<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
  // Proxy state
  let proxyStatus: { isRunning: boolean; port: number; certificatePath: string } = { 
    isRunning: false, 
    port: 8080, 
    certificatePath: '' 
  };
  let isStopButtonDisabled = false;
  let proxySettings: {
    port: number;
    autoStart: boolean;
    saveOnlyInScope: boolean;
    customHeaders?: Record<string, string>;
  } = {
    port: 8080,
    autoStart: false,
    saveOnlyInScope: false,
    customHeaders: {}
  };
  
  // Custom headers state
  let customHeaders: Record<string, string> = {};
  let newHeaderName = '';
  let newHeaderValue = '';
  let headerValidation = { error: false, message: '' };
  let showCertInstructions = false;
  let certInstructions = {
    windows: '',
    macos: '',
    firefox: '',
    chrome: ''
  };
  
  // Start proxy server
  async function startProxy() {
    if (!isElectron || !window.electronAPI?.proxy) {
      console.error('Proxy can only be started in the Electron app');
      return;
    }
    
    try {
      proxyStatus = await window.electronAPI.proxy.start({
        port: proxySettings.port,
        saveOnlyInScope: proxySettings.saveOnlyInScope
      });
      console.log('Proxy started:', proxyStatus);
    } catch (error) {
      console.error('Failed to start proxy:', error);
    }
  }
  
  // Stop proxy server
  async function stopProxy() {
    if (!isElectron || !window.electronAPI?.proxy) {
      console.error('Proxy can only be stopped in the Electron app');
      return;
    }
    
    // Disable the stop button for 3 seconds
    isStopButtonDisabled = true;
    
    try {
      proxyStatus = await window.electronAPI.proxy.stop();
      console.log('Proxy stopped:', proxyStatus);
    } catch (error) {
      console.error('Failed to stop proxy:', error);
    }
    
    // Re-enable the button after 3 seconds
    setTimeout(() => {
      isStopButtonDisabled = false;
    }, 3000);
  }
  
  // Export CA certificate
  async function exportCertificate() {
    if (!isElectron || !window.electronAPI?.proxy) {
      console.error('Certificate can only be exported in the Electron app');
      return;
    }
    
    try {
      const result = await window.electronAPI.proxy.exportCertificate();
      if (result.success) {
        alert(result.message);
        // Show certificate installation instructions
        showCertificateInstructions();
      } else {
        if (!result.canceled) {
          alert(`Failed to export certificate: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Failed to export certificate:', error);
    }
  }
  
  // Show certificate installation instructions
  async function showCertificateInstructions() {
    if (!isElectron || !window.electronAPI?.proxy) {
      console.error('Certificate instructions are only available in the Electron app');
      return;
    }
    
    try {
      certInstructions = await window.electronAPI.proxy.getCertificateInstructions();
      showCertInstructions = true;
    } catch (error) {
      console.error('Failed to get certificate instructions:', error);
    }
  }
  
  // Update proxy settings
  async function updateProxySettings() {
    if (!isElectron || !window.electronAPI?.proxy) return;
    
    try {
      const updatedSettings = await window.electronAPI.proxy.updateSettings({
        port: proxySettings.port,
        autoStart: proxySettings.autoStart,
        saveOnlyInScope: proxySettings.saveOnlyInScope,
        customHeaders: proxySettings.customHeaders
      });
      proxySettings = updatedSettings;
      console.log('Proxy settings updated:', proxySettings);
    } catch (error) {
      console.error('Failed to update proxy settings:', error);
    }
  }
  
  // Load proxy status and settings
  async function loadProxyData() {
    if (!isElectron || !window.electronAPI?.proxy) {
      return;
    }
    
    try {
      // Get proxy status
      proxyStatus = await window.electronAPI.proxy.getStatus();
      
      // Get proxy settings
      proxySettings = await window.electronAPI.proxy.getSettings();
      
      // Load custom headers
      customHeaders = await window.electronAPI.proxy.getCustomHeaders();
    } catch (error) {
      console.error('Failed to load proxy data:', error);
    }
  }
  
  // Add a new custom header
  async function addCustomHeader(): Promise<void> {
    // Validate header name and value
    if (!newHeaderName.trim()) {
      headerValidation = { error: true, message: 'Header name cannot be empty' };
      return;
    }
    
    // Add header to the list
    const updatedHeaders = { ...customHeaders, [newHeaderName]: newHeaderValue };
    
    try {
      // Update headers via API
      if (window.electronAPI?.proxy) {
        customHeaders = await window.electronAPI.proxy.updateCustomHeaders(updatedHeaders);
      }
      
      // Clear inputs
      newHeaderName = '';
      newHeaderValue = '';
      headerValidation = { error: false, message: '' };
    } catch (error) {
      console.error('Failed to update custom headers:', error);
      headerValidation = { error: true, message: 'Failed to add header' };
    }
  }
  
  // Remove a custom header
  async function removeCustomHeader(headerName: string): Promise<void> {
    // Create a copy of headers without the one to remove
    const updatedHeaders: Record<string, string> = { ...customHeaders };
    delete updatedHeaders[headerName];
    
    try {
      // Update headers via API
      if (window.electronAPI?.proxy) {
        customHeaders = await window.electronAPI.proxy.updateCustomHeaders(updatedHeaders);
      }
    } catch (error) {
      console.error('Failed to remove custom header:', error);
    }
  }
  
  // Initialize the component
  onMount(() => {
    loadProxyData();
    
    // Set up listeners for proxy events
    if (isElectron && window.electronAPI) {
      // Listen for proxy status updates
      window.electronAPI.receive('proxy-status', (status: any) => {
        console.log('Proxy status update:', status);
        proxyStatus = { ...proxyStatus, ...status };
      });
      
      // Listen for proxy errors
      window.electronAPI.receive('proxy-error', (error: any) => {
        console.error('Proxy error:', error);
        alert(`Proxy error: ${error.message}`);
      });
    }
  });
</script>

<div class="proxy-settings">
  <!-- Proxy Status and Controls -->
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Proxy Status</h3>
    </div>
    <div class="settings-card-content">
      <div class="status-indicator" class:running={proxyStatus.isRunning} title={proxyStatus.isRunning ? 'Proxy Running' : 'Proxy Stopped'}>
        <div class="status-dot"></div>
        <span>Proxy {proxyStatus.isRunning ? 'Running' : 'Stopped'}</span>
      </div>
      
      <div class="control-buttons">
        {#if proxyStatus.isRunning}
          <button 
            class="control-button stop" 
            on:click={stopProxy} 
            disabled={isStopButtonDisabled}
            class:disabled={isStopButtonDisabled}
          >
            Stop Proxy
          </button>
        {:else}
          <button class="control-button start" on:click={startProxy}>Start Proxy</button>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Proxy Configuration -->
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Proxy Configuration</h3>
    </div>
    <div class="settings-card-content">
      <div class="settings-group">
        <label class="settings-label">
          Proxy Port:
          <input 
            type="number" 
            bind:value={proxySettings.port} 
            on:change={updateProxySettings}
            min="1024" 
            max="65535" 
            class="settings-input"
          />
        </label>
        
        <label class="settings-label checkbox-label">
          <input 
            type="checkbox" 
            bind:checked={proxySettings.autoStart} 
            on:change={updateProxySettings}
          />
          Auto-start proxy
        </label>

        <label class="settings-label checkbox-label">
          <input 
            type="checkbox" 
            bind:checked={proxySettings.saveOnlyInScope} 
            on:change={updateProxySettings}
          />
          Only save in-scope items
        </label>
      </div>
    </div>
  </div>
  
  <!-- Custom Headers -->
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Custom Headers</h3>
    </div>
    <div class="settings-card-content">
      <p class="settings-description">
        Add custom HTTP headers to every request that goes through the proxy.
      </p>
      
      <div class="settings-group">
        <div class="header-form">
          <div class="header-inputs">
            <input
              type="text"
              bind:value={newHeaderName}
              placeholder="Header Name"
              class="settings-input header-input"
            />
            <input
              type="text"
              bind:value={newHeaderValue}
              placeholder="Header Value"
              class="settings-input header-input"
            />
          </div>
          <button class="settings-button" on:click={addCustomHeader}>Add Header</button>
        </div>
        
        {#if headerValidation.error}
          <p class="error-message">{headerValidation.message}</p>
        {/if}
      </div>
      
      {#if Object.keys(customHeaders).length > 0}
        <div class="header-list">
          <h4>Current Headers:</h4>
          <div class="headers-table">
            <div class="headers-table-header">
              <div class="header-name">Name</div>
              <div class="header-value">Value</div>
              <div class="header-action">Action</div>
            </div>
            {#each Object.entries(customHeaders) as [name, value]}
              <div class="header-item">
                <div class="header-name">{name}</div>
                <div class="header-value">{value}</div>
                <div class="header-action">
                  <button
                    class="remove-button"
                    on:click={() => removeCustomHeader(name)}
                    title="Remove header"
                  >×</button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {:else}
        <p class="no-headers">No custom headers defined</p>
      {/if}
    </div>
  </div>
  
  <!-- Certificate Management -->
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Certificate Management</h3>
    </div>
    <div class="settings-card-content">
      <p class="settings-description">
        Export the CA certificate to enable HTTPS inspection. The certificate must be installed in your browser or operating system.
      </p>
      
      <button class="settings-button" on:click={exportCertificate}>Export CA Certificate</button>
      
      {#if proxyStatus.certificatePath}
        <div class="cert-path">
          <span>Certificate Path:</span>
          <span class="path">{proxyStatus.certificatePath}</span>
        </div>
      {/if}
    </div>
  </div>
  
  <!-- Certificate Installation Instructions Modal -->
  {#if showCertInstructions}
    <div class="modal-overlay">
      <div class="modal-container">
        <div class="modal-header">
          <h3>CA Certificate Installation Instructions</h3>
          <button class="close-button" on:click={() => showCertInstructions = false}>×</button>
        </div>
        <div class="modal-content">
          <div class="instruction-section">
            <h4>Windows</h4>
            <p>{certInstructions.windows}</p>
          </div>
          <div class="instruction-section">
            <h4>macOS</h4>
            <p>{certInstructions.macos}</p>
          </div>
          <div class="instruction-section">
            <h4>Firefox</h4>
            <p>{certInstructions.firefox}</p>
          </div>
          <div class="instruction-section">
            <h4>Chrome/Edge</h4>
            <p>{certInstructions.chrome}</p>
          </div>
          <div class="modal-footer">
            <button on:click={() => showCertInstructions = false}>Close</button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .proxy-settings {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .settings-card {
    background-color: #2c2c2c;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border: 1px solid #ddd;
  }
  
  .settings-card-header {
    background-color: #1a1a1a;
    padding: 15px 20px;
    border-bottom: 1px solid #333;
  }
  
  .settings-card-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: normal;
    color: #fff;
  }
  
  .settings-card-content {
    padding: 20px;
  }
  
  .settings-description {
    color: #aaa;
    margin-bottom: 15px;
    font-size: 14px;
  }
  
  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .settings-label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #ddd;
    font-size: 14px;
  }
  
  .checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  
  .settings-input {
    background-color: #333;
    border: 1px solid #444;
    color: #fff;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;
    width: 100px;
  }
  
  .settings-button {
    background-color: #333;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 10px 15px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }
  
  .settings-button:hover {
    background-color: #444;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #777;
  }
  
  .status-indicator.running .status-dot {
    background-color: #4caf50;
    box-shadow: 0 0 8px #4caf50;
  }
  
  .control-buttons {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .control-button {
    padding: 8px 15px;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    background-color: #333;
  }
  
  .control-button:hover:not(.disabled) {
    background-color: #444;
  }
  
  .control-button.start {
    background-color: #4caf50;
  }
  
  .control-button.start:hover {
    background-color: #3d8b40;
  }
  
  .control-button.stop {
    background-color: #f44336;
  }
  
  .control-button.stop:hover:not(.disabled) {
    background-color: #d32f2f;
  }
  
  .control-button.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .cert-path {
    margin-top: 15px;
    font-size: 13px;
    color: #aaa;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  
  .cert-path .path {
    font-family: monospace;
    background-color: #222;
    padding: 8px;
    border-radius: 4px;
    word-break: break-all;
  }
  
  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
  }
  
  .modal-container {
    background-color: #2c2c2c;
    border-radius: 8px;
    width: 80%;
    max-width: 800px;
    max-height: 80%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .modal-header {
    padding: 15px;
  }
  
  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: normal;
    color: #fff;
  }
  
  .close-button {
    position: absolute;
    top: 10px;
    right: 10px;
    background: none;
    border: none;
    color: #fff;
    font-size: 20px;
    cursor: pointer;
  }
  
  .modal-content {
    padding: 20px;
    overflow-y: auto;
  }
  
  .instruction-section {
    margin-bottom: 20px;
  }
  
  .instruction-section h4 {
    margin: 0 0 10px 0;
    color: #fff;
  }
  
  .instruction-section p {
    margin: 0;
    color: #ddd;
    white-space: pre-line;
  }
  
  .modal-footer {
    padding: 15px;
    text-align: right;
  }
</style>
