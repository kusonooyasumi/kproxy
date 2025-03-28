<script lang="ts">
  import type { CapturedRequest } from '$lib/types';
  import proxy from '$lib/stores/proxy';
  import { scopeStore } from '$lib/stores/scope';

  export let request: CapturedRequest;
  export let selected: boolean;

  $: isInScope = $scopeStore.inScope.includes(`${request.protocol}://${request.host}${request.path}`);
  $: isHighlighted = selected || (request.status >= 400 && request.status < 600);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

<div class="request-details" class:selected class:highlighted={isHighlighted}>
  <div class="request-header">
    <div class="method-badge" class:error={request.status >= 400}>
      {request.method}
    </div>
    <div class="url" title={`${request.protocol}://${request.host}${request.path}`}>
      {request.host}{request.path}
    </div>
    <div class="status-code" class:error={request.status >= 400}>
      {request.status || 'Pending'}
    </div>
  </div>

  {#if selected}
    <div class="request-body">
      <div class="tabs">
        <button class="tab-button active">Request</button>
        <button class="tab-button">Response</button>
      </div>

      <div class="request-content">
        <div class="section">
          <h3>Headers</h3>
        <pre>{JSON.stringify(request.headers, null, 2)}</pre>
        </div>

        {#if request.body}
          <div class="section">
            <h3>Body</h3>
        <pre>{request.body}</pre>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .request-details {
    border: 1px solid #444;
    border-radius: 4px;
    margin-bottom: 8px;
    overflow: hidden;
  }

  .request-details.selected {
    border-color: #2196f3;
  }

  .request-details.highlighted {
    border-color: #f44336;
  }

  .request-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    background-color: #1a1a1a;
    cursor: pointer;
  }

  .method-badge {
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: bold;
    margin-right: 8px;
    background-color: #4caf50;
    color: white;
  }

  .method-badge.error {
    background-color: #f44336;
  }

  .url {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status-code {
    margin-left: 8px;
    font-weight: bold;
  }

  .status-code.error {
    color: #f44336;
  }

  .request-body {
    padding: 12px;
    background-color: #1e1e1e;
  }

  .tabs {
    display: flex;
    border-bottom: 1px solid #444;
    margin-bottom: 12px;
  }

  .tab-button {
    padding: 6px 12px;
    background: none;
    border: none;
    color: #aaa;
    cursor: pointer;
  }

  .tab-button.active {
    color: white;
    border-bottom: 2px solid #2196f3;
  }

  .section {
    margin-bottom: 16px;
  }

  h3 {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: #aaa;
  }

  pre {
    margin: 0;
    padding: 8px;
    background-color: #252525;
    border-radius: 4px;
    overflow-x: auto;
    font-size: 12px;
  }
</style>
