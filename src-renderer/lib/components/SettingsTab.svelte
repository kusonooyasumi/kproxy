<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import ProxySettings from './settings/ProxySettings.svelte';
  import GeneralSettings from './settings/GeneralSettings.svelte';
  import ScopeSettings from './settings/ScopeSettings.svelte';
  import ProjectSettings from './settings/ProjectSettings.svelte';
  
  // Props that can be passed to the component
  export let standalone = false; // Whether the component is running in standalone mode (new window)
  
  // State
  let selectedSection = 'Project'; // Default to Project settings
  
  // Handle section selection
  function selectSection(section: string) {
    selectedSection = section;
  }
  
  // Initialize the UI after component is mounted
  onMount(() => {
    console.log(`SettingsTab mounted, standalone: ${standalone}`);
    
    // Hide parent sidebar and tabs if in standalone mode
    if (standalone) {
      // This is a workaround to hide the sidebar and tabs when in standalone mode
      // These elements might be present from the parent layout
      const sidebar = document.querySelector('.sidebar') as HTMLElement;
      const tabs = document.querySelector('.tabs') as HTMLElement;
      
      if (sidebar) sidebar.style.display = 'none';
      if (tabs) tabs.style.display = 'none';
    }
  });
</script>

<div class="settings-container">
  <!-- Settings Sidebar -->
<div class="settings-sidebar">
    <div class="sidebar-item" class:active={selectedSection === 'Project'} on:click={() => selectSection('Project')}>Project</div>
    <div class="sidebar-item" class:active={selectedSection === 'Proxy'} on:click={() => selectSection('Proxy')}>Proxy</div>
    <div class="sidebar-item" class:active={selectedSection === 'Scope'} on:click={() => selectSection('Scope')}>Scope</div>
  </div>
  
  <!-- Settings Content -->
  <div class="settings-content">
    {#if selectedSection === 'Project'}
      <div class="settings-section">
        <h2>Project Settings</h2>
        <svelte:component this={ProjectSettings} />
      </div>
    {:else if selectedSection === 'Proxy'}
      <div class="settings-section">
        <h2>Proxy Settings</h2>
        <svelte:component this={ProxySettings} />
      </div>
    {:else if selectedSection === 'Scope'}
      <div class="settings-section">
        <h2>Scope Settings</h2>
        <svelte:component this={ScopeSettings} />
      </div>
    {/if}
  </div>
</div>

<style>
  .settings-container {
    display: flex;
    height: 97.3%;
    width: 100%;
    gap: 15px;
    background-color: transparent;
  }
  
  .settings-sidebar {
    width: 200px;
    background-color: #1a1a1a;
    padding: 15px 0;
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    overflow: hidden;
  }
  
  .sidebar-item {
    padding: 12px 20px;
    cursor: pointer;
    color: #ddd;
    transition: all 0.2s ease;
    margin: 2px 8px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
  
  .sidebar-item:hover {
    background-color: #2a2a2a;
    color: #fff;
  }
  
  .sidebar-item.active {
    background-color: #2a2a2a;
    color: #fff;
    border: 3px solid #ff5252;
  }
  
  .settings-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    background-color: #1a1a1a;
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #ddd;
  }
  
  .settings-section {
    max-width: 800px;
  }
  
  .settings-section h2 {
    margin-top: 0;
    color: #fff;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #333;
  }

  /* Global styles for input elements within settings */
  :global(.settings-container input[type="text"]),
  :global(.settings-container input[type="number"]),
  :global(.settings-container select) {
    background-color: #2a2a2a;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 8px 12px;
    color: #fff;
    width: 100%;
    margin-bottom: 15px;
    border: 1px solid #ddd;
  }

  :global(.settings-container button) {
    background-color: #333;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 8px 15px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border: 1px solid #ddd;
  }

  :global(.settings-container button:hover) {
    background-color: #444;
  }

  :global(.settings-container button.primary) {
    background-color: #ff5252;
  }

  :global(.settings-container button.primary:hover) {
    background-color: #ff3838;
  }

  :global(.settings-container .form-group) {
    margin-bottom: 20px;
    background-color: #2a2a2a;
    padding: 15px;
    border-radius: 4px;
    border: 1px solid #ddd;
  }

  :global(.settings-container .form-group label) {
    display: block;
    margin-bottom: 8px;
    color: #ddd;
  }
</style>
