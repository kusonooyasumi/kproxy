<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Pane, Splitpanes } from 'svelte-splitpanes';
    import CodeMirror from "svelte-codemirror-editor";
    import { oneDark } from "@codemirror/theme-one-dark";
    import { 
      repeaterRequests, 
      selectedRepeaterIndex, 
      selectedRepeaterRequest,
      addRepeaterRequest,
      selectRepeaterRequest,
      updateRepeaterRequest,
      navigateRepeaterResponse,
      addRepeaterResponse,
      type RepeaterResponse,
      type RepeaterRequest,
      reorderRepeaterRequests // Add this function to your store
    } from '$lib/stores/repeater';
  
    // Props that can be passed to the component
    export let standalone = false; // Whether the component is running in standalone mode (new window)
    
    // Check if running in Electron
    const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
    
    // Keep track of edited request content
    let requestContent = '';
    let isLoading = false;
    let responseContent = '';
    let urlInput = 'https://target.com'; // Default URL
    let searchQuery = '';
    
    // Drag and drop variables
    let mouseYCoordinate: number | null = null;
    let distanceTopGrabbedVsPointer: number | null = null;
    let draggingItem: any | null = null;
    let draggingItemIndex: number | null = null;
    let hoveredItemIndex: number | null = null;
    let isDragging = false;
    let requestListContainer: HTMLDivElement | null = null;
    let dragStartTime = 0;
    let dragStartY = 0;
    let potentialDragItem: any | null = null;
    let potentialDragIndex: number | null = null;
    let dragThreshold = 5; // Pixels to move before considering it a drag
    
    // Initialize with any initial value
    onMount(() => {
      console.log(`RepeaterTab mounted, standalone: ${standalone}`);
      console.log($repeaterRequests);
      
      // Hide parent sidebar and tabs if in standalone mode
      if (standalone) {
        
        // If we're in standalone mode, we want to fetch the latest requests
        if (isElectron && window.electronAPI) {
          console.log('Standalone repeater tab mounted, requesting latest requests from main...');
          
          // Request the latest repeater requests from main process
          // We'll use a different IPC channel to request the current repeater state
          window.electronAPI.receive('current-repeater-state', (currentRequests: any[]) => {
            console.log('Received current repeater state:', currentRequests);
            
            // Add each request to the repeater store
            if (currentRequests && currentRequests.length > 0) {
              currentRequests.forEach(request => {
                addRepeaterRequest(request);
              });
            }
          });
          
          // Request the current state from main process
          // @ts-ignore - TS doesn't recognize this function that was added to the API
          window.electronAPI.proxy.getRepeaterState();
        }
      }
      
      // Set up listeners for requests sent to repeater
      if (isElectron && window.electronAPI) {
        // Listen for requests sent to repeater
        window.electronAPI.receive('send-to-repeater', (request: CapturedRequest) => {
          console.log('Received request in repeater:', request);
          // Create a new request object with required id
          const requestWithId = {
            ...request,
            id: request.id // Ensure id is present
          };
          addRepeaterRequest(requestWithId);
        });
      }
      
      // Add global event listeners for drag and drop
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    });
    
    // Track mouse position for manual drag handling
    function handleMouseMove(e: MouseEvent): void {
      // Check if we have a potential drag that hasn't started yet
      if (potentialDragItem && !isDragging) {
        // Calculate distance moved from drag start
        const distanceMoved = Math.abs(e.clientY - dragStartY);
        
        // If moved past threshold, initiate drag
        if (distanceMoved > dragThreshold) {
          isDragging = true;
          draggingItem = potentialDragItem;
          draggingItemIndex = potentialDragIndex;
          mouseYCoordinate = e.clientY;
          
          // Calculate distance from top of item to pointer
          if (e.target instanceof HTMLElement) {
            const parent = e.target.closest('.request-item');
            if (parent instanceof HTMLElement) {
              distanceTopGrabbedVsPointer = parent.getBoundingClientRect().y - e.clientY;
            }
          }
        }
      }
      
      // Handle active dragging
      if (isDragging && draggingItem && requestListContainer) {
        mouseYCoordinate = e.clientY;
        
        // Get all visible items (excluding the ghost and the dragged item)
        const items = Array.from(requestListContainer.querySelectorAll('.request-item:not(.ghost):not(.invisible)'));
        
        // Get container bounds
        const containerRect = requestListContainer.getBoundingClientRect();
        
        // Check if we're above the first item
        const firstItem = items[0] as HTMLElement;
        if (firstItem && e.clientY < firstItem.getBoundingClientRect().top) {
          hoveredItemIndex = 0;
          return;
        }
        
        // Check if we're below the last item
        const lastItem = items[items.length - 1] as HTMLElement;
        if (lastItem && e.clientY > lastItem.getBoundingClientRect().bottom) {
          // Make sure we're still within the container's vertical bounds
          if (e.clientY <= containerRect.bottom) {
            hoveredItemIndex = filteredRequests.length;
            
            // If dragging the last item, no change needed
            if (draggingItemIndex === filteredRequests.length - 1) {
              return;
            }
          }
          return;
        }
        
        // Check each item to see which one we're hovering over
        let foundHoveredItem = false;
        for (let i = 0; i < items.length; i++) {
          const item = items[i] as HTMLElement;
          const rect = item.getBoundingClientRect();
          
          // Calculate the middle of the item
          const itemMiddle = rect.top + (rect.height / 2);
          
          // If cursor is above the middle of the item, we're hovering above it
          if (e.clientY < itemMiddle) {
            hoveredItemIndex = i;
            foundHoveredItem = true;
            break;
          }
          // If cursor is below the middle of the item, we're hovering below it
          else if (e.clientY >= itemMiddle) {
            hoveredItemIndex = i + 1;
            foundHoveredItem = true;
          }
        }
        
        // Adjust for drag direction if we have a dragging item
        if (foundHoveredItem && draggingItemIndex !== null && hoveredItemIndex !== null) {
          // If dragging item is above the hover position, adjust index
          if (draggingItemIndex < hoveredItemIndex) {
            hoveredItemIndex -= 1;
          }
          // If dragging item is below the hover position, no adjustment needed
        }
        
        // If we didn't find a hovered item but we're within the container,
        // and we're below the last item, set to the end
        if (!foundHoveredItem && e.clientY > containerRect.top && e.clientY < containerRect.bottom) {
          if (lastItem && e.clientY > lastItem.getBoundingClientRect().bottom) {
            hoveredItemIndex = filteredRequests.length - 1;
          }
        }
        
        // Reorder the requests if needed
        if (
          draggingItemIndex !== null && 
          hoveredItemIndex !== null &&
          draggingItemIndex !== hoveredItemIndex &&
          hoveredItemIndex >= 0 && 
          hoveredItemIndex <= filteredRequests.length
        ) {
          console.log(`Moving item from ${draggingItemIndex} to ${hoveredItemIndex}`);
          
          // Create a new copy of the filtered requests
          const newRequests = [...filteredRequests];
          
          // Remove the dragged item
          const [draggedItem] = newRequests.splice(draggingItemIndex, 1);
          
          // Insert it at the new position
          newRequests.splice(hoveredItemIndex, 0, draggedItem);
          
          // Update the store with the new order
          // Map filtered requests back to original indices
          const originalIndices = newRequests.map(item => 
            $repeaterRequests.findIndex(r => r.repeaterId === item.repeaterId)
          );
          
          // Reorder the requests in the store
          reorderRepeaterRequests(originalIndices);
          
          // Update dragging index
          draggingItemIndex = hoveredItemIndex;
        }
      }
    }
    
    function handleMouseUp(e: MouseEvent): void {
      // If we have a potential drag that never started, treat it as a click
      if (potentialDragItem && !isDragging) {
        // Handle as a click - select the request
        const originalIndex = $repeaterRequests.findIndex(r => r.repeaterId === potentialDragItem.repeaterId);
        if (originalIndex !== -1) {
          selectRepeaterRequest(originalIndex);
        }
      }
      
      // Reset all drag state
      isDragging = false;
      draggingItem = null;
      draggingItemIndex = null;
      hoveredItemIndex = null;
      mouseYCoordinate = null;
      potentialDragItem = null;
      potentialDragIndex = null;
    }
    
    // Update URL input when selected request changes
    $: if ($selectedRepeaterRequest) {
      urlInput = `${$selectedRepeaterRequest.protocol}://${$selectedRepeaterRequest.host}${$selectedRepeaterRequest.path}`;
    } else if (!urlInput) {
      urlInput = 'https://target.com';
    }
    
    // Handle URL input change to update selected request
    function handleUrlChange() {
      if (!$selectedRepeaterRequest) return;
      
      try {
        // Parse the URL to extract protocol, host, and path
        const parsedUrl = new URL(urlInput);
        
        // Update the selected request
        const updatedRequest = {
          ...$selectedRepeaterRequest,
          protocol: parsedUrl.protocol.replace(':', '') as 'http' | 'https',
          host: parsedUrl.host,
          path: parsedUrl.pathname + parsedUrl.search
        };
        
        // Update the request in the store
        updateRepeaterRequest(updatedRequest.repeaterId, updatedRequest);
        
      } catch (error) {
        console.error('Error parsing URL:', error);
        // Invalid URL, revert to the original
        if ($selectedRepeaterRequest) {
          urlInput = `${$selectedRepeaterRequest.protocol}://${$selectedRepeaterRequest.host}${$selectedRepeaterRequest.path}`;
        }
      }
    }
    
    // Format request as a string
    function formatRequestString(request: RepeaterRequest): string {
      return `${request.method} ${request.path} HTTP/1.1
  Host: ${request.host}
  ${Object.entries(request.headers || {})
    .filter(([key]) => key.toLowerCase() !== 'host')
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}
  
  ${request.body || ''}`;
    }
    
    // Format response as a string
    function formatResponseString(response: RepeaterResponse): string {
      if (!response) {
        return 'No response data available. Click "Send" to execute the request.';
      }
      
      let output = `HTTP/1.1 ${response.status}
  ${Object.entries(response.responseHeaders || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n')}
  
  ${response.responseBody}`;
  
      // Add request data if available
      if (response.requestData) {
        output += `\n\n--- Request Data ---
  Method: ${response.requestData.method}
  URL: ${response.requestData.url}
  Headers:
  ${Object.entries(response.requestData.headers || {})
    .map(([key, value]) => `  ${key}: ${value}`)
    .join('\n')}
  
  Body:
  ${response.requestData.body || '(empty)'}`;
      }
  
      return output;
    }
    
    // Update response content when current response changes
    $: if ($selectedRepeaterRequest) {
      const currentResponse = $selectedRepeaterRequest.responses[$selectedRepeaterRequest.currentResponseIndex];
      responseContent = formatResponseString(currentResponse);
    }
    
    // Navigate to previous response for current request
    function previousResponse() {
      if (!$selectedRepeaterRequest || $selectedRepeaterRequest.responses.length === 0) return;
      navigateRepeaterResponse($selectedRepeaterRequest.repeaterId, 'prev');
      updateRequestContent();
    }
    
    // Navigate to next response for current request
    function nextResponse() {
      if (!$selectedRepeaterRequest || $selectedRepeaterRequest.responses.length === 0) return;
      navigateRepeaterResponse($selectedRepeaterRequest.repeaterId, 'next');
      updateRequestContent();
    }
  
    // Update request content based on current response's request data
    function updateRequestContent() {
      if (!$selectedRepeaterRequest) return;
      const currentResponse = $selectedRepeaterRequest.responses[$selectedRepeaterRequest.currentResponseIndex];
      
      // If we have a response with request data, use that
      if (currentResponse?.requestData) {
        try {
          const url = new URL(currentResponse.requestData.url);
          requestContent = formatRequestString({
            ...$selectedRepeaterRequest,
            method: currentResponse.requestData.method,
            protocol: url.protocol.replace(':', '') as 'http' | 'https',
            host: url.host,
            path: url.pathname + url.search,
            headers: currentResponse.requestData.headers,
            body: currentResponse.requestData.body,
            id: $selectedRepeaterRequest.id // Ensure id is present
          });
          return;
        } catch (error) {
          console.error('Error parsing request URL:', error);
        }
      }
      
      // Fall back to the request's current state
      requestContent = formatRequestString({
        ...$selectedRepeaterRequest,
        id: $selectedRepeaterRequest.id // Ensure id is present
      });
    }
  
    // Update request content when:
    // - Selected request changes
    // - Response index changes
    // - Request is modified
    $: if ($selectedRepeaterRequest) {
      updateRequestContent();
    }
    
    // Parse the edited request content back into a request object
    function parseRequestContent(content: string, originalRequest: typeof $selectedRepeaterRequest): typeof $selectedRepeaterRequest {
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
      if (!$selectedRepeaterRequest || !isElectron) return;
      
      // Parse the edited content to update the request object
      const updatedRequest = parseRequestContent(requestContent, $selectedRepeaterRequest);
      
      if (!updatedRequest) {
        console.error('Failed to parse request content');
        responseContent = 'Error: Failed to parse request content';
        return;
      }
      
      console.log('Sending request from repeater:', updatedRequest);
      
      // Set loading state
      isLoading = true;
      responseContent = 'Loading...';
      
      try {
        // Update the store with the modified request first
        updateRepeaterRequest($selectedRepeaterRequest.repeaterId, updatedRequest);
        
        // Clone the request to avoid reference issues
        const requestToSend = JSON.parse(JSON.stringify(updatedRequest));
        
        // Send the request through Electron API
        if (window.electronAPI) {
          const response = await window.electronAPI.tab.sendRequest(requestToSend);
          
          if (response.error) {
            throw new Error(response.error);
          }
          
          // Add the response to the request's history along with the request data
          addRepeaterResponse($selectedRepeaterRequest.repeaterId, {
            status: response.status,
            responseHeaders: response.headers,
            responseBody: response.body,
            responseLength: response.size || (response.body ? response.body.length : 0),
            responseTime: response.time,
            requestData: {
              method: requestToSend.method,
              url: `${requestToSend.protocol}://${requestToSend.host}${requestToSend.path}`,
              headers: requestToSend.headers,
              body: requestToSend.body,
              timestamp: new Date().toISOString()
            }
          });
        }
      } catch (error: unknown) {
        console.error('Error sending request:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        responseContent = `Error sending request: ${errorMessage}`;
      } finally {
        isLoading = false;
      }
    }
    
    // Search for requests based on the query
    function filterRequests(requests: typeof $repeaterRequests, query: string): typeof $repeaterRequests {
      if (!query.trim()) return requests;
      
      const lowercaseQuery = query.toLowerCase();
      return requests.filter(request => 
        request.host.toLowerCase().includes(lowercaseQuery) ||
        request.path.toLowerCase().includes(lowercaseQuery) ||
        request.method.toLowerCase().includes(lowercaseQuery)
      );
    }
    
    // Computed filtered requests
    $: filteredRequests = filterRequests($repeaterRequests, searchQuery);
    
    // Clean up event listeners
    onDestroy(() => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
        disabled={!$selectedRepeaterRequest}
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
                Requests ({$repeaterRequests.length})
              </div>
              <div class="search-container">
                <input 
                  type="text" 
                  class="search-input" 
                  placeholder="Search requests" 
                  bind:value={searchQuery}
                >
              </div>
              <div class="request-list" bind:this={requestListContainer}>
                {#if mouseYCoordinate && draggingItem && distanceTopGrabbedVsPointer !== null}
                  <div
                    class="request-item ghost"
                    style="transform: translateY({mouseYCoordinate - requestListContainer?.getBoundingClientRect().top + distanceTopGrabbedVsPointer}px)">
                    <div class="request-item-number">
                      {draggingItem.requestNumber}. {draggingItem.name}
                    </div>
                    <div class="request-item-details">
                      {draggingItem.method} {draggingItem.host}{draggingItem.path}
                    </div>
                  </div>
                {/if}
                
                {#if $repeaterRequests.length === 0}
                  <div class="empty-message">No requests yet. Send requests from the Requests tab.</div>
                {:else}
                  {#each filteredRequests as request, index}
                    <!-- Find the original index of this request in the full list -->
                    {@const originalIndex = $repeaterRequests.findIndex(r => r.repeaterId === request.repeaterId)}
                    <div 
                      class="request-item {draggingItem && draggingItem.repeaterId === request.repeaterId ? 'invisible' : ''}" 
                      class:selected={$selectedRepeaterIndex === originalIndex}
                      on:mousedown={(e) => {
                        if (e.button !== 0) return; // Only handle left mouse button
                        
                        // Store the initial position and time for drag detection
                        dragStartTime = Date.now();
                        dragStartY = e.clientY;
                        
                        // Store potential drag item, but don't start dragging yet
                        potentialDragItem = request;
                        potentialDragIndex = index;
                        
                        // Prevent text selection during drag
                        e.preventDefault();
                      }}
                    >
                      <div class="request-item-number">
                        {request.requestNumber}. 
                        {#if $selectedRepeaterIndex === originalIndex}
                          <input
                            type="text"
                            class="request-name-input"
                            bind:value={request.name}
                            on:blur={() => updateRepeaterRequest(request.repeaterId, { name: request.name })}
                            on:keydown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            on:mousedown={(e) => e.stopPropagation()} 
                          >
                        {:else}
                          {request.name}
                        {/if}
                      </div>
                      <div class="request-item-details">
                        {request.method} {request.host}{request.path}
                      </div>
                    </div>
                  {/each}
                {/if}
                
              </div>
            </div>
          
        </Pane>
        <Pane>
          <div class="panel-tab">
            <span>Request</span>
            </div>
          <div class="request-content">
          <CodeMirror theme={oneDark} bind:value={requestContent} lineWrapping={true}/>
        </div>
        </Pane>
        <Pane>
          <div class="response-panel-tab">
            <span>Response</span>
            <div class="panel-buttons">
            <button 
              class="nav-button" 
              on:click={previousResponse}
              disabled={!$selectedRepeaterRequest || $selectedRepeaterRequest.responses.length === 0 || $selectedRepeaterRequest.currentResponseIndex === 0}
            >Prev</button>
            <span class="response-position">
              {$selectedRepeaterRequest?.responses.length ? `${$selectedRepeaterRequest.currentResponseIndex + 1}/${$selectedRepeaterRequest.responses.length}` : '0/0'}
            </span>
            <button 
              class="nav-button" 
              on:click={nextResponse}
              disabled={!$selectedRepeaterRequest || $selectedRepeaterRequest.responses.length === 0 || $selectedRepeaterRequest.currentResponseIndex === $selectedRepeaterRequest.responses.length - 1}
            >Next</button>
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
  
    .nav-button {
      padding: 3px 8px;
      background-color: #333;
      border: none;
      color: white;
      cursor: pointer;
      border-radius: 4px;
      transition: background-color 0.2s ease;
    }
  
    .nav-button:hover:not(:disabled) {
      background-color: #444;
    }
  
    .nav-button:disabled {
      opacity: 0.5;
      cursor: default;
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
      position: relative; /* For absolute positioning of ghost items */
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
      position: relative;
    }
    
    .request-item {
      padding: 12px 15px;
      border-bottom: 1px solid #333;
      cursor: pointer;
      transition: background-color 0.2s ease;
      user-select: none;
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
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  
    .request-item-details {
      font-size: 12px;
      color: #777;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 2px;
    }
    
    .empty-message {
      padding: 20px;
      color: #777;
      text-align: center;
      font-style: italic;
    }
    
    .ghost {
      pointer-events: none;
      z-index: 99;
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      opacity: 0.8;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
      background-color: #2a2a2a;
      border: 1px dashed #4caf50;
      will-change: transform;
    }
    
    .invisible {
      opacity: 0;
      pointer-events: none;
    }
    
    .drop-area-bottom {
      height: 50px;
      border: 1px dashed #333;
      margin: 10px 15px;
      border-radius: 4px;
      background-color: rgba(76, 175, 80, 0.05);
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
    
    .request-name-input {
      background-color: #333;
      border: 1px solid #444;
      color: #fff;
      padding: 2px 4px;
      border-radius: 3px;
      font-size: 14px;
      width: 70%;
    }
  </style>
