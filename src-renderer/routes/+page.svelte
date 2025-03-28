<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { projectState } from '$lib/stores/project';
  import { scopeStore } from '$lib/stores/scope';
  import RequestsTab from '$lib/components/RequestsTab.svelte';
  import RepeaterTab from '$lib/components/RepeaterTab2.svelte';
  import SettingsTab from '$lib/components/SettingsTab.svelte';
  import DecodeEncodeTab from '$lib/components/DecodeEncodeTab.svelte';
  import FuzzTab from '$lib/components/FuzzTab.svelte';
  import ChatTab from '$lib/components/ChatTab.svelte';
  import SitemapTab from '$lib/components/SitemapTab.svelte';
  
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
    } else if (interfaceName === 'Decode') {
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
    if (tabName !== 'Settings' && tabName !== 'Repeater' && tabName !== 'Requests' && tabName !== 'Fuzzer' && tabName !== 'Chat' && tabName !== 'Decode' && tabName !== 'Sitemap') return;
    
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
        window.electronAPI.openTabInNewWindow(tabName);
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
  

  // Set up project state change listener
  function setupProjectStateChangeListener() {
    if (window.electronAPI) {
      window.electronAPI.receive('project-state-changed', (data) => {
        console.log('Project state changed:', data);
        
        if (data && data.project) {
          // Update the project state in the store
          projectState.initialize(data.project);
          
          // If we're in startup mode, close the startup dialog
          if (showStartupDialog) {
            showStartupDialog = false;
          }
        }
      });
    }
  }

  // Function to initialize scope settings from backend
  async function initializeScopeSettings() {
    if (window.electronAPI && window.electronAPI.proxy) {
      try {
        // Load scope settings from backend
        const savedScopeSettings = await window.electronAPI.proxy.getScopeSettings();
        
        // Update the scope store with the loaded settings
        scopeStore.set(savedScopeSettings);
        console.log('Loaded scope settings at app initialization:', savedScopeSettings);
      } catch (error) {
        console.error('Failed to load scope settings during initialization:', error);
      }
    }
  }

  // Initialize the UI after component is mounted
  onMount(() => {
    // Check URL parameters to see if we're in startup mode
    if ($page.url.searchParams.get('startup') === 'true') {
      console.log('Startup mode detected, showing startup dialog');
      showStartupDialog = true;
    } else {
      // If not in startup mode, try to get the current project
      if (window.electronAPI) {
        window.electronAPI.project.getCurrent().then(project => {
          if (project) {
            projectState.initialize(project);
            console.log('Loaded current project:', project);
            
            // If project has scope settings, use them
            if (project.scopes) {
              scopeStore.set(project.scopes);
            } else {
              // Otherwise load from backend
              initializeScopeSettings();
            }
          } else {
            // No active project, load scope settings from backend
            initializeScopeSettings();
          }
        }).catch(err => {
          console.error('Error getting current project:', err);
          // Still try to initialize scope settings
          initializeScopeSettings();
        });
      }
    }
    
    // Set up listeners
    setupTabMessageListener();
    setupProjectStateChangeListener();
    
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
        <div class="sidebar-item" class:active={activeSidebarItem === 'Decode'}>Decode</div>
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
      <div class="tab">Decode</div>
      <div class="tab">Sitemap</div>
    </div>
    
    <!-- Main Panel - Contains all interfaces -->
    <div class="main-panel">
      <div id="requests-interface">
        <RequestsTab />
      </div>

      <div id="repeater-interface">
        <RepeaterTab />
      </div>
      
      <div id="decode-encode-interface">
        <DecodeEncodeTab />
      </div>

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
    height: calc(100vh - 60px);
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
    height: calc(100vh - 190px);
  }

  #repeater-interface {
    height: calc(100vh - 190px);
    display: none;
  }
  
  #fuzzer-interface {
    height: calc(100vh - 110px);
    overflow: auto;
    display: none;
  }
  
  #sitemap-interface {
    height: calc(100vh - 190px);
    display: none;
  }

  #chat-interface {
    height: calc(100vh - 120px);
    display: none;
  }

  #decode-encode-interface, #settings-interface {
    display: none;
    height: calc(100vh - 50px);
    width: 100%;
    background-color: transparent;
    border-radius: 4px;
    overflow: auto;
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
    width: 100%;
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
</style>
