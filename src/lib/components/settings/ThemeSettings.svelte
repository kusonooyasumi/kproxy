<script lang="ts">
  import { onMount } from 'svelte';
  
  // Placeholder for theme settings
  let themeSettings = {
    theme: 'dark',
    accentColor: '#ff5252',
    fontSize: 14,
    fontFamily: 'Arial, sans-serif',
    customCss: ''
  };
  
  // Theme options
  const themeOptions = [
    { value: 'dark', label: 'Dark Theme' },
    { value: 'light', label: 'Light Theme' },
    { value: 'system', label: 'System Default' }
  ];
  
  // Color options
  const colorOptions = [
    { value: '#ff5252', label: 'Red' },
    { value: '#4caf50', label: 'Green' },
    { value: '#2196f3', label: 'Blue' },
    { value: '#ff9800', label: 'Orange' },
    { value: '#9c27b0', label: 'Purple' }
  ];
  
  // Font options
  const fontOptions = [
    { value: 'Arial, sans-serif', label: 'Arial' },
    { value: 'Roboto, sans-serif', label: 'Roboto' },
    { value: 'Consolas, monospace', label: 'Consolas' },
    { value: 'Courier New, monospace', label: 'Courier New' }
  ];
  
  // Update settings
  function updateSettings() {
    console.log('Updating theme settings:', themeSettings);
    // Here you would typically save the settings to the backend
  }
  
  onMount(() => {
    // Load theme settings from backend
    console.log('ThemeSettings component mounted');
  });
</script>

<div class="theme-settings">
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Interface Theme</h3>
    </div>
    <div class="settings-card-content">
      <div class="settings-group">
        <label class="settings-label">
          Theme:
          <select 
            bind:value={themeSettings.theme} 
            on:change={updateSettings}
            class="settings-select"
          >
            {#each themeOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
        
        <label class="settings-label">
          Accent Color:
          <div class="color-picker-container">
            <select 
              bind:value={themeSettings.accentColor} 
              on:change={updateSettings}
              class="settings-select"
            >
              {#each colorOptions as option}
                <option value={option.value}>{option.label}</option>
              {/each}
            </select>
            <div class="color-preview" style="background-color: {themeSettings.accentColor}"></div>
          </div>
        </label>
      </div>
    </div>
  </div>
  
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Typography</h3>
    </div>
    <div class="settings-card-content">
      <div class="settings-group">
        <label class="settings-label">
          Font Size:
          <div class="font-size-control">
            <input 
              type="range" 
              min="10" 
              max="20" 
              step="1" 
              bind:value={themeSettings.fontSize} 
              on:change={updateSettings}
              class="range-input"
            />
            <span class="font-size-value">{themeSettings.fontSize}px</span>
          </div>
        </label>
        
        <label class="settings-label">
          Font Family:
          <select 
            bind:value={themeSettings.fontFamily} 
            on:change={updateSettings}
            class="settings-select"
          >
            {#each fontOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      </div>
    </div>
  </div>
  
  <div class="settings-card">
    <div class="settings-card-header">
      <h3>Custom CSS</h3>
    </div>
    <div class="settings-card-content">
      <p class="settings-description">
        Add custom CSS to personalize the application appearance.
        Changes will take effect after restarting the application.
      </p>
      
      <textarea 
        bind:value={themeSettings.customCss} 
        on:change={updateSettings}
        placeholder="/* Add your custom CSS here */"
        class="custom-css-textarea"
        rows="8"
      ></textarea>
    </div>
  </div>
</div>

<style>
  .theme-settings {
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
  
  .settings-select {
    background-color: #333;
    border: 1px solid #444;
    color: #fff;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;
    width: 200px;
  }
  
  .color-picker-container {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  
  .color-preview {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid #444;
  }
  
  .font-size-control {
    display: flex;
    align-items: center;
    gap: 15px;
  }
  
  .range-input {
    flex: 1;
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: #444;
    outline: none;
    cursor: pointer;
    border-radius: 2px;
  }
  
  .range-input::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    background: #ff5252;
    border-radius: 50%;
    cursor: pointer;
  }
  
  .font-size-value {
    min-width: 40px;
    text-align: right;
    font-family: monospace;
  }
  
  .custom-css-textarea {
    width: 100%;
    background-color: #333;
    border: 1px solid #444;
    color: #fff;
    padding: 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 14px;
    resize: vertical;
  }
</style>
