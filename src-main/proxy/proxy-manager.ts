import { BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import ProxyServer from './proxy-server';
import { getCertificatePath, exportCertificate, getCertificateInstructions, ensureProxyDataDir } from './certificate';

// Types
export interface ProxyStatus {
  isRunning: boolean;
  port: number;
  certificatePath: string;
}

export interface ProxySettings {
  port: number;
  autoStart: boolean;
  customHeaders?: Record<string, string>;
  saveOnlyInScope: boolean;
}

export interface ScopeSettings {
  inScope: string[];
  outOfScope: string[];
}

export interface RequestDetails {
  id: number;
  host: string;
  method: string | undefined;
  path: string;
  query?: string;
  headers: any;
  timestamp: string;
  responseLength: number;
  status: number;
  responseTime: number;
  protocol: 'http' | 'https';
  body?: string;
  responseBody?: string;
  responseHeaders?: any;
  error?: string;
}

// Default values
const defaultSettings: ProxySettings = {
  port: 8080,
  autoStart: false,
  customHeaders: {},
  saveOnlyInScope: false
};

const defaultScopeSettings: ScopeSettings = {
  inScope: [''],
  outOfScope: ['']
};

class ProxyManager {
  private proxyStatus: ProxyStatus;
  private proxySettings: ProxySettings;
  private scopeSettings: ScopeSettings;
  private customHeaders: Record<string, string>;
  private proxyServer: ProxyServer;
  private eventHandlers: Record<string, Function[]>;
  
  // In-memory cache of recent requests
  private requestsCache: RequestDetails[];
  private maxRequestsCache: number;

  constructor() {
    this.proxyStatus = {
      isRunning: false,
      port: defaultSettings.port,
      certificatePath: getCertificatePath()
    };
    
    this.proxySettings = { ...defaultSettings };
    this.scopeSettings = { ...defaultScopeSettings };
    this.customHeaders = {};
    this.proxyServer = new ProxyServer();
    this.eventHandlers = {};
    
    // Initialize request cache
    this.requestsCache = [];
    this.maxRequestsCache = 1000;
    
    // Set up event listeners for the proxy server
    this.setupProxyListeners();
  }

  // Event handling methods
  on(event: string, callback: Function) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
    return this;
  }

  private emit(event: string, ...args: any[]) {
    const handlers = this.eventHandlers[event] || [];
    handlers.forEach(handler => handler(...args));
  }
  
  /**
   * Set up event listeners for the proxy server
   */
  private setupProxyListeners() {
    // Handle request events
    this.proxyServer.on('request', (requestDetails: RequestDetails) => {
      // Store request in memory cache (CONNECT requests are filtered in addRequestToCache)
      this.addRequestToCache(requestDetails);
      console.log('request logged');
      this.broadcastToRenderer('proxy-request', requestDetails);
      console.log('request sent');      
      // All requests are now broadcast in the addRequestToCache method
    });
    
    // Handle response events
    this.proxyServer.on('response', (responseDetails: RequestDetails) => {
      // Update request in memory cache (CONNECT requests are filtered in updateRequestInCache)
      this.updateRequestInCache(responseDetails);
      
      // Send to renderer process (don't send CONNECT responses)
      if (responseDetails.method !== 'CONNECT') {
        this.broadcastToRenderer('proxy-response', responseDetails);
      }
    });
    
    // Handle proxy start event
    this.proxyServer.on('started', (details: { port: number }) => {
      console.log(`Proxy started on port ${details.port}`);
      this.broadcastToRenderer('proxy-status', {
        isRunning: true,
        port: details.port
      });
    });
    
    // Handle proxy stop event
    this.proxyServer.on('stopped', () => {
      console.log('Proxy stopped');
      this.broadcastToRenderer('proxy-status', {
        isRunning: false
      });
    });
    
    // Handle proxy errors
    this.proxyServer.on('error', (error: Error) => {
      console.error('Proxy error:', error);
      this.broadcastToRenderer('proxy-error', {
        message: error.message
      });
    });
  }

  // Initialize proxy manager
  async initialize() {
    // Load saved settings and headers
    this.loadSettings();
    this.loadCustomHeaders();
    this.loadScopeSettings();
    
    // Auto-start proxy if configured
    if (this.proxySettings.autoStart) {
      try {
        await this.startProxy({ port: this.proxySettings.port });
      } catch (error) {
        console.error('Failed to auto-start proxy:', error);
      }
    }
  }

  // Save and load settings
  private saveSettings() {
    const proxyDataPath = ensureProxyDataDir();
    fs.writeFileSync(
      path.join(proxyDataPath, 'settings.json'),
      JSON.stringify(this.proxySettings, null, 2)
    );
  }

  private loadSettings() {
    const proxyDataPath = ensureProxyDataDir();
    const settingsPath = path.join(proxyDataPath, 'settings.json');
    
    if (fs.existsSync(settingsPath)) {
      try {
        const data = fs.readFileSync(settingsPath, 'utf-8');
        this.proxySettings = { ...defaultSettings, ...JSON.parse(data) };
      } catch (error) {
        console.error('Failed to load proxy settings:', error);
        this.proxySettings = { ...defaultSettings };
      }
    } else {
      this.proxySettings = { ...defaultSettings };
      this.saveSettings();
    }
    
    return this.proxySettings;
  }
  
  // Save and load scope settings
  private saveScopeSettings() {
    const proxyDataPath = ensureProxyDataDir();
    fs.writeFileSync(
      path.join(proxyDataPath, 'scope-settings.json'),
      JSON.stringify(this.scopeSettings, null, 2)
    );
  }

  private loadScopeSettings() {
    const proxyDataPath = ensureProxyDataDir();
    const settingsPath = path.join(proxyDataPath, 'scope-settings.json');
    
    if (fs.existsSync(settingsPath)) {
      try {
        const data = fs.readFileSync(settingsPath, 'utf-8');
        this.scopeSettings = { ...defaultScopeSettings, ...JSON.parse(data) };
      } catch (error) {
        console.error('Failed to load scope settings:', error);
        this.scopeSettings = { ...defaultScopeSettings };
      }
    } else {
      this.scopeSettings = { ...defaultScopeSettings };
      this.saveScopeSettings();
    }
    
    return this.scopeSettings;
  }

  // Save and load custom headers
  private saveCustomHeaders() {
    const proxyDataPath = ensureProxyDataDir();
    fs.writeFileSync(
      path.join(proxyDataPath, 'custom-headers.json'),
      JSON.stringify(this.customHeaders, null, 2)
    );
  }

  private loadCustomHeaders() {
    const proxyDataPath = ensureProxyDataDir();
    const headersPath = path.join(proxyDataPath, 'custom-headers.json');
    
    if (fs.existsSync(headersPath)) {
      try {
        const data = fs.readFileSync(headersPath, 'utf-8');
        this.customHeaders = JSON.parse(data);
      } catch (error) {
        console.error('Failed to load custom headers:', error);
        this.customHeaders = {};
      }
    } else {
      this.customHeaders = {};
      this.saveCustomHeaders();
    }
    
    return this.customHeaders;
  }

  // Start and stop proxy
  async startProxy(settings: { port: number }) {
    if (this.proxyServer.checkIfRunning()) {
      return this.proxyStatus;
    }
    
    try {
      const port = settings.port || this.proxySettings.port;
      
    // Set custom headers for the proxy server
    this.proxyServer.setCustomHeaders(this.customHeaders);
    
    // Enable SSL interception to capture all HTTPS requests
    this.proxyServer.setSslInterception(true);
    
    // Set scope related settings
    this.proxyServer.setSaveOnlyInScope(this.proxySettings.saveOnlyInScope);
    this.proxyServer.setScopeSettings(this.scopeSettings);
      
      // Start the proxy server
      await this.proxyServer.start(port);
      
      // Update status
      this.proxyStatus = {
        isRunning: true,
        port,
        certificatePath: getCertificatePath()
      };
      
      // Notify about the status change
      this.emit('status-change', this.proxyStatus);
      
      // Notify all renderer processes
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('proxy-status', this.proxyStatus);
      });
      
      return this.proxyStatus;
    } catch (error) {
      console.error('Failed to start proxy:', error);
      
      // Notify all renderer processes about the error
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('proxy-error', { message: (error as Error).message });
      });
      
      throw error;
    }
  }

  async stopProxy() {
    if (!this.proxyServer.checkIfRunning()) {
      return this.proxyStatus;
    }
    
    try {
      // Stop the proxy server
      await this.proxyServer.stop();
      
      // Update status
      this.proxyStatus = {
        isRunning: false,
        port: this.proxySettings.port,
        certificatePath: getCertificatePath()
      };
      
      // Notify about the status change
      this.emit('status-change', this.proxyStatus);
      
      // Notify all renderer processes
      BrowserWindow.getAllWindows().forEach(window => {
        window.webContents.send('proxy-status', this.proxyStatus);
      });
      
      return this.proxyStatus;
    } catch (error) {
      console.error('Failed to stop proxy:', error);
      throw error;
    }
  }

  // Update settings
  async updateSettings(settings: Partial<ProxySettings>) {
    const needRestart = this.proxyStatus.isRunning && 
                        settings.port !== undefined && 
                        settings.port !== this.proxySettings.port;

    // Update saveOnlyInScope if changed
    if (settings.saveOnlyInScope !== undefined) {
      this.proxyServer.setSaveOnlyInScope(settings.saveOnlyInScope);
    }
    
    // Update settings
    this.proxySettings = { ...this.proxySettings, ...settings };
    this.saveSettings();
    
    // Restart proxy if needed
    if (needRestart) {
      await this.stopProxy();
      await this.startProxy({ port: this.proxySettings.port });
    }
    
    return this.proxySettings;
  }

  // Update custom headers
  updateCustomHeaders(headers: Record<string, string>) {
    this.customHeaders = headers;
    this.saveCustomHeaders();
    
    // Update the proxy server's headers if it's running
    if (this.proxyServer.checkIfRunning()) {
      this.proxyServer.setCustomHeaders(this.customHeaders);
    }
    
    return this.customHeaders;
  }

  // Get proxy status
  getStatus() {
    return this.proxyStatus;
  }

  // Get proxy settings
  getSettings() {
    return this.proxySettings;
  }

  // Get custom headers
  getCustomHeaders() {
    return this.customHeaders;
  }

  /**
   * Add a request to the memory cache
   * @param {RequestDetails} request - Request details
   */
  private addRequestToCache(request: RequestDetails) {
    // Skip CONNECT method requests specifically
    if (request.method === 'CONNECT') {
      return;
    }
    
    // Add to in-memory cache
    this.requestsCache.unshift(request);
    
    // Limit the number of requests in memory
    if (this.requestsCache.length > this.maxRequestsCache) {
      this.requestsCache = this.requestsCache.slice(0, this.maxRequestsCache);
    }
  }

  /**
   * Update a request in the memory cache with response details
   * @param {RequestDetails} response - Response details
   */
  private updateRequestInCache(response: RequestDetails) {
    // Skip CONNECT method requests
    if (response.method === 'CONNECT') {
      return;
    }
    
    // Find the request by ID
    const index = this.requestsCache.findIndex(req => req.id === response.id);
    
    if (index !== -1) {
      // Update with response details
      this.requestsCache[index] = { ...this.requestsCache[index], ...response };
    }
  }

  /**
   * Broadcast a message to all renderer processes
   * @param {string} channel - IPC channel name
   * @param {any} data - Data to send
   */
  private broadcastToRenderer(channel: string, data: any) {
    // Get all windows
    const windows = BrowserWindow.getAllWindows();
    
    console.log(`Broadcasting ${channel} to ${windows.length} windows, data ID: ${data.id || 'no-id'}`);
    
    // Send the message to all windows
    for (const win of windows) {
      if (!win.isDestroyed()) {
        try {
          win.webContents.send(channel, data);
          console.log(`Sent ${channel} to window ${win.id}`);
        } catch (error) {
          console.error(`Failed to send ${channel} to window ${win.id}:`, error);
        }
      }
    }
  }

  // Register IPC handlers
  registerIpcHandlers() {
    // Get proxy status
    ipcMain.handle('proxy:getStatus', () => {
      return this.getStatus();
    });
    
    // Get proxy settings
    ipcMain.handle('proxy:getSettings', () => {
      return this.getSettings();
    });
    
    // Start proxy
    ipcMain.handle('proxy:start', async (event, settings) => {
      return await this.startProxy(settings);
    });
    
    // Stop proxy
    ipcMain.handle('proxy:stop', async () => {
      return await this.stopProxy();
    });
    
    // Update settings
    ipcMain.handle('proxy:updateSettings', async (event, settings) => {
      return await this.updateSettings(settings);
    });
    
    // Export certificate
    ipcMain.handle('proxy:exportCertificate', async () => {
      return await exportCertificate();
    });
    
    // Export CA certificate to user-specified location
    ipcMain.handle('proxy:exportCaCertificate', async () => {
      try {
        const certPath = getCertificatePath();
        if (!certPath) {
          throw new Error('CA certificate not initialized');
        }
        
        // Ask user where to save certificate
        const { canceled, filePath } = await dialog.showSaveDialog({
          title: 'Export CA Certificate',
          defaultPath: 'kproxy-ca.crt',
          filters: [
            { name: 'Certificates', extensions: ['crt', 'pem'] }
          ]
        });
        
        if (canceled || !filePath) {
          return { success: false, canceled: true };
        }
        
        // Copy certificate to selected location
        fs.copyFileSync(certPath, filePath);
        
        return { 
          success: true, 
          certPath: filePath,
          message: 'Certificate exported successfully. Install it in your browser\'s certificate store.'
        };
      } catch (error) {
        console.error('Error exporting certificate:', error);
        return { 
          success: false, 
          error: (error as Error).message
        };
      }
    });
    
    // Get certificate instructions
    ipcMain.handle('proxy:getCertificateInstructions', () => {
      return getCertificateInstructions();
    });
    
    // Get custom headers
    ipcMain.handle('proxy:getCustomHeaders', () => {
      return this.getCustomHeaders();
    });
    
    // Update custom headers
    ipcMain.handle('proxy:updateCustomHeaders', (event, headers) => {
      return this.updateCustomHeaders(headers);
    });
    
    // Get all requests
    ipcMain.handle('proxy:getRequests', () => {
      return this.requestsCache;
    });
    
    // Clear requests
    ipcMain.handle('proxy:clearRequests', () => {
      this.requestsCache = [];
      return { success: true };
    });
    
    // Get scope settings
    ipcMain.handle('proxy:getScopeSettings', () => {
      return this.scopeSettings;
    });
    
    // Save scope settings
    ipcMain.handle('proxy:saveScopeSettings', (event, settings: ScopeSettings) => {
      this.scopeSettings = settings;
      this.saveScopeSettings();
      return { success: true };
    });
  }
}

export default ProxyManager;
