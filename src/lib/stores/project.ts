import { writable } from 'svelte/store';

// Define the initial empty project state
const initialProjectState: Project | null = null;

// Create the writable store
const projectStore = writable<Project | null>(initialProjectState);

// Enhanced store with custom methods
export const projectState = {
  ...projectStore,
  
  // Initialize project data
  initialize: (project: Project | null) => {
    projectStore.set(project);
  },
  
  // Update project data
  update: (project: Project) => {
    projectStore.update(currentProject => {
      if (!currentProject) return project;
      return { ...currentProject, ...project };
    });
  },
  
  // Add requests to project
  addRequests: (requests: CapturedRequest[]) => {
    projectStore.update(currentProject => {
      if (!currentProject) return null;
      
      // Create a new array with the new requests added
      const updatedRequests = [...currentProject.requests, ...requests];
      
      // Return the updated project
      return {
        ...currentProject,
        requests: updatedRequests,
        lastModified: new Date().toISOString()
      };
    });
  },
  
  // Clear project data (set to null)
  clear: () => {
    projectStore.set(null);
  },
  
  // Save project to file
  save: async (): Promise<{ success: boolean; path?: string; error?: string }> => {
    let currentProject: Project | null = null;
    
    // Get the current project from the store
    projectStore.subscribe(value => {
      currentProject = value;
    })();
    
    if (!currentProject) {
      return { success: false, error: 'No active project to save' };
    }
    
    if (window.electronAPI) {
      try {
        return await window.electronAPI.project.save(currentProject);
      } catch (error: any) {
        console.error('Error saving project:', error);
        return { success: false, error: error?.message || 'Failed to save project' };
      }
    } else {
      console.error('Electron API not available');
      return { success: false, error: 'Electron API not available - saving is only available in the desktop app' };
    }
  },
  
  // Save project with a new name/location
  saveAs: async (): Promise<{ success: boolean; path?: string; error?: string }> => {
    let currentProject: Project | null = null;
    
    // Get the current project from the store
    projectStore.subscribe(value => {
      currentProject = value;
    })();
    
    if (!currentProject) {
      return { success: false, error: 'No active project to save' };
    }
    
    if (window.electronAPI) {
      try {
        return await window.electronAPI.project.saveAs(currentProject);
      } catch (error: any) {
        console.error('Error saving project as:', error);
        return { success: false, error: error?.message || 'Failed to save project' };
      }
    } else {
      console.error('Electron API not available');
      return { success: false, error: 'Electron API not available - saving is only available in the desktop app' };
    }
  }
};
