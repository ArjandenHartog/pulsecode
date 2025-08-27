'use client';

import { useState, useEffect, useRef } from 'react';
import { Workspace } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Terminal, 
  Play, 
  Square, 
  Trash2, 
  Maximize2, 
  Minimize2,
  Copy,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TerminalPanelProps {
  workspace: Workspace | null;
}

export function TerminalPanel({ workspace }: TerminalPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [isClaudeRunning, setIsClaudeRunning] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto scroll to bottom when new output is added
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  useEffect(() => {
    // Initialize terminal with workspace info
    if (workspace) {
      setTerminalOutput([
        `PulseCode Terminal - ${workspace.name}`,
        `Working directory: ${workspace.path}`,
        `Ready to start Claude Code session...`,
        ''
      ]);
    } else {
      setTerminalOutput([]);
    }
  }, [workspace]);

  const handleSendCommand = async () => {
    if (!workspace || !command.trim()) return;

    // Add command to output
    const newOutput = [...terminalOutput, `$ ${command}`];
    
    // Special handling for Claude Code commands
    if (command.includes('claude-code') || command.includes('claude')) {
      setIsClaudeRunning(true);
      newOutput.push('🤖 Launching Claude Code...');
      newOutput.push('✓ Claude Code is ready and waiting for instructions');
      newOutput.push('💬 Type your questions or requests to Claude');
      newOutput.push('');
    } else {
      // Simulate command execution
      newOutput.push(`Executing: ${command}`);
      newOutput.push('Command completed successfully');
      newOutput.push('');
    }
    
    setTerminalOutput(newOutput);
    setCommand('');
  };

  const handleStopClaude = () => {
    setIsClaudeRunning(false);
    setTerminalOutput(prev => [
      ...prev,
      '🛑 Claude Code session terminated',
      'Ready for new commands...',
      ''
    ]);
  };

  const clearTerminal = () => {
    if (workspace) {
      setTerminalOutput([
        `PulseCode Terminal - ${workspace.name}`,
        `Working directory: ${workspace.path}`,
        ''
      ]);
    } else {
      setTerminalOutput([]);
    }
  };

  const copyOutput = () => {
    const output = terminalOutput.join('\n');
    navigator.clipboard.writeText(output);
  };

  if (!workspace) {
    return (
      <div className="h-full bg-muted/20 border-t flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No workspace selected</p>
          <p className="text-xs">Select a workspace to use the terminal</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "bg-black text-green-400 font-mono text-sm transition-all duration-200 border-t",
      isExpanded ? "h-96" : "h-72"
    )}>
      {/* Terminal Header */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between text-gray-300">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            <span className="text-sm font-medium">Terminal</span>
          </div>
          
          {isClaudeRunning && (
            <Badge variant="secondary" className="bg-green-600 text-white text-xs">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-1" />
              Claude Running
            </Badge>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            onClick={copyOutput}
            title="Copy output"
          >
            <Copy className="h-3 w-3" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            onClick={clearTerminal}
            title="Clear terminal"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0 text-gray-400 hover:text-white"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? (
              <Minimize2 className="h-3 w-3" />
            ) : (
              <Maximize2 className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Terminal Output */}
      <div 
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 space-y-1 h-full"
        style={{ height: 'calc(100% - 3rem)' }}
      >
        {terminalOutput.map((line, index) => (
          <div key={index} className="whitespace-pre-wrap">
            {line}
          </div>
        ))}
        
        {/* Command Input */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-green-400">$</span>
          <Input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSendCommand();
              }
            }}
            placeholder={isClaudeRunning ? "Chat with Claude..." : "Enter command..."}
            className="flex-1 bg-transparent border-none text-green-400 placeholder:text-green-600 focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
          />
          
          <div className="flex gap-1">
            {isClaudeRunning ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleStopClaude}
                className="h-6 px-2 text-red-400 hover:text-red-300 hover:bg-red-900/20"
              >
                <Square className="h-3 w-3 mr-1" />
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleSendCommand}
                disabled={!command.trim()}
                className="h-6 px-2 text-green-400 hover:text-green-300 hover:bg-green-900/20"
              >
                <Play className="h-3 w-3 mr-1" />
                Run
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}