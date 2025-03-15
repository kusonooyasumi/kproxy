<script lang="ts">
  import { Pane, Splitpanes } from 'svelte-splitpanes';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';
  import type { Writable } from 'svelte/store';
  import { tick } from 'svelte';
  import CodeMirror from "svelte-codemirror-editor";
  import { oneDark } from "@codemirror/theme-one-dark";
  
  // Define the ScopeSettings interface
  interface ScopeSettings {
    inScope: string[];
    outOfScope: string[];
  }
  
  // Create a local store for scope settings
  const scopeStore = writable<ScopeSettings>({
    inScope: [],
    outOfScope: []
  });
  
  // Props that can be passed to the component
  export let standalone = false; // Whether the component is running in standalone mode (new window)
  
  const dispatch = createEventDispatcher();
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
  // Proxy state
  let proxyStatus = { isRunning: false, port: 8080, certificatePath: '' };
  let proxySettings = { port: 8080, autoStart: false };
  let requests: CapturedRequest[] = [];
  let selectedRequest: CapturedRequest | null = null;
  let loading = true;
  let showCertInstructions = false;
  let certInstructions = {
    windows: '',
    macos: '',
    firefox: '',
    chrome: ''
  };

  let responseContent = '';
  let requestContent = '';
  // Scope filter state
  let showFilterOptions = false;
  let scopeOnly = false;
  let scopeSettings: ScopeSettings = { inScope: [], outOfScope: [] };
  
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
  
  // Clear requests
  async function clearRequests() {
    if (!isElectron || !window.electronAPI?.proxy) {
      console.error('Requests can only be cleared in the Electron app');
      return;
    }
    
    try {
      await window.electronAPI.proxy.clearRequests();
      requests = [];
      selectedRequest = null;
    } catch (error) {
      console.error('Failed to clear requests:', error);
    }
  }
  
  // Subscribe to scope store updates
  scopeStore.subscribe((value: ScopeSettings) => {
    scopeSettings = value;
  });
  
  // Check if a host is in scope
  function isInScope(host: string): boolean {
    // Fast path: direct match with in-scope items
    if (scopeSettings.inScope.includes(host)) {
      return true;
    }
    
    // Check wildcard matches for in-scope
    const isInScopeMatch = scopeSettings.inScope.some((pattern: string) => {
      if (pattern.startsWith('*.')) {
        // Wildcard pattern like *.example.com
        const domain = pattern.substring(2); // Remove the *. prefix
        return host === domain || host.endsWith('.' + domain);
      }
      return false;
    });
    
    if (!isInScopeMatch) {
      return false; // Not matched by any in-scope pattern
    }
    
    // Check if excluded by out-of-scope patterns
    const isExcluded = scopeSettings.outOfScope.some((pattern: string) => {
      if (pattern === host) {
        return true;
      }
      if (pattern.startsWith('*.')) {
        const domain = pattern.substring(2);
        return host === domain || host.endsWith('.' + domain);
      }
      return false;
    });
    
    return !isExcluded;
  }
  
  // Get filtered requests based on scope settings
  $: filteredRequests = scopeOnly 
    ? requests.filter(request => isInScope(request.host))
    : requests;
  
  // Format date for display
  function formatDate(isoString: string) {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString();
    } catch (e) {
      return isoString;
    }
  }
  
  // Format request query parameters
  function formatQueryParams(query: string | undefined) {
    if (!query) return '';
    return query;
  }
  
  // Format request body for display
  function formatBody(body: string | undefined) {
    if (!body) return '';
    
    try {
      // Try to parse and format JSON
      const parsedJson = JSON.parse(body);
      return JSON.stringify(parsedJson, null, 2);
    } catch (e) {
      // Return the original string if it's not JSON
      return body;
    }
  }
  
  // Format full request with method, headers, and body
  function formatFullRequest(request: CapturedRequest | null) {
    if (!request) return '';
    
    let formattedRequest = '';
    
    // Request line
    formattedRequest += `${request.method} ${request.path} HTTP/1.1\r\n`;
    
    // Host header
    formattedRequest += `Host: ${request.host}\r\n`;
    
    // Request headers
    if (request.headers) {
      for (const [key, value] of Object.entries(request.headers)) {
        if (key.toLowerCase() !== 'host') { // Skip host header as we already added it
          formattedRequest += `${key}: ${value}\r\n`;
        }
      }
    }
    
    // Empty line separating headers from body
    formattedRequest += '\r\n';
    
    // Request body
    if (request.body) {
      try {
        // Try to parse and format JSON body
        const parsedJson = JSON.parse(request.body);
        formattedRequest += JSON.stringify(parsedJson, null, 2);
      } catch (e) {
        // Use raw body if not JSON
        formattedRequest += request.body;
      }
    }
    
    return formattedRequest;
  }
  
  // Format full response with status, headers, and body
  function formatFullResponse(request: CapturedRequest | null) {
    if (!request) return '';
    if (!request.status) return 'No response received';
    
    let formattedResponse = '';
    
    // Status line
    formattedResponse += `HTTP/1.1 ${request.status} ${getStatusText(request.status)}\r\n`;
    
    // Response headers
    if (request.responseHeaders) {
      for (const [key, value] of Object.entries(request.responseHeaders)) {
        formattedResponse += `${key}: ${value}\r\n`;
      }
    }
    
    // Empty line separating headers from body
    formattedResponse += '\r\n';
    
    // Response body
    if (request.responseBody) {
      try {
        // Try to parse and format JSON body
        const parsedJson = JSON.parse(request.responseBody);
        formattedResponse += JSON.stringify(parsedJson, null, 2);
      } catch (e) {
        // Use raw body if not JSON
        formattedResponse += request.responseBody;
      }
    }
    
    return formattedResponse;
  }
  
  // Get HTTP status text for a status code
  function getStatusText(status: number) {
    const statusTexts = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      405: 'Method Not Allowed',
      418: 'I\'m a teapot',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout'
    };
    
    return statusTexts[status as keyof typeof statusTexts] || 'Unknown Status';
  }
  
  // Handle request selection
  function selectRequest(request: CapturedRequest) {
    selectedRequest = request;
    responseContent = formatFullResponse(selectedRequest)
    requestContent = formatFullRequest(selectedRequest)
  }
  
  // Send request to repeater
  async function sendToRepeater(request: CapturedRequest) {
    if (!isElectron || !window.electronAPI?.proxy) {
      console.error('Repeater feature can only be used in the Electron app');
      return;
    }
    
    try {
      const result = await window.electronAPI.proxy.sendToRepeater(request);
      if (result.success) {
        console.log('Request sent to repeater successfully');
      } else {
        console.error('Failed to send request to repeater:', result.error);
      }
    } catch (error) {
      console.error('Error sending request to repeater:', error);
    }
  }
  
  // Handle right-click on request
  let contextMenuVisible = false;
  let contextMenuX = 0;
  let contextMenuY = 0;
  let contextMenuRequest: CapturedRequest | null = null;
  
  async function showContextMenu(event: MouseEvent, request: CapturedRequest) {
    event.preventDefault();
    
    // Position the context menu where the user clicked
    contextMenuX = event.clientX;
    contextMenuY = event.clientY;
    contextMenuRequest = request;
    contextMenuVisible = true;
    
    // Register a handler to close the context menu when clicking outside
    await tick();
    document.addEventListener('click', closeContextMenu);
  }
  
  function closeContextMenu() {
    contextMenuVisible = false;
    document.removeEventListener('click', closeContextMenu);
  }
  
  // Handle right-click on request panel
  let panelContextMenuVisible = false;
  let panelContextMenuX = 0;
  let panelContextMenuY = 0;
  
  async function showPanelContextMenu(event: MouseEvent) {
    if (!selectedRequest) return;
    
    event.preventDefault();
    
    // Position the context menu where the user clicked
    panelContextMenuX = event.clientX;
    panelContextMenuY = event.clientY;
    panelContextMenuVisible = true;
    
    // Register a handler to close the context menu when clicking outside
    await tick();
    document.addEventListener('click', closePanelContextMenu);
  }
  
  function closePanelContextMenu() {
    panelContextMenuVisible = false;
    document.removeEventListener('click', closePanelContextMenu);
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
  
  // Load requests and proxy status
  async function loadInitialData() {
    if (!isElectron || !window.electronAPI) {
      loading = false;
      return;
    }
    
    try {
      // Get proxy status
      proxyStatus = await window.electronAPI.proxy.getStatus();
      
      // Get proxy settings
      proxySettings = await window.electronAPI.proxy.getSettings();
      
      // Get existing requests
      requests = await window.electronAPI.proxy.getRequests();
      
      // Load scope settings from backend
      if (window.electronAPI.scope) {
        try {
          const savedScopeSettings = await window.electronAPI.scope.getSettings();
          scopeStore.set(savedScopeSettings);
          console.log('Loaded scope settings:', savedScopeSettings);
        } catch (scopeError) {
          console.error('Failed to load scope settings:', scopeError);
        }
      }
      
      loading = false;
    } catch (error) {
      console.error('Failed to load data:', error);
      loading = false;
    }
  }
  
  // Toggle filter options visibility
  function toggleFilterOptions() {
    showFilterOptions = !showFilterOptions;
    
  }
  
  // Initialize the UI after component is mounted
  onMount(() => {
    console.log(`RequestsTab mounted, standalone: ${standalone}`);
    
    // Hide parent sidebar and tabs if in standalone mode
    if (standalone) {
      // This is a workaround to hide the sidebar and tabs when in standalone mode
      // These elements might be present from the parent layout
      const sidebar = document.querySelector('.sidebar') as HTMLElement;
      const tabs = document.querySelector('.tabs') as HTMLElement;
      
      if (sidebar) sidebar.style.display = 'none';
      if (tabs) tabs.style.display = 'none';
    }
    
    // Load initial data
    loadInitialData();
    
    // Set up listeners for proxy events
    if (isElectron && window.electronAPI) {
      // Listen for new requests
      window.electronAPI.receive('proxy-request', (requestData: CapturedRequest) => {
        console.log('New request:', requestData);
        // Add to requests list (ensure no duplicates)
        const existingIndex = requests.findIndex(r => r.id === requestData.id);
        if (existingIndex === -1) {
          requests = [requestData, ...requests];
        }
      });
      
      // Listen for response updates
      window.electronAPI.receive('proxy-response', (responseData: CapturedRequest) => {
        console.log('Response received:', responseData);
        // Update the request in our list
        const index = requests.findIndex(r => r.id === responseData.id);
        if (index !== -1) {
          requests[index] = responseData;
          requests = [...requests]; // Trigger reactivity
          
          // Update selected request if it's the one that was updated
          if (selectedRequest && selectedRequest.id === responseData.id) {
            selectedRequest = responseData;
          }
        }
      });
      
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
      
      // Listen for project state changes
      window.electronAPI.receive('project-state-changed', (data: { action: string; project: Project }) => {
        console.log('Project state changed:', data.action, data.project);
        
        if (data.action === 'new') {
          // Clear requests when a new project is created
          requests = [];
          selectedRequest = null;
        } else if (data.action === 'open') {
          // No need to update requests here as the main.js now sends all proxied requests
          // via proxy-request and proxy-response events when a project is opened
        }
        
        // Update scope settings if available in the project
        if (data.project.scopes) {
          scopeStore.set(data.project.scopes);
        }
      });
    }
  });
  
  // Clean up event listeners
  onDestroy(() => {
    // No need to remove IPC listeners as they're automatically cleaned up
  });
</script>

<div class="request-controls">
  <div class="control-group">
    <div class="status-indicator" class:running={proxyStatus.isRunning} title={proxyStatus.isRunning ? 'Proxy Running' : 'Proxy Stopped'}>
      <div class="status-dot"></div>
      <span>Proxy {proxyStatus.isRunning ? 'Running' : 'Stopped'}</span>
    </div>
    
    <div class="control-buttons">
      <button class="control-button" on:click={clearRequests}>Clear Requests</button>
    <div class="filter-dropdown">
        <button class="control-button" class:active={scopeOnly} on:click={toggleFilterOptions}>
          Filter {scopeOnly ? '(Active)' : ''}
          <span class="dropdown-arrow">▼</span>
        </button>
        
        {#if showFilterOptions}
          <div class="dropdown-content">
            <label class="filter-option">
              <input type="checkbox" bind:checked={scopeOnly}>
              <span>In scope items only</span>
            </label>
            {#if scopeOnly && filteredRequests.length === 0 && requests.length > 0}
              <div class="filter-warning">No requests match the current scope</div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
<div class="main-panel">
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
    
    <!-- Loading State -->
    {#if loading}
      <div class="loading-overlay">
        <div class="loading-spinner"></div>
        <div>Loading...</div>
      </div>
    {/if}


<Splitpanes theme="no-splitter" horizontal style="" dblClickSplitter={false}>
  <Pane>
    <Splitpanes theme="modern-theme" horizontal style="">
      <Pane>
        <div class="table-container">
          <table class="request-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Protocol</th>
                <th>Host</th>
                <th>Method</th>
                <th>Path</th>
                <th>Status</th>
                <th>Response Size</th>
                <th>Time (ms)</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {#if requests.length === 0}
                <tr>
                  <td colspan="9" class="no-requests">
                    {#if proxyStatus.isRunning}
                      No requests captured yet. Configure your browser to use proxy at localhost:{proxyStatus.port}
                    {:else}
                      Start the proxy server to capture HTTP/HTTPS requests
                    {/if}
                  </td>
                </tr>
              {:else}
                {#each filteredRequests as request (request.id)}
                  <tr 
                    class:selected={selectedRequest && selectedRequest.id === request.id}
                    class:error={request.error}
                    on:click={() => selectRequest(request)}
                    on:contextmenu={(e) => showContextMenu(e, request)}
                  >
                    <td>{request.id}</td>
                    <td>{request.protocol}</td>
                    <td>{request.host}</td>
                    <td class="method {request.method.toLowerCase()}">{request.method}</td>
                    <td class="path">{request.path}</td>
                    <td class="status">
                      {#if request.status}
                        <span class="status-code status-{Math.floor(request.status / 100)}xx">{request.status}</span>
                      {:else}
                        -
                      {/if}
                    </td>
                    <td>{request.responseLength ? request.responseLength : '-'}</td>
                    <td>{request.responseTime ? request.responseTime : '-'}</td>
                    <td>{formatDate(request.timestamp)}</td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      </Pane>
      <Pane>
        <Splitpanes theme="modern-theme">
          <Pane>
            <div class="panel request-panel" on:contextmenu={(e) => showPanelContextMenu(e)}>
              <div class="panel-header">
                <h3>Request</h3>
              </div>
              <div class="panel-content">
                <div class="line-numbers-wrapper">
                  {#if selectedRequest}
                   
                    <CodeMirror theme={oneDark} bind:value={requestContent} editable={false}/>
                  {/if}
                </div>
              </div>
          </Pane>
          <Pane>
            <div class="panel response-panel">
              <div class="panel-header">
                <h3>Response</h3>
              </div>
              <div class="panel-content">
                <div class="line-numbers-wrapper">
                  {#if selectedRequest}
                   
                    <CodeMirror theme={oneDark} bind:value={responseContent} editable={false}/>
                  {/if}
                </div>
              </div>
            </div>
          </Pane>
        </Splitpanes>
      </Pane>
    </Splitpanes>
  </Pane>

</Splitpanes>
</div>
{#if contextMenuVisible && contextMenuRequest}
  <div 
    class="context-menu"
    style="top: {contextMenuY}px; left: {contextMenuX}px;"
  >
    <div class="context-menu-item" on:click={() => {
      if (contextMenuRequest) sendToRepeater(contextMenuRequest);
      closeContextMenu();
    }}>
      Send to Repeater
    </div>
  </div>
{/if}

<!-- Request Panel Context Menu -->
{#if panelContextMenuVisible && selectedRequest}
  <div 
    class="context-menu"
    style="top: {panelContextMenuY}px; left: {panelContextMenuX}px;"
  >
    <div class="context-menu-item" on:click={() => {
      if (selectedRequest) sendToRepeater(selectedRequest);
      closePanelContextMenu();
    }}>
      Send to Repeater
    </div>
  </div>
{/if}

<style>

.main-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    background-color: transparent;
    border-radius: 4px;
    height: 100%;
    border: 1px solid #ddd;
  }

  /* Modern Theme */
  :global(.splitpanes.modern-theme .splitpanes__pane) {
    background-color: transparent;
    
  }
 
  :global(.splitpanes.modern-theme .splitpanes__splitter) {
    background-color: #ccc;
    position: relative;
  }
 
  :global(.splitpanes.modern-theme .splitpanes__splitter:before) {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    transition: opacity 0.4s;
    background-color: #ff5252;
    opacity: 0;
    z-index: 1;
  }
 
  :global(.splitpanes.modern-theme .splitpanes__splitter:hover:before) {
    opacity: 1;
  }
 
  :global(.splitpanes.modern-theme .splitpanes__splitter.splitpanes__splitter__active) {
    z-index: 2; /* Fix an issue of overlap fighting with a near hovered splitter */
  }
 
  :global(.modern-theme.splitpanes--vertical > .splitpanes__splitter:before) {
    left: -3px;
    right: -3px;
    height: 100%;
    cursor: col-resize;
  }
 
  :global(.modern-theme.splitpanes--horizontal > .splitpanes__splitter:before) {
    top: -3px;
    bottom: -3px;
    width: 100%;
    cursor: row-resize;
  }
 
  /* No Splitter Theme */
  :global(.splitpanes.no-splitter .splitpanes__pane) {
    background-color: transparent;
    border-radius: 4px;
  }
 
  :global(.splitpanes.no-splitter .splitpanes__splitter) {
    background-color: #ccc;
    position: relative;
  }
 
  :global(.no-splitter.splitpanes--horizontal > .splitpanes__splitter:before) {
    width: 0.125rem;
    pointer-events: none;
    cursor: none;
  }
 
  :global(.no-splitter.splitpanes--vertical > .splitpanes__splitter:before) {
    height: 0.125rem;
    pointer-events: none;
    cursor: none;
  }

  .requests-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    background-color: transparent;
  }  
  
  /* Request Controls */
  .request-controls {
    padding: 8px 15px;
    background-color: #1a1a1a;
    border-radius: 4px;
    margin-bottom: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #ddd;
  }

  .control-group {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: bold;
    max-width: 300px;
    white-space: nowrap;
    text-overflow: ellipsis;
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
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .control-button {
    padding: 4px 14px;
    background-color: #333;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border: 1px solid #ddd;
  }
  
  .control-button:hover {
    background-color: #444;
  }
  
  .control-button.active {
    background-color: #2196f3;
  }
  
  .control-button.active:hover {
    background-color: #1976d2;
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
  
  /* Filter dropdown styles */
  .filter-dropdown {
    position: relative;
    display: inline-block;
  }
  
  .dropdown-arrow {
    font-size: 10px;
    margin-left: 5px;
  }
  


  .dropdown-content  {
    margin-top: 5px;
    position: fixed;
    right: 10px;
    background-color: #2a2a2a;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 100;
    min-width: 180px;
    padding: 4px 0;
    overflow: auto;
    animation: fadeIn 0.15s ease-out;
  }
  
  .filter-option {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px;
    cursor: pointer;
    border-radius: 4px;
  }
  
  .filter-option:hover {
    background-color: #333;
  }
  
  .filter-option input[type="checkbox"] {
    margin: 0;
  }
  
  .filter-warning {
    color: #ff9800;
    font-size: 12px;
    margin-top: 8px;
    padding: 5px;
    border-radius: 4px;
    background-color: rgba(255, 152, 0, 0.1);
  }
  
  .settings-group {
    display: flex;
    gap: 20px;
    align-items: center;
  }
  
  .settings-group input[type="number"] {
    width: 80px;
    padding: 8px;
    background-color: #2a2a2a;
    border: 1px solid #444;
    color: #fff;
    border-radius: 8px;
  }
  
  /* Request Table */
  .table-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: auto;
    min-height: 150px;
    width: 100%;
    height: 100%;
    background-color: #1a1a1a;
    margin-bottom: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  .request-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
  }
  
  .request-table th {
    background-color: #1a1a1a;
    text-align: center;
    color: #ddd;
    height: 25px;
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: 1px solid #333;
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .request-table td {
    padding: 5px;
    border-bottom: 1px solid #333;
    color: #ddd;
    text-align: center;
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .request-table tr:hover {
    background-color: #2a2a2a;
  }
  
  .request-table tr.selected {
    background-color: #303030;
  }
  
  .request-table tr.error {
    color: #ff5252;
  }
  
  .method {
    text-transform: uppercase;
    font-weight: bold;
  }
  
  .method.get {
    color: #4caf50;
  }
  
  .method.post {
    color: #2196f3;
  }
  
  .method.put {
    color: #ff9800;
  }
  
  .method.delete {
    color: #f44336;
  }
  
  .method.connect {
    color: #9c27b0;
  }
  
  .path {
    max-width: 300px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .status-code {
    padding: 3px 7px;
    border-radius: 6px;
    font-weight: bold;
  }
  
  .status-2xx {
    background-color: #4caf50;
    color: #fff;
  }
  
  .status-3xx {
    background-color: #ff9800;
    color: #fff;
  }
  
  .status-4xx, .status-5xx {
    background-color: #f44336;
    color: #fff;
  }
  
  .no-requests {
    text-align: center;
    padding: 30px;
    color: #888;
    font-style: italic;
  }
  
  /* Split Panel View */
  .bottom-container {
    flex: 1;
    background-color: #1a1a1a;
    border-radius: 7px;
    overflow: hidden;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
  }
  
  .split-view {
    display: flex;
    height: 100%;
    width: 100%;
    max-width: 100%;
  }
  
  .panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background-color: #1a1a1a;
  }
  
  .request-panel {
    border-right: 1px solid #333;
  }
  
  .panel-header {
    padding: 10px 15px;
    background-color: #1a1a1a;
    border-bottom: 1px solid #333;
  }
  
  .panel-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: normal;
    color: #ddd;
  }
  
  .panel-content {
    flex: 1;
    overflow: auto;
    padding: 0;
    position: relative;
    max-width: 100%;
  }
  
  /* Line numbers and content */
  .line-numbers-wrapper {
    display: flex;
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }
  
  .line-numbers {
    background-color: #252525;
    padding: 12px 8px 12px 8px;
    text-align: right;
    color: #888;
    font-family: monospace;
    font-size: 12px;
    user-select: none;
    min-width: 30px;
    border-right: 1px solid #333;
    flex-shrink: 0;
    position: sticky;
    left: 0;
  }
  
  .line-number {
    height: 1.4em;
  }
  
  .content-block {
    font-family: monospace;
    white-space: pre-wrap;
    margin: 0;
    padding: 12px;
    background-color: #1a1a1a;
    color: #fff;
    box-sizing: border-box;
    border: none;
    overflow-x: auto;
    overflow-y: hidden;
    flex: 1;
    font-size: 12px;
    line-height: 1.4;
    display: block;
    max-width: 100%;
    word-break: break-word;
  }
  
  .no-selection {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #777;
    font-style: italic;
  }
  
  .detail-item.error {
    color: #ff5252;
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
    border-radius: 7px;
    width: 80%;
    max-width: 800px;
    max-height: 80%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.5);
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
    background-color: #1a1a1a;
    padding: 15px;
    border-radius: 8px;
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
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .modal-footer button:hover {
    background-color: #ff3838;
  }
  
  /* Loading Overlay */
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    z-index: 10;
    color: #fff;
    border-radius: 7px;
  }
  
  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top: 4px solid #ff5252;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 15px;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  
  /* Context Menu Styles */
  .context-menu {
    position: fixed;
    background-color: #2a2a2a;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    z-index: 100;
    min-width: 180px;
    padding: 4px 0;
    overflow: hidden;
    animation: fadeIn 0.15s ease-out;
  }
  
  .context-menu-item {
    padding: 8px 16px;
    cursor: pointer;
    transition: background-color 0.2s;
    color: #fff;
  }
  
  .context-menu-item:hover {
    background-color: #444;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #1e1e1e;
  }

  ::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>