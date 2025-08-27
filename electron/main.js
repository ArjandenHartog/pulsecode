const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const isDev = process.env.NODE_ENV === 'development';

// Function to find Git Bash installation
function findGitBash() {
  const possiblePaths = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    'C:\\Git\\bin\\bash.exe',
    `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Git\\bin\\bash.exe`,
    `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Git\\usr\\bin\\bash.exe`
  ];
  
  for (const gitPath of possiblePaths) {
    if (fs.existsSync(gitPath)) {
      console.log(`Found Git Bash at: ${gitPath}`);
      return gitPath;
    }
  }
  
  // Try using 'where' command to find bash
  try {
    const result = execSync('where bash', { encoding: 'utf8' });
    const paths = result.trim().split('\n');
    console.log(`Found bash paths: ${JSON.stringify(paths)}`);
    for (const bashPath of paths) {
      const cleanPath = bashPath.trim();
      if (cleanPath.includes('Git') && fs.existsSync(cleanPath)) {
        console.log(`Found Git Bash via where command: ${cleanPath}`);
        return cleanPath;
      }
    }
  } catch (error) {
    console.log('Could not find bash via where command:', error.message);
  }
  
  return null;
}

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

    // Open file in default editor
    ipcMain.handle('open-file', async (event, filePath) => {
      try {
        await shell.openPath(filePath);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Execute command in workspace
    ipcMain.handle('execute-command', async (event, { workspaceId, command }) => {
      try {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace) {
          return { success: false, error: 'Workspace not found' };
        }

        return new Promise((resolve) => {
          const isClaudeCommand = command.includes('claude-code') || command.includes('claude');
          const isClaudeInput = command.startsWith('claude-input:');
          
          if (isClaudeInput) {
            // Send input to existing Claude process
            const input = command.replace('claude-input:', '') + '\n';
            if (workspace.claudeProcess && workspace.claudeProcess.stdin) {
              workspace.claudeProcess.stdin.write(input);
              resolve({ success: true, output: '' });
            } else {
              resolve({ success: false, error: 'No active Claude process' });
            }
          } else if (isClaudeCommand) {
            // Start Claude Code process
            const claudeCommand = command.trim() === 'claude' ? 'claude' : 'claude-code';
            console.log(`Starting Claude with command: ${claudeCommand} in ${workspace.path}`);
            
            // Set up environment for Claude Code (needs Git Bash on Windows)
            let bashPath = null;
            try {
              const result = execSync('where bash', { encoding: 'utf8' });
              const paths = result.trim().split('\n');
              console.log('All bash paths found:', paths);
              // Take the first Git-related bash path and clean it
              bashPath = (paths.find(p => p.includes('Git')) || paths[0])?.replace(/\r/g, '').trim();
              console.log('Selected bash path:', bashPath);
            } catch (error) {
              console.log('Could not find bash:', error.message);
            }
            
            const env = { 
              ...process.env, 
              FORCE_COLOR: '1'
            };
            
            if (bashPath) {
              env.CLAUDE_CODE_GIT_BASH_PATH = bashPath;
            }
            
            console.log('Environment variables:', {
              CLAUDE_CODE_GIT_BASH_PATH: env.CLAUDE_CODE_GIT_BASH_PATH,
              PATH: env.PATH?.split(';').slice(0, 3).join(';') + '...'
            });

            // Start Claude Code via cmd with proper environment and force TTY mode
            const claudeProcess = spawn('cmd', ['/c', `${claudeCommand}`], {
              cwd: workspace.path,
              stdio: ['pipe', 'pipe', 'pipe'],
              env: {
                ...env,
                FORCE_COLOR: '1',
                TERM: 'xterm-256color',
                // Force interactive mode
                CI: 'false'
              },
              shell: false,
              detached: false
            });

            workspace.claudeProcess = claudeProcess;
            workspace.status = 'running';

            let output = '';
            let hasReceivedOutput = false;

            claudeProcess.stdout.on('data', (data) => {
              const text = data.toString();
              output += text;
              hasReceivedOutput = true;
              console.log(`Claude stdout: ${text}`);
              
              // Send real-time output to renderer - clean up ANSI codes for display
              const cleanText = text.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI escape codes
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: cleanText
              });
            });

            claudeProcess.stderr.on('data', (data) => {
              const text = data.toString();
              output += text;
              hasReceivedOutput = true;
              console.log(`Claude stderr: ${text}`);
              
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: text,
                isError: true
              });
            });

            claudeProcess.on('spawn', () => {
              console.log(`Claude process spawned successfully with PID: ${claudeProcess.pid}`);
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: `Claude Code launched (PID: ${claudeProcess.pid})\n`
              });
            });

            claudeProcess.on('error', (error) => {
              console.error(`Claude process error:`, error);
              workspace.status = 'error';
              workspace.claudeProcess = null;
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: `Error launching Claude: ${error.message}\n`,
                isError: true
              });
              this.mainWindow?.webContents.send('workspace-update', workspace);
            });

            claudeProcess.on('close', (code, signal) => {
              console.log(`Claude process closed with code: ${code}, signal: ${signal}`);
              workspace.status = code === 0 ? 'completed' : 'error';
              workspace.claudeProcess = null;
              
              const statusMessage = code === 0 
                ? 'Claude Code session ended normally' 
                : `Claude Code exited with code: ${code}`;
              
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: `${statusMessage}\n`
              });
              
              this.mainWindow?.webContents.send('workspace-update', workspace);
            });

            // Give some initial feedback
            setTimeout(() => {
              if (!hasReceivedOutput) {
                this.mainWindow?.webContents.send('terminal-output', {
                  workspaceId,
                  output: `Waiting for Claude Code to initialize...\n`
                });
              }
            }, 2000);

            resolve({ 
              success: true, 
              output: `Launching Claude Code in ${workspace.path}...` 
            });
          } else {
            // Execute regular command
            const process = spawn('cmd', ['/c', command], {
              cwd: workspace.path,
              stdio: ['pipe', 'pipe', 'pipe']
            });

            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => {
              output += data.toString();
            });

            process.stderr.on('data', (data) => {
              errorOutput += data.toString();
            });

            process.on('close', (code) => {
              resolve({
                success: code === 0,
                output: output || errorOutput || `Command exited with code ${code}`,
                error: code !== 0 ? errorOutput : undefined
              });
            });
          }
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Stop Claude Code process
    ipcMain.handle('stop-claude-code', async (event, workspaceId) => {
      try {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace || !workspace.claudeProcess) {
          return { success: false, error: 'No Claude Code process running' };
        }

        workspace.claudeProcess.kill();
        workspace.claudeProcess = null;
        workspace.status = 'idle';
        
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Get workspace git info
    ipcMain.handle('get-git-info', async (event, workspacePath) => {
      try {
        return new Promise((resolve) => {
          const gitProcess = spawn('git', ['branch', '--show-current'], {
            cwd: workspacePath,
            stdio: ['pipe', 'pipe', 'pipe']
          });

          let output = '';
          gitProcess.stdout.on('data', (data) => {
            output += data.toString().trim();
          });

          gitProcess.on('close', (code) => {
            resolve({
              success: code === 0,
              branch: code === 0 ? output : null
            });
          });
        });
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Check Git Bash availability
    ipcMain.handle('check-git-bash', async () => {
      const gitBashPath = findGitBash();
      return {
        available: !!gitBashPath,
        path: gitBashPath,
        message: gitBashPath 
          ? 'Git Bash is available' 
          : 'Git Bash not found. Please install Git for Windows from https://git-scm.com/downloads/win'
      };
    });

    // Get file changes (git status)
    ipcMain.handle('get-file-changes', async (event, workspacePath) => {
      try {
        return new Promise((resolve) => {
          const gitProcess = spawn('git', ['status', '--porcelain'], {
            cwd: workspacePath,
            stdio: ['pipe', 'pipe', 'pipe']
          });

          let output = '';
          gitProcess.stdout.on('data', (data) => {
            output += data.toString();
          });

          gitProcess.on('close', (code) => {
            if (code !== 0) {
              resolve({ success: false, changes: [] });
              return;
            }

            const changes = output
              .split('\n')
              .filter(line => line.trim())
              .map(line => {
                const status = line.substring(0, 2);
                const filePath = line.substring(3);
                
                let type = 'modified';
                let staged = false;

                if (status.includes('A')) type = 'added';
                if (status.includes('D')) type = 'deleted';
                if (status.includes('M')) type = 'modified';
                
                staged = status[0] !== ' ' && status[0] !== '?';

                return {
                  path: filePath,
                  type,
                  status: staged ? 'staged' : 'unstaged'
                };
              });

            resolve({ success: true, changes });
          });
        });
      } catch (error) {
        return { success: false, error: error.message, changes: [] };
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