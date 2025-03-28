<script lang="ts">
  import { Pane, Splitpanes } from 'svelte-splitpanes';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';
  import RequestTable from './RequestTable.svelte';
  import RequestPanel from './RequestPanel.svelte';
  import { tick } from 'svelte';
  import CodeMirror from "svelte-codemirror-editor";
  import { oneDark } from "@codemirror/theme-one-dark";
  
  // Import scopeStore from the centralized store
  import { scopeStore, type ScopeSettings } from '$lib/stores/scope';
  import { addRepeaterRequest } from '$lib/stores/repeater';
  import { projectState } from '$lib/stores/project';
  import '$lib/styles/requests.css'
  
  // Add search functionality
  let searchText = '';
  let useRegex = false;
  let statusFilter = '';
  
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

  // Scope filter state
  let showFilterOptions = false;
  let scopeOnly = false;
  let scopeSettings: ScopeSettings = { inScope: [], outOfScope: [] };
  
  // Sorting state
  let sortConfig: {column: string; direction: 'asc' | 'desc' | null}[] = [];

  // Column visibility context menu
  let columnMenuVisible = false;
  let columnMenuX = 0;
  let columnMenuY = 0;
  
  // Column configuration for sorting using a writable store
  const columnsStore = writable([
    { id: 'id', label: 'ID', type: 'numeric', visible: true },
    { id: 'protocol', label: 'Protocol', type: 'text', visible: true },
    { id: 'host', label: 'Host', type: 'text', visible: true },
    { id: 'method', label: 'Method', type: 'text', visible: true },
    { id: 'path', label: 'Path', type: 'text', visible: true },
    { id: 'status', label: 'Status', type: 'numeric', visible: true },
    { id: 'responseLength', label: 'Response Size', type: 'numeric', visible: true },
    { id: 'responseTime', label: 'Time (ms)', type: 'numeric', visible: true },
    { id: 'timestamp', label: 'Timestamp', type: 'date', visible: true }
  ]);
  
  // Filter requests based on search text, regex option, and status filter
  $: filteredRequests = requests
    .filter(request => {
      // First apply scope filter if enabled
      if (scopeOnly && !isInScope(request.host)) {
        return false;
      }
      
      // Then apply status filter if provided
      if (statusFilter && request.status) {
        if (!String(request.status).includes(statusFilter)) {
          return false;
        }
      }
      
      // Finally apply text search if provided
      if (searchText) {
        try {
          if (useRegex) {
            // Use regex search
            const regex = new RegExp(searchText, 'i'); // 'i' for case insensitive
            return regex.test(request.method) || 
                  regex.test(request.host) || 
                  regex.test(request.path) || 
                  (request.body && regex.test(request.body));
          } else {
            // Use simple case-insensitive search
            const searchLower = searchText.toLowerCase();
            return request.method.toLowerCase().includes(searchLower) || 
                  request.host.toLowerCase().includes(searchLower) || 
                  request.path.toLowerCase().includes(searchLower) || 
                  (request.body && request.body.toLowerCase().includes(searchLower));
          }
        } catch (e) {
          // Handle invalid regex
          console.error('Invalid regex:', e);
          return true; // Show all results if regex is invalid
        }
      }
      
      return true; // Include by default if no search or filters
    });
  
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
      // Clear sort config when clearing requests
      sortConfig = [];
    } catch (error) {
      console.error('Failed to clear requests:', error);
    }
  }
  
  // Sort the requests based on current sort configuration
  $: sortedRequests = [...filteredRequests].sort((a, b) => {
    // If no sort config, return original order
    if (sortConfig.length === 0) return 0;
    
    // Apply each sort in order
    for (const { column, direction } of sortConfig) {
      const columnConfig = $columnsStore.find(col => col.id === column);
      if (!columnConfig) continue;
      
      let valueA = a[column as keyof CapturedRequest];
      let valueB = b[column as keyof CapturedRequest];
      
      // Handle special case for timestamp
      if (column === 'timestamp') {
        valueA = new Date(valueA as string).getTime();
        valueB = new Date(valueB as string).getTime();
      }
      
      // Handle undefined or null values
      if (valueA === undefined || valueA === null) valueA = columnConfig.type === 'numeric' ? -Infinity : '';
      if (valueB === undefined || valueB === null) valueB = columnConfig.type === 'numeric' ? -Infinity : '';
      
      // Compare based on type
      let comparison = 0;
      if (columnConfig.type === 'numeric') {
        comparison = Number(valueA) - Number(valueB);
      } else if (columnConfig.type === 'date') {
        comparison = Number(valueA) - Number(valueB);
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }
      
      // Apply direction
      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }
    
    return 0;
  });

  // Function to handle header click for sorting
  function handleHeaderClick(columnId: string) {
    // Find if this column is already being sorted
    const columnSortIndex = sortConfig.findIndex(item => item.column === columnId);
    
    if (columnSortIndex === -1) {
      // Column not yet sorted, add it to sortConfig with 'asc' direction
      sortConfig = [...sortConfig, { column: columnId, direction: 'asc' }];
    } else {
      // Column is already sorted, toggle direction
      const currentDirection = sortConfig[columnSortIndex].direction;
      if (currentDirection === 'asc') {
        // Change to descending
        sortConfig[columnSortIndex].direction = 'desc';
        sortConfig = [...sortConfig]; // Trigger reactivity
      } else if (currentDirection === 'desc') {
        // Remove this column from sort
        sortConfig = sortConfig.filter(item => item.column !== columnId);
      }
    }
  }

  function toggleColumnVisibility(columnId: string, event?: Event) {
  if (event) {
    event.stopPropagation(); // Prevent the click from closing the menu
  }
  
  // Don't allow toggling off the ID column
  if (columnId === 'id' && $columnsStore.find(col => col.id === 'id')?.visible) {
    return; // Exit early if trying to hide the ID column
  }
  
  columnsStore.update(columns => {
    const columnIndex = columns.findIndex(col => col.id === columnId);
    if (columnIndex !== -1) {
      columns[columnIndex].visible = !columns[columnIndex].visible;
    }
    return columns;
  });
  
  // Re-add the event listener to close on the next outside click
  document.addEventListener('click', closeColumnMenu, { once: true });
}


  async function showColumnMenu(event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation(); // Add this to prevent immediate closing
    
    columnMenuX = event.clientX;
    columnMenuY = event.clientY;
    columnMenuVisible = true;
    
    await tick();
    // Use a timeout to avoid the same click that opened the menu from closing it
    setTimeout(() => {
      document.addEventListener('click', closeColumnMenu, { once: true });
    }, 0);
  }

  function closeColumnMenu(event?: MouseEvent) {
    // Don't close if the click was on a checkbox or within the menu
    if (event) {
      const menu = document.querySelector('.column-menu');
      if (menu && menu.contains(event.target as Node)) {
        // If clicked inside menu, re-add the event listener for the next outside click
        document.addEventListener('click', closeColumnMenu, { once: true });
        return;
      }
    }
    
    columnMenuVisible = false;
  }

  function getSortIndicator(columnId: string): string {
    const sortItem = sortConfig.find(item => item.column === columnId);
    if (!sortItem) return '';
    
    return sortItem.direction === 'asc' ? '▲' : '▼';
  }

  function getSortPriority(columnId: string): number | null {
    const index = sortConfig.findIndex(item => item.column === columnId);
    return index === -1 ? null : index + 1;
  }

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

  // Format date for display
  function formatDate(isoString: string) {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString();
    } catch (e) {
      return isoString;
    }
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



  // Toggle filter options visibility
  function toggleFilterOptions() {
    showFilterOptions = !showFilterOptions;
  }
  

  function selectRequest(request: CapturedRequest) {
    selectedRequest = request;
  }

  // Send request to repeater
  async function sendToRepeater(request: CapturedRequest) {
    if (!isElectron || !window.electronAPI?.proxy) {
      console.error('Repeater feature can only be used in the Electron app');
      return;
    }
    
    try {
      // First, add to the centralized store for any tabs in the current window
      addRepeaterRequest(request);
      
      // Then, notify other windows via the proxy API
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
  
  // Copy request URL to clipboard
  function copyRequestUrl(request: CapturedRequest) {
    const url = `${request.protocol}://${request.host}${request.path}`;
    
    navigator.clipboard.writeText(url)
      .then(() => {
        console.log('URL copied to clipboard:', url);
      })
      .catch((error) => {
        console.error('Failed to copy URL to clipboard:', error);
      });
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
      
      // Load scope settings from backend if scope API is available
      if (window.electronAPI && typeof window.electronAPI === 'object' && 'scope' in window.electronAPI) {
        const scopeAPI = (window.electronAPI as { scope?: { getSettings: () => Promise<ScopeSettings> } }).scope;
        if (scopeAPI && typeof scopeAPI.getSettings === 'function') {
          try {
            const savedScopeSettings = await scopeAPI.getSettings();
            scopeStore.set(savedScopeSettings);
            console.log('Loaded scope settings:', savedScopeSettings);
          } catch (scopeError) {
            console.error('Failed to load scope settings:', scopeError);
          }
        }
      }
      
      loading = false;
    } catch (error) {
      console.error('Failed to load data:', error);
      loading = false;
    }
  }
  
  // Initialize the UI after component is mounted
  onMount(() => {
    console.log(`RequestsTab mounted, standalone: ${standalone}`);
    
    // Load initial data
    loadInitialData();
    
    // Set up listeners for proxy events
    if (isElectron && window.electronAPI) {
      
      // Listen for proxy status updates
      window.electronAPI.receive('proxy-status', (status: any) => {
        console.log('Proxy status update:', status);
        proxyStatus = { ...proxyStatus, ...status };
      });

      // Listen for new requests
      window.electronAPI.receive('proxy-request', (requestData: CapturedRequest) => {
        console.log('New request:', requestData);
        // Add to requests list (ensure no duplicates)
        const existingIndex = requests.findIndex(r => r.id === requestData.id);
        if (existingIndex === -1) {
          requests = [requestData, ...requests];
          // Save to project (just pass the array of requests)
          projectState.addRequests([requestData]);
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

          // Update in project store (just pass the array of requests)
          projectState.addRequests([responseData]);
        }
      });
      
      // Listen for project state changes
      window.electronAPI.receive('project-state-changed', (data: { action: string; project: Project }) => {
        console.log('Project state changed:', data.action, data.project);
        
        if (data.action === 'new') {
          // Clear requests when a new project is created
          requests = [];
          selectedRequest = null;
          // Reset sorting
          sortConfig = [];
        } else if (data.action === 'open') {
          // Load saved requests when a project is opened
          const projectRequests = [
            ...(data.project.requests || []),
            ...(data.project.repeaterRequests || [])
          ];
          
          // Merge requests while maintaining uniqueness
          const uniqueRequests = projectRequests.reduce((acc: CapturedRequest[], request) => {
            if (!acc.some(r => r.id === request.id)) {
              acc.push(request);
            }
            return acc;
          }, []);
          
          requests = uniqueRequests;
          selectedRequest = null;
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
        <button class="control-button" class:active={scopeOnly || searchText || statusFilter} on:click={toggleFilterOptions}>
          Filter {(scopeOnly || searchText || statusFilter) ? '(Active)' : ''}
          <span class="dropdown-arrow">▼</span>
        </button>
        
        {#if showFilterOptions}
          <div class="dropdown-content">
            <div class="search-filter">
              <input 
                type="text" 
                placeholder="Search requests..." 
                bind:value={searchText} 
                class="search-input"
              />
              <label class="regex-option">
                <input type="checkbox" bind:checked={useRegex}>
                <span>Use regex</span>
              </label>
            </div>
            
            <div class="status-filter">
              <input 
                type="text" 
                placeholder="Filter by status code" 
                bind:value={statusFilter} 
                class="status-input"
              />
            </div>
            
            <label class="filter-option">
              <input type="checkbox" bind:checked={scopeOnly}>
              <span>In scope items only</span>
            </label>
            
            {#if filteredRequests.length === 0 && requests.length > 0}
              <div class="filter-warning">No requests match the current filters</div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>
<div class="requests-main-panel">
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
        <RequestTable
          {requests}
          {selectedRequest}
          {sortConfig}
          columns={columnsStore}
          {searchText}
          {useRegex}
          {statusFilter}
          {scopeOnly}
          scopeSettings={scopeSettings}
          selectRequest={selectRequest}
          on:contextmenu={(e) => showContextMenu(e.detail.event, e.detail.request)}
        />
      </Pane>
      <Pane>
        <Splitpanes theme="modern-theme">
          <Pane>
            <RequestPanel request={selectedRequest} panelType="request" on:contextmenu={(e) => showPanelContextMenu(e.detail)}/>
          </Pane>
          <Pane>
            <RequestPanel request={selectedRequest} panelType="response"/>
          </Pane>
          </Splitpanes>
        </Pane>
      </Splitpanes>
    </Pane>
  </Splitpanes>

  <!-- Context Menu for Requests -->
  {#if contextMenuVisible && contextMenuRequest}
    <div 
      class="context-menu" 
      style={`left: ${contextMenuX}px; top: ${contextMenuY}px`}
      on:click|stopPropagation
    >
      <div class="menu-item" on:click={() => contextMenuRequest && sendToRepeater(contextMenuRequest)}>
        Send to Repeater
      </div>
      <div class="menu-item" on:click={() => contextMenuRequest && copyRequestUrl(contextMenuRequest)}>
        Copy URL
      </div>
    </div>
  {/if}


</div>
