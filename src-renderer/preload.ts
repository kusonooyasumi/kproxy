// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

// Types for the APIs exposed to the renderer
interface ProxyAPI {
  getStatus: () => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
  getSettings: () => Promise<{ port: number; autoStart: boolean; customHeaders?: Record<string, string> }>;
  start: (settings: { port: number }) => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
  stop: () => Promise<{ isRunning: boolean; port: number; certificatePath: string }>;
  updateSettings: (settings: { port: number; autoStart: boolean; customHeaders?: Record<string, string> }) => Promise<{ port: number; autoStart: boolean; customHeaders?: Record<string, string> }>;
  exportCertificate: () => Promise<{ success: boolean; message?: string; path?: string; error?: string; canceled?: boolean }>;
  exportCaCertificate: () => Promise<{ success: boolean; message?: string; certPath?: string; error?: string; canceled?: boolean }>;
  getCertificateInstructions: () => Promise<{ windows: string; macos: string; firefox: string; chrome: string }>;
  getCustomHeaders: () => Promise<Record<string, string>>;
  updateCustomHeaders: (headers: Record<string, string>) => Promise<Record<string, string>>;
  getRequests: () => Promise<any[]>;
  clearRequests: () => Promise<{ success: boolean }>;
  getScopeSettings: () => Promise<{ inScope: string[]; outOfScope: string[] }>;
  saveScopeSettings: (settings: { inScope: string[]; outOfScope: string[] }) => Promise<{ success: boolean }>;
  sendToRepeater: (request: any) => Promise<{ success: boolean; error?: string }>;
  sendRepeaterRequests: (requests: any[]) => Promise<{ success: boolean; error?: string }>;
  getRepeaterState: () => Promise<{ success: boolean; requests?: any[]; error?: string }>;
}

// Types for FFuf API
interface FfufAPI {
  run: (args: string[]) => Promise<string>;
  stop: () => Promise<string>;
}

// Types for Tab Management API
interface TabAPI {
  openInNewWindow: (tabName: string) => void;
  sendToRepeater: (request: any) => Promise<{ success: boolean; error?: string }>;
  sendRequest: (request: any) => Promise<any>;
}

// Define the type first, then implement it
export interface ExposeInRendererTypes {
  toggleDevTools: () => void;
  setTitleBarColors: (bgColor: string, iconColor: string) => void;
  receive: (channel: string, func: (...args: any[]) => void) => void;
  send: (channel: string, ...args: any[]) => void;
  openTabInNewWindow: (tabName: string) => void;
  startWithoutProject: () => void;
  sendStoreUpdate: (storeName: string, value: any) => Promise<any>;
}

const exposeInRenderer: ExposeInRendererTypes = {
	toggleDevTools: () => ipcRenderer.send('toggleDevTools'),
	setTitleBarColors: (bgColor: string, iconColor: string) => {
		document.documentElement.style.background = bgColor;
		ipcRenderer.send('setTitleBarColors', bgColor, iconColor);
	},
// Helper function to receive messages from main process
  receive: (channel: string, func: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_, ...args) => func(...args));
  },
  // Helper to send messages to main process
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
  // Helper to open tab in new window
  openTabInNewWindow: (tabName: string) => {
    ipcRenderer.send('openTabInNewWindow', { tabName });
  },
  // Helper for startup without project
  startWithoutProject: () => {
    ipcRenderer.send('start-without-project', {});
  },
  // Store synchronization
  sendStoreUpdate: (storeName: string, value: any) => {
    return ipcRenderer.invoke('store:update', storeName, value);
  }
};

// Type for the project API exposed to the renderer
interface ProjectAPI {
  initialize: (name?: string) => Promise<any>;
  getCurrent: () => Promise<any>;
  getPath: () => Promise<string | null>;
  load: (path: string) => Promise<{ success: boolean; project?: any; error?: string; canceled?: boolean }>;
  save: (projectData: any) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>;
  saveAs: (projectData: any) => Promise<{ success: boolean; path?: string; error?: string; canceled?: boolean }>;
  open: () => Promise<{ success: boolean; project?: any; error?: string; canceled?: boolean }>;
  update: (projectData: any) => Promise<any>;
  hasUnsavedChanges: () => Promise<boolean>;
  getProjectsDirectory: () => Promise<string>;
}

// Create the proxy API methods
const proxyAPI: ProxyAPI = {
  getStatus: () => ipcRenderer.invoke('proxy:getStatus'),
  getSettings: () => ipcRenderer.invoke('proxy:getSettings'),
  start: (settings) => ipcRenderer.invoke('proxy:start', settings),
  stop: () => ipcRenderer.invoke('proxy:stop'),
  updateSettings: (settings) => ipcRenderer.invoke('proxy:updateSettings', settings),
  exportCertificate: () => ipcRenderer.invoke('proxy:exportCertificate'),
  exportCaCertificate: () => ipcRenderer.invoke('proxy:exportCaCertificate'),
  getCertificateInstructions: () => ipcRenderer.invoke('proxy:getCertificateInstructions'),
  getCustomHeaders: () => ipcRenderer.invoke('proxy:getCustomHeaders'),
  updateCustomHeaders: (headers) => ipcRenderer.invoke('proxy:updateCustomHeaders', headers),
  getRequests: () => ipcRenderer.invoke('proxy:getRequests'),
  clearRequests: () => ipcRenderer.invoke('proxy:clearRequests'),
  getScopeSettings: () => ipcRenderer.invoke('proxy:getScopeSettings'),
  saveScopeSettings: (settings) => ipcRenderer.invoke('proxy:saveScopeSettings', settings),
  sendToRepeater: (request) => ipcRenderer.invoke('send-to-repeater', request),
  sendRepeaterRequests: (requests) => ipcRenderer.invoke('repeater-requests', requests),
  getRepeaterState: () => ipcRenderer.invoke('get-repeater-state')
};

// Create the FFuf API methods
const ffufAPI: FfufAPI = {
  run: (args) => ipcRenderer.invoke('ffuf:run', args),
  stop: () => ipcRenderer.invoke('ffuf:stop')
};

// Create the Tab API methods
const tabAPI: TabAPI = {
  openInNewWindow: (tabName) => ipcRenderer.send('openTabInNewWindow', { tabName }),
  sendToRepeater: (request) => ipcRenderer.invoke('send-to-repeater', request),
  sendRequest: (request) => ipcRenderer.invoke('send-request', request)
};

// Expose standard API
for(const [key, value] of Object.entries(exposeInRenderer)) {
  contextBridge.exposeInMainWorld(key, value);
}

// Create the project API methods
const projectAPI: ProjectAPI = {
  initialize: (name) => ipcRenderer.invoke('project:initialize', name),
  getCurrent: () => ipcRenderer.invoke('project:getCurrent'),
  getPath: () => ipcRenderer.invoke('project:getPath'),
  load: (path) => ipcRenderer.invoke('project:load', path),
  save: (projectData) => ipcRenderer.invoke('project:save', projectData),
  saveAs: (projectData) => ipcRenderer.invoke('project:saveAs', projectData),
  open: () => ipcRenderer.invoke('project:open'),
  update: (projectData) => ipcRenderer.invoke('project:update', projectData),
  hasUnsavedChanges: () => ipcRenderer.invoke('project:hasUnsavedChanges'),
  getProjectsDirectory: () => ipcRenderer.invoke('project:getProjectsDirectory')
};

// Expose APIs to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  ...exposeInRenderer,
  proxy: proxyAPI,
  project: projectAPI,
  ffuf: ffufAPI,
  tab: tabAPI
});
