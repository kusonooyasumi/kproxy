const fs = require('fs');
const path = require('path');
const { dialog, BrowserWindow } = require('electron');

class ProjectManager {
  constructor() {
    this.currentProject = null;
    this.projectPath = null;
  }

  /**
   * Initialize a new empty project
   */
  initializeNewProject(name = 'Untitled Project') {
    this.currentProject = {
      name,
      requests: [],
      proxiedRequests: [],
      repeaterRequests: [],
      chats: [], // Add support for storing chat conversations
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
    return this.currentProject;
  }

  /**
   * Get the current project data
   */
  getCurrentProject() {
    return this.currentProject;
  }

  /**
   * Load project from the specified file path
   */
  async loadProject(filePath) {
    try {
      const data = fs.readFileSync(filePath, 'utf8');
      this.currentProject = JSON.parse(data);
      this.projectPath = filePath;
      
      // Update lastOpened timestamp
      this.currentProject.lastOpened = new Date().toISOString();
      
      return { success: true, project: this.currentProject };
    } catch (error) {
      console.error('Error loading project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Save project to the current path or show save dialog if no path exists
   */
  async saveProject(projectData, forceSaveAs = false) {
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
      
      return { success: true, path: this.projectPath };
    } catch (error) {
      console.error('Error saving project:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Show save dialog and save project to the selected path
   */
  async saveProjectAs(projectData) {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      
      // Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: path.join(this.getProjectsDirectory(), `${projectData.name || 'untitled'}.kproxy`),
        filters: [
          { name: 'KProxy Projects', extensions: ['kproxy'] }
        ]
      });
      
      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }
      
      // Update current project path
      this.projectPath = filePath;
      
      // Update project name from filename if not set
      if (!projectData.name) {
        this.currentProject.name = path.basename(filePath, '.kproxy');
      }
      
      // Save to the selected path
      fs.writeFileSync(this.projectPath, JSON.stringify(this.currentProject, null, 2), 'utf8');
      
      return { success: true, path: this.projectPath };
    } catch (error) {
      console.error('Error in saveProjectAs:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Show open dialog and load a project
   */
  async openProject() {
    try {
      const mainWindow = BrowserWindow.getFocusedWindow();
      
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
        return { success: false, canceled: true };
      }
      
      // Load the selected project
      return this.loadProject(filePaths[0]);
    } catch (error) {
      console.error('Error in openProject:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get or create the default projects directory
   */
  getProjectsDirectory() {
    const userDataPath = path.join(require('os').homedir(), 'KProxy', 'Projects');
    
    // Create the directory if it doesn't exist
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    return userDataPath;
  }

  /**
   * Update the current project with new data
   */
  updateProject(projectData) {
    this.currentProject = { ...this.currentProject, ...projectData };
    return this.currentProject;
  }
}

module.exports = ProjectManager;
