const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

class PulseCodeApp {
  constructor() {
    this.mainWindow = null;
    this.workspaces = new Map();
  }

  createMainWindow() {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 600,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload', 'index.js'),
        webSecurity: !isDev
      },
      titleBarStyle: 'default',
      autoHideMenuBar: true,
      show: false
    });

    const startUrl = isDev 
      ? 'http://localhost:3000' 
      : `file://${path.join(__dirname, '../out/index.html')}`;

    this.mainWindow.loadURL(startUrl);

    if (isDev) {
      this.mainWindow.webContents.openDevTools();
    }

    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  setupIpcHandlers() {
    // Handle folder selection
    ipcMain.handle('select-folder', async () => {
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Project Folder'
      });
      
      return result.canceled ? null : result.filePaths[0];
    });

    // Handle workspace creation
    ipcMain.handle('create-workspace', async (event, { folderPath, name }) => {
      try {
        const workspaceId = `workspace_${Date.now()}`;
        const workspace = {
          id: workspaceId,
          name,
          path: folderPath,
          status: 'idle',
          terminal: null,
          claudeProcess: null,
          createdAt: new Date().toISOString()
        };
        
        this.workspaces.set(workspaceId, workspace);
        return { success: true, workspace };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Get all workspaces
    ipcMain.handle('get-workspaces', async () => {
      return Array.from(this.workspaces.values());
    });

    // Remove workspace
    ipcMain.handle('remove-workspace', async (event, workspaceId) => {
      if (this.workspaces.has(workspaceId)) {
        const workspace = this.workspaces.get(workspaceId);
        if (workspace.claudeProcess) {
          workspace.claudeProcess.kill();
        }
        this.workspaces.delete(workspaceId);
        return { success: true };
      }
      return { success: false, error: 'Workspace not found' };
    });

    // Open folder in explorer
    ipcMain.handle('open-folder', async (event, folderPath) => {
      shell.openPath(folderPath);
    });

    // Execute command in workspace
    ipcMain.handle('execute-command', async (event, { workspaceId, command }) => {
      try {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
          return { success: false, error: 'Workspace not found' };
        }

        // This would integrate with Claude Code CLI
        // For now, we'll simulate the command execution
        console.log(`Executing command in ${workspace.path}: ${command}`);
        
        return { success: true, output: `Command executed: ${command}` };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }

  async init() {
    await app.whenReady();
    this.createMainWindow();
    this.setupIpcHandlers();
  }
}

const pulseCodeApp = new PulseCodeApp();

app.whenReady().then(() => {
  pulseCodeApp.init();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      pulseCodeApp.createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});