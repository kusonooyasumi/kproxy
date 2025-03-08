<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  
  // Check if running in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;
  
  // Define type for scope settings
  interface ScopeSettings {
    inScope: string[];
    outOfScope: string[];
  }
  
  // Create a writable store for scope settings that can be imported in other components
  export const scopeStore = writable<ScopeSettings>({
    inScope: ['example.com', '*.example.org'],
    outOfScope: ['admin.example.com']
  });
  
  // Local state for the component
  let scopeSettings = {
    inScope: ['example.com', '*.example.org'],
    outOfScope: ['admin.example.com'],
    newScopeItem: '',
    newExclusionItem: ''
  };
  
  // Save scope settings to electron backend
  async function saveScopeSettings() {
    if (!isElectron || !window.electronAPI) {
      console.error('Cannot save scope settings: Electron API not available');
      return;
    }
    
    try {
      // This assumes you'll implement this method in your electron backend
      await window.electronAPI.scope.saveSettings({
        inScope: scopeSettings.inScope,
        outOfScope: scopeSettings.outOfScope
      });
      console.log('Scope settings saved');
    } catch (error) {
      console.error('Failed to save scope settings:', error);
    }
  }
  
  // Load scope settings from backend
  async function loadScopeSettings() {
    if (!isElectron || !window.electronAPI) {
      console.log('Cannot load scope settings: Electron API not available');
      return;
    }
    
    try {
      // This assumes you'll implement this method in your electron backend
      const savedSettings = await window.electronAPI.scope.getSettings();
      scopeSettings.inScope = savedSettings.inScope;
      scopeSettings.outOfScope = savedSettings.outOfScope;
      updateScopeStore();
      console.log('Scope settings loaded:', savedSettings);
    } catch (error) {
      console.error('Failed to load scope settings:', error);
    }
  }
  
  // Add a new in-scope item
  function addInScopeItem() {
    if (scopeSettings.newScopeItem.trim()) {
      scopeSettings.inScope = [...scopeSettings.inScope, scopeSettings.newScopeItem.trim()];
      scopeSettings.newScopeItem = '';
      updateScopeStore();
      saveScopeSettings();
    }
  }
  
  // Remove an in-scope item
  function removeInScopeItem(index: number) {
    scopeSettings.inScope = scopeSettings.inScope.filter((_, i) => i !== index);
    updateScopeStore();
    saveScopeSettings();
  }
  
  // Add a new out-of-scope item
  function addOutOfScopeItem() {
    if (scopeSettings.newExclusionItem.trim()) {
      scopeSettings.outOfScope = [...scopeSettings.outOfScope, scopeSettings.newExclusionItem.trim()];
      scopeSettings.newExclusionItem = '';
      updateScopeStore();
      saveScopeSettings();
    }
  }
  
  // Remove an out-of-scope item
  function removeOutOfScopeItem(index: number) {
    scopeSettings.outOfScope = scopeSettings.outOfScope.filter((_, i) => i !== index);
    updateScopeStore();
    saveScopeSettings();
  }
  
  // Update the scope store with current values
  function updateScopeStore() {
    scopeStore.set({
      inScope: scopeSettings.inScope,
      outOfScope: scopeSettings.outOfScope
    });
  }
  
  // Handle key press for adding items
  function handleKeyPress(event: KeyboardEvent, type: 'in' | 'out') {
    if (event.key === 'Enter') {
      if (type === 'in') {
        addInScopeItem();
      } else {
        addOutOfScopeItem();
      }
    }
  }
  
  onMount(() => {
    // Load scope settings from backend
    console.log('ScopeSettings component mounted');
    // Load settings from backend if available
    loadScopeSettings();
  });
</script>

<div class="scope-settings">
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>In-Scope Items</h3>
    </div>
    <div class="settings-card-content">
      <p class="settings-description">
        Define domains and patterns that should be included in the scope.
        You can use wildcards like *.example.com
      </p>
      
      <div class="scope-input-group">
        <input 
          type="text" 
          placeholder="Enter domain or pattern" 
          bind:value={scopeSettings.newScopeItem}
          on:keypress={(e) => handleKeyPress(e, 'in')}
          class="settings-input full-width"
        />
        <button class="settings-button" on:click={addInScopeItem}>Add</button>
      </div>
      
      <div class="scope-items">
        {#if scopeSettings.inScope.length === 0}
          <div class="empty-message">No in-scope items defined</div>
        {:else}
          {#each scopeSettings.inScope as item, index}
            <div class="scope-item">
              <span>{item}</span>
              <button class="remove-button" on:click={() => removeInScopeItem(index)}>×</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
  
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Out-of-Scope Exclusions</h3>
    </div>
    <div class="settings-card-content">
      <p class="settings-description">
        Define domains and patterns that should be excluded from the scope,
        even if they match an in-scope pattern.
      </p>
      
      <div class="scope-input-group">
        <input 
          type="text" 
          placeholder="Enter domain or pattern to exclude" 
          bind:value={scopeSettings.newExclusionItem}
          on:keypress={(e) => handleKeyPress(e, 'out')}
          class="settings-input full-width"
        />
        <button class="settings-button" on:click={addOutOfScopeItem}>Add</button>
      </div>
      
      <div class="scope-items">
        {#if scopeSettings.outOfScope.length === 0}
          <div class="empty-message">No exclusions defined</div>
        {:else}
          {#each scopeSettings.outOfScope as item, index}
            <div class="scope-item exclusion">
              <span>{item}</span>
              <button class="remove-button" on:click={() => removeOutOfScopeItem(index)}>×</button>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .scope-settings {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .settings-card {
    background-color: #2c2c2c;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }
  
  .settings-card-header {
    background-color: #1a1a1a;
    padding: 15px 20px;
    border-bottom: 1px solid #333;
  }
  
  .settings-card-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: normal;
    color: #fff;
  }
  
  .settings-card-content {
    padding: 20px;
  }
  
  .settings-description {
    color: #aaa;
    margin-bottom: 15px;
    font-size: 14px;
  }
  
  .scope-input-group {
    display: flex;
    gap: 10px;
    margin-bottom: 15px;
  }
  
  .settings-input {
    background-color: #333;
    border: 1px solid #444;
    color: #fff;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;
  }
  
  .full-width {
    flex: 1;
  }
  
  .settings-button {
    background-color: #333;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 8px 15px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }
  
  .settings-button:hover {
    background-color: #444;
  }
  
  .scope-items {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .scope-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: #333;
    padding: 8px 12px;
    border-radius: 4px;
    color: #ddd;
    font-size: 14px;
  }
  
  .scope-item.exclusion {
    border-left: 3px solid #f44336;
  }
  
  .remove-button {
    background: none;
    border: none;
    color: #999;
    font-size: 18px;
    cursor: pointer;
    padding: 0 5px;
  }
  
  .remove-button:hover {
    color: #f44336;
  }
  
  .empty-message {
    color: #777;
    font-style: italic;
    text-align: center;
    padding: 15px 0;
  }
</style>
