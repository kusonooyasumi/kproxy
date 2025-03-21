<script lang="ts">
  import { onMount } from 'svelte';
  
  // Placeholder for general settings
  let generalSettings = {
    maxRequestSize: 10, // MB
    timeoutSeconds: 30,
    followRedirects: true,
    maxRedirects: 5
  };
  
  // Update settings
  function updateSettings() {
    console.log('Updating general settings:', generalSettings);
    // Here you would typically save the settings to the backend
  }
  
  onMount(() => {
    // Load settings from backend
    console.log('GeneralSettings component mounted');
  });
</script>

<div class="general-settings">
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Request Settings</h3>
    </div>
    <div class="settings-card-content">
      <div class="settings-group">
        <label class="settings-label">
          Max Request Size (MB):
          <input 
            type="number" 
            bind:value={generalSettings.maxRequestSize} 
            on:change={updateSettings}
            min="1" 
            max="100" 
            class="settings-input"
          />
        </label>
        
        <label class="settings-label">
          Request Timeout (seconds):
          <input 
            type="number" 
            bind:value={generalSettings.timeoutSeconds} 
            on:change={updateSettings}
            min="1" 
            max="300" 
            class="settings-input"
          />
        </label>
        
        <label class="settings-label checkbox-label">
          <input 
            type="checkbox" 
            bind:checked={generalSettings.followRedirects} 
            on:change={updateSettings}
          />
          Follow Redirects
        </label>
        
        {#if generalSettings.followRedirects}
          <label class="settings-label">
            Max Redirects:
            <input 
              type="number" 
              bind:value={generalSettings.maxRedirects} 
              on:change={updateSettings}
              min="1" 
              max="10" 
              class="settings-input"
            />
          </label>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .general-settings {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  .settings-card {
    background-color: #2c2c2c;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    border: 1px solid #ddd;
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
  
  .settings-group {
    display: flex;
    flex-direction: column;
    gap: 15px;
  }
  
  .settings-label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    color: #ddd;
    font-size: 14px;
  }
  
  .checkbox-label {
    flex-direction: row;
    align-items: center;
    gap: 10px;
  }
  
  .settings-input {
    background-color: #333;
    border: 1px solid #444;
    color: #fff;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;
    width: 100px;
  }
</style>
