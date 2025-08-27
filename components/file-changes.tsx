'use client';

import { useState, useEffect } from 'react';
import { Workspace, FileChange } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  File, 
  FileText, 
  FilePlus, 
  FileX, 
  GitBranch, 
  GitCommit,
  RefreshCw,
  ExternalLink,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileChangesProps {
  workspace: Workspace | null;
}

export function FileChanges({ workspace }: FileChangesProps) {
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [gitBranch, setGitBranch] = useState<string | null>(null);

  useEffect(() => {
    if (workspace) {
      loadFileChanges();
      loadGitInfo();
    } else {
      setFileChanges([]);
      setGitBranch(null);
    }
  }, [workspace]);

  const loadFileChanges = async () => {
    if (!workspace || !window.electronAPI) return;

    setIsLoading(true);
    try {
      const result = await window.electronAPI.getFileChanges(workspace.path);
      if (result.success) {
        setFileChanges(result.changes);
      } else {
        console.error('Failed to load file changes:', result.error);
        setFileChanges([]);
      }
    } catch (error) {
      console.error('Error loading file changes:', error);
      setFileChanges([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGitInfo = async () => {
    if (!workspace || !window.electronAPI) return;

    try {
      const result = await window.electronAPI.getGitInfo(workspace.path);
      if (result.success && result.branch) {
        setGitBranch(result.branch);
      } else {
        setGitBranch(null);
      }
    } catch (error) {
      console.error('Error loading git info:', error);
      setGitBranch(null);
    }
  };

  const handleOpenFile = async (filePath: string) => {
    if (!workspace || !window.electronAPI) return;

    try {
      const fullPath = `${workspace.path}\\${filePath}`;
      const result = await window.electronAPI.openFile(fullPath);
      if (!result.success) {
        console.error('Failed to open file:', result.error);
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <FilePlus className="h-4 w-4 text-green-600" />;
      case 'modified':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'deleted':
        return <FileX className="h-4 w-4 text-red-600" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getStatusColor = (type: string, status: string) => {
    if (status === 'staged') {
      return 'text-green-600';
    }
    
    switch (type) {
      case 'added':
        return 'text-green-600';
      case 'modified':
        return 'text-blue-600';
      case 'deleted':
        return 'text-red-600';
      default:
        return 'text-muted-foreground';
    }
  };

  if (!workspace) {
    return (
      <div className="h-full p-4 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No workspace selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">File Changes</h3>
            {gitBranch && (
              <Badge variant="outline" className="text-xs">
                <GitBranch className="h-3 w-3 mr-1" />
                {gitBranch}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 w-7 p-0" 
              onClick={loadFileChanges}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Loading file changes...</p>
          </div>
        ) : fileChanges.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No changes detected</p>
            <p className="text-xs">Working tree is clean</p>
          </div>
        ) : (
          <div className="p-2">
            {/* Staged Changes */}
            {fileChanges.some(f => f.status === 'staged') && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-green-600 mb-2 px-2 flex items-center gap-2">
                  <GitCommit className="h-3 w-3" />
                  Staged Changes
                  <Badge variant="secondary" className="text-xs">
                    {fileChanges.filter(f => f.status === 'staged').length}
                  </Badge>
                </h4>
                <div className="space-y-1">
                  {fileChanges
                    .filter(change => change.status === 'staged')
                    .map((change, index) => (
                      <div
                        key={`staged-${index}`}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer group"
                        onClick={() => handleOpenFile(change.path)}
                        title="Click to open in editor"
                      >
                        {getFileIcon(change.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono truncate" title={change.path}>
                            {change.path.split('/').pop() || change.path.split('\\').pop()}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {change.path}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs capitalize",
                            getStatusColor(change.type, change.status)
                          )}
                        >
                          {change.type}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Unstaged Changes */}
            {fileChanges.some(f => f.status === 'unstaged') && (
              <div>
                <h4 className="text-sm font-medium text-orange-600 mb-2 px-2 flex items-center gap-2">
                  <File className="h-3 w-3" />
                  Unstaged Changes
                  <Badge variant="secondary" className="text-xs">
                    {fileChanges.filter(f => f.status === 'unstaged').length}
                  </Badge>
                </h4>
                <div className="space-y-1">
                  {fileChanges
                    .filter(change => change.status === 'unstaged')
                    .map((change, index) => (
                      <div
                        key={`unstaged-${index}`}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 cursor-pointer group"
                        onClick={() => handleOpenFile(change.path)}
                        title="Click to open in editor"
                      >
                        {getFileIcon(change.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono truncate" title={change.path}>
                            {change.path.split('/').pop() || change.path.split('\\').pop()}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {change.path}
                          </p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs capitalize",
                            getStatusColor(change.type, change.status)
                          )}
                        >
                          {change.type}
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {fileChanges.length > 0 && (
        <div className="p-3 border-t bg-muted/20">
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className="flex-1"
              onClick={() => {
                // TODO: Implement stage all functionality
                console.log('Stage all files');
              }}
            >
              Stage All
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                // TODO: Implement commit functionality
                console.log('Open commit dialog');
              }}
            >
              Commit
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}