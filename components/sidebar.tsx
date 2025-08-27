'use client';

import { Workspace } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Folder, 
  GitBranch, 
  Play, 
  Square, 
  X, 
  ExternalLink,
  Clock,
  CheckCircle,
  AlertCircle,
  Bot,
  Code
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SidebarProps {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;
  onSelectWorkspace: (workspace: Workspace) => void;
  onRemoveWorkspace: (workspaceId: string) => void;
}

export function Sidebar({ 
  workspaces, 
  selectedWorkspace, 
  onSelectWorkspace, 
  onRemoveWorkspace 
}: SidebarProps) {
  const getStatusIcon = (status: Workspace['status']) => {
    switch (status) {
      case 'running':
        return <Play className="h-3 w-3 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-blue-500" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: Workspace['status']) => {
    switch (status) {
      case 'running':
        return 'bg-green-500/10 text-green-700 border-green-200';
      case 'error':
        return 'bg-red-500/10 text-red-700 border-red-200';
      case 'completed':
        return 'bg-blue-500/10 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  const openFolder = async (folderPath: string) => {
    if (window.electronAPI) {
      await window.electronAPI.openFolder(folderPath);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {workspaces.length === 0 ? (
        <div className="p-4 text-center text-muted-foreground">
          <Folder className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No workspaces yet</p>
          <p className="text-xs">Create one to get started</p>
        </div>
      ) : (
        <div className="p-2 space-y-2">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className={cn(
                "group relative rounded-lg border p-3 cursor-pointer transition-colors hover:bg-accent/50",
                selectedWorkspace?.id === workspace.id 
                  ? "bg-accent border-accent-foreground/20" 
                  : "hover:bg-muted/50"
              )}
              onClick={() => onSelectWorkspace(workspace)}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(workspace.status)}
                    <h3 className="text-sm font-medium truncate">
                      {workspace.name}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground truncate" title={workspace.path}>
                    {workspace.path.split('\\').pop() || workspace.path}
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFolder(workspace.path);
                    }}
                    title="Open in Explorer"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveWorkspace(workspace.id);
                    }}
                    title="Remove workspace"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Status and Provider */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs capitalize", getStatusColor(workspace.status))}
                  >
                    {workspace.status}
                  </Badge>
                  <div className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted/50">
                    {(workspace.provider || 'claude') === 'claude' ? (
                      <Bot className="h-3 w-3" />
                    ) : (
                      <Code className="h-3 w-3" />
                    )}
                    <span className="capitalize">{workspace.provider || 'claude'}</span>
                  </div>
                </div>
                
                {workspace.gitBranch && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <GitBranch className="h-3 w-3" />
                    <span className="truncate max-w-16">{workspace.gitBranch}</span>
                  </div>
                )}
              </div>

              {/* Activity indicator */}
              {workspace.status === 'running' && (
                <div className="absolute top-2 right-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}