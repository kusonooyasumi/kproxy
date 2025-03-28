<script lang="ts">
  import CodeMirror from "svelte-codemirror-editor";
  import { oneDark } from "@codemirror/theme-one-dark";
  import type { CapturedRequest } from '$lib/types';
  import { goto } from '$app/navigation';
  import { addRepeaterRequest } from '$lib/stores/repeater';
  import { clickOutside } from '$lib/actions/clickOutside';

  export let request: CapturedRequest | null = null;

  let contextMenu = {
    show: false,
    x: 0,
    y: 0
  };

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    contextMenu = {
      show: true,
      x: event.clientX,
      y: event.clientY
    };
  }

  function closeContextMenu() {
    contextMenu.show = false;
  }

  function copyContent() {
    if (content) {
      navigator.clipboard.writeText(content);
    }
    closeContextMenu();
  }

  let isSendingToRepeater = false;

  function sendToRepeater() {
    if (request && !isSendingToRepeater) {
      isSendingToRepeater = true;
      addRepeaterRequest(request);
      closeContextMenu();
      
      // Reset after short delay to prevent rapid duplicate sends
      setTimeout(() => {
        isSendingToRepeater = false;
      }, 500);
    }
  }
  export let panelType: 'request' | 'response' = 'request';

  function formatFullRequest(request: CapturedRequest) {
    if (!request) return '';
    
    let formattedRequest = `${request.method} ${request.path} HTTP/1.1\r\n`;
    formattedRequest += `Host: ${request.host}\r\n`;
    
    if (request.headers) {
      for (const [key, value] of Object.entries(request.headers)) {
        if (key.toLowerCase() !== 'host') {
          formattedRequest += `${key}: ${value}\r\n`;
        }
      }
    }
    
    formattedRequest += '\r\n';
    
    if (request.body) {
      try {
        const parsedJson = JSON.parse(request.body);
        formattedRequest += JSON.stringify(parsedJson, null, 2);
      } catch (e) {
        formattedRequest += request.body;
      }
    }
    
    return formattedRequest;
  }

  function formatFullResponse(request: CapturedRequest) {
    if (!request) return '';
    if (!request.status) return 'No response received';
    
    let formattedResponse = `HTTP/1.1 ${request.status} ${getStatusText(request.status)}\r\n`;
    
    if (request.responseHeaders) {
      for (const [key, value] of Object.entries(request.responseHeaders)) {
        formattedResponse += `${key}: ${value}\r\n`;
      }
    }
    
    formattedResponse += '\r\n';
    
    if (request.responseBody) {
      try {
        const parsedJson = JSON.parse(request.responseBody);
        formattedResponse += JSON.stringify(parsedJson, null, 2);
      } catch (e) {
        formattedResponse += request.responseBody;
      }
    }
    
    return formattedResponse;
  }

  function getStatusText(status: number) {
    const statusTexts = {
      200: 'OK', 201: 'Created', 204: 'No Content',
      301: 'Moved Permanently', 302: 'Found', 304: 'Not Modified',
      400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
      404: 'Not Found', 405: 'Method Not Allowed', 418: 'I\'m a teapot',
      429: 'Too Many Requests', 500: 'Internal Server Error',
      502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout'
    };
    return statusTexts[status as keyof typeof statusTexts] || 'Unknown Status';
  }

  $: content = request 
    ? panelType === 'request' 
      ? formatFullRequest(request) 
      : formatFullResponse(request)
    : '';
</script>

<div class="panel {panelType}-panel" on:contextmenu={handleContextMenu} use:clickOutside={closeContextMenu}>
  <div class="panel-header">
    <h3>{panelType === 'request' ? 'Request' : 'Response'}</h3>
  </div>
  <div class="panel-content">
    <div class="line-numbers-wrapper">
      {#if request}
        <CodeMirror theme={oneDark} bind:value={content} editable={false}/>
      {/if}
    </div>
  </div>
</div>

<style>
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

  .line-numbers-wrapper {
    display: flex;
    width: 100%;
    height: 100%;
    overflow-y: auto;
  }

  .context-menu {
    position: fixed;
    background: #2a2a2a;
    border: 1px solid #444;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    min-width: 150px;
  }

  .context-menu-item {
    padding: 8px 12px;
    color: #ddd;
    cursor: pointer;
    font-size: 13px;
  }

  .context-menu-item:hover {
    background: #3a3a3a;
  }
</style>

{#if contextMenu.show}
  <div class="context-menu" style={`left: ${contextMenu.x}px; top: ${contextMenu.y}px`}>
    <div class="context-menu-item" on:click={copyContent}>Copy {panelType}</div>
    <div class="context-menu-item" on:click={sendToRepeater}>Send to Repeater</div>
  </div>
{/if}
