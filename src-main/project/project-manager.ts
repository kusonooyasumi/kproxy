import { BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

// Types
export interface ProjectSettings {
  proxy: {
    port: number;
    autoStart: boolean;
  };
}

export interface ProjectScopes {
  inScope: string[];
  outOfScope: string[];
}

export interface ProjectData {
  name: string;
  requests: any[];
  proxiedRequests: any[];
  repeaterRequests: any[];
  chats: any[];
  scopes: ProjectScopes;
  settings: ProjectSettings;
  lastSaved: string | null;
  lastOpened?: string;
}

export interface SaveResult {
  success: boolean;
  path?: string;
  error?: string;
  canceled?: boolean;
}

export interface LoadResult {
  success: boolean;
  project?: ProjectData;
  error?: string;
  canceled?: boolean;
}

class ProjectManager {
  private currentProject: ProjectData | null = null;
  private projectPath: string | null = null;
  private eventHandlers: Record<string, Function[]> = {};

  constructor() {
    // Initialize event handlers object
    this.eventHandlers = {};
  }

  /**
   * Event handling methods
   */
  on(event: string, callback: Function) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event].push(callback);
    return this;
  }

  private emit(event: string, ...args: any[]) {
    const handlers = this.eventHandlers[event] || [];
    handlers.forEach(handler => handler(...args));
  }

  /**
   * Initialize a new empty project
   */
  initializeNewProject(name = 'Untitled Project'): ProjectData {
    console.log('Initializing new project with name:', name);
    this.currentProject = {
      name,
      requests: [],
      proxiedRequests: [],
      repeaterRequests: [],
      chats: [],
      scopes: {
        inScope: [],
        outOfScope: []
      },
      settings: {
        proxy: {
          port: 8080,
          autoStart: false
        }
      },
      lastSaved: null
    };
    
    this.projectPath = null;
    
    // Notify about project initialization
    this.emit('project-initialized', this.currentProject);
    
    return this.currentProject;
  }

  /**
   * Get the current project data
   */
  getCurrentProject(): ProjectData | null {
    return this.currentProject;
  }

  /**
   * Get the current project path
   */
  getProjectPath(): string | null {
    return this.projectPath;
  }

  /**
   * Load project from the specified file path
   */
  async loadProject(filePath: string): Promise<LoadResult> {
    try {
      // Read the file
      const data = fs.readFileSync(filePath, 'utf8');
      
      // Parse the JSON data
      const projectData = JSON.parse(data) as ProjectData;
      
      // Update the current project
      this.currentProject = projectData;
      this.projectPath = filePath;
      
      // Update lastOpened timestamp
      this.currentProject.lastOpened = new Date().toISOString();
      
      // Notify about project loading
      this.emit('project-loaded', this.currentProject);
      
      return { 
        success: true, 
        project: this.currentProject 
      };
    } catch (error) {
      console.error('Error loading project:', error);
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Save project to the current path or show save dialog if no path exists
   */
  async saveProject(projectData: ProjectData, forceSaveAs = false): Promise<SaveResult> {
    try {
      // Update the project data with the provided data
      this.currentProject = { ...projectData };
      
      // Update the lastSaved timestamp
      this.currentProject.lastSaved = new Date().toISOString();
      
      // Ensure we have the arrays for different request types
      if (!this.currentProject.proxiedRequests) {
        this.currentProject.proxiedRequests = [];
      }
      
      if (!this.currentProject.repeaterRequests) {
        this.currentProject.repeaterRequests = [];
      }
      
      // If we don't have a path or forceSaveAs is true, show save dialog
      if (!this.projectPath || forceSaveAs) {
        return this.saveProjectAs(this.currentProject);
      }
      
      // Save to the existing path
      fs.writeFileSync(this.projectPath, JSON.stringify(this.currentProject, null, 2), 'utf8');
      
      // Notify about project saving
      this.emit('project-saved', this.currentProject, this.projectPath);
      
      return { 
        success: true, 
        path: this.projectPath 
      };
    } catch (error) {
      console.error('Error saving project:', error);
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Show save dialog and save project to the selected path
   */
  async saveProjectAs(projectData: ProjectData): Promise<SaveResult> {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      
      if (!mainWindow) {
        throw new Error('No active window found');
      }
      
      // Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: path.join(this.getProjectsDirectory(), `${projectData.name || 'untitled'}.kproxy`),
        filters: [
          { name: 'KProxy Projects', extensions: ['kproxy'] }
        ]
      });
      
      if (canceled || !filePath) {
        return { 
          success: false, 
          canceled: true 
        };
      }
      
      // Update current project path
      this.projectPath = filePath;
      
      // Update project name from filename if not set
      if (!projectData.name) {
        this.currentProject!.name = path.basename(filePath, '.kproxy');
      }
      
      // Save to the selected path
      fs.writeFileSync(this.projectPath, JSON.stringify(this.currentProject, null, 2), 'utf8');
      
      // Notify about project saving
      this.emit('project-saved', this.currentProject, this.projectPath);
      
      return { 
        success: true, 
        path: this.projectPath 
      };
    } catch (error) {
      console.error('Error in saveProjectAs:', error);
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Show open dialog and load a project
   */
  async openProject(): Promise<LoadResult> {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      
      if (!mainWindow) {
        throw new Error('No active window found');
      }
      
      // Show open dialog
      const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Open Project',
        defaultPath: this.getProjectsDirectory(),
        filters: [
          { name: 'KProxy Projects', extensions: ['kproxy'] }
        ],
        properties: ['openFile']
      });
      
      if (canceled || filePaths.length === 0) {
        return { 
          success: false, 
          canceled: true 
        };
      }
      
      // Load the selected project
      return this.loadProject(filePaths[0]);
    } catch (error) {
      console.error('Error in openProject:', error);
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Get or create the default projects directory
   */
  getProjectsDirectory(): string {
    const userDataPath = path.join(os.homedir(), 'KProxy', 'Projects');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    return userDataPath;
  }

  /**
   * Update the current project with new data
   */
  updateProject(projectData: Partial<ProjectData>): ProjectData | null {
    if (!this.currentProject) {
      return null;
    }
    
    this.currentProject = { ...this.currentProject, ...projectData };
    
    // Notify about project update
    this.emit('project-updated', this.currentProject);
    
    return this.currentProject;
  }

  /**
   * Check if the project has unsaved changes
   */
  hasUnsavedChanges(): boolean {
    return this.currentProject !== null && this.projectPath !== null;
  }

  /**
   * Register IPC handlers for project management
   */
  registerIpcHandlers(): void {
    // We're not registering IPC handlers here anymore to avoid conflicts
    // IPC handlers are now registered in the main.ts file
    console.log('ProjectManager: registerIpcHandlers is now a no-op to avoid duplicate handlers');
  }
}

export default ProjectManager;
