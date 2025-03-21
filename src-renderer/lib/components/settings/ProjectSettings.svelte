<script lang="ts">
  import { onMount } from 'svelte';
  import { projectState } from '$lib/stores/project';
  
  // Project state
  let activeProject: Project | null = null;
  let projectName = 'Untitled Project';
  let editingName = false;
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
  
  // Function to update project name
  function updateProjectName() {
    if (!activeProject) return;
    
    editingName = false;
    
    if (projectName.trim() === '') {
      projectName = 'Untitled Project';
    }
    
    if (projectName !== activeProject.name) {
      activeProject.name = projectName;
      projectState.update(activeProject);
      saveProject();
    }
  }
  
  // Function to handle Enter key press when editing name
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      updateProjectName();
    } else if (event.key === 'Escape') {
      editingName = false;
      if (activeProject) {
        projectName = activeProject.name || 'Untitled Project';
      }
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
          {#if editingName}
            <div class="edit-name-container">
              <input 
                type="text" 
                bind:value={projectName} 
                on:blur={updateProjectName}
                on:keydown={handleKeyDown}
                class="name-input"
                autofocus
              />
              <button class="save-name-btn" on:click={updateProjectName}>
                Save
              </button>
            </div>
          {:else}
            <div class="editable-value">
              <span class="value">{projectName}</span>
              <button class="edit-btn" on:click={() => editingName = true}>
                ✏️
              </button>
            </div>
          {/if}
        </div>
        <div class="info-row">
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
        on:click={() => {
          window.electronAPI?.project.initialize()
        }}
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
  
  .editable-value {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .edit-btn {
    background: none;
    border: none;
    color: #aaa;
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    margin-left: 8px;
    transition: color 0.2s;
  }
  
  .edit-btn:hover {
    color: #fff;
  }
  
  .edit-name-container {
    flex: 1;
    display: flex;
    gap: 8px;
  }
  
  .name-input {
    flex: 1;
    background-color: #333;
    border: 1px solid #555;
    border-radius: 4px;
    color: #fff;
    padding: 6px 10px;
    font-size: 14px;
  }
  
  .name-input:focus {
    outline: none;
    border-color: #7289da;
  }
  
  .save-name-btn {
    background-color: #4c6ef5;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
  }
  
  .save-name-btn:hover {
    background-color: #3b5bdb;
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
