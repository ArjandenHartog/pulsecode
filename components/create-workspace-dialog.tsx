'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Folder, FolderOpen } from 'lucide-react';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateWorkspace: (folderPath: string, name: string) => void;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreateWorkspace,
}: CreateWorkspaceDialogProps) {
  const [selectedPath, setSelectedPath] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);

  const handleSelectFolder = async () => {
    if (!window.electronAPI) return;
    
    setIsSelecting(true);
    try {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        setSelectedPath(folderPath);
        
        // Auto-generate workspace name from folder name
        const folderName = folderPath.split('\\').pop() || folderPath.split('/').pop() || 'Workspace';
        setWorkspaceName(folderName);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    } finally {
      setIsSelecting(false);
    }
  };

  const handleCreate = () => {
    if (selectedPath && workspaceName.trim()) {
      onCreateWorkspace(selectedPath, workspaceName.trim());
      
      // Reset form
      setSelectedPath('');
      setWorkspaceName('');
    }
  };

  const handleCancel = () => {
    setSelectedPath('');
    setWorkspaceName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Select a project folder to create a new Claude Code workspace. Each workspace runs independently with its own terminal and Claude instance.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="folder-path">Project Folder</Label>
            <div className="flex gap-2">
              <Input
                id="folder-path"
                placeholder="Select a project folder..."
                value={selectedPath}
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectFolder}
                disabled={isSelecting}
                className="flex-shrink-0"
              >
                {isSelecting ? (
                  <FolderOpen className="h-4 w-4 animate-pulse" />
                ) : (
                  <Folder className="h-4 w-4" />
                )}
                {isSelecting ? 'Selecting...' : 'Browse'}
              </Button>
            </div>
            {selectedPath && (
              <p className="text-xs text-muted-foreground">
                Selected: {selectedPath}
              </p>
            )}
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Workspace Name</Label>
            <Input
              id="workspace-name"
              placeholder="Enter workspace name..."
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate}
            disabled={!selectedPath || !workspaceName.trim()}
          >
            Create Workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}