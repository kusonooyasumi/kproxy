<script lang="ts">
  import { onMount } from 'svelte';
  import { projectState } from '$lib/stores/project';
  
  // Project state
  let activeProject: Project | null = null;
  let projectName = 'Untitled Project';
  let projectSaving = false;
  let projectError: string | null = null;
  
  // Function to save the current project
  async function saveProject() {
    if (!activeProject) {
      projectError = 'No active project to save';
      return;
    }
    
    try {
      projectSaving = true;
      projectError = null;
      
      const result = await projectState.save();
      
      if (!result.success) {
        projectError = result.error || 'Failed to save project';
      }
    } catch (err: any) {
      console.error('Error saving project:', err);
      projectError = err?.message || 'Failed to save project';
    } finally {
      projectSaving = false;
    }
  }
  
  // Function to save the current project with a new name/location
  async function saveProjectAs() {
    if (!activeProject) {
      projectError = 'No active project to save';
      return;
    }
    
    try {
      projectSaving = true;
      projectError = null;
      
      const result = await projectState.saveAs();
      
      if (!result.success) {
        projectError = result.error || 'Failed to save project';
      }
    } catch (err: any) {
      console.error('Error saving project as:', err);
      projectError = err?.message || 'Failed to save project';
    } finally {
      projectSaving = false;
    }
  }
  
  // Initialize the component
  onMount(() => {
    // Subscribe to project state changes
    const unsubscribe = projectState.subscribe(project => {
      activeProject = project;
      if (activeProject) {
        projectName = activeProject.name || 'Untitled Project';
      }
    });
    
    // Listen for project state change events from the main process
    if (window.electronAPI) {
      window.electronAPI.receive('project-state-changed', (data) => {
        if (data && data.project) {
          projectState.initialize(data.project);
        }
      });
    }
    
    // Return cleanup function
    return () => {
      unsubscribe();
    };
  });
</script>

<div class="project-settings">
  <div class="form-group">
    <h3>Project Information</h3>
    
    <div class="project-info">
      {#if activeProject}
        <div class="info-row">
          <span class="label">Name:</span>
          <span class="value">{projectName}</span>
        </div>
        <div class="info-row">
          <span class="label">Location:</span>
          <span class="value">{activeProject.path || 'Unknown'}</span>
        </div>
      {:else}
        <p class="no-project">No active project</p>
      {/if}
    </div>
  </div>
  
  <div class="form-group">
    <h3>Project Actions</h3>
    
    <div class="actions-grid">
      <button 
        class="action-button" 
        on:click={() => window.electronAPI?.project.new()}
      >
        <span class="icon">📄</span>
        <span>New Project</span>
      </button>
      
      <button 
        class="action-button" 
        on:click={() => window.electronAPI?.project.open()}
      >
        <span class="icon">📂</span>
        <span>Open Project</span>
      </button>
      
      <button 
        class="action-button" 
        class:disabled={!activeProject} 
        on:click={saveProject}
      >
        <span class="icon">💾</span>
        <span>Save Project</span>
      </button>
      
      <button 
        class="action-button" 
        class:disabled={!activeProject} 
        on:click={saveProjectAs}
      >
        <span class="icon">📋</span>
        <span>Save As...</span>
      </button>
    </div>
    
    {#if projectError}
      <div class="project-error">
        <span class="error-icon">⚠️</span>
        <span>{projectError}</span>
      </div>
    {/if}
    
    {#if projectSaving}
      <div class="project-saving">
        <span class="spinner"></span>
        <span>Saving...</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .project-settings {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  
  h3 {
    margin-top: 0;
    margin-bottom: 15px;
    color: #fff;
    font-size: 18px;
  }
  
  .project-info {
    background-color: #222;
    border-radius: 4px;
    padding: 15px;
    border: 1px solid #ddd;
  }
  
  .info-row {
    display: flex;
    margin-bottom: 10px;
  }
  
  .info-row:last-child {
    margin-bottom: 0;
  }
  
  .label {
    width: 100px;
    color: #aaa;
  }
  
  .value {
    flex: 1;
    color: #fff;
    word-break: break-all;
  }
  
  .no-project {
    color: #aaa;
    font-style: italic;
    text-align: center;
    margin: 10px 0;
  }
  
  .actions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 15px;
    margin-bottom: 15px;
  }
  
  .action-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: #333;
    border: none;
    color: #fff;
    padding: 15px;
    border-radius: 4%;
    border: 1px solid #ddd;
    cursor: pointer;
    transition: background-color 0.2s;
    text-align: center;
    gap: 8px;
  }
  
  .action-button:hover {
    background-color: #444;
  }
  
  .action-button.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .action-button.disabled:hover {
    background-color: #333;
  }
  
  .icon {
    font-size: 24px;
  }
  
  .project-error {
    background-color: rgba(255, 0, 0, 0.2);
    color: #ff6b6b;
    padding: 10px;
    border-radius: 8px;
    margin-top: 15px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .error-icon {
    font-size: 18px;
  }
  
  .project-saving {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #aaa;
    margin-top: 15px;
  }
  
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid transparent;
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
