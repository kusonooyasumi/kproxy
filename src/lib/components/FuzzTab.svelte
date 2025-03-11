<script lang="ts">
    import { onMount } from 'svelte';
  
    // Component props
    export let initialUrl: string = '';
    
    // Component state
    let requestLines: string[] = [];
    let lineNumbers: number[] = [];
    let currentRequestContent: string = '';
    let targetUrl: string = initialUrl;
    let rateLimit: number = 10;
    let selectedLine: number | null = null;
    let fuzzParameter: string = '';
    let fuzzValues: string[] = [];
    let fuzzResults: any[] = [];
    let isFuzzing: boolean = false;
    
    // Default HTTP request template
    const defaultRequest = `POST /login HTTP/2
Host: 0a3e0062040f0cf9485dc3c180094000b.web-security-academy.net
Cookie: session=ut4LRxNz6dMdRotbUEdtfB2f9BYHQvZE
Content-Length: 35
Cache-Control: max-age=0
Sec-Ch-Ua: "Chromium";v="129", "Not=A?Brand";v="8"
Sec-Ch-Ua-Mobile: ?0
Sec-Ch-Ua-Platform: "macOS"
Accept-Language: en-GB,en;q=0.9
Origin: https://0a3e0062040f0cf9485dc3c180094000b.web-security-academy.net
Content-Type: application/x-www-form-urlencoded
Upgrade-Insecure-Requests: 1
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6613.138 Safari/537.36
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7
Sec-Fetch-Site: same-origin
Sec-Fetch-Mode: navigate
Sec-Fetch-User: ?1
Sec-Fetch-Dest: document
Referer: https://0a3e0062040f0cf9485dc3c180094000b.web-security-academy.net/login
Accept-Encoding: gzip, deflate, br
Priority: u=0, i

username=ANYTHING&password=anything`;
  
    // Initialize component
    onMount(() => {
      currentRequestContent = defaultRequest;
      updateLineNumbers();
    });
  
    // Update line numbers whenever request content changes
    function updateLineNumbers() {
      requestLines = currentRequestContent.split('\n');
      lineNumbers = Array.from({ length: requestLines.length }, (_, i) => i + 1);
    }
  
    // Handle changes to the textarea content
    function handleTextareaChange(event: Event) {
      const target = event.target as HTMLTextAreaElement;
      currentRequestContent = target.value;
      updateLineNumbers();
    }
  
    // Handle line selection
    function selectLine(lineNumber: number) {
      selectedLine = lineNumber;
      
      // Get the content of the selected line for potential fuzzing
      if (lineNumber > 0 && lineNumber <= requestLines.length) {
        fuzzParameter = requestLines[lineNumber - 1];
      }
    }
  
    // Add a parameter marker for fuzzing
    function addFuzzMarker() {
      if (selectedLine === null) return;
      
      const lines = currentRequestContent.split('\n');
      if (selectedLine > 0 && selectedLine <= lines.length) {
        // Replace the selected line's content with a fuzz marker
        const line = lines[selectedLine - 1];
        
        // Find if there's a parameter value to mark for fuzzing
        if (line.includes('=')) {
          const parts = line.split('=');
          lines[selectedLine - 1] = parts[0] + '=${FUZZ}' + (parts.length > 2 ? parts.slice(2).join('=') : '');
        } else if (line.includes(':')) {
          const parts = line.split(':');
          lines[selectedLine - 1] = parts[0] + ': ${FUZZ}' + (parts.length > 2 ? parts.slice(2).join(':') : '');
        }
        
        currentRequestContent = lines.join('\n');
        updateLineNumbers();
      }
    }
  
    // Clear all fuzz markers
    function clearFuzzMarkers() {
      currentRequestContent = currentRequestContent.replace(/\${FUZZ}/g, 'ANYTHING');
      updateLineNumbers();
    }
  
    // Auto-detect parameters that could be fuzzed
    function autoDetectFuzzPoints() {
      const lines = currentRequestContent.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Look for parameters in query strings or form data
        if (line.includes('=')) {
          const parts = line.split('=');
          lines[i] = parts[0] + '=${FUZZ}' + (parts.length > 2 ? parts.slice(2).join('=') : '');
        }
      }
      
      currentRequestContent = lines.join('\n');
      updateLineNumbers();
    }
    
    // Set up fuzz values
    function setupFuzzValues() {
      // Example fuzz values - in a real implementation, these would be more comprehensive
      fuzzValues = [
        "admin",
        "' OR '1'='1",
        "../../../../etc/passwd",
        "1; DROP TABLE users",
        "%00",
        "$(whoami)",
        "{{7*7}}"
      ];
    }
    
    // Start fuzzing process
    async function startFuzzing() {
      if (!targetUrl) {
        alert("Please enter a target URL");
        return;
      }
      
      if (!currentRequestContent.includes('${FUZZ}')) {
        alert("No fuzz points defined. Please mark parameters for fuzzing.");
        return;
      }
      
      isFuzzing = true;
      fuzzResults = [];
      setupFuzzValues();
      
      // Simulate fuzzing by sending each value
      for (const value of fuzzValues) {
        const requestWithFuzzValue = currentRequestContent.replace(/\${FUZZ}/g, value);
        
        // In a real implementation, you would send the actual request
        // For demo purposes, we'll just simulate a response
        await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
        
        fuzzResults.push({
          payload: value,
          status: Math.random() > 0.7 ? 500 : 200,
          length: Math.floor(Math.random() * 5000) + 1000,
          time: Math.floor(Math.random() * 500) + 50
        });
      }
      
      isFuzzing = false;
    }
  </script>

  <div class="fuzzer-container">
    <div class="toolbar">
      <button on:click={addFuzzMarker}>Add $</button>
      <button on:click={clearFuzzMarkers}>Clear $</button>
      <button on:click={autoDetectFuzzPoints}>Auto $</button>
      <div class="target-url-container">
        <input type="text" placeholder="Target URL" bind:value={targetUrl} />
        <button on:click={startFuzzing} disabled={isFuzzing}>
          {isFuzzing ? 'Fuzzing...' : 'Start Fuzzing'}
        </button>
      </div>
    </div>
    <div class="toolbar">
        <div class="rate-limit-container">
            <p>Rate Limit</p><input type="text" placeholder="10" bind:value={rateLimit} />
          </div>
          <div class="rate-limit-container">
            <p>Rate Limit</p><input type="text" placeholder="10" bind:value={targetUrl} />
          </div>
        <button on:click={addFuzzMarker}>Add $</button>
        <button on:click={clearFuzzMarkers}>Clear $</button>
        <button on:click={autoDetectFuzzPoints}>Auto $</button>
        <div class="target-url-container">
          <input type="text" placeholder="Target URL" bind:value={targetUrl} />
          <button on:click={startFuzzing} disabled={isFuzzing}>
            {isFuzzing ? 'Fuzzing...' : 'Start Fuzzing'}
          </button>
        </div>
      </div>
    
    <div class="editor-container">

      <textarea 
        class="request-editor" 
        on:input={handleTextareaChange} 
        bind:value={currentRequestContent}
        spellcheck="false"
      ></textarea>
    </div>
    
    {#if fuzzResults.length > 0}
      <div class="results-container">
        <h3>Fuzzing Results</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Payload</th>
              <th>Status</th>
              <th>Length</th>
              <th>Time (ms)</th>
            </tr>
          </thead>
          <tbody>
            {#each fuzzResults as result, index}
              <tr class:vulnerable={result.status === 500}>
                <td>{index + 1}</td>
                <td>{result.payload}</td>
                <td>{result.status}</td>
                <td>{result.length}</td>
                <td>{result.time}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
  
  <style>
    .fuzzer-container {
      font-family: monospace;
      width: 100%;
      margin: 0 auto;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
    
    .toolbar {
      display: flex;
      padding: 8px;
      background-color: #212121;
      border-bottom: 1px solid #ccc;
      align-items: center;
    }
    
    .toolbar button {
      margin-right: 8px;
      padding: 4px 8px;
      background-color: #212121;
      border: 1px solid #ccc;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .toolbar button:hover {
      background-color: #e0e0e0;
    }
    
    .target-url-container {
      display: flex;
      flex-grow: 1;
      margin-left: 16px;
    }
    
    .target-url-container input {
      flex-grow: 1;
      padding: 4px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      margin-right: 8px;
    }

    .rate-limit-container {
    
      width: 100px;
    }
    
    .rate-limit-container input {
      flex-grow: 1;
      padding: 4px 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      margin-right: 8px;
      width: 60px;
    }
    
    .editor-container {
      display: flex;
      height: 700px;
      border-bottom: 1px solid #ccc;
    }
    
    .line-numbers {
      width: 40px;
      background-color: #f0f0f0;
      border-right: 1px solid #ccc;
      text-align: right;
      padding: 8px 0;
      overflow-y: hidden;
      user-select: none;
    }
    
    .line-number {
      padding: 0 5px;
      color: #888;
      cursor: pointer;
    }
    
    .line-number.selected {
      background-color: #e0e0e0;
      color: #000;
    }
    
    .request-editor {
      flex-grow: 1;
      padding: 8px;
      font-family: monospace;
      font-size: 14px;
      line-height: 1.5;
      border: none;
      resize: none;
      outline: none;
      white-space: pre;
      overflow-wrap: normal;
      overflow-x: auto;
    }
    
    .results-container {
      padding: 16px;
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 8px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    
    th {
      background-color: #f0f0f0;
    }
    
    tr.vulnerable {
      background-color: #ffebee;
    }
  </style>
  