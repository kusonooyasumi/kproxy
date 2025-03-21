<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Pane, Splitpanes } from 'svelte-splitpanes';
  import CodeMirror from "svelte-codemirror-editor";
  import { oneDark } from "@codemirror/theme-one-dark";

  // Props that can be passed to the component
  export let standalone = false; // Whether the component is running in standalone mode (new window)
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
  let requests: CapturedRequest[] = [];
  let selectedRequest: CapturedRequest | null = null;
  let selectedIndex = 0;
  
  // Keep track of edited request content
  let requestContent = '';
  let isLoading = false;
  let responseContent = '';
  let urlInput = 'https://target.com'; // Default URL
  
  
  
  // Initialize with any initial value
  onMount(() => {
  });
  
  // Update URL input when selected request changes
  $: if (selectedRequest) {
    urlInput = `${selectedRequest.protocol}://${selectedRequest.host}${selectedRequest.path}`;
  } else if (!urlInput) {
    urlInput = 'https://target.com';
  }
  
  // Handle URL input change to update selected request
  function handleUrlChange() {
    if (!selectedRequest) return;
    
    try {
      // Parse the URL to extract protocol, host, and path
      const parsedUrl = new URL(urlInput);
      
      // Update the selected request
      selectedRequest.protocol = parsedUrl.protocol.replace(':', '') as 'http' | 'https';
      selectedRequest.host = parsedUrl.host;
      selectedRequest.path = parsedUrl.pathname + parsedUrl.search;
      
      // Update the request content
      requestContent = formatRequestString(selectedRequest);
    } catch (error) {
      console.error('Error parsing URL:', error);
      // Invalid URL, revert to the original
      urlInput = `${selectedRequest.protocol}://${selectedRequest.host}${selectedRequest.path}`;
    }
  }
  
  // Format request as a string
  function formatRequestString(request: CapturedRequest): string {
    return `${request.method} ${request.path} HTTP/1.1
Host: ${request.host}
${Object.entries(request.headers || {})
  .filter(([key]) => key.toLowerCase() !== 'host')
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}

${request.body || ''}`;
  }
  
  // Format response as a string
  function formatResponseString(request: CapturedRequest): string {
    if (!request.responseBody) {
      return 'No response data available. Click "Send" to execute the request.';
    }
    
    return `HTTP/1.1 ${request.status}
${Object.entries(request.responseHeaders || {})
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}

${request.responseBody}`;
  }
  
  // Update the request content when a request is selected
  $: if (selectedRequest) {
    requestContent = formatRequestString(selectedRequest);
    responseContent = formatResponseString(selectedRequest);
  }
  
  // Handle receiving requests from the RequestsTab
  function handleRequestReceived(request: CapturedRequest) {
    console.log('Received request in repeater:', request);
    
    // Add to requests list (ensure no duplicates)
    const existingIndex = requests.findIndex(r => r.id === request.id);
    if (existingIndex === -1) {
      // Clone the request to avoid reference issues
      const newRequest = JSON.parse(JSON.stringify(request));
      
      // Add a unique identifier for the repeater request
      newRequest.repeaterId = Date.now(); 
      
      requests = [...requests, newRequest];
      
      // Select the new request
      selectedIndex = requests.length - 1;
      selectedRequest = requests[selectedIndex];
    }
  }
  
  // Navigate to previous request
  function previousRequest() {
    if (requests.length === 0) return;
    
    if (selectedIndex > 0) {
      selectedIndex--;
      selectedRequest = requests[selectedIndex];
    }
  }
  
  // Navigate to next request
  function nextRequest() {
    if (requests.length === 0) return;
    
    if (selectedIndex < requests.length - 1) {
      selectedIndex++;
      selectedRequest = requests[selectedIndex];
    }
  }
  
  // Parse the edited request content back into a request object
  function parseRequestContent(content: string, originalRequest: CapturedRequest): CapturedRequest {
    try {
      // Make a deep copy of the original request
      const parsedRequest = JSON.parse(JSON.stringify(originalRequest));
      
      // Split the content into lines
      const lines = content.split('\n');
      
      // Parse the first line to get method and path
      if (lines.length > 0) {
        const firstLineParts = lines[0].split(' ');
        if (firstLineParts.length >= 2) {
          parsedRequest.method = firstLineParts[0];
          parsedRequest.path = firstLineParts[1];
        }
      }
      
      // Reset headers
      parsedRequest.headers = {};
      
      // Parse headers
      let i = 1; // Start from line after the first line
      while (i < lines.length && lines[i].trim() !== '') {
        const line = lines[i].trim();
        const colonIndex = line.indexOf(':');
        
        if (colonIndex > 0) {
          const headerName = line.substring(0, colonIndex).trim();
          const headerValue = line.substring(colonIndex + 1).trim();
          
          // Special case for Host header
          if (headerName.toLowerCase() === 'host') {
            parsedRequest.host = headerValue;
          }
          
          parsedRequest.headers[headerName] = headerValue;
        }
        
        i++;
      }
      
      // Parse body (everything after the empty line)
      let bodyStartIndex = -1;
      for (let j = 1; j < lines.length; j++) {
        if (lines[j].trim() === '') {
          bodyStartIndex = j + 1;
          break;
        }
      }
      
      if (bodyStartIndex > 0 && bodyStartIndex < lines.length) {
        parsedRequest.body = lines.slice(bodyStartIndex).join('\n');
      } else {
        parsedRequest.body = '';
      }
      
      return parsedRequest;
    } catch (error) {
      console.error('Error parsing request content:', error);
      return originalRequest;
    }
  }
  
  // Send the selected request
  async function sendRequest() {
    if (!selectedRequest || !isElectron) return;
    
    // Parse the edited content to update the request object
    const updatedRequest = parseRequestContent(requestContent, selectedRequest);
    
    console.log('Sending request from repeater:', updatedRequest);
    
    // Set loading state
    isLoading = true;
    responseContent = 'Loading...';
    
    try {
      // Clone the request to avoid reference issues
      const requestToSend = JSON.parse(JSON.stringify(updatedRequest));
      
      // Send the request through Electron API
      if (window.electronAPI) {
        const response = await window.electronAPI.tab.sendRequest(requestToSend);
        
        if (response.error) {
          throw new Error(response.error);
        }
        
        // Update the request with the response data
        selectedRequest.status = response.status;
        selectedRequest.responseHeaders = response.headers;
        selectedRequest.responseBody = response.body;
        selectedRequest.responseLength = response.size || (response.body ? response.body.length : 0);
        selectedRequest.responseTime = response.time;
        
        // Update the response display
        responseContent = formatResponseString(selectedRequest);
      }
    } catch (error: unknown) {
      console.error('Error sending request:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      responseContent = `Error sending request: ${errorMessage}`;
    } finally {
      isLoading = false;
    }
  }
  
  // Search for requests
  function searchRequests(query: string) {
    // TODO: Implement search functionality
    console.log('Searching requests:', query);
  }
  
  // Initialize the UI after component is mounted
  onMount(() => {
    console.log(`RepeaterTab mounted, standalone: ${standalone}`);
    
    // Hide parent sidebar and tabs if in standalone mode
    if (standalone) {
      // This is a workaround to hide the sidebar and tabs when in standalone mode
      // These elements might be present from the parent layout
      const sidebar = document.querySelector('.sidebar') as HTMLElement;
      const tabs = document.querySelector('.tabs') as HTMLElement;
      
      if (sidebar) sidebar.style.display = 'none';
      if (tabs) tabs.style.display = 'none';
    }
    
    // Set up listeners for requests sent to repeater
    if (isElectron && window.electronAPI) {
      // Listen for requests sent to repeater
      window.electronAPI.receive('send-to-repeater', (request: CapturedRequest) => {
        handleRequestReceived(request);
      });
      
      // Listen for request to send current repeater requests back to main process
      window.electronAPI.receive('get-repeater-requests', () => {
        console.log('Got request for repeater requests, sending:', requests);
        
        // Send the current repeater requests back to the main process
        if (window.electronAPI) {
          window.electronAPI.proxy.sendRepeaterRequests(requests)
            .then((result: { success: boolean; error?: string }) => {
              if (result.success) {
                console.log('Successfully sent repeater requests to main process');
              } else {
                console.error('Failed to send repeater requests:', result.error);
              }
            })
            .catch((err: Error) => {
              console.error('Error sending repeater requests:', err);
            });
        }
      });
      
      // Listen for project state changes
      window.electronAPI.receive('project-state-changed', (data: { action: string; project: Project }) => {
        if (data.action === 'new') {
          // Clear existing requests when a new project is created
          requests = [];
          selectedRequest = null;
          selectedIndex = 0;
          console.log('Cleared repeater requests for new project');
        } else if (data.action === 'open') {
          // We don't need to do anything here as the requests will be sent via the 'send-to-repeater' event
          console.log('Project opened, waiting for repeater requests');
        }
      });
    }
  });
  
  // Clean up event listeners
  onDestroy(() => {
    // No need to remove IPC listeners as they're automatically cleaned up
  });
</script>

<div class="repeater-header">
  <input 
    type="text" 
    class="url-input" 
    placeholder="https://target.com" 
    bind:value={urlInput}
    on:blur={handleUrlChange}
    on:keydown={(e) => e.key === 'Enter' && handleUrlChange()}
  >
  
  <div class="header-buttons">
    <button 
      class="send-button action-button" 
      on:click={sendRequest}
      disabled={!selectedRequest}
    >Send</button>
  </div>
</div>
<div class="repeater-body">
<Splitpanes theme="no-splitter" horizontal style="" dblClickSplitter={false}>

  <Pane>
    <Splitpanes theme="modern-theme">
      <Pane>
        
          <!-- Left panel (Request list) -->
          <div class="request-list-panel">
            <div class="panel-header">
              Requests ({requests.length})
            </div>
            <div class="search-container">
              <input 
                type="text" 
                class="search-input" 
                placeholder="Search requests" 
                on:input={(e) => searchRequests(e.currentTarget.value)}
              >
            </div>
            <div class="request-list">
              {#if requests.length === 0}
                <div class="empty-message">No requests yet. Send requests from the Requests tab.</div>
              {:else}
                {#each requests as request, index}
                  <div 
                    class="request-item" 
                    class:selected={selectedIndex === index}
                    on:click={() => {
                      selectedIndex = index;
                      selectedRequest = request;
                    }}
                  >
                    <div class="request-item-number">Request #{index + 1}</div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        
      </Pane>
      <Pane>
        <div class="panel-tab">
          <span>Request</span>
          <button class="send-button icon-button" title="Request issues">⚠</button>
        </div>
        <div class="request-content">
        <CodeMirror theme={oneDark} bind:value={requestContent} lineWrapping={true}/>
      </div>
      </Pane>
      <Pane>
        <div class="response-panel-tab">
          <span>Response</span>
          <div class="panel-buttons">
            <button class="send-button icon-button" title="Response issues">⚠</button>
            <button class="send-button icon-button" title="Fullscreen">□</button>
          </div>
        </div>
        <div class="response-content">
          {#if isLoading}
            <div class="loading-indicator">
              <div class="spinner"></div>
              <div>Sending request...</div>
            </div>
          {:else}
          <CodeMirror theme={oneDark} bind:value={responseContent} editable={false} lineWrapping={true}/>
          {/if}
        </div>
      </Pane>
    </Splitpanes>
  </Pane>

</Splitpanes>
</div>
<style>
.panel-buttons {
    display: flex;
    gap: 10px;
  }

  .repeater-header {
    padding: 8px;
    display: flex;
    align-items: center;
    background-color: transparent;
    border-radius: 4px;
    margin-bottom: 10px;
    margin-left: auto;
    background-color: #1a1a1a;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #ddd;
  }
  
  .url-input {
    width: 500px;
    padding: 5px 10px;
    background-color: #2a2a2a;
    border: none;
    color: #fff;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);

    border-radius: 4px;
  }
  
  .search-input {
    flex: 1;
    padding: 5px;
    background-color: #2a2a2a;
    border: none;
    color: #fff;
    border-radius: 4px;
  }

  .header-buttons {
    margin-left: auto;
    display: flex;
    gap: 8px;
  }
  
  .send-button {
    width: 34px;
    height: 34px;
    background-color: #333;
    border: none;
    color: #ff5252;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s ease;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #ddd;
  }
  
  .send-button:hover {
    background-color: #444;
  }
  
  .action-button {
    width: auto;
    padding: 0 15px;
    color: white;
  }
  
  .action-button:hover {
    background-color: #ff5252;
  }
  
  .icon-button {
    background: none;
  }
  
  .repeater-body {
    display: flex;
    height: 100%;
    gap: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  .request-list-panel {
    width: 100%;
    display: flex;
    height: 100%;
    flex-direction: column;
    background-color: #1a1a1a;
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  
  .panel-header {
    padding: 12px 15px;
    background-color: #1a1a1a;
    border-bottom: 1px solid #333;
    font-weight: bold;
    height: 45px;
  }
  
  .search-container {
    padding: 10px;
    background-color: #1a1a1a;
    border-bottom: 1px solid #333;
  }
  
  .request-list {
    flex: 1;
    overflow-y: auto;
  }
  
  .request-item {
    padding: 12px 15px;
    border-bottom: 1px solid #333;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  
  .request-item:hover {
    background-color: #2a2a2a;
  }
  
  .request-item.selected {
    background-color: #333;
  }
  
  .request-item-number {
    font-weight: bold;
    color: #4caf50;
    font-size: 14px;
  }
  
  .empty-message {
    padding: 20px;
    color: #777;
    text-align: center;
    font-style: italic;
  }
  
  
  .response-panel-tab {
    padding: 6px 15px;
    flex: 1;
    display: flex;
    justify-content: space-between;
    transition: background-color 0.2s ease;
    height: 45px;
    background-color: #1a1a1a;
    border-radius: 0px 7px 0px 0px;
    border-bottom: 1px solid #333;
  }

  .panel-tab {
    padding: 6px 15px;
    flex: 1;
    display: flex;
    justify-content: space-between;
    transition: background-color 0.2s ease;
    height: 45px;
    background-color: #1a1a1a;
    border-bottom: 1px solid #333;
  }
  
  .request-content {
    flex: 1;
    height: 100%;
    width: 100%;
    min-width: 25%;
    padding: 0;
    border-right: 1px solid #333;
    overflow: auto;
    background-color: #1a1a1a;

  }
  
  .response-content {
    flex: 1;
    height: 100%;
    width: 100%;
    padding: 0;
    overflow: auto;
    background-color: #1a1a1a;

  }
  
  .loading-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    width: 100%;
    color: #ff5252;
    font-style: italic;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    margin-bottom: 10px;
    border: 3px solid rgba(255, 82, 82, 0.3);
    border-radius: 50%;
    border-top-color: #ff5252;
    animation: spin 1s ease-in-out infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
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


</style>
