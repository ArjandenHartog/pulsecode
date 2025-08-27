'use client';

import { useState, useEffect } from 'react';
import { Workspace, AIProvider } from '@/lib/types';
import { Sidebar } from './sidebar';
import { MainContent } from './main-content';
import { FileChanges } from './file-changes';
import { CreateWorkspaceDialog } from './create-workspace-dialog';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export function ConductorApp() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if we're running in Electron
    setIsElectron(typeof window !== 'undefined' && window.electronAPI !== undefined);
    
    if (window.electronAPI) {
      loadWorkspaces();
    }
  }, []);

  useEffect(() => {
    // Listen for workspace updates from Electron
    if (window.electronAPI) {
      const cleanupWorkspace = window.electronAPI.onWorkspaceUpdate((event, updatedWorkspace) => {
        setWorkspaces(prev => prev.map(w => 
          w.id === updatedWorkspace.id ? updatedWorkspace : w
        ));
        if (selectedWorkspace?.id === updatedWorkspace.id) {
          setSelectedWorkspace(updatedWorkspace);
        }
      });

      return cleanupWorkspace;
    }
  }, [selectedWorkspace]);

  const loadWorkspaces = async () => {
    if (!window.electronAPI) return;
    
    try {
      const workspaceList = await window.electronAPI.getWorkspaces();
      setWorkspaces(workspaceList);
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    }
  };

  const handleCreateWorkspace = async (folderPath: string, name: string, provider: AIProvider) => {
    if (!window.electronAPI) return;
    
    try {
      const result = await window.electronAPI.createWorkspace({ folderPath, name, provider });
      if (result.success && result.workspace) {
        // Get Git info for the new workspace
        const gitInfo = await window.electronAPI.getGitInfo(folderPath);
        if (gitInfo.success && gitInfo.branch) {
          result.workspace.gitBranch = gitInfo.branch;
        }
        
        setWorkspaces(prev => [...prev, result.workspace!]);
        setSelectedWorkspace(result.workspace!);
        setIsCreateDialogOpen(false);
      }
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  };

  const handleRemoveWorkspace = async (workspaceId: string) => {
    if (!window.electronAPI) return;
    
    try {
      const result = await window.electronAPI.removeWorkspace(workspaceId);
      if (result.success) {
        setWorkspaces(prev => prev.filter(w => w.id !== workspaceId));
        if (selectedWorkspace?.id === workspaceId) {
          setSelectedWorkspace(null);
        }
      }
    } catch (error) {
      console.error('Failed to remove workspace:', error);
    }
  };

  if (!isElectron) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">PulseCode Conductor</h1>
          <p className="text-muted-foreground">
            This app is designed to run in Electron. Please use the desktop version.
          </p>
          <Button onClick={() => window.location.reload()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 border-r bg-muted/30">
        <div className="h-full flex flex-col">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold">PulseCode</h1>
              <Button
                size="sm"
                onClick={() => setIsCreateDialogOpen(true)}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </div>
          <Sidebar
            workspaces={workspaces}
            selectedWorkspace={selectedWorkspace}
            onSelectWorkspace={setSelectedWorkspace}
            onRemoveWorkspace={handleRemoveWorkspace}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Content */}
        <div className="flex-1 flex">
          {/* Center Content */}
          <div className="flex-1 flex flex-col">
            <MainContent 
              selectedWorkspace={selectedWorkspace}
              onExecuteCommand={(workspaceId, command) => {
                if (window.electronAPI) {
                  return window.electronAPI.executeCommand({ workspaceId, command });
                }
                return Promise.resolve({ success: false, error: 'Not in Electron' });
              }}
            />
          </div>
          
          {/* Right Panel - File Changes */}
          <div className="w-80 border-l">
            <FileChanges workspace={selectedWorkspace} />
          </div>
        </div>

      </div>

      {/* Create Workspace Dialog */}
      <CreateWorkspaceDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onCreateWorkspace={handleCreateWorkspace}
      />
    </div>
  );
}