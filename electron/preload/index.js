const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Folder operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  
  // Workspace management
  createWorkspace: (data) => ipcRenderer.invoke('create-workspace', data),
  getWorkspaces: () => ipcRenderer.invoke('get-workspaces'),
  removeWorkspace: (workspaceId) => ipcRenderer.invoke('remove-workspace', workspaceId),
  
  // Command execution
  executeCommand: (data) => ipcRenderer.invoke('execute-command', data),
  stopAIProcess: (workspaceId) => ipcRenderer.invoke('stop-ai-process', workspaceId),
  
  // Git operations
  getGitInfo: (workspacePath) => ipcRenderer.invoke('get-git-info', workspacePath),
  getFileChanges: (workspacePath) => ipcRenderer.invoke('get-file-changes', workspacePath),
  checkToolAvailability: (tool) => ipcRenderer.invoke('check-tool-availability', tool),
  
  // System info
  platform: process.platform,
  
  // Event listeners
  onWorkspaceUpdate: (callback) => {
    ipcRenderer.on('workspace-update', callback);
    return () => ipcRenderer.removeAllListeners('workspace-update');
  },
  
  onTerminalOutput: (callback) => {
    ipcRenderer.on('terminal-output', callback);
    return () => ipcRenderer.removeAllListeners('terminal-output');
  }
});