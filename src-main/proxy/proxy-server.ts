import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { Duplex } from 'node:stream';
import { promisify } from 'node:util';
import { EventEmitter } from 'node:events';
import { URL } from 'node:url';
import zlib from 'node:zlib';
import { CertificateGenerator, generateServerCertificate } from './certificate';
import httpProxy from 'http-proxy';

// Promisify zlib functions
const gunzipAsync = promisify(zlib.gunzip);
const inflateAsync = promisify(zlib.inflate);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);

/**
 * Helper function to decompress response data based on Content-Encoding header
 */
async function decompressResponse(
  data: Buffer, 
  contentEncoding: string | undefined
): Promise<Buffer> {
  if (!contentEncoding) {
    return data;
  }

  try {
    const encoding = contentEncoding.toLowerCase();
    
    if (encoding.includes('br')) {
      // Brotli decompression
      return await brotliDecompressAsync(data);
    } else if (encoding.includes('gzip')) {
      // Gzip decompression
      return await gunzipAsync(data);
    } else if (encoding.includes('deflate')) {
      // Deflate decompression
      return await inflateAsync(data);
    }
    
    // If no matching encoding or unsupported encoding, return as is
    return data;
  } catch (error) {
    console.error(`Decompression error (${contentEncoding}):`, error);
    // Return original data if decompression fails
    return data;
  }
}

// Interface for request details
interface RequestDetails {
  id: number;
  host: string;
  method: string | undefined;
  path: string;
  query?: string;
  headers: http.IncomingHttpHeaders;
  timestamp: string;
  responseLength: number;
  status: number;
  responseTime: number;
  protocol: 'http' | 'https';
  body?: string;
  responseBody?: string;
  responseHeaders?: http.IncomingHttpHeaders;
  error?: string;
}

// Advanced HTTP proxy implementation with SSL/TLS interception and event emitting
class ProxyServer extends EventEmitter {
  private server: http.Server | null = null;
  private customHeaders: Record<string, string> = {};
  private sslInterception: boolean = false;
  private httpsServers: Map<string, https.Server> = new Map();
  private requestId: number = 1;
  private certificateCache: Map<string, { key: string; cert: string }> = new Map();
  private certGenerator: CertificateGenerator;
  private port: number = 8080;
  private isRunning: boolean = false;
  private certificatePath: string | null = null;
  private activeConnections: Set<net.Socket> = new Set();
  private saveOnlyInScope: boolean = false;
  private scopeSettings: { inScope: string[]; outOfScope: string[] } | null = null;

  constructor(options?: { 
    sslInterception?: boolean; 
    port?: number; 
    customHeaders?: Record<string, string>;
    saveOnlyInScope?: boolean;
    scopeSettings?: { inScope: string[]; outOfScope: string[] }
  }) {
    super();
    this.server = null;
    this.sslInterception = options?.sslInterception || false;
    this.port = options?.port || 8080;
    this.customHeaders = options?.customHeaders || {};
    this.saveOnlyInScope = options?.saveOnlyInScope || false;
    this.scopeSettings = options?.scopeSettings || null;
    this.certGenerator = new CertificateGenerator();
    
    // Add global unhandled error handling
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      // Don't crash the application
    });
  }

  /**
   * Initialize the proxy server
   */
  initialize(): void {
    // Initialize CA certificate
    this.certificatePath = this.certGenerator.initializeCA();
    console.log('Proxy server initialized with CA certificate:', this.certificatePath);
  }

  /**
   * Enable or disable SSL interception
   */
  setSslInterception(enabled: boolean): void {
    this.sslInterception = enabled;
    console.log(`SSL interception ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set custom headers to be added to each request
   */
  setCustomHeaders(headers: Record<string, string>): void {
    this.customHeaders = headers;
    console.log('Custom headers set:', this.customHeaders);
  }

  /**
   * Set whether to only save in-scope items
   */
  setSaveOnlyInScope(enabled: boolean): void {
    this.saveOnlyInScope = enabled;
    console.log(`Save only in-scope items ${enabled ? 'enabled' : 'disabled'}`);
    if (enabled && this.scopeSettings) {
      console.log('Current scope settings:', this.scopeSettings);
    }
  }

  /**
   * Set scope settings
   */
  setScopeSettings(settings: { inScope: string[]; outOfScope: string[] }): void {
    this.scopeSettings = settings;
    console.log('Scope settings updated:', settings);
  }

  /**
   * Check if a host is in scope
   */
  private isInScope(host: string): boolean {
    if (!this.scopeSettings) {
      // If no scope settings, consider everything in scope
      return true;
    }

    // Check out-of-scope first (explicit exclusions take precedence)
    for (const pattern of this.scopeSettings.outOfScope) {
      if (this.matchesPattern(host, pattern)) {
        return false;
      }
    }

    // Check in-scope patterns
    for (const pattern of this.scopeSettings.inScope) {
      if (this.matchesPattern(host, pattern)) {
        return true;
      }
    }

    // If no in-scope patterns match, consider out of scope
    return false;
  }

  /**
   * Check if host matches a scope pattern (supports wildcards)
   */
  private matchesPattern(host: string, pattern: string): boolean {
    // Simple exact match
    if (pattern === host) {
      return true;
    }

    // Wildcard match (e.g. *.example.com)
    if (pattern.startsWith('*.')) {
      const domain = pattern.substring(2);
      return host.endsWith(domain) || 
             host === domain.substring(1); // Also match example.com for *.example.com
    }

    return false;
  }

  /**
   * Create the proxy server
   */
  createServer(port: number): http.Server {
    const server = http.createServer();
    
    // Handle HTTP requests
    server.on('request', this.handleHttpRequest.bind(this));
    
    // Handle HTTPS CONNECT requests
    server.on('connect', this.handleHttpsConnect.bind(this));
    
    // Handle errors
    server.on('error', (err) => {
      console.error('Proxy server error:', err);
      this.emit('error', err);
    });
    
    // Track connections for proper cleanup
    server.on('connection', (socket: net.Socket) => {
      this.activeConnections.add(socket);
      socket.on('close', () => {
        this.activeConnections.delete(socket);
      });
    });
    
    this.port = port;
    return server;
  }

  /**
   * Handle HTTP requests
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    const startTime = Date.now();
    const reqUrl = new URL(req.url || '', `http://${req.headers.host}`);
    const reqId = this.requestId++;

    // Create a proxy instance
    const proxy = httpProxy.createProxyServer({});

    // Add custom headers to the request
    if (Object.keys(this.customHeaders).length > 0) {
      // Create a copy of the original headers and add custom headers
      const modifiedHeaders = {...req.headers};
      Object.keys(this.customHeaders).forEach(headerName => {
        modifiedHeaders[headerName.toLowerCase()] = this.customHeaders[headerName];
      });
      req.headers = modifiedHeaders;
    }

    // Record request details
    const requestDetails: RequestDetails = {
      id: reqId,
      host: reqUrl.hostname || '',
      method: req.method,
      path: reqUrl.pathname + reqUrl.search,
      query: reqUrl.search || '',
      headers: req.headers,
      timestamp: new Date().toISOString(),
      responseLength: 0,
      status: 0,
      responseTime: 0,
      protocol: 'http'
    };

    // Collect request body if present
    let requestBody: Buffer[] = [];
    req.on('data', (chunk) => {
      requestBody.push(chunk);
    });
    
    req.on('end', () => {
      try {
        requestDetails.body = Buffer.concat(requestBody).toString();
      } catch (error) {
        console.error('Error collecting request body:', error);
      }
      
          // Only emit request if we're saving all or it's in scope
          if (!this.saveOnlyInScope || this.isInScope(requestDetails.host)) {
            this.emit('request', requestDetails);
          }
    });

    // Capture response data
    let responseBody: Buffer[] = [];
    
    // Handle proxy errors
    proxy.on('error', (err) => {
      console.error('Proxy error:', err);
      if (!res.headersSent) {
        res.writeHead(500, {
          'Content-Type': 'text/plain'
        });
        res.end(`Proxy error: ${err.message}`);
      }
      
      // Update request details with error
      requestDetails.status = 500;
      requestDetails.responseTime = Date.now() - startTime;
      requestDetails.error = err.message;
      
          // Only emit response if we're saving all or it's in scope
          if (!this.saveOnlyInScope || this.isInScope(requestDetails.host)) {
            this.emit('response', requestDetails);
          }
    });

    // Capture the response
    proxy.on('proxyRes', (proxyRes, req, res) => {
      requestDetails.status = proxyRes.statusCode || 0;
      requestDetails.responseHeaders = proxyRes.headers;
      
      proxyRes.on('data', (chunk) => {
        responseBody.push(chunk);
      });
      
      proxyRes.on('end', async () => {
        try {
          const responseData = Buffer.concat(responseBody);
          
          // Decompress the response if it's compressed
          const contentEncoding = proxyRes.headers['content-encoding'];
          const decompressedData = await decompressResponse(responseData, contentEncoding);
          
          requestDetails.responseBody = decompressedData.toString();
          requestDetails.responseLength = responseData.length; // Keep original length for metrics
          requestDetails.responseTime = Date.now() - startTime;
          
          // Only emit response if we're saving all or it's in scope
          if (!this.saveOnlyInScope || this.isInScope(requestDetails.host)) {
            this.emit('response', requestDetails);
          }
        } catch (err) {
          console.error('Error processing response:', err);
        }
      });
    });

    // Forward the request
    proxy.web(req, res, {
      target: `http://${reqUrl.host}`,
      selfHandleResponse: false
    });
  }

  /**
   * Handle HTTPS CONNECT requests
   */
  private handleHttpsConnect(req: http.IncomingMessage, clientSocket: Duplex, head: Buffer): void {
    const startTime = Date.now();
    
    // Parse the target hostname and port from request
    const [hostname, port] = (req.url || '').split(':');
    const targetPort = parseInt(port) || 443;
    
    // Create request details object for the CONNECT request itself
    const connectRequestDetails: RequestDetails = {
      id: 0,
      host: hostname,
      method: 'CONNECT',
      path: req.url || '',
      headers: req.headers,
      timestamp: new Date().toISOString(),
      responseLength: 0,
      status: 0,
      responseTime: 0,
      protocol: 'https'
    };

    
    // Always intercept SSL/TLS if interception is enabled
    if (!this.sslInterception) {
      // Direct tunnel without interception
      this.createDirectTunnel(hostname, targetPort, clientSocket, head, connectRequestDetails, startTime);
    } else {
      // SSL/TLS interception
      this.interceptSsl(hostname, targetPort, clientSocket, head, connectRequestDetails, startTime);
    }
  }

  /**
   * Create a direct tunnel for HTTPS requests (no interception)
   */
  private createDirectTunnel(
    hostname: string, 
    port: number, 
    clientSocket: Duplex, 
    head: Buffer,
    requestDetails: RequestDetails,
    startTime: number
  ): void {
    // Connect to the target server
    const serverSocket = net.connect(port, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      serverSocket.write(head);
      
      // Update request details
      requestDetails.status = 200;
      requestDetails.responseTime = Date.now() - startTime;
      
      // Emit response event for the CONNECT request
      this.emit('response', requestDetails);
      
      // Bidirectional data transfer
      serverSocket.pipe(clientSocket);
      clientSocket.pipe(serverSocket);
      
      serverSocket.on('error', (err) => {
        console.error('Target server socket error:', err);
        clientSocket.destroy();
      });
      
      clientSocket.on('error', (err) => {
        console.error('Client socket error:', err);
        serverSocket.destroy();
      });
    });
    
    serverSocket.on('error', (error) => {
      console.error('HTTPS proxy error:', error);
      clientSocket.end();
      
      // Update request details with error
      requestDetails.status = 500;
      requestDetails.error = error.message;
      requestDetails.responseTime = Date.now() - startTime;
      
      // Emit response event
      this.emit('response', requestDetails);
    });
  }

  /**
   * Get or generate certificate for a domain
   */
  private async getCertificateForDomain(domain: string): Promise<{ key: string; cert: string }> {
    // Check cache first
    if (this.certificateCache.has(domain)) {
      return this.certificateCache.get(domain)!;
    }
    
    // Generate new certificate
    const { privateKey, certificate } = this.certGenerator.generateServerCertificate(domain);
    
    // Cache certificate
    this.certificateCache.set(domain, { key: privateKey, cert: certificate });
    
    return { key: privateKey, cert: certificate };
  }

  /**
   * Intercept SSL/TLS connection
   */
  private interceptSsl(
    hostname: string, 
    port: number, 
    clientSocket: Duplex, 
    head: Buffer,
    connectRequestDetails: RequestDetails,
    startTime: number
  ): void {
    // Generate or retrieve certificate for the domain
    this.getCertificateForDomain(hostname)
      .then(({ key, cert }) => {
        // Create HTTPS server for this connection
        const server = https.createServer({
          key: key,
          cert: cert,
          // Add options for self-signed certificates
          requestCert: false,
          rejectUnauthorized: false
        });

        // Handle request on HTTPS server
        server.on('request', (req, res) => {
          const secureReqId = this.requestId++;
          const secureStartTime = Date.now();
          
          // Add custom headers to the HTTPS request
          if (Object.keys(this.customHeaders).length > 0) {
            // Create a copy of the original headers and add custom headers
            const modifiedHeaders = {...req.headers};
            Object.keys(this.customHeaders).forEach(headerName => {
              modifiedHeaders[headerName.toLowerCase()] = this.customHeaders[headerName];
            });
            req.headers = modifiedHeaders;
          }
          
          // Create full URL from request
          const urlPath = req.url || '/';
          const fullUrl = new URL(urlPath, `https://${hostname}`);
          
          // Create request details for the actual HTTPS request
          const secureRequestDetails: RequestDetails = {
            id: secureReqId,
            host: hostname,
            method: req.method,
            path: urlPath,
            query: fullUrl.search || '',
            headers: req.headers,
            timestamp: new Date().toISOString(),
            responseLength: 0,
            status: 0,
            responseTime: 0,
            protocol: 'https'
          };

          // Collect request body
          let requestBody: Buffer[] = [];
          req.on('data', (chunk) => {
            requestBody.push(chunk);
          });
          
          req.on('end', () => {
            try {
              if (requestBody.length > 0) {
                secureRequestDetails.body = Buffer.concat(requestBody).toString();
              }
            } catch (error) {
              console.error('Error collecting HTTPS request body:', error);
            }
            
          // Only emit request if we're saving all or it's in scope
          if (!this.saveOnlyInScope || this.isInScope(secureRequestDetails.host)) {
            this.emit('request', secureRequestDetails);
          }
          });

          // Create proxy for HTTPS request
          const proxy = httpProxy.createProxyServer({});
          
          // Capture response data
          let responseBody: Buffer[] = [];
          
          // Handle proxy errors
          proxy.on('error', (err) => {
            console.error('HTTPS Proxy error:', err);
            if (!res.headersSent) {
              res.writeHead(500, {
                'Content-Type': 'text/plain'
              });
              res.end(`Proxy error: ${err.message}`);
            }
            
            // Update request details with error
            secureRequestDetails.status = 500;
            secureRequestDetails.responseTime = Date.now() - secureStartTime;
            secureRequestDetails.error = err.message;
            
          // Only emit response if we're saving all or it's in scope
          if (!this.saveOnlyInScope || this.isInScope(secureRequestDetails.host)) {
            this.emit('response', secureRequestDetails);
          }
          });

          // Capture the response
          proxy.on('proxyRes', (proxyRes, req, res) => {
            secureRequestDetails.status = proxyRes.statusCode || 0;
            secureRequestDetails.responseHeaders = proxyRes.headers;
            
            proxyRes.on('data', (chunk) => {
              responseBody.push(chunk);
            });
            
            proxyRes.on('end', async () => {
              try {
                if (responseBody.length > 0) {
                  const responseData = Buffer.concat(responseBody);
                  
                  // Decompress the response if it's compressed
                  const contentEncoding = proxyRes.headers['content-encoding'];
                  const decompressedData = await decompressResponse(responseData, contentEncoding);
                  
                  secureRequestDetails.responseBody = decompressedData.toString();
                  secureRequestDetails.responseLength = responseData.length; // Keep original length for metrics
                }
                secureRequestDetails.responseTime = Date.now() - secureStartTime;
                
                // Only emit response if we're saving all or it's in scope
                if (!this.saveOnlyInScope || this.isInScope(secureRequestDetails.host)) {
                  this.emit('response', secureRequestDetails);
                }
              } catch (err) {
                console.error('Error processing HTTPS response:', err);
              }
            });
          });

          // Forward the request
          proxy.web(req, res, {
            target: `https://${hostname}:${port}`,
            secure: false, // Don't validate SSL cert
            selfHandleResponse: false
          });
        });

        // Handle errors on the HTTPS server
        server.on('error', (err) => {
          console.error('HTTPS server error:', err);
          clientSocket.end();
          
          // Update original connect request status
          connectRequestDetails.status = 500;
          connectRequestDetails.error = err.message;
          connectRequestDetails.responseTime = Date.now() - startTime;
          
          // Emit response event for the CONNECT request
          this.emit('response', connectRequestDetails);
        });

        // Handle upgrade event for WebSockets
        server.on('upgrade', (req, socket, head) => {
          const wsReqId = this.requestId++;
          const wsStartTime = Date.now();
          
          // Create request details for the WebSocket upgrade
          const wsRequestDetails: RequestDetails = {
            id: wsReqId,
            host: hostname,
            method: 'WEBSOCKET',
            path: req.url || '',
            headers: req.headers,
            timestamp: new Date().toISOString(),
            responseLength: 0,
            status: 0,
            responseTime: 0,
            protocol: 'https'
          };
          
          // Only emit request if we're saving all or it's in scope
          if (!this.saveOnlyInScope || this.isInScope(wsRequestDetails.host)) {
            this.emit('request', wsRequestDetails);
          }
          
          // Handle WebSocket connections
          const targetHost = req.headers.host || hostname;
          let targetHostname = targetHost;
          let targetPort = 443;
          
          // Parse host:port format if present
          if (targetHost.includes(':')) {
            const parts = targetHost.split(':');
            targetHostname = parts[0];
            targetPort = parseInt(parts[1]) || 443;
          }
          
          // Create a connection to the target server
          const targetConnection = net.connect({
            host: targetHostname,
            port: targetPort
          }, () => {
            // Send WebSocket handshake
            socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
                        'Upgrade: websocket\r\n' +
                        'Connection: Upgrade\r\n\r\n');
            
            // Update WebSocket request details
            wsRequestDetails.status = 101;
            wsRequestDetails.responseTime = Date.now() - wsStartTime;
            
          // Only emit response if we're saving all or it's in scope
          if (!this.saveOnlyInScope || this.isInScope(wsRequestDetails.host)) {
            this.emit('response', wsRequestDetails);
          }
            
            // Connect the target and client sockets
            targetConnection.pipe(socket);
            socket.pipe(targetConnection);
          });
          
          targetConnection.on('error', (err) => {
            console.error('WebSocket target connection error:', err);
            socket.end();
            
            // Update WebSocket request details with error
            wsRequestDetails.status = 500;
            wsRequestDetails.error = err.message;
            wsRequestDetails.responseTime = Date.now() - wsStartTime;
            
            // Emit response event for WebSocket error
            this.emit('response', wsRequestDetails);
          });
        });

        // Create server connection - temporary server for this connection
        const serverConnection = net.createServer((socket) => {
          // Connect the client socket to our HTTPS server
          server.emit('connection', socket);
        });

        // Listen on a random port
        serverConnection.listen(0, '127.0.0.1', () => {
          // Get the assigned port
          const serverAddress = serverConnection.address() as net.AddressInfo;
          
          // Respond to the client that the connection is established
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          
          // Update connect request status
          connectRequestDetails.status = 200;
          connectRequestDetails.responseTime = Date.now() - startTime;
          
          // Emit response event for the CONNECT request
          this.emit('response', connectRequestDetails);
          
          // Create connection from client to our local HTTPS server
          const clientConnection = net.connect({
            host: '127.0.0.1',
            port: serverAddress.port
          }, () => {
            // Connect the client socket to our proxy socket
            clientConnection.pipe(clientSocket);
            clientSocket.pipe(clientConnection);
          });
          
          clientConnection.on('error', (err) => {
            console.error('Client connection error:', err);
            clientSocket.end();
            
            // We already sent a 200 response for the CONNECT, so we don't update it here
          });
        });
        
        serverConnection.on('error', (err) => {
          console.error('Server connection error:', err);
          clientSocket.end();
          
          // Update request details on error
          connectRequestDetails.status = 500;
          connectRequestDetails.error = err.message;
          connectRequestDetails.responseTime = Date.now() - startTime;
          
          // Emit response event
          this.emit('response', connectRequestDetails);
        });
        
        // Store the server in the map for later cleanup
        this.httpsServers.set(hostname, server);
      })
      .catch((err) => {
        console.error('Error handling CONNECT:', err);
        clientSocket.end();
        
        // Update request details on error
        connectRequestDetails.status = 500;
        connectRequestDetails.error = err.message;
        connectRequestDetails.responseTime = Date.now() - startTime;
        
        // Emit response event
        this.emit('response', connectRequestDetails);
      });
  }

  /**
   * Start the proxy server
   */
  async start(port?: number): Promise<void> {
    if (this.isRunning) {
      console.log('Proxy server already running on port', this.port);
      return;
    }

    // Initialize CA certificate if not done already
    if (!this.certificatePath) {
      this.initialize();
    }

    const serverPort = port || this.port;
    this.server = this.createServer(serverPort);
    
    // Use a promise wrapper for server.listen
    return new Promise<void>((resolve, reject) => {
      this.server!.listen(serverPort, () => {
        this.isRunning = true;
        this.port = serverPort;
        console.log(`Proxy server started on port ${serverPort}`);
        this.emit('started', { port: serverPort });
        resolve();
      }).on('error', (err) => {
        reject(err);
      });
    });
  }



  /**
   * Get the status of the proxy server
   */
  getStatus(): Record<string, any> {
    return {
      isRunning: this.isRunning,
      port: this.port,
      certificatePath: this.certificatePath,
      customHeaders: this.customHeaders,
      sslInterception: this.sslInterception,
      saveOnlyInScope: this.saveOnlyInScope
    };
  }

  /**
   * Get the CA certificate path for export
   */
  getCACertificatePath(): string | null {
    return this.certificatePath;
  }

  /**
   * Check if server is running
   */
  checkIfRunning(): boolean {
    return this.server !== null && this.isRunning;
  }

  /**
   * Stop the proxy server
   */
  stop(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.isRunning || !this.server) {
        console.log('Proxy server not running');
        resolve();
        return;
      }

      // Set a timeout for forced termination (3 seconds)
      const forceTimeout = setTimeout(() => {
        console.log('Force stopping proxy server after timeout');
        this.forceCloseAllConnections();
        this.isRunning = false;
        this.emit('stopped');
        resolve();
      }, 3000);

      // Close the main HTTP server
      this.server.close(() => {
        clearTimeout(forceTimeout);
        
        // Close any HTTPS servers created for SSL interception
        if (this.httpsServers.size > 0) {
          // Close all HTTPS servers
          for (const [hostname, server] of this.httpsServers.entries()) {
            server.close();
          }
          this.httpsServers.clear();
        }

        this.isRunning = false;
        console.log('Proxy server stopped gracefully');
        this.emit('stopped');
        resolve();
      }).on('error', (err) => {
        clearTimeout(forceTimeout);
        console.error('Error stopping proxy server:', err);
        reject(err);
      });
    });
  }

  /**
   * Force close all active connections
   */
  private forceCloseAllConnections(): void {
    console.log(`Force closing ${this.activeConnections.size} active connections`);
    // Destroy all tracked sockets
    for (const socket of this.activeConnections) {
      socket.destroy();
    }
    this.activeConnections.clear();
    
    // Forcefully close HTTPS servers
    for (const [hostname, server] of this.httpsServers.entries()) {
      server.close();
    }
    this.httpsServers.clear();
  }
}

export default ProxyServer;
