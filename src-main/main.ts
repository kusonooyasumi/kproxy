import { app, BrowserWindow, ipcMain, protocol, net, Menu, dialog } from 'electron';
import path from 'path';
import url from 'url';
import { stat } from 'node:fs/promises';
import * as proxyModule from './proxy';
import * as projectModule from './project';
import * as ffufModule from './ffuf';
import { promisify } from 'node:util';
import zlib from 'node:zlib';

// Promisify zlib functions
const gunzipAsync = promisify(zlib.gunzip);
const inflateAsync = promisify(zlib.inflate);
const brotliDecompressAsync = promisify(zlib.brotliDecompress);

/**
 * Helper function to decompress response data based on Content-Encoding header
 */
async function decompressResponse(
  data: Buffer, 
  contentEncoding: string | undefined
): Promise<Buffer> {
  if (!contentEncoding) {
    return data;
  }

  try {
    const encoding = contentEncoding.toLowerCase();
    
    if (encoding.includes('br')) {
      // Brotli decompression
      return await brotliDecompressAsync(data);
    } else if (encoding.includes('gzip')) {
      // Gzip decompression
      return await gunzipAsync(data);
    } else if (encoding.includes('deflate')) {
      // Deflate decompression
      return await inflateAsync(data);
    }
    
    // If no matching encoding or unsupported encoding, return as is
    return data;
  } catch (error) {
    console.error(`Decompression error (${contentEncoding}):`, error);
    // Return original data if decompression fails
    return data;
  }
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
import electronSquirrelStartup from 'electron-squirrel-startup';
if(electronSquirrelStartup) app.quit();

// Tab window references to avoid garbage collection
let tabWindows: Record<string, BrowserWindow> = {};

// Reference to the startup dialog window
let startupDialogWindow: BrowserWindow | null = null;

// Only one instance of the electron main process should be running due to how chromium works.
// If another instance of the main process is already running `app.requestSingleInstanceLock()`
// will return false, `app.quit()` will be called, and the other instances will receive a
// `'second-instance'` event.
// https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata
if(!app.requestSingleInstanceLock()) {
	app.quit();
}

// This event will be called when a second instance of the app tries to run.
// https://www.electronjs.org/docs/latest/api/app#event-second-instance
app.on('second-instance', (event, args, workingDirectory, additionalData) => {
	createWindow();
});

const scheme = 'app';
const srcFolder = path.join(app.getAppPath(), `.vite/main_window/`);
const staticAssetsFolder = import.meta.env.DEV ? path.join(import.meta.dirname, '../../static/') : srcFolder;

protocol.registerSchemesAsPrivileged([{
		scheme: scheme,
		privileges: {
			standard: true,
			secure: true,
			allowServiceWorkers: true,
			supportFetchAPI: true,
			corsEnabled: false,
			stream: true, // video stream from schema
			codeCache: true,
		},
	},
]);

app.on('ready', () => {
	protocol.handle(scheme, async (request) => {
		const requestPath = path.normalize(decodeURIComponent(new URL(request.url).pathname));

		async function isFile(filePath: string) {
			try {
				if((await stat(filePath)).isFile()) return filePath;
			}
			catch(e) {}
		}

		const responseFilePath = await isFile(path.join(srcFolder, requestPath))
		?? await isFile(path.join(srcFolder, path.dirname(requestPath), `${path.basename(requestPath) || 'index'}.html`))
		?? path.join(srcFolder, '200.html');

		return await net.fetch(url.pathToFileURL(responseFilePath).toString());
	});
});

function createWindow() {
	// Create the browser window.
	const mainWindow = new BrowserWindow({
		icon: path.join(staticAssetsFolder, '/icon2.png'),
		width: 900,
		height: 700,
		minWidth: 400,
		minHeight: 200,
		// Window Controls Overlay API - https://developer.mozilla.org/en-US/docs/Web/API/Window_Controls_Overlay_API
		// Allows for a custom window header while overlaying native window controls in the corner.
		// https://www.electronjs.org/docs/latest/tutorial/window-customization#window-controls-overlay
		titleBarStyle: 'hidden',
		titleBarOverlay: {
			color: '#2a2a2a',
			symbolColor: '#f8fafc',
			height: 40
		},
		backgroundColor: '#2a2a2a',
		webPreferences: {
			preload: path.join(import.meta.dirname, '../preload/preload.cjs'),
		},
	});

	if(import.meta.env.DEV) {
		mainWindow.loadURL(VITE_DEV_SERVER_URLS['main_window']);

		// Open the DevTools.
		// mainWindow.webContents.openDevTools();
	}
	else {
		mainWindow.loadURL('app://-/');
	}
}

/**
 * Create the startup dialog window to select project options
 */
const createStartupDialog = async () => {
  console.log('Creating startup dialog window');
  
  // Create a small dialog window
  startupDialogWindow = new BrowserWindow({
    icon: path.join(staticAssetsFolder, '/icon2.png'),
    width: 500,
    height: 400,
    resizable: false,
    frame: false,
    show: false,
    title: 'KProxy - Start Project',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#2a2a2a',
      symbolColor: '#f8fafc',
      height: 40
    },
    backgroundColor: '#2a2a2a',
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  startupDialogWindow.setMenu(null);
  
  // Show the window immediately
  startupDialogWindow.show();
  
  try {
    // In development, load from dev server
    if (import.meta.env.DEV) {
      await startupDialogWindow.loadURL(VITE_DEV_SERVER_URLS['main_window'] + '?startup=true');
      console.log('Successfully loaded startup dialog from dev server');
      
      // Open DevTools for debugging in dev mode
      startupDialogWindow.webContents.openDevTools();
    } else {
      // In production, load from built files
      await startupDialogWindow.loadURL('app://-/?startup=true');
      console.log('Loaded startup dialog from build files');
    }
  } catch (e) {
    console.error('Failed to load startup dialog:', e);
    // If loading fails, create the main window directly
    createWindow();
    return;
  }

  // Handle window close
  startupDialogWindow.on('closed', () => {
    console.log('Startup dialog window closed');
    startupDialogWindow = null;
  });
};

/**
 * Create a new window for a specific tab
 */
const createTabWindow = async (tabName: string) => {
  // Create a new browser window
  const tabWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: `KProxy - ${tabName}`,
    // Window Controls Overlay API
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#2a2a2a',
      symbolColor: '#f8fafc',
      height: 40
    },
    backgroundColor: '#2a2a2a',
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  
  // Remove default menu for specific windows
  tabWindow.setMenu(null);

  // Store reference to the window
  tabWindows[tabName] = tabWindow;

  try {
    // In development, load from dev server
    if (import.meta.env.DEV) {
      // Determine the URL based on tab type
      let queryParam = '';
      if (tabName !== 'Requests') {
        queryParam = `?tab=${encodeURIComponent(tabName)}`;
      }
      
      const tabUrl = VITE_DEV_SERVER_URLS['main_window'] + `/${tabName}`;
      console.log(`Loading ${tabName} in new window from: ${tabUrl}`);
      await tabWindow.loadURL(tabUrl);
    } else {
      // In production, load from built files
      await tabWindow.loadURL(`app://-/${tabName}`);
    }
    
    // Wait for window to finish loading before sending store state
    tabWindow.webContents.on('did-finish-load', () => {
      console.log(`Sending initial store state to new ${tabName} window`);
      
      // Send each store to the new window
      for (const [storeName, value] of Object.entries(storeState)) {
        tabWindow.webContents.send('store-update', {
          storeName,
          value
        });
      }
    });
    
  } catch (e) {
    console.error(`Failed to load ${tabName} tab:`, e);
  }

  // Emitted when the window is closed
  tabWindow.on('closed', () => {
    // Dereference the window object
    delete tabWindows[tabName];
  });
  
  return tabWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  // Initialize all modules
  proxyModule.init();
  proxyModule.registerIpcHandlers();
  
  projectModule.init();
  projectModule.registerIpcHandlers();
  
  ffufModule.init();
  ffufModule.registerIpcHandlers();
  
  // Start directly with main window
  createWindow();
  
  // Register IPC handlers for tab management
  registerTabManagementHandlers();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', () => {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if(BrowserWindow.getAllWindows().length === 0) {
		createWindow();
	}
});

// Save project before quitting
app.on('before-quit', async (event) => {
  // Check if there's a current project with a saved path
  const currentProject = projectModule.getCurrentProject();
  const projectPath = projectModule.getProjectPath();
  
  if (currentProject && projectPath) {
    // We have a saved project - save automatically without prompting
    try {
      await projectModule.saveProject(currentProject);
    } catch (error) {
      console.error('Error auto-saving project:', error);
    }
  }
  // For new unsaved projects (no path), just quit without saving
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Store state that needs to be shared across windows
const storeState: Record<string, any> = {
  scope: { inScope: ['example.com', '*.example.org'], outOfScope: ['admin.example.com'] }
};

// Handler for store updates from renderer
ipcMain.handle('store:update', async (event, storeName: string, value: any) => {
  console.log(`Received store update for ${storeName}:`, value);
  
  // Update the store state
  storeState[storeName] = value;
  
  // Broadcast the update to all windows except the sender
  const sender = event.sender;
  const allWindows = BrowserWindow.getAllWindows();
  
  allWindows.forEach(window => {
    // Skip the sender window to avoid circular updates
    if (window.webContents !== sender) {
      window.webContents.send('store-update', {
        storeName,
        value
      });
    }
  });
  
  return true;
});

ipcMain.on('toggleDevTools', (event) => event.sender.toggleDevTools());
ipcMain.on('setTitleBarColors', (event, bgColor, iconColor) => {
	const window = BrowserWindow.fromWebContents(event.sender);
	if(window === null) return;
	
	// MacOS title bar overlay buttons do not need styling so the function is undefined
	if(window.setTitleBarOverlay === undefined) return;

	window.setTitleBarOverlay({
		color: bgColor,
		symbolColor: iconColor,
		height: 40
	});
});

/**
 * Register IPC handlers for tab management and project operations
 */
function registerTabManagementHandlers() {
  // Project API IPC Handlers
  // Create a new project
  ipcMain.handle('project:initialize', async (event, name) => {
    console.log('project:initialize handler called with name:', name);
    try {
      // Initialize an empty project using project module
      const newProject = projectModule.initializeNewProject();
      
      // Check if this is coming from the startup dialog or settings
      const isFromStartup = startupDialogWindow && 
                           (BrowserWindow.fromWebContents(event.sender) === startupDialogWindow);
      
      // If from startup, create a new window
      if (isFromStartup && startupDialogWindow) {
        console.log('Creating new window from startup dialog');
        // Create a new window first
        createWindow();
        // Close the startup dialog
        startupDialogWindow.close();
      }
      
      // Notify all windows about project state change
      const windows = [...BrowserWindow.getAllWindows()].filter(Boolean);
      windows.forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('project-state-changed', { 
            action: 'new', 
            project: newProject 
          });
        }
      });
      
      return newProject;
    } catch (error) {
      console.error('Error creating new project:', error);
      return false;
    }
  });

  // Open an existing project
  ipcMain.handle('project:open', async (event) => {
    try {
      // Use project module to show open dialog and load a project
      const result = await projectModule.openProject();
      
      if (result.success) {
        // Check if this is coming from the startup dialog or settings
        const isFromStartup = startupDialogWindow && 
                             (BrowserWindow.fromWebContents(event.sender) === startupDialogWindow);
        
        // If from startup, create a new window
        if (isFromStartup && startupDialogWindow) {
          console.log('Creating new window from startup dialog');
          // Create a new window first
          createWindow();
          // Close the startup dialog
          startupDialogWindow.close();
        }
        
        // Notify all windows about project state change
        const windows = [...BrowserWindow.getAllWindows()].filter(Boolean);
        windows.forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('project-state-changed', { 
              action: 'open', 
              project: result.project 
            });
          }
        });
        
        // Wait a bit for all windows to initialize, then send repeater requests if any
        if (result.project?.repeaterRequests && result.project.repeaterRequests.length > 0) {
          setTimeout(() => {
            const targetsForRepeaterRequests: BrowserWindow[] = [];
            
            // Add the standalone Repeater window if it exists
            if (tabWindows['Repeater']) {
              targetsForRepeaterRequests.push(tabWindows['Repeater']);
            }
            
            // Add other windows that should receive repeater requests
            const mainWindows = BrowserWindow.getAllWindows().filter(
              w => !Object.values(tabWindows).includes(w)
            );
            
            if (mainWindows.length > 0) {
              targetsForRepeaterRequests.push(...mainWindows);
            }
            
            // Send each request to each target
            if (targetsForRepeaterRequests.length > 0 && result.project?.repeaterRequests) {
              result.project.repeaterRequests.forEach(request => {
                targetsForRepeaterRequests.forEach(win => {
                  if (!win.isDestroyed()) {
                    win.webContents.send('send-to-repeater', request);
                  }
                });
              });
              console.log(`Sent ${result.project.repeaterRequests.length} requests to ${targetsForRepeaterRequests.length} repeater tabs`);
            }
          }, 1000); // Give the tabs time to initialize
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error opening project:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Save the current project
  ipcMain.handle('project:save', async (event, projectData) => {
    try {
      // Get current repeater requests 
      const repeaterRequests = [];
      
      // If the Repeater window is open, request repeater requests
      if (tabWindows['Repeater']) {
        // Send a message to the repeater window to get its current requests
        tabWindows['Repeater'].webContents.send('get-repeater-requests');
        
        // We'll receive the repeater requests via the 'repeater-requests' IPC handler below
        // This is asynchronous, but the repeater requests will be saved on next save
      }
      
      // Update the project data with the requests
      const updatedProjectData = {
        ...projectData,
        repeaterRequests: projectData.repeaterRequests || [] // Use existing or empty array
      };
      
      const result = await projectModule.saveProject(updatedProjectData);
      
      if (result.success) {
        // Notify all windows about project state change
        const windows = [...BrowserWindow.getAllWindows()].filter(Boolean);
        windows.forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('project-state-changed', { 
              action: 'save', 
              project: projectModule.getCurrentProject() 
            });
          }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error saving project:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Handle receiving repeater requests for saving to project
  ipcMain.handle('repeater-requests', async (event, requests) => {
    try {
      if (!projectModule.getCurrentProject()) return { success: false };
      
      // Update the current project with the repeater requests
      projectModule.updateProject({
        repeaterRequests: requests
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error updating repeater requests:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Save the current project with a new name/location
  ipcMain.handle('project:saveAs', async (event, projectData) => {
    try {
      // Get current repeater requests 
      const repeaterRequests = [];
      
      // If the Repeater window is open, request repeater requests
      if (tabWindows['Repeater']) {
        // Send a message to the repeater window to get its current requests
        tabWindows['Repeater'].webContents.send('get-repeater-requests');
        
        // We'll receive the repeater requests via the 'repeater-requests' IPC handler
        // This is asynchronous, but the repeater requests will be saved on next save
      }
      
      // Update the project data with the requests
      const updatedProjectData = {
        ...projectData,
        repeaterRequests: projectData.repeaterRequests || [] // Use existing or empty array
      };
      
      const result = await projectModule.saveProject(updatedProjectData, true);
      
      if (result.success) {
        // Notify all windows about project state change
        const windows = [...BrowserWindow.getAllWindows()].filter(Boolean);
        windows.forEach(win => {
          if (!win.isDestroyed()) {
            win.webContents.send('project-state-changed', { 
              action: 'saveAs', 
              project: projectModule.getCurrentProject() 
            });
          }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error in save-as project:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Get the current project
  ipcMain.handle('project:getCurrent', async () => {
    return projectModule.getCurrentProject();
  });
  
  // Get project path
  ipcMain.handle('project:getPath', async () => {
    return projectModule.getProjectPath();
  });
  
  // Load project from path
  ipcMain.handle('project:load', async (event, filePath) => {
    return projectModule.loadProject(filePath);
  });
  
  // Update project
  ipcMain.handle('project:update', async (event, projectData) => {
    return projectModule.updateProject(projectData);
  });
  
  // Check for unsaved changes
  ipcMain.handle('project:hasUnsavedChanges', async () => {
    return projectModule.hasUnsavedChanges();
  });
  
  // Get projects directory
  ipcMain.handle('project:getProjectsDirectory', async () => {
    return projectModule.getProjectsDirectory();
  });

  // Handle opening tab in new window
  ipcMain.on('openTabInNewWindow', (event, { tabName }) => {
    console.log(`Request to open ${tabName} in new window`);
    
    // Check if there's already a window for this tab
    if (tabWindows[tabName]) {
      // Focus the existing window instead of creating a new one
      tabWindows[tabName].focus();
    } else {
      // Create a new window for this tab
      createTabWindow(tabName);
    }
  });

  // Handle sending request to repeater
  ipcMain.handle('send-to-repeater', async (event, request) => {
    try {
      console.log('Sending request to repeater:', request.id);
      
      // Check if there's a Repeater window open
      if (tabWindows['Repeater']) {
        // Send the request to the existing Repeater window
        tabWindows['Repeater'].webContents.send('send-to-repeater', request);
      }
      
      // Get the main window
      const allWindows = BrowserWindow.getAllWindows();
      const mainWindow = allWindows.find(w => !Object.values(tabWindows).includes(w));
      
      // Also update the main window if it exists
      if (mainWindow) {
        mainWindow.webContents.send('send-to-repeater', request);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error sending to repeater:', error);
      return { success: false, error: (error as Error).message };
    }
  });
  
  // Handle getting current repeater state
  ipcMain.handle('get-repeater-state', async (event) => {
    try {
      console.log('Handling get-repeater-state request');
      
      // Get current repeater requests from project
      const currentProject = projectModule.getCurrentProject();
      const repeaterRequests = currentProject?.repeaterRequests || [];
      
      // Also request from main window if available
      const allWindows = BrowserWindow.getAllWindows();
      const mainWindow = allWindows.find(w => !Object.values(tabWindows).includes(w));
      
      if (mainWindow) {
        mainWindow.webContents.send('request-repeater-state');
      }
      
      // Return current known requests immediately
      // The renderer will also receive any updates via the 'current-repeater-state' event
      const sender = event.sender;
      sender.send('current-repeater-state', repeaterRequests);
      
      return { success: true, requests: repeaterRequests };
    } catch (error) {
      console.error('Error getting repeater state:', error);
      return { success: false, error: (error as Error).message };
    }
  });
  
  // Handle receiving current repeater state from a window
  ipcMain.on('current-repeater-state-from-window', (event, requests) => {
    try {
      console.log('Received current repeater state from window, request count:', requests.length);
      
      // Get the source window
      const sourceWindow = BrowserWindow.fromWebContents(event.sender);
      
      // Find all windows that should receive this state update
      // This typically includes the standalone Repeater window if it exists
      const targetsForRepeaterRequests: BrowserWindow[] = [];
      
      // Add the standalone Repeater window if it exists
      if (tabWindows['Repeater']) {
        targetsForRepeaterRequests.push(tabWindows['Repeater']);
      }
      
      // Send to all targets except the source window
      targetsForRepeaterRequests.forEach(window => {
        // Skip the source window to avoid circular updates
        if (window !== sourceWindow && !window.isDestroyed()) {
          window.webContents.send('current-repeater-state', requests);
        }
      });
      
      // Also update the project data for persistence
      if (requests.length > 0 && projectModule.getCurrentProject()) {
        projectModule.updateProject({
          repeaterRequests: requests
        });
      }
      
      // Send response back to source window
      event.sender.send('get-repeater-state-response', { 
        success: true,
        message: `Repeater state forwarded to ${targetsForRepeaterRequests.length} windows`
      });
      
    } catch (error) {
      console.error('Error handling repeater state from window:', error);
      
      // Send error response
      event.sender.send('get-repeater-state-response', { 
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Handle sending request from repeater
  ipcMain.handle('send-request', async (event, request) => {
    try {
      console.log('Sending request from repeater:', request);
      
      // Import HTTP/HTTPS modules dynamically
      const https = await import('node:https');
      const http = await import('node:http');
      const { parse } = await import('node:url');
      
      // Get the appropriate protocol module
      const protocol = request.protocol === 'https' ? https : http;
      
      // Parse the request URL
      const parsedUrl = parse(`${request.protocol}://${request.host}${request.path}`);
      
      // Prepare request options
      const options = {
        hostname: request.host,
        port: parsedUrl.port || (request.protocol === 'https' ? 443 : 80),
        path: request.path,
        method: request.method,
        headers: request.headers || {},
        // Don't validate SSL certificates for simplicity
        rejectUnauthorized: false
      };
      
      // Create a promise to handle the async request
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        const req = protocol.request(options, (res: any) => {
          const chunks: Buffer[] = [];
          
          // Track response size
          let responseSize = 0;
          
          // Collect response data as buffers
          res.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
            responseSize += chunk.length;
          });
          
          // Finalize response
          res.on('end', async () => {
            const responseTime = Date.now() - startTime;
            
            // Combine all chunks into a single buffer
            const responseBuffer = Buffer.concat(chunks);
            
            // Decompress response if needed
            const contentEncoding = res.headers['content-encoding'];
            const decompressedBody = await decompressResponse(responseBuffer, contentEncoding);
            
            // Create response object
            const response = {
              status: res.statusCode,
              headers: res.headers,
              body: decompressedBody.toString(),
              time: responseTime,
              size: responseSize
            };
            
            resolve(response);
          });
        });
        
        // Handle request errors
        req.on('error', (error: Error) => {
          console.error('Error sending request:', error);
          reject({
            success: false,
            error: error.message
          });
        });
        
        // Send request body if it exists
        if (request.body) {
          req.write(request.body);
        }
        
        // End the request
        req.end();
      });
    } catch (error) {
      console.error('Error processing request:', error);
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // Start without project
  ipcMain.on('start-without-project', async (event) => {
    try {
      console.log('Starting without project');
      
      // Create a new window and close the startup dialog
      if (startupDialogWindow) {
        console.log('Creating new window from startup dialog');
        // Create a new window first
        createWindow();
        // Close the startup dialog
        startupDialogWindow.close();
      }
      
      // Send back success response
      event.reply('fromMain', { success: true });
    } catch (error) {
      console.error('Error starting without project:', error);
      event.reply('fromMain', { 
        success: false, 
        error: (error as Error).message 
      });
    }
  });
}
