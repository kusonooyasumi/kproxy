const http = require('http');
const https = require('https');
const url = require('url');
const net = require('net');
const tls = require('tls');
const httpProxy = require('http-proxy');
const CertificateGenerator = require('./certificate');
const { EventEmitter } = require('events');

class ProxyServer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = options.port || 8080;
    this.isRunning = false;
    this.certGenerator = new CertificateGenerator();
    this.httpServer = null;
    this.requestId = 1;
    this.certificatePath = null;
    this.certificateCache = new Map();
    this.customHeaders = options.customHeaders || {};
    
    // Add global unhandled error handling
    process.on('uncaughtException', (err) => {
      console.error('Uncaught Exception:', err);
      
      // Don't crash the application
    });
  }


  
  /**
   * Initialize the proxy server
   */
  initialize() {
    // Initialize CA certificate
    this.certificatePath = this.certGenerator.initializeCA();
    console.log('Proxy server initialized with CA certificate:', this.certificatePath);
  }

  /**
   * Start the proxy server
   */
  start() {
    if (this.isRunning) {
      console.log('Proxy server already running on port', this.port);
      return;
    }

    // Initialize CA certificate if not done already
    if (!this.certificatePath) {
      this.initialize();
    }

    // Create HTTP server to handle proxy requests
    this.httpServer = http.createServer();

    // Handle HTTP requests
    this.httpServer.on('request', this.handleHttpRequest.bind(this));

    // Handle HTTPS CONNECT requests
    this.httpServer.on('connect', this.handleHttpsConnect.bind(this));

    // Handle errors
    this.httpServer.on('error', (err) => {
      console.error('Proxy server error:', err);
      this.emit('error', err);
    });

    // Start listening
    this.httpServer.listen(this.port, () => {
      this.isRunning = true;
      console.log(`Proxy server started on port ${this.port}`);
      this.emit('started', { port: this.port });
    });
  }

  /**
   * Stop the proxy server
   */
  stop() {
    if (!this.isRunning || !this.httpServer) {
      console.log('Proxy server not running');
      return;
    }

    this.httpServer.close(() => {
      this.isRunning = false;
      console.log('Proxy server stopped');
      this.emit('stopped');
    });
  }

  /**
   * Handle HTTP requests
   * @param {http.IncomingMessage} req - The client request
   * @param {http.ServerResponse} res - The server response
   */
  handleHttpRequest(req, res) {
    const startTime = Date.now();
    const requestUrl = url.parse(req.url);
    const reqId = this.requestId++;

    // Create a proxy instance
    const proxy = httpProxy.createProxyServer({});

    // Add custom headers to the request
    if (Object.keys(this.customHeaders).length > 0) {
      // Create a copy of the original headers and add custom headers
      const modifiedHeaders = {...req.headers};
      Object.keys(this.customHeaders).forEach(headerName => {
        modifiedHeaders[headerName] = this.customHeaders[headerName];
      });
      req.headers = modifiedHeaders;
    }

    // Record request details
    const requestDetails = {
      id: reqId,
      host: requestUrl.hostname || '',
      method: req.method,
      path: requestUrl.path,
      query: requestUrl.query || '',
      headers: req.headers,
      timestamp: new Date().toISOString(),
      responseLength: 0,
      status: 0,
      responseTime: 0,
      protocol: 'http'
    };

    // Collect request body if present
    let requestBody = [];
    req.on('data', (chunk) => {
      requestBody.push(chunk);
    });
    
    req.on('end', () => {
      requestDetails.body = Buffer.concat(requestBody).toString();
      
      // Emit request started event
      this.emit('request', requestDetails);
    });

    // Capture response data
    let responseBody = [];
    
    // Handle proxy errors
    proxy.on('error', (err) => {
      console.error('Proxy error:', err);
      res.writeHead(500, {
        'Content-Type': 'text/plain'
      });
      res.end(`Proxy error: ${err.message}`);
      
      // Update request details with error
      requestDetails.status = 500;
      requestDetails.responseTime = Date.now() - startTime;
      requestDetails.error = err.message;
      
      // Emit response event
      this.emit('response', requestDetails);
    });

    // Capture the response
    proxy.on('proxyRes', (proxyRes, req, res) => {
      requestDetails.status = proxyRes.statusCode;
      requestDetails.responseHeaders = proxyRes.headers;
      
      proxyRes.on('data', (chunk) => {
        responseBody.push(chunk);
      });
      
      proxyRes.on('end', () => {
        try {
          const responseData = Buffer.concat(responseBody);
          requestDetails.responseBody = responseData.toString();
          requestDetails.responseLength = responseData.length;
          requestDetails.responseTime = Date.now() - startTime;
          
          // Emit response event
          this.emit('response', requestDetails);
        } catch (err) {
          console.error('Error processing response:', err);
        }
      });
    });

    // Forward the request
    proxy.web(req, res, {
      target: `http://${requestUrl.host}`,
      selfHandleResponse: false
    });
  }

  /**
   * Handle HTTPS CONNECT requests
   * @param {http.IncomingMessage} req - The client request
   * @param {net.Socket} clientSocket - The client socket
   * @param {Buffer} head - The first packet of the tunneling stream
   */
  handleHttpsConnect(req, clientSocket, head) {
    const startTime = Date.now();
    
    // Parse the target hostname and port from request
    const targetUrl = url.parse(`https://${req.url}`);
    const hostname = targetUrl.hostname;
    const port = targetUrl.port || 443;

    // Create request details object
    const requestDetails = {

      host: hostname,
      method: 'CONNECT',
      path: req.url,
      headers: req.headers,
      timestamp: new Date().toISOString(),
      responseLength: 0,
      status: 0,
      responseTime: 0,
      protocol: 'https'
    };
    
    // Emit request started event
    this.emit('request', requestDetails);

    // Generate or retrieve certificate for the domain
    this.getCertificateForDomain(hostname)
      .then(({ cert, key }) => {
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
          
          // Add custom headers to the HTTPS request
          if (Object.keys(this.customHeaders).length > 0) {
            // Create a copy of the original headers and add custom headers
            const modifiedHeaders = {...req.headers};
            Object.keys(this.customHeaders).forEach(headerName => {
              modifiedHeaders[headerName] = this.customHeaders[headerName];
            });
            req.headers = modifiedHeaders;
          }
          
          // Create request details for the actual HTTPS request
          const secureRequestDetails = {
            id: secureReqId,
            host: hostname,
            method: req.method,
            path: req.url,
            query: url.parse(req.url).query || '',
            headers: req.headers,
            timestamp: new Date().toISOString(),
            responseLength: 0,
            status: 0,
            responseTime: 0,
            protocol: 'https'
          };

          // Collect request body
          let requestBody = [];
          req.on('data', (chunk) => {
            requestBody.push(chunk);
          });
          
          req.on('end', () => {
            secureRequestDetails.body = Buffer.concat(requestBody).toString();
            
            // Emit request started event
            this.emit('request', secureRequestDetails);
          });

          // Create proxy for HTTPS request
          const proxy = httpProxy.createProxyServer({});
          
          // Capture response data
          let responseBody = [];
          
          // Handle proxy errors
          proxy.on('error', (err) => {
            console.error('HTTPS Proxy error:', err);
            res.writeHead(500, {
              'Content-Type': 'text/plain'
            });
            res.end(`Proxy error: ${err.message}`);
            
            // Update request details with error
            secureRequestDetails.status = 500;
            secureRequestDetails.responseTime = Date.now() - startTime;
            secureRequestDetails.error = err.message;
            
            // Emit response event
            this.emit('response', secureRequestDetails);
          });

          // Capture the response
          proxy.on('proxyRes', (proxyRes, req, res) => {
            secureRequestDetails.status = proxyRes.statusCode;
            secureRequestDetails.responseHeaders = proxyRes.headers;
            
            proxyRes.on('data', (chunk) => {
              responseBody.push(chunk);
            });
            
            proxyRes.on('end', () => {
              try {
                const responseData = Buffer.concat(responseBody);
                secureRequestDetails.responseBody = responseData.toString();
                secureRequestDetails.responseLength = responseData.length;
                secureRequestDetails.responseTime = Date.now() - startTime;
                
                // Emit response event
                this.emit('response', secureRequestDetails);
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
          requestDetails.status = 500;
          requestDetails.error = err.message;
          requestDetails.responseTime = Date.now() - startTime;
          
          // Emit response event
          this.emit('response', requestDetails);
        });

        // Handle upgrade event
        server.on('upgrade', (req, socket, head) => {
          // Handle WebSocket connections
          const targetHost = req.headers.host;
          const targetUrl = url.parse(`wss://${targetHost}`);
          
          // Create a connection to the target server
          const targetConnection = net.connect({
            host: targetUrl.hostname,
            port: targetUrl.port || 443
          }, () => {
            // Send 200 Connection established to the client
            socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
            
            // Connect the target and client sockets
            targetConnection.pipe(socket);
            socket.pipe(targetConnection);
          });
          
          targetConnection.on('error', (err) => {
            console.error('Target connection error:', err);
            socket.end();
          });
        });

        // Create server connection - temporary server for this connection
        const serverConnection = net.createServer((socket) => {
          // Connect the client socket to our HTTPS server
          server.emit('connection', socket);
          
          // Listen for data on the socket for debugging
          socket.on('data', (data) => {
            // Optional: Debug data flow
            // console.log('Socket data:', data.toString());
          });
        });

        // Listen on a random port
        serverConnection.listen(0, '127.0.0.1', () => {
          // Get the assigned port
          const serverAddress = serverConnection.address();
          
          // Respond to the client that the connection is established
          clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
          
          // Update connect request status
          requestDetails.status = 200;
          
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
            
            // Update request details on error
            requestDetails.error = err.message;
            requestDetails.responseTime = Date.now() - startTime;
            
            // Emit response event
            this.emit('response', requestDetails);
          });
        });
        
        serverConnection.on('error', (err) => {
          console.error('Server connection error:', err);
          clientSocket.end();
          
          // Update request details on error
          requestDetails.status = 500;
          requestDetails.error = err.message;
          requestDetails.responseTime = Date.now() - startTime;
          
          // Emit response event
          this.emit('response', requestDetails);
        });
      })
      .catch((err) => {
        console.error('Error handling CONNECT:', err);
        clientSocket.end();
        
        // Update request details on error
        requestDetails.status = 500;
        requestDetails.error = err.message;
        requestDetails.responseTime = Date.now() - startTime;
        
        // Emit response event
        this.emit('response', requestDetails);
      });
  }

  /**
   * Get or generate certificate for a domain
   * @param {string} domain - Domain to get certificate for
   * @returns {Promise<{key: string, cert: string}>} - Certificate and key
   */
  async getCertificateForDomain(domain) {
    // Check cache first
    if (this.certificateCache.has(domain)) {
      return this.certificateCache.get(domain);
    }
    
    // Generate new certificate
    const { privateKey, certificate } = this.certGenerator.generateServerCertificate(domain);
    
    // Cache certificate
    this.certificateCache.set(domain, { key: privateKey, cert: certificate });
    
    return { key: privateKey, cert: certificate };
  }

  /**
   * Get the status of the proxy server
   * @returns {Object} - Status object
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      certificatePath: this.certificatePath,
      customHeaders: this.customHeaders
    };
  }
  
  /**
   * Set custom headers to be added to each request
   * @param {Object} headers - Custom headers as key-value pairs
   */
  setCustomHeaders(headers) {
    this.customHeaders = headers || {};
    console.log('Custom headers set:', this.customHeaders);
  }

  /**
   * Get the CA certificate path for export
   * @returns {string} - Path to CA certificate
   */
  getCACertificatePath() {
    return this.certificatePath;
  }
}

module.exports = ProxyServer;
