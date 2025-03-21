<script lang="ts">
  import { Pane, Splitpanes } from 'svelte-splitpanes';
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';
  import type { Writable } from 'svelte/store';
  import { tick } from 'svelte';
  import CodeMirror from "svelte-codemirror-editor";
  import { oneDark } from "@codemirror/theme-one-dark";
  import { scopeStore, type ScopeSettings } from '$lib/stores/scope';

  // Import global types
  type CapturedRequest = globalThis.CapturedRequest;
  type Project = globalThis.Project;
  
  let responseContent = '';
  let requestContent = '';
  
  
  // Interface for sitemap node
  interface SitemapNode {
    name: string;
    type: 'domain' | 'subdomain' | 'path' | 'parameterized';
    children: Map<string, SitemapNode>;
    requests: CapturedRequest[];
    expanded: boolean;
    parent?: SitemapNode;
    fullPath: string;
  }
  

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
  
  // Sitemap state
  let sitemapRoot: SitemapNode = {
    name: 'Root',
    type: 'domain',
    children: new Map(),
    requests: [],
    expanded: true,
    fullPath: ''
  };
  let selectedNode: SitemapNode | null = null;
  
  // Scope filter state
  let showFilterOptions = false;
  let scopeOnly = false;
  let scopeSettings: ScopeSettings = { inScope: [], outOfScope: [] };
  
  
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
      // Clear sitemap
      sitemapRoot = {
        name: 'Root',
        type: 'domain',
        children: new Map(),
        requests: [],
        expanded: true,
        fullPath: ''
      };
      selectedNode = null;
    } catch (error) {
      console.error('Failed to clear requests:', error);
    }
  }
  
  // Function to add a request to the sitemap
  function addRequestToSitemap(request: CapturedRequest) {
    const url = new URL(`http://${request.host}${request.path}`);
    const hostname = url.hostname;
    const pathname = url.pathname;
    const hasParams = url.search.length > 0;
    
    // Split the hostname into parts
    const hostnameParts = hostname.split('.');
    const isSubdomain = hostnameParts.length > 2;
    
    // Get or create the domain node
    let domainName: string;
    if (isSubdomain) {
      // For subdomains, use the last two parts as the domain
      domainName = hostnameParts.slice(-2).join('.');
    } else {
      domainName = hostname;
    }
    
    let domainNode = sitemapRoot.children.get(domainName);
    if (!domainNode) {
      domainNode = {
        name: domainName,
        type: 'domain',
        children: new Map(),
        requests: [],
        expanded: false,
        parent: sitemapRoot,
        fullPath: domainName
      };
      sitemapRoot.children.set(domainName, domainNode);
    }
    
    // If it's a subdomain, add the subdomain node
    let currentNode = domainNode;
    if (isSubdomain) {
      // Get all subdomain parts except the domain part
      const subdomainParts = hostnameParts.slice(0, -2);
      const subdomain = subdomainParts.join('.');
      
      let subdomainNode = domainNode.children.get(subdomain);
      if (!subdomainNode) {
        subdomainNode = {
          name: subdomain,
          type: 'subdomain',
          children: new Map(),
          requests: [],
          expanded: false,
          parent: domainNode,
          fullPath: `${subdomain}.${domainName}`
        };
        domainNode.children.set(subdomain, subdomainNode);
      }
      currentNode = subdomainNode;
    }
    
    // Add the path node
    let pathNode = currentNode.children.get(pathname);
    if (!pathNode) {
      pathNode = {
        name: pathname || '/',
        type: 'path',
        children: new Map(),
        requests: [],
        expanded: false,
        parent: currentNode,
        fullPath: `${currentNode.fullPath}${pathname}`
      };
      currentNode.children.set(pathname, pathNode);
    }
    
    // Add the request to the path node
    pathNode.requests.push(request);
    
    // If there are query parameters, add a parameterized node
    if (hasParams) {
      const queryParams = url.search;
      let paramNode = pathNode.children.get(queryParams);
      if (!paramNode) {
        paramNode = {
          name: queryParams,
          type: 'parameterized',
          children: new Map(),
          requests: [],
          expanded: false,
          parent: pathNode,
          fullPath: `${pathNode.fullPath}${queryParams}`
        };
        pathNode.children.set(queryParams, paramNode);
      }
      paramNode.requests.push(request);
    }
    
    // Trigger reactivity by reassigning sitemapRoot
    sitemapRoot = { ...sitemapRoot };
  }
  
  // Update a request in the sitemap
  function updateRequestInSitemap(updatedRequest: CapturedRequest) {
    // Find and update the request in the sitemap
    function traverseAndUpdate(node: SitemapNode): boolean {
      for (let i = 0; i < node.requests.length; i++) {
        if (node.requests[i].id === updatedRequest.id) {
          node.requests[i] = updatedRequest;
          return true;
        }
      }
      
      for (const childNode of node.children.values()) {
        if (traverseAndUpdate(childNode)) {
          return true;
        }
      }
      
      return false;
    }
    
    traverseAndUpdate(sitemapRoot);
    
    // Trigger reactivity
    sitemapRoot = { ...sitemapRoot };
  }
  
  // Toggle node expansion
  function toggleNode(node: SitemapNode) {
    node.expanded = !node.expanded;
    // Trigger reactivity
    sitemapRoot = { ...sitemapRoot };
  }
  
  // Select a node
  function selectNode(node: SitemapNode) {
    selectedNode = node;
    if (node.requests.length > 0) {
      // Select the most recent request
      selectedRequest = node.requests[node.requests.length - 1];
      responseContent = formatFullResponse(selectedRequest)
      requestContent = formatFullRequest(selectedRequest)
    } else {
      selectedRequest = null;
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
  
  // Toggle scope-only filter
  function toggleScopeOnly() {
    scopeOnly = !scopeOnly;
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
    responseContent = formatFullResponse(request);
    requestContent = formatFullRequest(request);
  }
  
  // Send request to repeater
  async function sendToRepeater(request: CapturedRequest | null) {
    if (!request || !isElectron || !window.electronAPI?.proxy) {
      console.error('Repeater feature can only be used in the Electron app with a valid request');
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
      
      // Build initial sitemap from existing requests
      requests.forEach(request => {
        addRequestToSitemap(request);
      });
      
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
  
  // Recursive function to render sitemap nodes
  function renderSitemapNode(node: SitemapNode, level: number = 0): string {
    const nodeClass = `sitemap-node ${node.type} ${selectedNode === node ? 'selected' : ''}`;
    const paddingLeft = `${level * 20}px`;
    const hasChildren = node.children.size > 0;
    
    return `
      <div class="${nodeClass}" style="padding-left: ${paddingLeft};">
        <div class="node-header" on:click={() => selectNode(node)}>
          ${hasChildren ? 
            `<span class="toggle-icon" on:click|stopPropagation={() => toggleNode(node)}>
              ${node.expanded ? '▼' : '►'}
            </span>` : 
            `<span class="toggle-icon-placeholder"></span>`
          }
          <span class="node-name">${node.name}</span>
          ${node.requests.length > 0 ? `<span class="request-count">(${node.requests.length})</span>` : ''}
        </div>
        ${node.expanded && hasChildren ? 
          `<div class="node-children">
            ${Array.from(node.children.values()).map((child: SitemapNode): string => renderSitemapNode(child, level + 1)).join('')}
          </div>` : 
          ''
        }
      </div>
    `;
  }
  
  // Initialize the UI after component is mounted
  onMount(() => {
    console.log(`SitemapTab mounted, standalone: ${standalone}`);
    
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
          // Add to sitemap
          addRequestToSitemap(requestData);
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
          
          // Update in sitemap
          updateRequestInSitemap(responseData);
          
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
          
          // Clear sitemap
          sitemapRoot = {
            name: 'Root',
            type: 'domain',
            children: new Map(),
            requests: [],
            expanded: true,
            fullPath: ''
          };
          selectedNode = null;
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


<div class="sitemap-header">
<h3>Site Map</h3>
<div class="sitemap-controls">
  <button class="control-button scope-button" on:click={toggleScopeOnly}>
    {scopeOnly ? 'Show All' : 'In-Scope Only'}
  </button>
  <button class="control-button" on:click={clearRequests}>Clear</button>
  <div class="status-indicator" class:running={proxyStatus.isRunning} title={proxyStatus.isRunning ? 'Proxy Running' : 'Proxy Stopped'}>
    <div class="status-dot"></div>
    <span>Proxy {proxyStatus.isRunning ? 'Running' : 'Stopped'}</span>
  </div>
</div>
</div>

<div class="main-container-sitemap">
<Splitpanes theme="modern-theme" style="height:100%">
  <!-- Left Pane (Sitemap) -->
  <Pane size={30} minSize={20}>
    <div class="sitemap-container">
      <div class="sitemap-tree">
        {#if sitemapRoot.children.size === 0}
          <div class="empty-sitemap">
            {#if proxyStatus.isRunning}
              No requests captured yet. Configure your browser to use proxy at localhost:{proxyStatus.port}
            {:else}
              Start the proxy server to capture HTTP/HTTPS requests
            {/if}
          </div>
        {:else}
          <!-- Recursive rendering of sitemap nodes -->
          {#each Array.from(sitemapRoot.children.values()) as domain}
            {#if !scopeOnly || isInScope(domain.name)}
              <div class="sitemap-node domain {selectedNode === domain ? 'selected' : ''}">
                <div class="node-header" on:click={() => selectNode(domain)}>
                  <span class="toggle-icon" on:click|stopPropagation={() => toggleNode(domain)}>
                    {domain.expanded ? '▼' : '►'}
                  </span>
                  <span class="node-name">{domain.name}</span>
                  {#if domain.requests.length > 0}
                    <span class="request-count">({domain.requests.length})</span>
                  {/if}
                </div>
                
                {#if domain.expanded && domain.children.size > 0}
                  <div class="node-children">
                    {#each Array.from(domain.children.values()) as child}
                      <div class="sitemap-node {child.type} {selectedNode === child ? 'selected' : ''}" style="padding-left: 20px;">
                        <div class="node-header" on:click={() => selectNode(child)}>
                          {#if child.children.size > 0}
                            <span class="toggle-icon" on:click|stopPropagation={() => toggleNode(child)}>
                              {child.expanded ? '▼' : '►'}
                            </span>
                          {:else}
                            <span class="toggle-icon-placeholder"></span>
                          {/if}
                          <span class="node-name">{child.name}</span>
                          {#if child.requests.length > 0}
                            <span class="request-count">({child.requests.length})</span>
                          {/if}
                        </div>
                        
                        {#if child.expanded && child.children.size > 0}
                          <div class="node-children">
                            {#each Array.from(child.children.values()) as pathNode}
                              <div class="sitemap-node {pathNode.type} {selectedNode === pathNode ? 'selected' : ''}" style="padding-left: 20px;">
                                <div class="node-header" on:click={() => selectNode(pathNode)}>
                                  {#if pathNode.children.size > 0}
                                    <span class="toggle-icon" on:click|stopPropagation={() => toggleNode(pathNode)}>
                                      {pathNode.expanded ? '▼' : '►'}
                                    </span>
                                  {:else}
                                    <span class="toggle-icon-placeholder"></span>
                                  {/if}
                                  <span class="node-name">{pathNode.name}</span>
                                  {#if pathNode.requests.length > 0}
                                    <span class="request-count">({pathNode.requests.length})</span>
                                  {/if}
                                </div>
                                
                                {#if pathNode.expanded && pathNode.children.size > 0}
                                  <div class="node-children">
                                    {#each Array.from(pathNode.children.values()) as paramNode}
                                      <div class="sitemap-node parameterized {selectedNode === paramNode ? 'selected' : ''}" style="padding-left: 20px;">
                                        <div class="node-header" on:click={() => selectNode(paramNode)}>
                                          <span class="toggle-icon-placeholder"></span>
                                          <span class="node-name">{paramNode.name}</span>
                                          {#if paramNode.requests.length > 0}
                                            <span class="request-count">({paramNode.requests.length})</span>
                                          {/if}
                                        </div>
                                      </div>
                                    {/each}
                                  </div>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          {/each}
        {/if}
      </div>
    </div>
  </Pane>
  
  <!-- Right Pane (Request Details) -->
  <Pane size={70}>
    <Splitpanes theme="modern-theme" horizontal>
      <Pane size={40} minSize={20}>
        <div class="panel request-info-panel">
          <div class="panel-header">
            <h3>Request Information</h3>
          </div>
          <div class="panel-content">
            {#if selectedRequest}
              <div class="request-info">
                <div class="info-group">
                  <div class="info-label">Host:</div>
                  <div class="info-value">{selectedRequest.host}</div>
                </div>
                <div class="info-group">
                  <div class="info-label">Path:</div>
                  <div class="info-value">{selectedRequest.path}</div>
                </div>
                <div class="info-group">
                  <div class="info-label">Method:</div>
                  <div class="info-value method {selectedRequest.method.toLowerCase()}">{selectedRequest.method}</div>
                </div>
                <div class="info-group">
                  <div class="info-label">Status:</div>
                  <div class="info-value">
                    {#if selectedRequest.status}
                      <span class="status-code ">
                        {selectedRequest.status} {getStatusText(selectedRequest.status)}
                      </span>
                    {:else}
                      <span class="no-response">No response</span>
                    {/if}
                  </div>
                </div>
                <div class="info-group">
                  <div class="info-label">Time:</div>
                  <div class="info-value">{formatDate(selectedRequest.timestamp)}</div>
                </div>
                <div class="info-actions">
                  <button class="action-button" on:click={() => sendToRepeater(selectedRequest)}>Send to Repeater</button>
                </div>
              </div>
              
              {#if selectedNode && selectedNode.requests.length > 1}
                <div class="requests-table-container">
                  <h4>All Requests for this Path</h4>
                  <table class="requests-table">
                    <thead>
                      <tr>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Time</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each selectedNode.requests as request}
                        <tr class:selected={selectedRequest && selectedRequest.id === request.id}>
                          <td class="method {request.method.toLowerCase()}">{request.method}</td>
                          <td>
                            {#if request.status}
                              {request.status}
                            {:else}
                              <span class="no-response">-</span>
                            {/if}
                          </td>
                          <td>{formatDate(request.timestamp)}</td>
                          <td>
                            <button class="small-button" on:click={() => selectRequest(request)}>View</button>
                            <button class="small-button" on:click={() => sendToRepeater(request)}>Repeater</button>
                          </td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            {:else}
              <div class="no-selection">Select a request from the sitemap to view details</div>
            {/if}
          </div>
        </div>
      </Pane>
      
      <Pane size={60}>
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
                  {:else}
                    <div class="no-selection">Select a request to view details</div>
                  {/if}
                </div>
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
                  {:else}
                    <div class="no-selection">Select a request to view details</div>
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

<!-- Context Menu for Requests -->
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

<!-- Loading State -->
{#if loading}
  <div class="loading-overlay">
    <div class="loading-spinner"></div>
    <div>Loading...</div>
  </div>
{/if}

<style>
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
  
  /* Sitemap Styles */
  .main-container-sitemap {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #1a1a1a;
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #ddd;
    overflow: auto;
  }

  .sitemap-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: #1a1a1a;
    border-radius: 4px;
    overflow: auto;
  }
  
  .sitemap-header {
    padding: 11px 15px;
    background-color: #1a1a1a;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border: 1px solid #ddd;
    margin-bottom: 10px;
    border-radius: 4px;
  }
  
  .sitemap-header h3 {
    margin: 0;
    font-size: 16px;
    color: #ddd;
  }
  
  .sitemap-controls {
    display: flex;
    gap: 10px;
    align-items: center;
  }
  
  .sitemap-tree {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
  }
  
  .sitemap-node {
    margin-bottom: 2px;
  }
  
  .node-header {
    display: flex;
    align-items: center;
    padding: 5px;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .node-header:hover {
    background-color: #2a2a2a;
  }
  
  .sitemap-node.selected > .node-header {
    background-color: #303030;
  }
  
  .toggle-icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: #aaa;
    margin-right: 5px;
  }
  
  .toggle-icon-placeholder {
    width: 16px;
    margin-right: 5px;
  }
  
  .node-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .request-count {
    font-size: 12px;
    color: #aaa;
    margin-left: 5px;
  }
  
  .node-children {
    margin-left: 10px;
  }
  
  /* Node type styling */
  .sitemap-node.domain > .node-header .node-name {
    color: #4caf50;
    font-weight: bold;
  }
  
  .sitemap-node.subdomain > .node-header .node-name {
    color: #2196f3;
  }
  
  .sitemap-node.path > .node-header .node-name {
    color: #ddd;
  }
  
  .sitemap-node.parameterized > .node-header .node-name {
    color: #ff9800;
    font-style: italic;
  }
  
  .empty-sitemap {
    padding: 20px;
    text-align: center;
    color: #888;
    font-style: italic;
  }
  
  /* Request Controls */
  .status-indicator {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: bold;
    font-size: 12px;
  }
  
  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #777;
  }
  
  .status-indicator.running .status-dot {
    background-color: #4caf50;
    box-shadow: 0 0 8px #4caf50;
  }
  
  .control-button {
    padding: 5px 10px;
    background-color: #333;
    border: none;
    border-radius: 4px;
    color: #fff;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-size: 12px;
  }
  
  .control-button:hover {
    background-color: #444;
  }
  
  .scope-button {
    background-color: #2196f3;
  }
  
  .scope-button:hover {
    background-color: #1976d2;
  }
  
  /* Request Info Panel */
  .request-info-panel {
    height: 100%;
    background-color: #1a1a1a;
    border-radius: 7px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  
  .request-info {
    padding: 15px;
  }
  
  .info-group {
    display: flex;
    margin-bottom: 10px;
  }
  
  .info-label {
    width: 80px;
    font-weight: bold;
    color: #aaa;
  }
  
  .info-value {
    flex: 1;
    word-break: break-word;
  }
  
  .info-actions {
    margin-top: 20px;
    display: flex;
    gap: 10px;
  }
  
  .action-button {
    padding: 8px 15px;
    background-color: #2196f3;
    border: none;
    border-radius: 4px;
    color: white;
    cursor: pointer;
  }
  
  .action-button:hover {
    background-color: #1976d2;
  }
  
  /* Method styling */
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
  
  /* Status code styling */
  .status-code {
    padding: 3px 7px;
    border-radius: 4px;
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
  
  .no-response {
    color: #888;
    font-style: italic;
  }
  
  /* Request/Response Panels */
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-color: #1a1a1a;
    border-radius: 7px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
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
    position: relative;
  }
  
  /* Line numbers and content */
  .line-numbers-wrapper {
    display: flex;
    width: 100%;
    height: 100%;
    overflow: auto;
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
    padding: 20px;
  }
  
  /* Requests Table */
  .requests-table-container {
    margin-top: 20px;
    padding: 0 15px 15px 15px;
  }
  
  .requests-table-container h4 {
    margin-top: 0;
    margin-bottom: 10px;
    color: #ddd;
    font-size: 14px;
  }
  
  .requests-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  
  .requests-table th {
    text-align: left;
    padding: 8px;
    background-color: #252525;
    color: #ddd;
    border-bottom: 1px solid #333;
  }
  
  .requests-table td {
    padding: 6px 8px;
    border-bottom: 1px solid #333;
  }
  
  .requests-table tr:hover {
    background-color: #252525;
  }
  
  .requests-table tr.selected {
    background-color: #303030;
  }
  
  .small-button {
    padding: 3px 6px;
    background-color: #333;
    border: none;
    border-radius: 3px;
    color: #ddd;
    cursor: pointer;
    font-size: 11px;
    margin-right: 4px;
  }
  
  .small-button:hover {
    background-color: #444;
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
  
  /* Loading Overlay */
  .loading-overlay {
    position: fixed;
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
  
  @keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

</style>
