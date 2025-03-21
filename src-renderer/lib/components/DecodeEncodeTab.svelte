<script>

  // Props that can be passed to the component
  export let standalone = false; // Whether the component is running in standalone mode (new window)
  
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
    // Available decoding methods
    const decodingMethods = [
      { id: 'base64', label: 'Base64' },
      { id: 'url', label: 'URL' },
      { id: 'html', label: 'HTML Entities' },
      { id: 'jwt', label: 'JWT' },
      { id: 'hex', label: 'Hex' }
    ];
  
    // Reactive variables
    let inputText = '';
    let selectedMethod = 'base64';
    let outputText = '';
    let error = '';
  
    // Decode the input based on selected method
    function decode() {
      error = '';
      
      try {
        switch (selectedMethod) {
          case 'base64':
            outputText = atob(inputText);
            break;
          case 'url':
            outputText = decodeURIComponent(inputText);
            break;
          case 'html':
            const parser = new DOMParser();
            const dom = parser.parseFromString(`<!doctype html><body>${inputText}`, 'text/html');
            outputText = dom.body.textContent;
            break;
          case 'jwt':
            // JWT decoding (header and payload parts only)
            const parts = inputText.split('.');
            if (parts.length !== 3) throw new Error('Invalid JWT format');
            
            const header = JSON.parse(atob(parts[0]));
            const payload = JSON.parse(atob(parts[1]));
            
            outputText = JSON.stringify({ header, payload }, null, 2);
            break;
          case 'hex':
            // Convert hex to text
            outputText = inputText.match(/.{1,2}/g)
              ?.map(byte => String.fromCharCode(parseInt(byte, 16)))
              .join('') || '';
            break;
          default:
            throw new Error('Invalid decoding method');
        }
      } catch (e) {
        error = `Decoding error: ${e.message}`;
        outputText = '';
      }
    }
  
    // Clear both input and output
    function clearAll() {
      inputText = '';
      outputText = '';
      error = '';
    }
  </script>
  
  <div class="decoder-container">

    <div class="form-group">
      <label for="decoding-method">Select Decoding Method:</label>
      <select id="decoding-method" bind:value={selectedMethod}>
        {#each decodingMethods as method}
          <option value={method.id}>{method.label}</option>
        {/each}
      </select>
    </div>
  
    <div class="form-group">
      <label for="input-text">Input (encoded text):</label>
      <textarea 
        id="input-text" 
        bind:value={inputText} 
        placeholder="Paste your encoded text here"
        rows="6"
      ></textarea>
    </div>
  
    <div class="button-group">
      <button on:click={decode} disabled={!inputText}>Decode</button>
      <button on:click={clearAll}>Clear</button>
    </div>
  
    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}
  
    <div class="form-group">
      <label for="output-text">Output (decoded result):</label>
      <textarea 
        id="output-text" 
        value={outputText} 
        placeholder="Decoded output will appear here"
        rows="6"
        readonly
      ></textarea>
    </div>
  </div>
  
  <style>
    .decoder-container {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      margin: 0 auto;
      padding: 20px;
      border-radius: 4px;
      border: 1px solid #ddd;
      background-color: #1a1a1a;
      height: calc(100vh - 128.5px);
      overflow: auto;
    }
  
    .form-group {
      margin-bottom: 15px;
    }
  
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: 600;
      color: #ddd;
    }
  
    select, textarea {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      background-color: #2a2a2a;
    }
  
    select {
      cursor: pointer;
    }
  
    textarea {
      resize: vertical;
      font-family: monospace;
    }
  
    .button-group {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }
  
    button {
      padding: 8px 16px;
      background-color: #ff5252;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: background-color 0.2s;
      border: 1px solid #ddd;
    }
  
    button:hover {
      background-color: #ff6b6b;
    }
  
    button:disabled {
      background-color: #2a2a2a;
      cursor: not-allowed;
      color: #555;
    }
  
    button:nth-child(2) {
      background-color: #2a2a2a;
    }
  
    button:nth-child(2):hover {
      background-color: #e53935;
    }
  
    .error-message {
      color: #f44336;
      margin-bottom: 15px;
      padding: 10px;
      background-color: rgba(244, 67, 54, 0.1);
      border-radius: 4px;
      font-size: 14px;
    }
  </style>