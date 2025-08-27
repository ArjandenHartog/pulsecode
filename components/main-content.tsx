'use client';

import { useState, useEffect, useRef } from 'react';
import { Workspace } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Play, 
  Square, 
  Settings, 
  Bot, 
  Loader2,
  GitBranch,
  Folder,
  Send,
  Maximize2,
  Minimize2,
  Copy,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MainContentProps {
  selectedWorkspace: Workspace | null;
  onExecuteCommand: (workspaceId: string, command: string) => Promise<{ 
    success: boolean; 
    output?: string; 
    error?: string; 
  }>;
}

export function MainContent({ selectedWorkspace, onExecuteCommand }: MainContentProps) {
  const [command, setCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [isClaudeRunning, setIsClaudeRunning] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto scroll to bottom when new output is added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  useEffect(() => {
    // Initialize terminal when workspace changes
    if (selectedWorkspace) {
      setTerminalOutput([
        `Welcome to PulseCode Terminal`,
        `Workspace: ${selectedWorkspace.name}`,
        `Path: ${selectedWorkspace.path}`,
        ``,
        `Type 'claude' to start Claude Code or any other command to execute.`,
        ``,
      ]);
      setIsClaudeRunning(selectedWorkspace.status === 'running');
    } else {
      setTerminalOutput([]);
      setIsClaudeRunning(false);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    // Listen for terminal output from Electron
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onTerminalOutput((event, data) => {
        if (data.workspaceId === selectedWorkspace?.id) {
          setTerminalOutput(prev => [...prev, data.output]);
        }
      });
      return cleanup;
    }
  }, [selectedWorkspace]);

  const handleSendCommand = async () => {
    if (!selectedWorkspace || !command.trim()) return;

    const cmd = command.trim();
    setTerminalOutput(prev => [...prev, `$ ${cmd}`, '']);
    setCommand('');
    setIsExecuting(true);

    try {
      // Check if this is a Claude Code command
      if (cmd === 'claude' || cmd === 'claude-code' || cmd.startsWith('claude ')) {
        setIsClaudeRunning(true);
        setTerminalOutput(prev => [
          ...prev,
          'Starting Claude Code...',
          'Initializing Claude environment...',
          ''
        ]);
      }

      if (isClaudeRunning) {
        // If Claude is running, send input directly to Claude process
        const result = await window.electronAPI?.executeCommand({ 
          workspaceId: selectedWorkspace.id, 
          command: `claude-input:${cmd}` 
        });
        
        if (!result?.success) {
          setTerminalOutput(prev => [
            ...prev, 
            `Error sending to Claude: ${result?.error || 'Communication failed'}`,
            ''
          ]);
        }
      } else {
        // Regular command execution
        const result = await onExecuteCommand(selectedWorkspace.id, cmd);
        
        if (result.success) {
          if (result.output) {
            setTerminalOutput(prev => [...prev, result.output!, '']);
          }
        } else {
          setTerminalOutput(prev => [
            ...prev, 
            `Error: ${result.error || 'Command failed'}`,
            ''
          ]);
        }
      }
    } catch (error) {
      setTerminalOutput(prev => [
        ...prev,
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        ''
      ]);
    } finally {
      setIsExecuting(false);
      // Focus input after command execution
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleStopClaude = async () => {
    if (!selectedWorkspace || !window.electronAPI) return;

    try {
      const result = await window.electronAPI.stopClaudeCode(selectedWorkspace.id);
      if (result.success) {
        setIsClaudeRunning(false);
        setTerminalOutput(prev => [
          ...prev,
          'Claude Code session terminated',
          'Ready for new commands...',
          ''
        ]);
      }
    } catch (error) {
      console.error('Failed to stop Claude Code:', error);
    }
  };

  const clearTerminal = () => {
    if (selectedWorkspace) {
      setTerminalOutput([
        `Welcome to PulseCode Terminal`,
        `Workspace: ${selectedWorkspace.name}`,
        `Path: ${selectedWorkspace.path}`,
        ``,
      ]);
    } else {
      setTerminalOutput([]);
    }
  };

  const copyOutput = () => {
    const output = terminalOutput.join('\n');
    navigator.clipboard.writeText(output);
  };

  if (!selectedWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Bot className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold">No workspace selected</h2>
          <p className="text-muted-foreground">
            Select a workspace from the sidebar or create a new one to start your Claude Code terminal session.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold">{selectedWorkspace.name}</h2>
              {isClaudeRunning && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse mr-1" />
                  Claude Running
                </Badge>
              )}
              <Badge 
                variant={selectedWorkspace.status === 'running' ? 'default' : 'secondary'}
                className="capitalize"
              >
                {selectedWorkspace.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Folder className="h-3 w-3" />
              {selectedWorkspace.path}
              {selectedWorkspace.gitBranch && (
                <>
                  <GitBranch className="h-3 w-3 ml-2" />
                  {selectedWorkspace.gitBranch}
                </>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {isClaudeRunning ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleStopClaude}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Claude
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCommand('claude');
                  handleSendCommand();
                }}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Claude Code
              </Button>
            )}
            
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={copyOutput} title="Copy terminal output">
              <Copy className="h-3 w-3" />
            </Button>
            
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={clearTerminal} title="Clear terminal">
              <Trash2 className="h-3 w-3" />
            </Button>
            
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setIsMaximized(!isMaximized)} title={isMaximized ? "Minimize" : "Maximize"}>
              {isMaximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 flex flex-col bg-background border rounded-lg m-4 shadow-sm">
        {/* Terminal Output */}
        <div 
          ref={terminalRef}
          className="flex-1 overflow-y-auto p-6 font-mono text-sm space-y-1 min-h-0 bg-gray-50/30"
        >
          {terminalOutput.map((line, index) => (
            <div key={index} className={cn(
              "whitespace-pre-wrap",
              line.startsWith('$') ? 'text-blue-600 font-semibold' : '',
              line.startsWith('Error:') ? 'text-red-600' : '',
              line.includes('Starting Claude') || line.includes('Connecting') || line.includes('launched') ? 'text-green-600' : '',
              line.includes('terminated') || line.includes('exited') ? 'text-orange-600' : ''
            )}>
              {line}
            </div>
          ))}
          
          {/* Loading indicator */}
          {isExecuting && (
            <div className="flex items-center gap-2 text-blue-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Executing...</span>
            </div>
          )}
        </div>

        {/* Command Input */}
        <div className="border-t bg-background p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-blue-600 font-mono text-sm">
              <span>$</span>
            </div>
            <Input
              ref={inputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendCommand();
                }
              }}
              placeholder={isClaudeRunning ? "Chat with Claude..." : "Type a command..."}
              className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm"
              disabled={isExecuting}
              autoFocus
            />
            
            <Button
              size="sm"
              onClick={handleSendCommand}
              disabled={isExecuting || !command.trim()}
              className="flex-shrink-0"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}