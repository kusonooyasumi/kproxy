<script lang="ts">
  import { writable } from 'svelte/store';
  import { createEventDispatcher } from 'svelte';
  import type { CapturedRequest } from '$lib/types';
  import { scopeStore } from '$lib/stores/scope';
  import type { ScopeSettings } from '$lib/stores/scope';

  const dispatch = createEventDispatcher();

  export let requests: CapturedRequest[] = [];
  export let selectRequest: (request: CapturedRequest) => void;
  export let selectedRequest: CapturedRequest | null = null;
  export let sortConfig: {column: string; direction: 'asc' | 'desc' | null}[] = [];
  export let columns = writable([
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

  export let searchText = '';
  export let useRegex = false;
  export let statusFilter = '';
  export let scopeOnly = false;
  export let scopeSettings: ScopeSettings = { inScope: [], outOfScope: [] };

  $: filteredRequests = requests.filter(request => {
    if (scopeOnly && !isInScope(request.host)) return false;
    if (statusFilter && request.status && !String(request.status).includes(statusFilter)) return false;
    
    if (searchText) {
      try {
        if (useRegex) {
          const regex = new RegExp(searchText, 'i');
          return regex.test(request.method) || 
                regex.test(request.host) || 
                regex.test(request.path) || 
                (request.body && regex.test(request.body));
        } else {
          const searchLower = searchText.toLowerCase();
          return request.method.toLowerCase().includes(searchLower) || 
                request.host.toLowerCase().includes(searchLower) || 
                request.path.toLowerCase().includes(searchLower) || 
                (request.body && request.body.toLowerCase().includes(searchLower));
        }
      } catch (e) {
        console.error('Invalid regex:', e);
        return true;
      }
    }
    return true;
  });

  $: sortedRequests = [...filteredRequests].sort((a, b) => {
    if (sortConfig.length === 0) return 0;
    
    for (const { column, direction } of sortConfig) {
      const columnConfig = $columns.find(col => col.id === column);
      if (!columnConfig) continue;
      
      let valueA = a[column as keyof CapturedRequest];
      let valueB = b[column as keyof CapturedRequest];
      
      if (column === 'timestamp') {
        valueA = new Date(valueA as string).getTime();
        valueB = new Date(valueB as string).getTime();
      }
      
      if (valueA === undefined || valueA === null) valueA = columnConfig.type === 'numeric' ? -Infinity : '';
      if (valueB === undefined || valueB === null) valueB = columnConfig.type === 'numeric' ? -Infinity : '';
      
      let comparison = 0;
      if (columnConfig.type === 'numeric') {
        comparison = Number(valueA) - Number(valueB);
      } else if (columnConfig.type === 'date') {
        comparison = Number(valueA) - Number(valueB);
      } else {
        comparison = String(valueA).localeCompare(String(valueB));
      }
      
      if (comparison !== 0) {
        return direction === 'asc' ? comparison : -comparison;
      }
    }
    return 0;
  });

  function isInScope(host: string): boolean {
    if (scopeSettings.inScope.includes(host)) return true;
    
    const isInScopeMatch = scopeSettings.inScope.some((pattern: string) => {
      if (pattern.startsWith('*.')) {
        const domain = pattern.substring(2);
        return host === domain || host.endsWith('.' + domain);
      }
      return false;
    });
    
    if (!isInScopeMatch) return false;
    
    const isExcluded = scopeSettings.outOfScope.some((pattern: string) => {
      if (pattern === host) return true;
      if (pattern.startsWith('*.')) {
        const domain = pattern.substring(2);
        return host === domain || host.endsWith('.' + domain);
      }
      return false;
    });
    
    return !isExcluded;
  }

  function formatDate(isoString: string) {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString();
    } catch (e) {
      return isoString;
    }
  }

  function handleHeaderClick(columnId: string) {
    const columnSortIndex = sortConfig.findIndex(item => item.column === columnId);
    
    if (columnSortIndex === -1) {
      sortConfig = [...sortConfig, { column: columnId, direction: 'asc' }];
    } else {
      const currentDirection = sortConfig[columnSortIndex].direction;
      if (currentDirection === 'asc') {
        sortConfig[columnSortIndex].direction = 'desc';
        sortConfig = [...sortConfig];
      } else if (currentDirection === 'desc') {
        sortConfig = sortConfig.filter(item => item.column !== columnId);
      }
    }
  }

  function getSortIndicator(columnId: string): string {
    const sortItem = sortConfig.find(item => item.column === columnId);
    return sortItem?.direction === 'asc' ? '▲' : sortItem?.direction === 'desc' ? '▼' : '';
  }

  function getSortPriority(columnId: string): number | null {
    const index = sortConfig.findIndex(item => item.column === columnId);
    return index === -1 ? null : index + 1;
  }
</script>

<div class="table-container">
  <table class="request-table">
    <thead>
      <tr>
        {#each $columns as column}
          {#if column.visible}
            <th 
              on:click={() => handleHeaderClick(column.id)}
              class:sorted={getSortIndicator(column.id) !== ''}
              title={getSortIndicator(column.id) ? `Sorted ${getSortIndicator(column.id) === '▲' ? 'ascending' : 'descending'}` : 'Click to sort'}
            >
              {column.label}
              {#if getSortIndicator(column.id)}
                <span class="sort-indicator">{getSortIndicator(column.id)}</span>
                {#if sortConfig.length > 1}
                  <span class="sort-priority">{getSortPriority(column.id)}</span>
                {/if}
              {/if}
            </th>
          {/if}
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if requests.length === 0}
        <tr>
          <td colspan={$columns.filter(col => col.visible).length} class="no-requests">
            No requests captured yet
          </td>
        </tr>
      {:else}
        {#each sortedRequests as request (request.id)}
          <tr 
            class:selected={selectedRequest && selectedRequest.id === request.id}
            class:error={request.error}
            on:click={() => selectRequest(request)}
            on:contextmenu|preventDefault={(e) => dispatch('contextmenu', { event: e, request })}
          >
            {#if $columns.find(col => col.id === 'id')?.visible}
              <td>{request.id}</td>
            {/if}
            {#if $columns.find(col => col.id === 'protocol')?.visible}
              <td>{request.protocol}</td>
            {/if}
            {#if $columns.find(col => col.id === 'host')?.visible}
              <td>{request.host}</td>
            {/if}
            {#if $columns.find(col => col.id === 'method')?.visible}
              <td class="method {request.method.toLowerCase()}">{request.method}</td>
            {/if}
            {#if $columns.find(col => col.id === 'path')?.visible}
              <td class="path">{request.path}</td>
            {/if}
            {#if $columns.find(col => col.id === 'status')?.visible}
              <td class="status">
                {#if request.status}
                  <span class="status-code status-{Math.floor(request.status / 100)}xx">{request.status}</span>
                {:else}
                  -
                {/if}
              </td>
            {/if}
            {#if $columns.find(col => col.id === 'responseLength')?.visible}
              <td>{request.responseLength ? request.responseLength : '-'}</td>
            {/if}
            {#if $columns.find(col => col.id === 'responseTime')?.visible}
              <td>{request.responseTime ? request.responseTime : '-'}</td>
            {/if}
            {#if $columns.find(col => col.id === 'timestamp')?.visible}
              <td>{formatDate(request.timestamp)}</td>
            {/if}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

<style>
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
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s;
    padding: 5px 10px;
  }
  
  .request-table th:hover {
    background-color: #2a2a2a;
  }
  
  .request-table th.sorted {
    background-color: #2a2a2a;
    font-weight: bold;
  }
  
  .sort-indicator {
    margin-left: 5px;
    color: #ff5252;
    font-size: 10px;
  }
  
  .sort-priority {
    display: inline-block;
    margin-left: 3px;
    background-color: #ff5252;
    color: white;
    font-size: 9px;
    width: 14px;
    height: 14px;
    line-height: 14px;
    text-align: center;
    border-radius: 50%;
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
</style>
