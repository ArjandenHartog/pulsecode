# PulseCode - Claude Code Conductor

PulseCode is a desktop application for managing multiple Claude Code CLI sessions in parallel workspaces. Built with Next.js, Electron, and Shadcn UI.

## Architecture

### Core Components

- **ConductorApp**: Main application container managing state and layout
- **Sidebar**: Workspace list and management
- **MainContent**: Terminal interface for Claude Code sessions
- **FileChanges**: Git integration showing file changes and diff
- **CreateWorkspaceDialog**: Workspace creation wizard

### Electron Integration

The app uses Electron with secure IPC communication:

- **Main Process** (`electron/main.js`): Handles file system, process management, and Git operations
- **Preload Script** (`electron/preload/index.js`): Secure bridge between renderer and main process
- **Window Management**: Single main window with dev tools in development

### Key Features

1. **Workspace Management**
   - Create workspaces by selecting project folders
   - Track multiple projects simultaneously
   - Auto-detect Git branch information

2. **Claude Code Integration**
   - Launch Claude Code CLI in workspace directories
   - Real-time terminal output streaming
   - Process lifecycle management (start/stop)
   - Interactive command execution

3. **Git Integration**
   - Real-time file change detection
   - Staged vs unstaged change tracking
   - Branch information display
   - File diff visualization

4. **File System Operations**
   - Open files in default editor (double-click in file changes)
   - Open folders in Windows Explorer
   - Cross-platform path handling

## Technical Implementation

### Process Management

Claude Code processes are spawned using Node.js `child_process.spawn()` with proper stdio piping for real-time output capture.

### State Management

React state with useEffect hooks for:
- Workspace persistence
- Real-time updates from Electron main process
- Terminal output streaming
- File change monitoring

### UI Design

Modern, clean interface using:
- Shadcn UI components
- Tailwind CSS for styling
- Lucide React icons
- Monospace fonts for terminal output

### Security

- Context isolation enabled
- No node integration in renderer
- Secure IPC through contextBridge
- Validated file paths and commands

## Development Setup

1. Install dependencies: `npm install`
2. Start development: `npm run electron:dev`
3. Build production: `npm run dist`

## File Structure

```
/components/          # React UI components
/electron/           # Electron main and preload scripts
/lib/                # Utilities and TypeScript types
/app/                # Next.js app router pages
```

## IPC API Reference

### Main Process Handlers

- `select-folder`: Open folder selection dialog
- `create-workspace`: Create new workspace
- `execute-command`: Run command in workspace
- `get-file-changes`: Get Git status
- `get-git-info`: Get branch information
- `open-file`: Open file in default editor
- `open-folder`: Open folder in explorer

### Renderer Events

- `terminal-output`: Real-time command output
- `workspace-update`: Workspace status changes

## Windows Compatibility

- Uses Windows-specific path separators
- Handles Windows command prompt integration
- File associations respect Windows defaults
- Explorer integration for folders and files