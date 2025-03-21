<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';

  // Props that can be passed to the component
  export let standalone = false; // Whether the component is running in standalone mode (new window)
  
  const dispatch = createEventDispatcher();
  
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

  // Interface for FFuf command options
  interface FFufOptions {
    // HTTP Options
    headers: { name: string; value: string }[];
    method: string;
    cookies: string;
    clientCert: string;
    clientKey: string;
    postData: string;
    useHttp2: boolean;
    ignoreBody: boolean;
    followRedirects: boolean;
    rawUri: boolean;
    recursion: boolean;
    recursionDepth: number;
    recursionStrategy: 'default' | 'greedy';
    replayProxy: string;
    sni: string;
    timeout: number;
    url: string;
    proxy: string;

    // General Options
    showVersion: boolean;
    autoCalibrate: boolean;
    autoCalibrationStrings: string[];
    perHostCalibration: boolean;
    calibrationKeyword: string;
    calibrationStrategies: string[];
    colorize: boolean;
    configFile: string;
    jsonOutput: boolean;
    maxTime: number;
    maxTimePerJob: number;
    nonInteractive: boolean;
    delay: string;
    rate: number;
    silentMode: boolean;
    stopOnAllErrors: boolean;
    scraperFile: string;
    scrapers: string;
    stopOnSpuriousErrors: boolean;
    search: string;
    stopOnForbidden: boolean;
    threads: number;
    verbose: boolean;

    // Matcher Options
    matchCodes: string;
    matchLines: string;
    matcherMode: 'and' | 'or';
    matchRegexp: string;
    matchSize: string;
    matchTime: string;
    matchWords: string;

    // Filter Options
    filterCodes: string;
    filterLines: string;
    filterMode: 'and' | 'or';
    filterRegexp: string;
    filterSize: string;
    filterTime: string;
    filterWords: string;

    // Input Options
    dirSearchMode: boolean;
    extensions: string;
    encoders: string;
    ignoreComments: boolean;
    inputCmd: string;
    inputNum: number;
    inputShell: string;
    mode: 'clusterbomb' | 'pitchfork' | 'sniper';
    requestFile: string;
    requestProto: string;
    wordlists: { path: string; keyword: string }[];

    // Output Options
    debugLog: string;
    outputFile: string;
    outputDir: string;
    outputFormat: string;
    noOutputWithoutResults: boolean;
  }

  // Default FFuf options
  const defaultOptions: FFufOptions = {
    // HTTP Options
    headers: [],
    method: 'GET',
    cookies: '',
    clientCert: '',
    clientKey: '',
    postData: '',
    useHttp2: false,
    ignoreBody: false,
    followRedirects: false,
    rawUri: false,
    recursion: false,
    recursionDepth: 0,
    recursionStrategy: 'default',
    replayProxy: '',
    sni: '',
    timeout: 10,
    url: '',
    proxy: 'http://127.0.0.1:8080', // Default proxy setting

    // General Options
    showVersion: false,
    autoCalibrate: false,
    autoCalibrationStrings: [],
    perHostCalibration: false,
    calibrationKeyword: 'FUZZ',
    calibrationStrategies: [],
    colorize: true,
    configFile: '',
    jsonOutput: false,
    maxTime: 0,
    maxTimePerJob: 0,
    nonInteractive: false,
    delay: '',
    rate: 0,
    silentMode: false,
    stopOnAllErrors: false,
    scraperFile: '',
    scrapers: 'all',
    stopOnSpuriousErrors: false,
    search: '',
    stopOnForbidden: false,
    threads: 40,
    verbose: false,

    // Matcher Options
    matchCodes: '200-299,301,302,307,401,403,405,500',
    matchLines: '',
    matcherMode: 'or',
    matchRegexp: '',
    matchSize: '',
    matchTime: '',
    matchWords: '',

    // Filter Options
    filterCodes: '',
    filterLines: '',
    filterMode: 'or',
    filterRegexp: '',
    filterSize: '',
    filterTime: '',
    filterWords: '',

    // Input Options
    dirSearchMode: false,
    extensions: '',
    encoders: '',
    ignoreComments: false,
    inputCmd: '',
    inputNum: 100,
    inputShell: '',
    mode: 'clusterbomb',
    requestFile: '',
    requestProto: 'https',
    wordlists: [{ path: '', keyword: 'FUZZ' }],

    // Output Options
    debugLog: '',
    outputFile: '',
    outputDir: '',
    outputFormat: 'json',
    noOutputWithoutResults: false,
  };

  // Create a writable store for options
  const options = writable<FFufOptions>({ ...defaultOptions });
  
  // Store for output
  const output = writable<string>('');
  
  // Store for running state
  const isRunning = writable<boolean>(false);

  // Function to build FFuf command
  function buildFFufCommand(opts: FFufOptions): string[] {
    const args: string[] = [];

    // HTTP Options
    opts.headers.forEach(header => {
      if (header.name && header.value) {
        args.push('-H', `${header.name}: ${header.value}`);
      }
    });
    
    if (opts.method !== 'GET') args.push('-X', opts.method);
    if (opts.cookies) args.push('-b', opts.cookies);
    if (opts.clientCert) args.push('-cc', opts.clientCert);
    if (opts.clientKey) args.push('-ck', opts.clientKey);
    if (opts.postData) args.push('-d', opts.postData);
    if (opts.useHttp2) args.push('-http2');
    if (opts.ignoreBody) args.push('-ignore-body');
    if (opts.followRedirects) args.push('-r');
    if (opts.rawUri) args.push('-raw');
    if (opts.recursion) args.push('-recursion');
    if (opts.recursionDepth > 0) args.push('-recursion-depth', opts.recursionDepth.toString());
    if (opts.recursionStrategy !== 'default') args.push('-recursion-strategy', opts.recursionStrategy);
    if (opts.replayProxy) args.push('-replay-proxy', opts.replayProxy);
    if (opts.sni) args.push('-sni', opts.sni);
    if (opts.timeout !== 10) args.push('-timeout', opts.timeout.toString());
    if (opts.url) args.push('-u', opts.url);
    
    // Always include proxy
    args.push('-x', opts.proxy);

    // General Options
    if (opts.showVersion) args.push('-V');
    if (opts.autoCalibrate) args.push('-ac');
    opts.autoCalibrationStrings.forEach(str => {
      args.push('-acc', str);
    });
    if (opts.perHostCalibration) args.push('-ach');
    if (opts.calibrationKeyword !== 'FUZZ') args.push('-ack', opts.calibrationKeyword);
    opts.calibrationStrategies.forEach(strategy => {
      args.push('-acs', strategy);
    });
    if (opts.colorize) args.push('-c');
    if (opts.configFile) args.push('-config', opts.configFile);
    if (opts.jsonOutput) args.push('-json');
    if (opts.maxTime > 0) args.push('-maxtime', opts.maxTime.toString());
    if (opts.maxTimePerJob > 0) args.push('-maxtime-job', opts.maxTimePerJob.toString());
    if (opts.nonInteractive) args.push('-noninteractive');
    if (opts.delay) args.push('-p', opts.delay);
    if (opts.rate > 0) args.push('-rate', opts.rate.toString());
    if (opts.silentMode) args.push('-s');
    if (opts.stopOnAllErrors) args.push('-sa');
    if (opts.scraperFile) args.push('-scraperfile', opts.scraperFile);
    if (opts.scrapers !== 'all') args.push('-scrapers', opts.scrapers);
    if (opts.stopOnSpuriousErrors) args.push('-se');
    if (opts.search) args.push('-search', opts.search);
    if (opts.stopOnForbidden) args.push('-sf');
    if (opts.threads !== 40) args.push('-t', opts.threads.toString());
    if (opts.verbose) args.push('-v');

    // Matcher Options
    if (opts.matchCodes !== '200-299,301,302,307,401,403,405,500') args.push('-mc', opts.matchCodes);
    if (opts.matchLines) args.push('-ml', opts.matchLines);
    if (opts.matcherMode !== 'or') args.push('-mmode', opts.matcherMode);
    if (opts.matchRegexp) args.push('-mr', opts.matchRegexp);
    if (opts.matchSize) args.push('-ms', opts.matchSize);
    if (opts.matchTime) args.push('-mt', opts.matchTime);
    if (opts.matchWords) args.push('-mw', opts.matchWords);

    // Filter Options
    if (opts.filterCodes) args.push('-fc', opts.filterCodes);
    if (opts.filterLines) args.push('-fl', opts.filterLines);
    if (opts.filterMode !== 'or') args.push('-fmode', opts.filterMode);
    if (opts.filterRegexp) args.push('-fr', opts.filterRegexp);
    if (opts.filterSize) args.push('-fs', opts.filterSize);
    if (opts.filterTime) args.push('-ft', opts.filterTime);
    if (opts.filterWords) args.push('-fw', opts.filterWords);

    // Input Options
    if (opts.dirSearchMode) args.push('-D');
    if (opts.extensions) args.push('-e', opts.extensions);
    if (opts.encoders) args.push('-enc', opts.encoders);
    if (opts.ignoreComments) args.push('-ic');
    if (opts.inputCmd) {
      args.push('-input-cmd', opts.inputCmd);
      args.push('-input-num', opts.inputNum.toString());
    }
    if (opts.inputShell) args.push('-input-shell', opts.inputShell);
    if (opts.mode !== 'clusterbomb') args.push('-mode', opts.mode);
    if (opts.requestFile) args.push('-request', opts.requestFile);
    if (opts.requestProto !== 'https') args.push('-request-proto', opts.requestProto);
    
    // Wordlists
    opts.wordlists.forEach(wordlist => {
      if (wordlist.path) {
        const wordlistArg = wordlist.keyword 
          ? `${wordlist.path}:${wordlist.keyword}`
          : wordlist.path;
        args.push('-w', wordlistArg);
      }
    });

    // Output Options
    if (opts.debugLog) args.push('-debug-log', opts.debugLog);
    if (opts.outputFile) args.push('-o', opts.outputFile);
    if (opts.outputDir) args.push('-od', opts.outputDir);
    if (opts.outputFormat !== 'json') args.push('-of', opts.outputFormat);
    if (opts.noOutputWithoutResults) args.push('-or');

    return args;
  }

function runFFuf() {
  const opts = $options; 

  isRunning.set(true);
  output.set('Starting FFuf scan...\n');

  const args = buildFFufCommand(opts);
  console.log('Running ffuf with args:', args);

  if (isElectron && window.electronAPI?.ffuf) {
    window.electronAPI.ffuf.run(args).catch((error: string) => {
      output.update(current => current + `\nError: ${error}\n`);
      isRunning.set(false);
    });
  } else {
    console.error('Electron API not available');
    output.update(current => current + '\nError: Electron API not available\n');
    isRunning.set(false);
  }
}

  function stopFFuf() {
    if (isElectron && window.electronAPI?.ffuf) {
      window.electronAPI.ffuf.stop();
      output.update(current => current + '\nStopping FFuf scan...\n');
    } else {
      console.error('Electron API not available');
      output.update(current => current + '\nError: Electron API not available\n');
    }
  }

  function addHeader() {
    options.update(opts => {
      opts.headers.push({ name: '', value: '' });
      return opts;
    });
  }

  function removeHeader(index: number) {
    options.update(opts => {
      opts.headers.splice(index, 1);
      return opts;
    });
  }

  function addWordlist() {
    options.update(opts => {
      opts.wordlists.push({ path: '', keyword: 'FUZZ' });
      return opts;
    });
  }

  function removeWordlist(index: number) {
    options.update(opts => {
      opts.wordlists.splice(index, 1);
      return opts;
    });
  }

  function resetOptions() {
    options.set({ ...defaultOptions });
  }

  onMount(() => {
  // Set up event listeners for IPC
  if (isElectron && window.electronAPI) {
    window.electronAPI.receive('ffuf-output', (data: string) => {
      output.update(current => current + data);
    });

    window.electronAPI.receive('ffuf-complete', (exitCode: number) => {
      output.update(current => current + `\nFFuf process completed with exit code ${exitCode}\n`);
      isRunning.set(false);
    });

    window.electronAPI.receive('ffuf-error', (errorMsg: string) => {
      output.update(current => current + `\nError: ${errorMsg}\n`);
      isRunning.set(false);
    });
  }

  // Tab functionality
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      if (tabId) {
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        button.classList.add('active');
        document.getElementById(tabId)?.classList.add('active');
      }
    });
  });

  // Clean up listeners when component is destroyed
  return () => {
    // The component unmounting will naturally clean up listeners
    // In a production app, you might want to enhance the preload script with 
    // a way to remove specific listeners
  };
});
</script>


<div class="ffuf-container">

  <div class="tabs">
    <div class="tab-buttons">
      <button class="tab-button active" data-tab="target">Target</button>
      <button class="tab-button" data-tab="http">HTTP Options</button>
      <button class="tab-button" data-tab="general">General</button>
      <button class="tab-button" data-tab="matchers">Matchers</button>
      <button class="tab-button" data-tab="filters">Filters</button>
      <button class="tab-button" data-tab="input">Input</button>
      <button class="tab-button" data-tab="output">Output</button>
    </div>
    
    <div class="tab-content active" id="target">
      <div class="form-group">
        <label for="url">Target URL:</label>
        <input type="text" id="url" bind:value={$options.url} placeholder="https://example.com/FUZZ" />
        <p class="help-text">The URL to fuzz. Use FUZZ as the placeholder for the fuzzing point.</p>
      </div>
      
      <div class="form-group">
        <label for="proxy">Proxy URL:</label>
        <input type="text" id="proxy" bind:value={$options.proxy} placeholder="http://127.0.0.1:8080" />
        <p class="help-text">Proxy URL (SOCKS5 or HTTP). Always enabled for all requests.</p>
      </div>
    </div>
    
    <div class="tab-content" id="http">
      <div class="form-group">
        <label>HTTP Headers:</label>
        {#each $options.headers as header, i}
          <div class="header-row">
            <input type="text" bind:value={header.name} placeholder="Header Name" />
            <input type="text" bind:value={header.value} placeholder="Header Value" />
            <button on:click={() => removeHeader(i)} class="remove-btn">Remove</button>
          </div>
        {/each}
        <button on:click={addHeader} class="add-btn">Add Header</button>
      </div>
      
      <div class="form-group">
        <label for="method">HTTP Method:</label>
        <select class=dropdown id="method" bind:value={$options.method}>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="HEAD">HEAD</option>
          <option value="OPTIONS">OPTIONS</option>
          <option value="PATCH">PATCH</option>
        </select>
      </div>
      
      <div class="form-group">
        <label for="cookies">Cookies:</label>
        <input type="text" id="cookies" bind:value={$options.cookies} placeholder="name1=value1; name2=value2" />
      </div>
      
      <div class="form-group">
        <label for="postData">POST Data:</label>
        <textarea id="postData" bind:value={$options.postData} placeholder=''></textarea>
      </div>
      
      <div class="form-group checkbox">
        <input type="checkbox" id="http2" bind:checked={$options.useHttp2} />
        <label for="http2">Use HTTP/2</label>
      </div>
      
      <div class="form-group checkbox">
        <input type="checkbox" id="followRedirects" bind:checked={$options.followRedirects} />
        <label for="followRedirects">Follow Redirects</label>
      </div>
      
      <div class="form-group">
        <label for="timeout">Timeout (seconds):</label>
        <input type="number" id="timeout" bind:value={$options.timeout} min="1" />
      </div>
    </div>
    
    <div class="tab-content" id="general">
      <div class="form-group checkbox">
        <input type="checkbox" id="colorize" bind:checked={$options.colorize} />
        <label for="colorize">Colorize Output</label>
      </div>
      
      <div class="form-group checkbox">
        <input type="checkbox" id="verbose" bind:checked={$options.verbose} />
        <label for="verbose">Verbose Output</label>
      </div>
      
      <div class="form-group">
        <label for="threads">Threads:</label>
        <input type="number" id="threads" bind:value={$options.threads} min="1" max="200" />
      </div>
      
      <div class="form-group">
        <label for="delay">Delay (seconds):</label>
        <input type="text" id="delay" bind:value={$options.delay} placeholder="0.1 or 0.1-2.0" />
      </div>
    </div>
    
    <div class="tab-content" id="matchers">
      <div class="form-group">
        <label for="matchCodes">Match Status Codes:</label>
        <input type="text" id="matchCodes" bind:value={$options.matchCodes} placeholder="200,301-399" />
      </div>
      
      <div class="form-group">
        <label for="matchSize">Match Response Size:</label>
        <input type="text" id="matchSize" bind:value={$options.matchSize} placeholder="1024,4096-8192" />
      </div>
      
      <div class="form-group">
        <label for="matchWords">Match Word Count:</label>
        <input type="text" id="matchWords" bind:value={$options.matchWords} placeholder="42,100-200" />
      </div>
      
      <div class="form-group">
        <label for="matchLines">Match Line Count:</label>
        <input type="text" id="matchLines" bind:value={$options.matchLines} placeholder="10,20-30" />
      </div>
      
      <div class="form-group">
        <label for="matchRegexp">Match Regular Expression:</label>
        <input type="text" id="matchRegexp" bind:value={$options.matchRegexp} placeholder="admin|login" />
      </div>
      
      <div class="form-group">
        <label for="matcherMode">Matcher Mode:</label>
        <select class="dropdown" id="matcherMode" bind:value={$options.matcherMode}>
          <option value="or">OR</option>
          <option value="and">AND</option>
        </select>
      </div>
    </div>
    
    <div class="tab-content" id="filters">
      <div class="form-group">
        <label for="filterCodes">Filter Status Codes:</label>
        <input type="text" id="filterCodes" bind:value={$options.filterCodes} placeholder="404,500-599" />
      </div>
      
      <div class="form-group">
        <label for="filterSize">Filter Response Size:</label>
        <input type="text" id="filterSize" bind:value={$options.filterSize} placeholder="0,42" />
      </div>
      
      <div class="form-group">
        <label for="filterWords">Filter Word Count:</label>
        <input type="text" id="filterWords" bind:value={$options.filterWords} placeholder="0,10-20" />
      </div>
      
      <div class="form-group">
        <label for="filterLines">Filter Line Count:</label>
        <input type="text" id="filterLines" bind:value={$options.filterLines} placeholder="0,5-10" />
      </div>
      
      <div class="form-group">
        <label for="filterRegexp">Filter Regular Expression:</label>
        <input type="text" id="filterRegexp" bind:value={$options.filterRegexp} placeholder="not found|error" />
      </div>
      
      <div class="form-group">
        <label for="filterMode">Filter Mode:</label>
        <select class="dropdown" id="filterMode" bind:value={$options.filterMode}>
          <option value="or">OR</option>
          <option value="and">AND</option>
        </select>
      </div>
    </div>
    
    <div class="tab-content" id="input">
      <div class="form-group">
        <label>Wordlists:</label>
        {#each $options.wordlists as wordlist, i}
          <div class="wordlist-row">
            <input type="text" bind:value={wordlist.path} placeholder="Path to wordlist" />
            <input type="text" bind:value={wordlist.keyword} placeholder="Keyword (e.g., FUZZ)" />
            <button on:click={() => removeWordlist(i)} class="remove-btn">Remove</button>
          </div>
        {/each}
        <button on:click={addWordlist} class="add-btn">Add Wordlist</button>
      </div>
      
      <div class="form-group">
        <label for="extensions">Extensions:</label>
        <input type="text" id="extensions" bind:value={$options.extensions} placeholder="php,asp,html" />
        <p class="help-text">Comma separated list of extensions to test</p>
      </div>
      
      <div class="form-group">
        <label for="mode">Wordlist Mode:</label>
        <select class="dropdown" id="mode" bind:value={$options.mode}>
          <option value="clusterbomb">Clusterbomb</option>
          <option value="pitchfork">Pitchfork</option>
          <option value="sniper">Sniper</option>
        </select>
        <p class="help-text">How to combine multiple wordlists</p>
      </div>
    </div>
    
    <div class="tab-content" id="output">
      <div class="form-group">
        <label for="outputFile">Output File:</label>
        <input type="text" id="outputFile" bind:value={$options.outputFile} placeholder="/path/to/output.json" />
      </div>
      
      <div class="form-group">
        <label for="outputFormat">Output Format:</label>
        <select class="dropdown" id="outputFormat" bind:value={$options.outputFormat}>
          <option value="json">JSON</option>
          <option value="ejson">EJSON</option>
          <option value="html">HTML</option>
          <option value="md">Markdown</option>
          <option value="csv">CSV</option>
          <option value="ecsv">ECSV</option>
          <option value="all">All Formats</option>
        </select>
      </div>
      
      <div class="form-group checkbox">
        <input type="checkbox" id="noOutputWithoutResults" bind:checked={$options.noOutputWithoutResults} />
        <label for="noOutputWithoutResults">Don't create output file if no results</label>
      </div>
    </div>
  </div>
  
  <div class="control-buttons">
    <button on:click={runFFuf} disabled={$isRunning} class="run-btn">Run</button>
    <button on:click={stopFFuf} disabled={!$isRunning} class="stop-btn">Stop</button>
    <button on:click={resetOptions} class="reset-btn">Reset Options</button>
  </div>
  
  <div class="output-container">
    <pre class="output">{$output}</pre>
  </div>
</div>

<style>
  .ffuf-container {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    margin: 0 auto;
    background-color: transparent;
    overflow-x: hidden;
    height: 97%;
  }
  
  .dropdown {
    right: 0;
    top: 100%;
    min-width: 180px;
    background-color: #2a2a2a;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10;
    padding: 8px;
    margin-top: 5px;
  }
  
  .tabs {
    margin-bottom: 20px;

  }
  
  .tab-buttons {
    display: flex;
    background-color: #1a1a1a;
    padding: 7px 10px;
    border-radius: 4px;
    margin-bottom: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #ddd;
  }
  .tab-button {
    padding: 5px 20px;
    cursor: pointer;
    color: #999;
    text-align: center;
    border-radius: 6px;
    transition: background-color 0.2s ease;
    margin: 0 2px;
  }
  
  .tab-button:hover {
    background-color: #2a2a2a;
  }
  
  .tab-button.active {
    
    color: white;
    border: 1px solid #ff5252;
  }
  
  .tab-content {
    border: 1px solid #ddd;
    display: none;
    padding: 15px;
    background-color: #1a1a1a;
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);

  }
  
  .tab-content.active {
    display: block;
  }
  
  .form-group {
    margin-bottom: 15px;
  }
  
  label {
    display: block;
    margin-bottom: 5px;
    font-weight: bold;
  }
  
  input[type="text"],
  input[type="number"],
  textarea,
  select {
    width: 100%;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
  }
  
  textarea {
    min-height: 100px;
    resize: vertical;
  }
  
  .checkbox {
    display: flex;
    align-items: center;

  }
  
  .checkbox input {
    margin-right: 8px;
  }
  
  .checkbox label {
    margin-bottom: 0;
  }
  
  .header-row,
  .wordlist-row {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .header-row input,
  .wordlist-row input {
    flex: 1;
  }
  
  .add-btn,
  .remove-btn {
    padding: 5px 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .add-btn {
    background-color: #1a1a1a;
    color: white;
    margin-top: 5px;
    border: 1px solid #ddd;
  }
  
  .add-btn:hover{
    background-color: #ff5252;
    color: white;
    margin-top: 5px;
    border: 1px solid #ddd;
  }
  
  .remove-btn {
    background-color: #1a1a1a;
    color: white;
    border: 1px solid #ddd;
  }
  
  .add-btn:hover{
    background-color: #ff5252;
    color: white;
    margin-top: 5px;
    border: 1px solid #ddd;
  }

  .control-buttons {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    border-radius: 4px;
    
  }
  
  .run-btn,
  .stop-btn,
  .reset-btn {
    padding: 10px 0px;
    border: none;
    border-radius: 4px;
    font-weight: bold;
    cursor: pointer;
    flex: 1;
    background-color: #1a1a1a;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #ddd;
  }
  
  .run-btn {

    color: white;
  }
  
  .stop-btn {

    color: white;
  }
  
  .reset-btn {

    color: white;
  }
  
  button:disabled {
    color: #999;
    cursor: not-allowed;
  }
  
  .output-container {
    margin-top: 20px;
    background-color: #1a1a1a;

    border-radius: 4px;

  }
  
  .output {
    background-color: #000;
    color: #fff;
    padding: 15px;
    border-radius: 4px;
    overflow-x: auto;
    white-space: pre-wrap;
    height: 234px;
    overflow-y: auto;
    font-family: monospace;
    border: 1px solid #ddd;
  }
</style>
