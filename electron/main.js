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
      ? 'http://localhost:3009' 
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
    ipcMain.handle('create-workspace', async (event, { folderPath, name, provider }) => {
      try {
        const workspaceId = `workspace_${Date.now()}`;
        const workspace = {
          id: workspaceId,
          name,
          path: folderPath,
          status: 'idle',
          terminal: null,
          aiProcess: null,
          provider: provider || 'claude',
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
        if (workspace.aiProcess) {
          workspace.aiProcess.kill();
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
          const isAICommand = command.includes('claude-code') || command.includes('claude') || command.includes('opencode');
          const isAIInput = command.startsWith('ai-input:');
          
          if (isAIInput) {
            // Send input to existing AI process
            const input = command.replace('ai-input:', '') + '\n';
            if (workspace.aiProcess && workspace.aiProcess.stdin) {
              workspace.aiProcess.stdin.write(input);
              resolve({ success: true, output: '' });
            } else {
              resolve({ success: false, error: 'No active AI process' });
            }
          } else if (isAICommand) {
            // Determine AI tool and command
            let aiCommand;
            let needsBash = false;
            
            if (command.includes('opencode')) {
              aiCommand = 'opencode';
            } else {
              aiCommand = command.trim() === 'claude' ? 'claude' : 'claude-code';
              needsBash = true; // Claude Code needs Git Bash on Windows
            }
            
            console.log(`Starting ${workspace.provider} with command: ${aiCommand} in ${workspace.path}`);
            
            // Set up environment (Claude Code needs Git Bash on Windows)
            let bashPath = null;
            if (needsBash) {
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

            // Start AI process with proper environment
            const aiProcess = spawn('cmd', ['/c', `${aiCommand}`], {
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

            workspace.aiProcess = aiProcess;
            workspace.status = 'running';

            let output = '';
            let hasReceivedOutput = false;

            aiProcess.stdout.on('data', (data) => {
              const text = data.toString();
              output += text;
              hasReceivedOutput = true;
              console.log(`${workspace.provider} stdout: ${text}`);
              
              // Send real-time output to renderer - clean up ANSI codes for display
              const cleanText = text.replace(/\x1b\[[0-9;]*m/g, ''); // Remove ANSI escape codes
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: cleanText
              });
            });

            aiProcess.stderr.on('data', (data) => {
              const text = data.toString();
              output += text;
              hasReceivedOutput = true;
              console.log(`${workspace.provider} stderr: ${text}`);
              
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: text,
                isError: true
              });
            });

            aiProcess.on('spawn', () => {
              console.log(`${workspace.provider} process spawned successfully with PID: ${aiProcess.pid}`);
              const toolName = workspace.provider === 'claude' ? 'Claude Code' : 'OpenCode';
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: `${toolName} launched (PID: ${aiProcess.pid})\n`
              });
            });

            aiProcess.on('error', (error) => {
              console.error(`${workspace.provider} process error:`, error);
              workspace.status = 'error';
              workspace.aiProcess = null;
              const toolName = workspace.provider === 'claude' ? 'Claude' : 'OpenCode';
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: `Error launching ${toolName}: ${error.message}\n`,
                isError: true
              });
              this.mainWindow?.webContents.send('workspace-update', workspace);
            });

            aiProcess.on('close', (code, signal) => {
              console.log(`${workspace.provider} process closed with code: ${code}, signal: ${signal}`);
              workspace.status = code === 0 ? 'completed' : 'error';
              workspace.aiProcess = null;
              
              const toolName = workspace.provider === 'claude' ? 'Claude Code' : 'OpenCode';
              const statusMessage = code === 0 
                ? `${toolName} session ended normally` 
                : `${toolName} exited with code: ${code}`;
              
              this.mainWindow?.webContents.send('terminal-output', {
                workspaceId,
                output: `${statusMessage}\n`
              });
              
              this.mainWindow?.webContents.send('workspace-update', workspace);
            });

            // Give some initial feedback
            setTimeout(() => {
              if (!hasReceivedOutput) {
                const toolName = workspace.provider === 'claude' ? 'Claude Code' : 'OpenCode';
                this.mainWindow?.webContents.send('terminal-output', {
                  workspaceId,
                  output: `Waiting for ${toolName} to initialize...\n`
                });
              }
            }, 2000);

            const toolName = workspace.provider === 'claude' ? 'Claude Code' : 'OpenCode';
            resolve({ 
              success: true, 
              output: `Launching ${toolName} in ${workspace.path}...` 
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

    // Stop AI process
    ipcMain.handle('stop-ai-process', async (event, workspaceId) => {
      try {
        const workspace = this.workspaces.get(workspaceId);
        if (!workspace || !workspace.aiProcess) {
          return { success: false, error: 'No AI process running' };
        }

        workspace.aiProcess.kill();
        workspace.aiProcess = null;
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

    // Check tool availability
    ipcMain.handle('check-tool-availability', async (event, tool) => {
      try {
        if (tool === 'claude') {
          // Check for Claude Code
          try {
            execSync('claude --version', { encoding: 'utf8', stdio: 'pipe' });
            return {
              available: true,
              message: 'Claude Code is installed and ready'
            };
          } catch (error) {
            const gitBashPath = findGitBash();
            return {
              available: false,
              message: gitBashPath 
                ? 'Claude Code not found. Install from https://claude.ai/code'
                : 'Git Bash and Claude Code required. Install Git from https://git-scm.com/downloads/win and Claude Code from https://claude.ai/code'
            };
          }
        } else if (tool === 'opencode') {
          // Check for OpenCode
          try {
            execSync('opencode --version', { encoding: 'utf8', stdio: 'pipe' });
            return {
              available: true,
              message: 'OpenCode is installed and ready'
            };
          } catch (error) {
            return {
              available: false,
              message: 'OpenCode not found. Install with: npm i -g opencode-ai@latest'
            };
          }
        } else {
          return {
            available: false,
            message: 'Unknown tool'
          };
        }
      } catch (error) {
        return {
          available: false,
          message: `Error checking ${tool}: ${error.message}`
        };
      }
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