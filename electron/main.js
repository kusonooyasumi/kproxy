const { app, BrowserWindow, ipcMain, Menu, dialog } = require('electron');
const path = require('path');
const ProxyManager = require('./proxy/proxy-manager');
const ProjectManager = require('./project/project-manager');
const { spawn } = require('child_process');

let ffufProcess = null;


// IPC handlers
ipcMain.handle('run-ffuf', async (event, args) => {
  if (ffufProcess) {
    return Promise.reject('FFuf is already running');
  }

  try {
    ffufProcess = spawn('ffuf', args);
    
    ffufProcess.stdout.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('ffuf-output', data.toString());
      }
    });
    
    ffufProcess.stderr.on('data', (data) => {
      if (mainWindow) {
        mainWindow.webContents.send('ffuf-output', `ERROR: ${data.toString()}`);
      }
    });
    
    ffufProcess.on('close', (code) => {
      if (mainWindow) {
        mainWindow.webContents.send('ffuf-complete', code);
      }
      ffufProcess = null;
    });
    
    ffufProcess.on('error', (err) => {
      if (mainWindow) {
        mainWindow.webContents.send('ffuf-error', err.message);
      }
      ffufProcess = null;
    });
    
    return 'FFuf process started';
  } catch (error) {
    ffufProcess = null;
    return Promise.reject(error.message);
  }
});

ipcMain.handle('stop-ffuf', async () => {
  if (ffufProcess) {
    try {
      // On Windows, you might need a different approach
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', ffufProcess.pid, '/f', '/t']);
      } else {
        ffufProcess.kill();
      }
      
      return 'FFuf process stopped';
    } catch (error) {
      return Promise.reject(`Failed to stop FFuf: ${error.message}`);
    } finally {
      ffufProcess = null;
    }
  }
  
  return 'No FFuf process running';
});

// In CommonJS, __dirname is available globally

// Keep a global reference of the window object to avoid garbage collection
let mainWindow;
let tabWindows = {}; // Store references to tab-specific windows
let proxyManager; // Proxy manager instance
let projectManager; // Project manager instance
let startupDialogWindow; // Reference to startup dialog window

/**
 * Create the startup dialog window to select project options
 */
const createStartupDialog = async () => {
  console.log('Creating startup dialog window');
  
  // Create a small dialog window
  startupDialogWindow = new BrowserWindow({
    width: 500,
    height: 400,
    resizable: false,
    frame: true,
    show: false,
    title: 'KProxy - Start Project',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  startupDialogWindow.setMenu(null);
  
  // Show the window immediately for debugging
  startupDialogWindow.show();
  
  // Open DevTools for the startup dialog
  startupDialogWindow.webContents.openDevTools();
  
  try {
    // Instead of trying to load a route, directly load the main.js file 
    // with a query parameter to trigger startup mode
    await startupDialogWindow.loadURL('http://localhost:5173?startup=true');
    console.log('Successfully loaded startup dialog from dev server');
  } catch (e) {
    console.error('Failed to load startup dialog from dev server:', e);
    try {
      // Fallback to built files
      const mainIndex = path.join(__dirname, '../build/index.html');
      await startupDialogWindow.loadFile(mainIndex, { query: { 'startup': 'true' } });
      console.log('Loaded startup dialog from build files');
    } catch (loadErr) {
      console.error('Failed to load startup dialog completely:', loadErr);
      // If all else fails, just create the main window directly
      createWindow();
      return;
    }
  }

  // Handle window close
  startupDialogWindow.on('closed', () => {
    console.log('Startup dialog window closed');
    startupDialogWindow = null;
  });
};

/**
 * Create the main application window
 */
const createWindow = async () => {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Always try to load from the dev server first when in development
  try {
    // In production or if dev server fails, load from built files    

    const indexHtml = path.join(__dirname, '../build/index.html');
    await mainWindow.loadFile(indexHtml);
  } catch (e) {
    // In development, load from local dev server    
    console.error('Failed to load from prod build, falling back to dev server:', e);
    const serverUrl = 'http://localhost:5173';
    console.log('Attempting to load from dev server:', serverUrl);
    await mainWindow.loadURL(serverUrl);

    // Open the DevTools automatically in development mode
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', async () => {
  console.log('Electron app ready event fired');
  
  // Initialize managers
  proxyManager = new ProxyManager();
  proxyManager.initialize();
  
  projectManager = new ProjectManager();
  
  // For development testing purposes - COMMENT THIS OUT TO USE STARTUP DIALOG 
  // await createWindow();
  
  // Create the startup dialog - this should be the default behavior
  createStartupDialog();
});

// Save project before quitting
app.on('before-quit', async (event) => {
  if (projectManager && projectManager.getCurrentProject()) {
    // Get current project
    const currentProject = projectManager.getCurrentProject();
    
    // If project has a path and has been modified, ask to save
    if (currentProject && currentProject.path) {
      // TODO: Check if project has changes and prompt to save
    }
  }
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// Function to create a new window for a specific tab
const createTabWindow = async (tabName) => {
  // Create a new browser window
  const tabWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    title: `KProxy - ${tabName}`,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    titleBarStyle: 'hidden'
  });
  
  // Remove default menu for Requests window
  if (tabName === 'Requests') {
    // Set an empty menu to remove file edit view and help options
    tabWindow.setMenu(null);
  }

  // Store reference to the window
  tabWindows[tabName] = tabWindow;

  try {
    // Determine the URL based on tab type
    let url;
    if (tabName === 'Requests') {
      url = 'http://localhost:5173/requests';
    } else if (tabName === 'Repeater') {
      url = 'http://localhost:5173/repeater';
    } else if (tabName === 'Fuzzer') {
      url = 'http://localhost:5173/fuzzer';
    } else if (tabName === 'Chat') {
      url = 'http://localhost:5173/chat';
    } else if (tabName === 'Decode/Encode') {
      url = 'http://localhost:5173/decode';
    } else if (tabName === 'Sitemap') {
      url = 'http://localhost:5173/sitemap';
    } else if (tabName === 'Settings') {
      url = 'http://localhost:5173/settings';
    } else
    
    console.log(`Loading ${tabName} in new window from: ${url}`);
    await tabWindow.loadURL(url);
    
    // For tabs other than Requests that don't have dedicated routes,
    // send message to show the specific tab
    if (tabName !== 'Requests') {
      tabWindow.webContents.on('did-finish-load', () => {
        tabWindow.webContents.send('showTab', { tabName });
      });
    }
  } catch (e) {
    console.error('Failed to load from dev server, falling back to production build:', e);
    // In production or if dev server fails, load from built files
    
    // Determine the path based on tab type
    let indexPath;
    if (tabName === 'Requests') {
      indexPath = path.join(__dirname, '../build/requests/index.html');
    } else if (tabName === 'Repeater') {
      indexPath = path.join(__dirname, '../build/repeater/index.html');
    } else {
      indexPath = path.join(__dirname, '../build/index.html');
    }
    
    try {
      await tabWindow.loadFile(indexPath);
      
      // For tabs other than Requests that don't have dedicated routes,
      // send message to show the specific tab
      if (tabName !== 'Requests') {
        tabWindow.webContents.on('did-finish-load', () => {
          tabWindow.webContents.send('showTab', { tabName });
        });
      }
    } catch (loadErr) {
      console.error('Failed to load specific route, falling back to main index:', loadErr);
      // If the specific route file doesn't exist, fall back to the main index
      const indexHtml = path.join(__dirname, '../build/index.html');
      await tabWindow.loadFile(indexHtml);
      
      tabWindow.webContents.on('did-finish-load', () => {
        tabWindow.webContents.send('showTab', { tabName });
      });
    }
  }

  // Emitted when the window is closed
  tabWindow.on('closed', () => {
    // Dereference the window object
    delete tabWindows[tabName];
  });
};

// IPC listeners
ipcMain.on('toMain', (event, args) => {
  console.log('Received in main process:', args);
  
  // Send a response back to the renderer
  event.sender.send('fromMain', {
    reply: 'Message received in main process!'
  });
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
    
    // Also update the main window if it exists
    if (mainWindow) {
      mainWindow.webContents.send('send-to-repeater', request);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error sending to repeater:', error);
    return { success: false, error: error.message };
  }
});

// Project API IPC Handlers
// Create a new project
ipcMain.handle('new-project', async () => {
  try {
    // Close startup dialog if it exists
    if (startupDialogWindow) {
      startupDialogWindow.close();
    }
    
    // Initialize an empty project
    const newProject = projectManager.initializeNewProject();
    
    // Create the main window if it doesn't exist
    if (!mainWindow) {
      await createWindow();
    }
    
    // Notify all windows about project state change
    const windows = [mainWindow, ...Object.values(tabWindows)].filter(Boolean);
    windows.forEach(win => {
      win.webContents.send('project-state-changed', { 
        action: 'new', 
        project: newProject 
      });
    });
    
    return true;
  } catch (error) {
    console.error('Error creating new project:', error);
    return false;
  }
});

// Open an existing project
ipcMain.handle('open-project', async () => {
  try {
    // Use project manager to show open dialog and load a project
    const result = await projectManager.openProject();
    
    if (result.success) {
      // Close startup dialog if it exists
      if (startupDialogWindow) {
        startupDialogWindow.close();
      }
      
      // Create the main window if it doesn't exist
      if (!mainWindow) {
        await createWindow();
      }
      
      // Load the proxied requests into the proxy manager
      if (result.project.proxiedRequests && result.project.proxiedRequests.length > 0) {
        // Clear existing requests first
        proxyManager.requestsCache = [];
        
        // Add all project requests to the proxy manager cache
        result.project.proxiedRequests.forEach(request => {
          proxyManager.addRequestToCache(request);
        });
        
        console.log(`Loaded ${result.project.proxiedRequests.length} proxied requests from project`);
        
        // Broadcast the requests to all windows
        const allWindows = [mainWindow, ...Object.values(tabWindows)].filter(Boolean);
        result.project.proxiedRequests.forEach(request => {
          allWindows.forEach(win => {
            win.webContents.send('proxy-request', request);
            // If the request has a response, send that too
            if (request.status) {
              win.webContents.send('proxy-response', request);
            }
          });
        });
      }
      
      // Notify all windows about project state change
      const windows = [mainWindow, ...Object.values(tabWindows)].filter(Boolean);
      windows.forEach(win => {
        win.webContents.send('project-state-changed', { 
          action: 'open', 
          project: result.project 
        });
      });
      
      // Send repeater requests to all repeater tabs
      if (result.project.repeaterRequests && result.project.repeaterRequests.length > 0) {
        // Wait a bit for all windows to initialize
        setTimeout(() => {
          // Get list of all windows that should receive repeater requests
          const targetsForRepeaterRequests = [];
          
          // Add the standalone Repeater window if it exists
          if (tabWindows['Repeater']) {
            targetsForRepeaterRequests.push(tabWindows['Repeater']);
          }
          
          // Add the main window if it exists
          if (mainWindow) {
            targetsForRepeaterRequests.push(mainWindow);
          }
          
          // Send each request to each target
          if (targetsForRepeaterRequests.length > 0) {
            result.project.repeaterRequests.forEach(request => {
              targetsForRepeaterRequests.forEach(win => {
                win.webContents.send('send-to-repeater', request);
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
    return { success: false, error: error.message };
  }
});

// Save the current project
ipcMain.handle('save-project', async (event, projectData) => {
  try {
    // Get current proxied requests from the proxy manager
    const proxiedRequests = proxyManager.requestsCache;
    
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
      proxiedRequests,
      repeaterRequests: projectData.repeaterRequests || [] // Use existing or empty array
    };
    
    const result = await projectManager.saveProject(updatedProjectData);
    
    if (result.success) {
      // Notify all windows about project state change
      const windows = [mainWindow, ...Object.values(tabWindows)].filter(Boolean);
      windows.forEach(win => {
        win.webContents.send('project-state-changed', { 
          action: 'save', 
          project: projectManager.getCurrentProject() 
        });
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error saving project:', error);
    return { success: false, error: error.message };
  }
});

// Handle receiving repeater requests for saving to project
ipcMain.handle('repeater-requests', async (event, requests) => {
  try {
    if (!projectManager.getCurrentProject()) return { success: false };
    
    // Update the current project with the repeater requests
    projectManager.updateProject({
      repeaterRequests: requests
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating repeater requests:', error);
    return { success: false, error: error.message };
  }
});

// Save the current project with a new name/location
ipcMain.handle('save-project-as', async (event, projectData) => {
  try {
    // Get current proxied requests from the proxy manager
    const proxiedRequests = proxyManager.requestsCache;
    
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
      proxiedRequests,
      repeaterRequests: projectData.repeaterRequests || [] // Use existing or empty array
    };
    
    const result = await projectManager.saveProject(updatedProjectData, true);
    
    if (result.success) {
      // Notify all windows about project state change
      const windows = [mainWindow, ...Object.values(tabWindows)].filter(Boolean);
      windows.forEach(win => {
        win.webContents.send('project-state-changed', { 
          action: 'saveAs', 
          project: projectManager.getCurrentProject() 
        });
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error in save-as project:', error);
    return { success: false, error: error.message };
  }
});

// Get the current project
ipcMain.handle('get-current-project', async () => {
  return projectManager.getCurrentProject();
});

// Start without project (just open the main app)
ipcMain.on('start-without-project', async (event) => {
  try {
    console.log('Starting without project');
    // Close startup dialog if it exists
    if (startupDialogWindow) {
      startupDialogWindow.close();
    }
    
    // Create the main window if it doesn't exist
    if (!mainWindow) {
      await createWindow();
    }
    
    // Send back success response
    event.reply('fromMain', { success: true });
  } catch (error) {
    console.error('Error starting without project:', error);
    event.reply('fromMain', { success: false, error: error.message });
  }
});

// Handle sending request from repeater
ipcMain.handle('send-request', async (event, request) => {
  try {
    console.log('Sending request from repeater:', request);
    
    // Create options for HTTP/HTTPS request
    const https = require('https');
    const http = require('http');
    const url = require('url');
    
    // Get the appropriate protocol module
    const protocol = request.protocol === 'https' ? https : http;
    
    // Parse the request URL
    const parsedUrl = url.parse(`${request.protocol}://${request.host}${request.path}`);
    
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
      
      const req = protocol.request(options, (res) => {
        let responseData = '';
        
        // Track response size
        let responseSize = 0;
        
        // Collect response data
        res.on('data', (chunk) => {
          responseData += chunk;
          responseSize += chunk.length;
        });
        
        // Finalize response
        res.on('end', () => {
          const responseTime = Date.now() - startTime;
          
          // Create response object
          const response = {
            status: res.statusCode,
            headers: res.headers,
            body: responseData,
            time: responseTime,
            size: responseSize
          };
          
          resolve(response);
        });
      });
      
      // Handle request errors
      req.on('error', (error) => {
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
      error: error.message
    };
  }
});
