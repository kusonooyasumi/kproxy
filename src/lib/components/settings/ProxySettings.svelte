<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
  // Proxy state
  let proxyStatus = { isRunning: false, port: 8080, certificatePath: '' };
  let proxySettings = { port: 8080, autoStart: false };
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
      proxyStatus = await window.electronAPI.proxy.start({ port: proxySettings.port });
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
    
    try {
      proxyStatus = await window.electronAPI.proxy.stop();
      console.log('Proxy stopped:', proxyStatus);
    } catch (error) {
      console.error('Failed to stop proxy:', error);
    }
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
      const updatedSettings = await window.electronAPI.proxy.updateSettings(proxySettings);
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
    } catch (error) {
      console.error('Failed to load proxy data:', error);
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
          <button class="control-button stop" on:click={stopProxy}>Stop Proxy</button>
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
      </div>
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
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
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
  
  .control-button:hover {
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
  
  .control-button.stop:hover {
    background-color: #d32f2f;
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
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #1a1a1a;
    border-bottom: 1px solid #333;
  }
  
  .modal-header h3 {
    margin: 0;
    color: #fff;
  }
  
  .close-button {
    background: none;
    border: none;
    color: #999;
    font-size: 24px;
    cursor: pointer;
  }
  
  .modal-content {
    padding: 15px;
    overflow-y: auto;
    flex: 1;
  }
  
  .instruction-section {
    margin-bottom: 20px;
  }
  
  .instruction-section h4 {
    margin-top: 0;
    color: #ddd;
  }
  
  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 15px;
    border-top: 1px solid #333;
  }
  
  .modal-footer button {
    padding: 8px 15px;
    background-color: #ff5252;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
</style>
