<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import RequestsTab from '$lib/components/RequestsTab.svelte';
  import RepeaterTab from '$lib/components/RepeaterTab.svelte';
  import SettingsTab from '$lib/components/SettingsTab.svelte';
  import DecodeEncodeTab from '$lib/components/DecodeEncodeTab.svelte';
  import FuzzTab from '$lib/components/FuzzTab.svelte';
  import ChatTab from '$lib/components/ChatTab.svelte';
  import SitemapTab from '$lib/components/SitemapTab.svelte';
  import { projectState } from '$lib/stores/project';
  
  // Check if we should display the startup dialog
  let showStartupDialog = false;
  
  // State for sidebar visibility
  let sidebarVisible = true;
  
  // Track the active sidebar item
  let activeSidebarItem = 'Requests';
  
  // Function to toggle sidebar visibility
  function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    // The CSS handles most of the toggle behavior with the class:collapsed binding
  }

  // Function to show the selected interface and hide others
  function showInterface(interfaceName: string) {
    // Get references to the interface elements
    const requestsInterface = document.getElementById('requests-interface') as HTMLElement;
    const repeaterInterface = document.getElementById('repeater-interface') as HTMLElement;
    const decodeEncodeInterface = document.getElementById('decode-encode-interface') as HTMLElement;
    const settingsInterface = document.getElementById('settings-interface') as HTMLElement;
    const chatInterface = document.getElementById('chat-interface') as HTMLElement;
    const fuzzerInterface = document.getElementById('fuzzer-interface') as HTMLElement;
    const sitemapInterface = document.getElementById('sitemap-interface') as HTMLElement;
    const tabsBar = document.querySelector('.tabs') as HTMLElement;
    
    if (!requestsInterface || !repeaterInterface || !decodeEncodeInterface || !settingsInterface || !sitemapInterface || !fuzzerInterface || !tabsBar) return;
    
    // Hide all interface panels
    requestsInterface.style.display = 'none';
    repeaterInterface.style.display = 'none';
    decodeEncodeInterface.style.display = 'none';
    settingsInterface.style.display = 'none';
    chatInterface.style.display = 'none';
    fuzzerInterface.style.display = 'none';
    sitemapInterface.style.display = 'none';
    
    // Show/hide tabs based on the selected interface
    if (interfaceName === 'Settings') {
      tabsBar.style.display = 'none';
    } else {
      tabsBar.style.display = 'flex';
    }
    
    // Show the selected interface
    if (interfaceName === 'Repeater') {
      repeaterInterface.style.display = 'block';
    } else if (interfaceName === 'Decode/Encode') {
      decodeEncodeInterface.style.display = 'block';
    } else if (interfaceName === 'Settings') {
      settingsInterface.style.display = 'block';
    } else if (interfaceName === 'Fuzzer') {
      fuzzerInterface.style.display = 'block';
    } else if (interfaceName === 'Chat') {
      chatInterface.style.display = 'block';
    } else if (interfaceName === 'Sitemap') {
      sitemapInterface.style.display = 'block';
    } else if (interfaceName === 'Requests') {
      requestsInterface.style.display = 'block';
    } else {
      // Default view (Requests)

    }
    
    // Update the active sidebar item
    activeSidebarItem = interfaceName;
  }
  
  // Handle tab and sidebar item clicks
  function handleTabClick(event: Event) {
    const tab = event.currentTarget as HTMLElement;
    const tabs = document.querySelectorAll('.tab');
    
    // Update active tab
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    // Show corresponding interface
    showInterface(tab.textContent || '');
  }
  
  // Function to handle the right-click event on sidebar items
  function handleContextMenu(event: MouseEvent, tabName: string) {
    // Only handle right-clicks for Repeater and Requests tabs
    if (tabName !== 'Repeater' && tabName !== 'Requests' && tabName !== 'Fuzzer' && tabName !== 'Chat' && tabName !== 'Decode/Encode' && tabName !== 'Sitemap') return;
    
    // Prevent the default context menu
    event.preventDefault();
    
    // Create a context menu element
    const contextMenu = document.createElement('div');
    contextMenu.classList.add('context-menu');
    contextMenu.style.position = 'fixed';
    contextMenu.style.zIndex = '1000';
    contextMenu.style.backgroundColor = '#2c2c2c';
    contextMenu.style.border = '1px solid #444';
    contextMenu.style.borderRadius = '8px';
    contextMenu.style.padding = '5px 0';
    contextMenu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
    contextMenu.style.left = `${event.clientX}px`;
    contextMenu.style.top = `${event.clientY}px`;
    
    // Create the "Open in New Window" option
    const openInNewWindowOption = document.createElement('div');
    openInNewWindowOption.textContent = 'Open in New Window';
    openInNewWindowOption.style.padding = '8px 12px';
    openInNewWindowOption.style.cursor = 'pointer';
    openInNewWindowOption.style.color = '#fff';
    openInNewWindowOption.style.fontSize = '14px';
    
    // Add hover effect
    openInNewWindowOption.addEventListener('mouseover', () => {
      openInNewWindowOption.style.backgroundColor = '#3d3d3d';
    });
    
    openInNewWindowOption.addEventListener('mouseout', () => {
      openInNewWindowOption.style.backgroundColor = 'transparent';
    });
    
    // Add click handler to open in new window
    openInNewWindowOption.addEventListener('click', () => {
      // Check if the electronAPI is available (only in Electron environment)
      if (window.electronAPI) {
        window.electronAPI.send('openTabInNewWindow', { tabName });
      } else {
        console.warn('Electron API not available - this feature only works in the desktop app');
      }
      
      // Remove the context menu
      document.body.removeChild(contextMenu);
    });
    
    // Add the option to the menu
    contextMenu.appendChild(openInNewWindowOption);
    
    // Add the menu to the body
    document.body.appendChild(contextMenu);
    
    // Handle clicking outside the context menu
    function handleClickOutside(e: MouseEvent) {
      if (!contextMenu.contains(e.target as Node)) {
        if (document.body.contains(contextMenu)) {
          document.body.removeChild(contextMenu);
        }
        document.removeEventListener('click', handleClickOutside);
      }
    }
    
    // Add event listener for clicking outside
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);
  }
  
  // Handle showing a specific tab when instructed by Electron
  function setupTabMessageListener() {
    if (window.electronAPI) {
      window.electronAPI.receive('showTab', (data) => {
        if (data && data.tabName) {
          const tabName = data.tabName;
          console.log(`Received instruction to show tab: ${tabName}`);
          
          // Find and click the corresponding tab
          const tabs = document.querySelectorAll('.tab');
          tabs.forEach(tab => {
            if (tab.textContent === tabName) {
              (tab as HTMLElement).click();
            }
          });
        }
      });
    }
  }
  

  // Initialize the UI after component is mounted
  onMount(() => {
    // Check URL parameters to see if we're in startup mode
    if ($page.url.searchParams.get('startup') === 'true') {
      console.log('Startup mode detected, showing startup dialog');
      showStartupDialog = true;
    }
    
    // Set up the tab message listener
    setupTabMessageListener();
    
    // Add event listeners for tabs
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => handleTabClick(e));
    });
    
    // Add event listeners for sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
      // Add click handler
      item.addEventListener('click', () => {
        const tabName = item.textContent || '';
        
        // Handle Settings tab separately since it doesn't have a corresponding tab in the tabs bar
        if (tabName === 'Settings') {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          showInterface('Settings');
          return;
        }
        
        // For other tabs, find the matching tab in the top bar
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
          if (tab.textContent === tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding interface
            showInterface(tabName);
          }
        });
      });
      
      // Add context menu handler for right-click
      item.addEventListener('contextmenu', (event: Event) => {
        const tabName = item.textContent || '';
        handleContextMenu(event as MouseEvent, tabName);
      });
    });
    
    // Return cleanup function
    return () => {
      // Clean up any event listeners if needed
    };
  });
  
</script>

<div class="app-container">

  <!-- Left Sidebar -->
  <div class="sidebar" class:collapsed={!sidebarVisible}>
    <div class="toggle-button" on:click={toggleSidebar}>
      {#if sidebarVisible}
        <span>◀</span>
      {:else}
        <span>▶</span>
      {/if}
    </div>
    <div class="sidebar-content" class:hidden={!sidebarVisible}>
      <div class="sidebar-section">
        <div class="sidebar-item" class:active={activeSidebarItem === 'Settings'}>Settings</div>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-item" class:active={activeSidebarItem === 'Requests'}>Requests</div>
        <div class="sidebar-item" class:active={activeSidebarItem === 'Repeater'}>Repeater</div>
        <div class="sidebar-item" class:active={activeSidebarItem === 'Fuzzer'}>Fuzzer</div>
        <div class="sidebar-item" class:active={activeSidebarItem === 'Chat'}>Chat</div>
        <div class="sidebar-item" class:active={activeSidebarItem === 'Decode/Encode'}>Decode/Encode</div>
        <div class="sidebar-item" class:active={activeSidebarItem === 'Sitemap'}>Sitemap</div>
      </div>
    </div>
  </div>
  
  <!-- Main Content -->
  <div class="main-content">
    <!-- Tabs Bar -->
    <div class="tabs">
      <div class="tab active">Requests</div>
      <div class="tab">Repeater</div>
      <div class="tab">Fuzzer</div>
      <div class="tab">Chat</div>
      <div class="tab">Decode/Encode</div>
      <div class="tab">Sitemap</div>
    </div>
    
    <!-- Main Panel - Contains all interfaces -->
    <div class="main-panel">
      <!-- Requests Interface -->
      <div id="requests-interface">
        <RequestsTab />
      </div>

      <!-- Repeater Interface -->
      <div id="repeater-interface">
        <RepeaterTab />
      </div>
      
      <!-- Decode/Encode Interface -->
      <div id="decode-encode-interface">
        <DecodeEncodeTab />
      </div>

      <!-- Decode/Encode Interface -->
      <div id="fuzzer-interface">
        <FuzzTab />
      </div>

      <div id="chat-interface">
        <ChatTab />
      </div>

      <div id="sitemap-interface">
        <SitemapTab />
      </div>
      
      <!-- Settings Interface -->
      <div id="settings-interface">
        <SettingsTab />
      </div>
    </div>
  </div>
</div>

{#if showStartupDialog}
  <div class="startup-modal-overlay">
    <div class="startup-dialog">
      <div class="dialog-header">
        <h1>Welcome to KProxy</h1>
        <p>Select how you would like to start</p>
      </div>
      
      <div class="dialog-content">
        <button 
          class="option-button" 
          on:click={() => {
            if (window.electronAPI) {
              window.electronAPI.project.new().catch(err => console.error('Error creating new project:', err));
            }
          }}
        >
          <div class="option-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 14h8v2H8v-2zm0-4h3v2H8v-2z" fill="currentColor"/>
            </svg>
          </div>
          <span>Create New Project</span>
          <p class="option-description">Start a new KProxy project file</p>
        </button>
        
        <button 
          class="option-button" 
          on:click={() => {
            if (window.electronAPI) {
              window.electronAPI.project.open().catch(err => console.error('Error opening project:', err));
            }
          }}
        >
          <div class="option-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="M20 18H4V8h16v10zM3 4h18v3H3V4zm8 11h6v2h-6v-2z" fill="currentColor"/>
            </svg>
          </div>
          <span>Open Existing Project</span>
          <p class="option-description">Open a previously saved KProxy project</p>
        </button>
        
        <button 
          class="option-button" 
          on:click={() => {
            if (window.electronAPI) {
              console.log('Starting without project');
              window.electronAPI.send('start-without-project', {});
              showStartupDialog = false;
            }
          }}
        >
          <div class="option-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
              <path fill="none" d="M0 0h24v24H0z"/>
              <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm-1-5h2v2h-2v-2zm2-1.645V14h-2v-1.5a1 1 0 0 1 1-1 1.5 1.5 0 1 0-1.471-1.794l-1.962-.393A3.5 3.5 0 1 1 13 13.355z" fill="currentColor"/>
            </svg>
          </div>
          <span>Continue Without Project</span>
          <p class="option-description">Use KProxy without saving data to a project file</p>
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    font-family: Arial, sans-serif;
  }
  
  :global(body) {
    background-color: #212121;
    color: #fff;
    height: 100vh;
    overflow: hidden;
    margin: 0;
    padding: 0;
  }
  
.app-container {
    display: flex;
    flex-direction: row;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    position: relative;
  }
  
  
  .sidebar {
    position: relative;
    width: 200px;
    background-color: #1a1a1a;
    display: flex;
    flex-direction: column;
    transition: width 0.3s ease;
    border-radius: 4px;
    margin: 10px 10px 0 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    height: calc(100vh - 20px);
    overflow: hidden;
    z-index: 10;
    flex-shrink: 0;
    border: 1px solid #ddd;
  }
  
  .sidebar.collapsed {
    width: 40px;
  }
  
  .toggle-button {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #333;
    color: #fff;
    border-radius: 6px;
    cursor: pointer;
    z-index: 10;
  }
  
  .sidebar-content {
    padding: 20px;
    display: flex;
    flex-direction: column;
    width: 100%;
    transition: opacity 0.3s ease;
  }
  
  .sidebar-content.hidden {
    opacity: 0;
    pointer-events: none;
  }
  
  .sidebar-section {
    margin-bottom: 20px;
  }
  
  .sidebar-item {
    padding: 10px;
    cursor: pointer;
    color: #ddd;
    border-radius: 8px;
    transition: background-color 0.2s ease;
  }
  
  .sidebar-item:hover {
    color: #fff;
    background-color: #2a2a2a;
  }
  
  /* Add styling for active sidebar item with red color */
  .sidebar-item.active {
    color: #ff5252;
  }
  
  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    transition: margin-left 0.3s ease;
    height: 100%;
    margin: 10px 10px 0 0;
    min-width: 0; /* Prevent flex items from overflowing */
  }
  
  .tabs {
    display: flex;
    background-color: #1a1a1a;
    padding: 5px 10px;
    border-radius: 4px;
    margin-bottom: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #ddd;
  }
  
  .tab {
    padding: 10px 20px;
    cursor: pointer;
    color: #999;
    text-align: center;
    border-radius: 7px;
    transition: background-color 0.2s ease;
    margin: 0 2px;
  }
  
  .tab:hover {
    background-color: #2a2a2a;
  }
  
  .tab.active {
    background-color: #2a2a2a;
    color: #fff;
    border: 2px solid #ff5252;
  }
  
  .main-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    background-color: transparent;
    border-radius: 4px;
    
    overflow: auto;
  }
  
  #requests-interface {
    height: calc(100vh - 150px);
  }

  #repeater-interface {
    height: calc(100vh - 150px);
    display: none;
  }
  
  #fuzzer-interface {
    height: 100%;
    overflow: auto;
    display: none;
  }
  
  #sitemap-interface {
    height: calc(100vh - 170px);
    display: none;
  }

  #chat-interface {
    height: calc(100vh - 78.5px);
    display: none;
  }

  #decode-encode-interface, #settings-interface {
    display: none;
    height: 100%;
    width: 100%;
    background-color: transparent;
    border-radius: 4px;
    overflow: auto;
  }
  
  .send-button {
    width: 30px;
    height: 30px;
    background-color: #333;
    border: none;
    color: #ff5252;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
  }

  :global(.input-container) {
    background-color: #2a2a2a;
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 10px;
  }

  :global(.table-container) {
    background-color: #2a2a2a;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 10px;
  }

  :global(table) {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
  }

  :global(th, td) {
    padding: 10px;
    border-bottom: 1px solid #444;
  }

  :global(button) {
    border-radius: 8px;
  }

  /* Request response section styles */
  .request-response-section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
  }
  
  .url-input-container {
    display: flex;
    align-items: center;
    gap: 10px;
    background-color: #2a2a2a;
    border-radius: 8px;
    padding: 10px;
  }
  
  .url-input {
    flex: 1;
    background-color: #333;
    border: none;
    padding: 8px 12px;
    color: #fff;
    border-radius: 6px;
  }
  
  .response-section {
    background-color: #2a2a2a;
    border-radius: 8px;
    padding: 10px;
  }
  
  .response-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .response-controls {
    display: flex;
    gap: 8px;
  }
  
  .control-button {
    background-color: #333;
    border: none;
    color: #fff;
    width: 30px;
    height: 30px;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .response-content {
    background-color: #333;
    border-radius: 6px;
    padding: 10px;
    min-height: 150px;
    color: #ddd;
  }
  
  .requests-table {
    margin-bottom: 10px;
    overflow: auto;
  }
  
  .requests-table table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .requests-table th {
    background-color: #2a2a2a;
    text-align: left;
    padding: 10px;
    font-weight: normal;
    color: #ddd;
  }
  
  .requests-table td {
    padding: 8px 10px;
    border-bottom: 1px solid #333;
  }
  
  /* Startup dialog styles */
  .startup-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }
  
  .startup-dialog {
    background-color: #2a2a2a;
    width: 90%;
    max-width: 500px;
    border-radius: 10px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    padding: 25px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .dialog-header {
    text-align: center;
    margin-bottom: 10px;
  }
  
  .dialog-header h1 {
    font-size: 24px;
    margin-bottom: 5px;
    color: #fff;
  }
  
  .dialog-header p {
    font-size: 16px;
    color: #aaa;
    margin: 0;
  }
  
  .dialog-content {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .option-button {
    display: grid;
    grid-template-columns: 50px 1fr;
    grid-template-rows: auto auto;
    grid-template-areas: 
      "icon title"
      "icon description";
    align-items: center;
    background-color: #333;
    border: none;
    border-radius: 8px;
    padding: 15px;
    cursor: pointer;
    transition: background-color 0.2s;
    text-align: left;
    color: #fff;
  }
  
  .option-button:hover {
    background-color: #444;
  }
  
  .option-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .option-icon {
    grid-area: icon;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 24px;
    color: #ff5252;
  }
  
  .option-button span {
    grid-area: title;
    font-size: 16px;
    font-weight: bold;
    color: #fff;
  }
  
  .option-description {
    grid-area: description;
    font-size: 14px;
    color: #aaa;
    margin: 0;
  }
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: #1e1e1e;
  }

  ::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>