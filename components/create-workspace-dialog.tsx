'use client';

import { useState, useEffect } from 'react';
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
import { Folder, FolderOpen, Bot, Code } from 'lucide-react';
import { AIProvider } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateWorkspace: (folderPath: string, name: string, provider: AIProvider) => void;
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreateWorkspace,
}: CreateWorkspaceDialogProps) {
  const [selectedPath, setSelectedPath] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('claude');
  const [isSelecting, setIsSelecting] = useState(false);
  const [toolAvailability, setToolAvailability] = useState<{
    claude: { available: boolean; message: string };
    opencode: { available: boolean; message: string };
  }>({ claude: { available: false, message: '' }, opencode: { available: false, message: '' } });

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
      onCreateWorkspace(selectedPath, workspaceName.trim(), selectedProvider);
      
      // Reset form
      setSelectedPath('');
      setWorkspaceName('');
      setSelectedProvider('claude');
    }
  };

  const handleCancel = () => {
    setSelectedPath('');
    setWorkspaceName('');
    setSelectedProvider('claude');
    onOpenChange(false);
  };

  // Check tool availability when dialog opens
  useEffect(() => {
    if (open && window.electronAPI) {
      Promise.all([
        window.electronAPI.checkToolAvailability('claude'),
        window.electronAPI.checkToolAvailability('opencode')
      ]).then(([claudeResult, opencodeResult]) => {
        setToolAvailability({
          claude: claudeResult,
          opencode: opencodeResult
        });
      });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Select a project folder and AI provider to create a new workspace. Each workspace runs independently with its own terminal and AI instance.
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
          
          <div className="grid gap-2">
            <Label htmlFor="ai-provider">AI Provider</Label>
            <Select value={selectedProvider} onValueChange={(value: AIProvider) => setSelectedProvider(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select AI provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4" />
                    <div>
                      <div>Claude Code</div>
                      <div className="text-xs text-muted-foreground">
                        {toolAvailability.claude.available ? '✅ Available' : '❌ Not installed'}
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="opencode">
                  <div className="flex items-center gap-2">
                    <Code className="h-4 w-4" />
                    <div>
                      <div>OpenCode</div>
                      <div className="text-xs text-muted-foreground">
                        {toolAvailability.opencode.available ? '✅ Available' : '❌ Not installed'}
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {!toolAvailability[selectedProvider]?.available && (
              <p className="text-xs text-amber-600">
                {toolAvailability[selectedProvider]?.message}
              </p>
            )}
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