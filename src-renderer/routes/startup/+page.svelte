<script lang="ts">
  import { onMount } from 'svelte';
  
  let loading = false;
  let error = '';
  
  /**
   * Handle creating a new project
   */
  async function handleNewProject() {
    try {
      loading = true;
      error = '';
      
      if (window.electronAPI) {
        await window.electronAPI.project.new();
      } else {
        console.error('Electron API not available');
        error = 'Electron API not available - this feature only works in the desktop app';
      }
    } catch (err: any) {
      console.error('Error creating new project:', err);
      error = err?.message || 'Failed to create new project';
    } finally {
      loading = false;
    }
  }
  
  /**
   * Handle opening an existing project
   */
  async function handleOpenProject() {
    try {
      loading = true;
      error = '';
      
      if (window.electronAPI) {
        const result = await window.electronAPI.project.open();
        
        if (!result.success && !('canceled' in result && result.canceled)) {
          error = result.error || 'Failed to open project';
        }
      } else {
        console.error('Electron API not available');
        error = 'Electron API not available - this feature only works in the desktop app';
      }
    } catch (err: any) {
      console.error('Error opening project:', err);
      error = err?.message || 'Failed to open project';
    } finally {
      loading = false;
    }
  }
  
  /**
   * Handle starting without a project
   */
  function handleNoProject() {
    try {
      loading = true;
      error = '';
      
      if (window.electronAPI) {
        console.log('Starting without project');
        window.electronAPI.send('start-without-project', {});
        
        // Add a listener for the response
        window.electronAPI.receive('fromMain', (response) => {
          if (response && !response.success && response.error) {
            error = response.error;
          }
          loading = false;
        });
      } else {
        console.error('Electron API not available');
        error = 'Electron API not available - this feature only works in the desktop app';
        loading = false;
      }
    } catch (err: any) {
      console.error('Error starting without project:', err);
      error = err?.message || 'Failed to start application';
      loading = false;
    }
  }
  
  onMount(() => {
    // Listen for the show-startup-dialog event (fallback for when the startup page doesn't exist)
    if (window.electronAPI) {
      window.electronAPI.receive('show-startup-dialog', () => {
        // The dialog is already showing, so we don't need to do anything
        console.log('Received show-startup-dialog event');
      });
    }
  });
</script>

<div class="startup-container">
  <div class="startup-dialog">
    <div class="dialog-header">
      <h1>Welcome to KProxy</h1>
      <p>Select how you would like to start</p>
    </div>
    
    <div class="dialog-content">
      <button 
        class="option-button" 
        on:click={handleNewProject} 
        disabled={loading}
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
        on:click={handleOpenProject} 
        disabled={loading}
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
        on:click={handleNoProject} 
        disabled={loading}
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
    
    {#if error}
      <div class="error-message">
        {error}
      </div>
    {/if}
    
    {#if loading}
      <div class="loading-indicator">
        <span class="loader"></span>
      </div>
    {/if}
  </div>
</div>

<style>
  .startup-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background-color: #1a1a1a;
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
  
  .error-message {
    background-color: rgba(255, 0, 0, 0.2);
    color: #ff6b6b;
    padding: 10px;
    border-radius: 5px;
    font-size: 14px;
    text-align: center;
  }
  
  .loading-indicator {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 40px;
  }
  
  .loader {
    width: 20px;
    height: 20px;
    border: 2px solid #fff;
    border-bottom-color: transparent;
    border-radius: 50%;
    display: inline-block;
    box-sizing: border-box;
    animation: rotation 1s linear infinite;
  }
  
  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
