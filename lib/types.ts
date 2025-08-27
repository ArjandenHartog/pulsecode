export interface Workspace {
  id: string;
  name: string;
  path: string;
  status: 'idle' | 'running' | 'error' | 'completed';
  terminal?: TerminalData;
  claudeProcess?: any;
  createdAt: string;
  lastActivity?: string;
  gitBranch?: string;
  fileChanges?: FileChange[];
}

export interface TerminalData {
  id: string;
  workspaceId: string;
  output: string[];
  isActive: boolean;
  currentCommand?: string;
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  status: 'staged' | 'unstaged';
}

export interface ElectronAPI {
  selectFolder: () => Promise<string | null>;
  openFolder: (folderPath: string) => Promise<void>;
  openFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  createWorkspace: (data: { folderPath: string; name: string }) => Promise<{
    success: boolean;
    workspace?: Workspace;
    error?: string;
  }>;
  getWorkspaces: () => Promise<Workspace[]>;
  removeWorkspace: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  executeCommand: (data: { workspaceId: string; command: string }) => Promise<{
    success: boolean;
    output?: string;
    error?: string;
  }>;
  stopClaudeCode: (workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  getGitInfo: (workspacePath: string) => Promise<{
    success: boolean;
    branch?: string | null;
    error?: string;
  }>;
  getFileChanges: (workspacePath: string) => Promise<{
    success: boolean;
    changes: FileChange[];
    error?: string;
  }>;
  checkGitBash: () => Promise<{
    available: boolean;
    path?: string | null;
    message: string;
  }>;
  platform: string;
  onWorkspaceUpdate: (callback: (event: any, data: any) => void) => () => void;
  onTerminalOutput: (callback: (event: any, data: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}