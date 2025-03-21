import ProjectManager from './project-manager';
import type { 
  ProjectSettings, 
  ProjectScopes, 
  ProjectData, 
  SaveResult, 
  LoadResult 
} from './project-manager';

// Create a singleton ProjectManager instance
const projectManager = new ProjectManager();

// Initialize the project functionality
const init = () => {
  // Any initialization logic would go here
};

// Register IPC handlers for renderer process communication
const registerIpcHandlers = () => {
  // Handle any potential errors during IPC registration
  try {
    projectManager.registerIpcHandlers();
  } catch (error) {
    console.error('Error registering project IPC handlers:', error);
  }
};

// Create wrapper functions to export the ProjectManager methods
const initializeNewProject = (name?: string) => {
  return projectManager.initializeNewProject(name);
};

const getCurrentProject = () => {
  return projectManager.getCurrentProject();
};

const getProjectPath = () => {
  return projectManager.getProjectPath();
};

const loadProject = (filePath: string) => {
  return projectManager.loadProject(filePath);
};

const saveProject = (projectData: ProjectData, forceSaveAs = false) => {
  return projectManager.saveProject(projectData, forceSaveAs);
};

const openProject = () => {
  return projectManager.openProject();
};

const updateProject = (projectData: Partial<ProjectData>) => {
  return projectManager.updateProject(projectData);
};

const hasUnsavedChanges = () => {
  return projectManager.hasUnsavedChanges();
};

const getProjectsDirectory = () => {
  return projectManager.getProjectsDirectory();
};

// Export functions from the ProjectManager module
export {
  init,
  registerIpcHandlers,
  // Project management functions
  initializeNewProject,
  getCurrentProject,
  getProjectPath,
  loadProject,
  saveProject,
  openProject,
  updateProject,
  hasUnsavedChanges,
  getProjectsDirectory,
  // Type exports
  type ProjectSettings,
  type ProjectScopes,
  type ProjectData,
  type SaveResult,
  type LoadResult
};
