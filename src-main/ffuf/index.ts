import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';

// Keep track of the FFuf process
let ffufProcess: ChildProcess | null = null;

/**
 * Initialize FFuf module and register IPC handlers
 */
const init = () => {
  // Nothing specific to initialize yet
};

/**
 * Register IPC handlers for FFuf operations
 */
const registerIpcHandlers = () => {
  // Run FFuf command
  ipcMain.handle('ffuf:run', async (event, args: string[]) => {
    if (ffufProcess) {
      return Promise.reject('FFuf is already running');
    }

    try {
      ffufProcess = spawn('ffuf', args);
      
      const mainWindow = BrowserWindow.fromWebContents(event.sender);
      
      if (ffufProcess.stdout) {
        ffufProcess.stdout.on('data', (data) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ffuf-output', data.toString());
          }
        });
      }
      
      if (ffufProcess.stderr) {
        ffufProcess.stderr.on('data', (data) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('ffuf-output', `ERROR: ${data.toString()}`);
          }
        });
      }
      
      ffufProcess.on('close', (code) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ffuf-complete', code);
        }
        ffufProcess = null;
      });
      
      ffufProcess.on('error', (err) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('ffuf-error', err.message);
        }
        ffufProcess = null;
      });
      
      return 'FFuf process started';
    } catch (error) {
      ffufProcess = null;
      return Promise.reject((error as Error).message);
    }
  });

  // Stop FFuf process
  ipcMain.handle('ffuf:stop', async () => {
    if (ffufProcess) {
      try {
        // On Windows, use taskkill to forcefully terminate the process and its children
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', ffufProcess.pid!.toString(), '/f', '/t']);
        } else {
          ffufProcess.kill();
        }
        
        return 'FFuf process stopped';
      } catch (error) {
        return Promise.reject(`Failed to stop FFuf: ${(error as Error).message}`);
      } finally {
        ffufProcess = null;
      }
    }
    
    return 'No FFuf process running';
  });
};

export {
  init,
  registerIpcHandlers
};
