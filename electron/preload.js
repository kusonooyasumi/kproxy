const { contextBridge, ipcRenderer } = require('electron');


// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, data) => {
    // whitelist channels
    const validChannels = ['run-ffuf', 'stop-ffuf'];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`));
  },
  on: (channel, callback) => {
    const validChannels = ['ffuf-output', 'ffuf-complete', 'ffuf-error'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  removeAllListeners: (channel) => {
    const validChannels = ['ffuf-output', 'ffuf-complete', 'ffuf-error'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Message sending functions
  send: (channel, data) => {
    // whitelist channels
    const validChannels = ['toMain', 'openTabInNewWindow', 'start-without-project'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  
  // Message receiving functions
  receive: (channel, func) => {
const validChannels = [
      'fromMain', 
      'showTab', 
      'proxy-request', 
      'proxy-response', 
      'proxy-status', 
      'proxy-error',
      'send-to-repeater',
      'project-state-changed',
      'get-repeater-requests'
    ];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  // Project API
  project: {
    // Create a new project
    new: () => ipcRenderer.invoke('new-project'),
    
    // Open an existing project
    open: () => ipcRenderer.invoke('open-project'),
    
    // Save the current project
    save: (project) => ipcRenderer.invoke('save-project', project),
    
    // Save the current project with a new name/location
    saveAs: (project) => ipcRenderer.invoke('save-project-as', project),
    
    // Get the current project data
    getCurrentProject: () => ipcRenderer.invoke('get-current-project')
  },
  
  // Proxy server API
  proxy: {
    // Start the proxy server
    start: (options) => ipcRenderer.invoke('start-proxy', options),
    
    // Stop the proxy server
    stop: () => ipcRenderer.invoke('stop-proxy'),
    
    // Get proxy status
    getStatus: () => ipcRenderer.invoke('get-proxy-status'),
    
    // Get proxy settings
    getSettings: () => ipcRenderer.invoke('get-proxy-settings'),
    
    // Update proxy settings
    updateSettings: (settings) => ipcRenderer.invoke('update-proxy-settings', settings),
    
    // Get custom headers
    getCustomHeaders: () => ipcRenderer.invoke('get-proxy-custom-headers'),
    
    // Update custom headers
    updateCustomHeaders: (headers) => ipcRenderer.invoke('update-proxy-custom-headers', headers),
    
    // Get all captured requests
    getRequests: () => ipcRenderer.invoke('get-requests'),
    
    // Clear captured requests
    clearRequests: () => ipcRenderer.invoke('clear-requests'),
    
    // Export CA certificate
    exportCertificate: () => ipcRenderer.invoke('export-ca-certificate'),
    
    // Get CA certificate installation instructions
    getCertificateInstructions: () => ipcRenderer.invoke('get-ca-install-instructions'),
    
    // Send request to repeater
    sendToRepeater: (request) => ipcRenderer.invoke('send-to-repeater', request),
    
    // Send a request from the repeater
    sendRequest: (request) => ipcRenderer.invoke('send-request', request),
    
    // Send repeater requests for project saving
    sendRepeaterRequests: (requests) => ipcRenderer.invoke('repeater-requests', requests)
  },
  
  // Scope settings API
  scope: {
    // Get scope settings
    getSettings: () => ipcRenderer.invoke('get-scope-settings'),
    
    // Save scope settings
    saveSettings: (settings) => ipcRenderer.invoke('save-scope-settings', settings)
  }
});

// You could also expose specific APIs or functionality from Node.js
// For example, a function to read the app version:
contextBridge.exposeInMainWorld('appInfo', {
  getVersion: () => process.env.npm_package_version
});
