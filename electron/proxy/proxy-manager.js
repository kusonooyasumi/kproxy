const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const ProxyServer = require('./proxy-server');
const Store = require('electron-store');

class ProxyManager {
  constructor() {
    this.proxyServer = new ProxyServer();
    
    // Create a data store for requests
    this.store = new Store({
      name: 'kproxy-data',
      defaults: {
        requests: [],
        proxySettings: {
          port: 8080,
          autoStart: false
        },
        scopeSettings: {
          inScope: ['example.com', '*.example.org'],
          outOfScope: ['admin.example.com']
        }
      }
    });
    
    // In-memory cache of recent requests
    this.requestsCache = [];
    
    // Maximum number of requests to store in memory
    this.maxRequestsCache = 1000;
    
    // Set up event listeners for the proxy server
    this.setupProxyListeners();
    
    // Initialize IPC handlers
    this.setupIpcHandlers();
  }

  /**
   * Initialize the proxy server
   */
  initialize() {
    this.proxyServer.initialize();
    
    // Auto-start proxy if configured
    const proxySettings = this.store.get('proxySettings');
    if (proxySettings.autoStart) {
      this.proxyServer.port = proxySettings.port;
      this.startProxy();
    }
  }

  /**
   * Set up event listeners for the proxy server
   */
  setupProxyListeners() {
    // Handle request events
    this.proxyServer.on('request', (requestDetails) => {
      // Store request in memory cache (CONNECT requests are filtered in addRequestToCache)
      this.addRequestToCache(requestDetails);
      
      // Send to renderer process (don't send CONNECT requests)
      if (requestDetails.method !== 'CONNECT') {
        this.broadcastToRenderer('proxy-request', requestDetails);
      }
    });
    
    // Handle response events
    this.proxyServer.on('response', (responseDetails) => {
      // Update request in memory cache (CONNECT requests are filtered in updateRequestInCache)
      this.updateRequestInCache(responseDetails);
      
      // Send to renderer process (don't send CONNECT responses)
      if (responseDetails.method !== 'CONNECT') {
        this.broadcastToRenderer('proxy-response', responseDetails);
      }
    });
    
    // Handle proxy start event
    this.proxyServer.on('started', (details) => {
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
    this.proxyServer.on('error', (error) => {
      console.error('Proxy error:', error);
      this.broadcastToRenderer('proxy-error', {
        message: error.message
      });
    });
  }

  /**
   * Set up IPC handlers
   */
  setupIpcHandlers() {
    // Start proxy server
    ipcMain.handle('start-proxy', (event, options = {}) => {
      const port = options.port || this.store.get('proxySettings.port');
      
      // Update proxy port if provided
      if (port && port !== this.proxyServer.port) {
        this.proxyServer.port = port;
        // Save to settings
        this.store.set('proxySettings.port', port);
      }
      
      return this.startProxy();
    });
    
    // Stop proxy server
    ipcMain.handle('stop-proxy', () => {
      return this.stopProxy();
    });
    
    // Get proxy status
    ipcMain.handle('get-proxy-status', () => {
      return this.proxyServer.getStatus();
    });
    
    // Get proxy settings
    ipcMain.handle('get-proxy-settings', () => {
      return this.store.get('proxySettings');
    });
    
    // Update proxy settings
    ipcMain.handle('update-proxy-settings', (event, settings) => {
      const currentSettings = this.store.get('proxySettings');
      const updatedSettings = { ...currentSettings, ...settings };
      this.store.set('proxySettings', updatedSettings);
      
      // Update proxy server port if it changed and it's running
      if (settings.port && settings.port !== this.proxyServer.port && this.proxyServer.isRunning) {
        this.stopProxy();
        this.proxyServer.port = settings.port;
        this.startProxy();
      }
      
      return updatedSettings;
    });
    
    // Get all requests
    ipcMain.handle('get-requests', () => {
      return this.requestsCache;
    });
    
    // Clear requests
    ipcMain.handle('clear-requests', () => {
      this.requestsCache = [];
      return { success: true };
    });
    
    // Get scope settings
    ipcMain.handle('get-scope-settings', () => {
      return this.store.get('scopeSettings');
    });

    // Save scope settings
    ipcMain.handle('save-scope-settings', (event, settings) => {
      this.store.set('scopeSettings', settings);
      return { success: true };
    });
    
    // Export CA certificate
    ipcMain.handle('export-ca-certificate', async (event) => {
      try {
        const certPath = this.proxyServer.getCACertificatePath();
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
        
        if (canceled) {
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
          error: error.message
        };
      }
    });
    
    // Get CA certificate installation instructions
    ipcMain.handle('get-ca-install-instructions', () => {
      return {
        windows: 'Double-click the exported certificate file. Select "Place all certificates in the following store" and click "Browse". Select "Trusted Root Certification Authorities" and click "OK". Click "Next" and then "Finish".',
        macos: 'Double-click the exported certificate file. This will open Keychain Access. Enter your password to install the certificate. Double-click the installed certificate, expand "Trust" and set "When using this certificate" to "Always Trust".',
        firefox: 'Open Firefox preferences. Search for "certificates" and click "View Certificates". Go to the "Authorities" tab and click "Import". Select the exported certificate file and check "Trust this CA to identify websites" then click "OK".',
        chrome: 'On Windows and macOS, Chrome uses the system certificate store, so follow the instructions for your OS. On Linux, open Chrome settings, search for "certificates", click "Manage certificates", go to "Authorities" tab, and import the certificate.'
      };
    });
  }

  /**
   * Start the proxy server
   * @returns {Object} - Status of the proxy server
   */
  startProxy() {
    if (!this.proxyServer.isRunning) {
      this.proxyServer.start();
    }
    
    return this.proxyServer.getStatus();
  }

  /**
   * Stop the proxy server
   * @returns {Object} - Status of the proxy server
   */
  stopProxy() {
    if (this.proxyServer.isRunning) {
      this.proxyServer.stop();
    }
    
    return this.proxyServer.getStatus();
  }

  /**
   * Add a request to the memory cache
   * @param {Object} request - Request details
   */
  addRequestToCache(request) {
    // Skip CONNECT method requests
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
   * @param {Object} response - Response details
   */
  updateRequestInCache(response) {
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
   * @param {Object} data - Data to send
   */
  broadcastToRenderer(channel, data) {
    // Get all windows
    const { BrowserWindow } = require('electron');
    const windows = BrowserWindow.getAllWindows();
    
    // Send the message to all windows
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
  }
}

module.exports = ProxyManager;
