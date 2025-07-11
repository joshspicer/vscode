# JoshBot - Remote Coding Agent Test Extension

A test extension for the Remote Coding Agents status API that simulates a coding agent reporting various status updates to VS Code core.

## Features

- **Status Provider Registration**: Demonstrates how to register a status provider using the `remoteCodingAgents.registerStatusProvider()` API
- **Real-time Status Updates**: Shows how to emit status updates with files changed, messages, logs, and links
- **Multiple Test Scenarios**: Includes commands to test different aspects of the API

## Commands

All commands are available through the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **JoshBot: Start Coding Task** - Simulates a complete coding workflow with multiple status updates
- **JoshBot: Simulate File Modification** - Shows file modification status updates
- **JoshBot: Simulate Error** - Demonstrates error reporting and recovery
- **JoshBot: Simulate Long Running Task** - Shows progress reporting for long tasks
- **JoshBot: Clear Status** - Clears the current status

## Status Bar Integration

The extension adds a status bar item showing the current JoshBot status. Click it to start a coding task.

## Configuration

- `joshbot.agentId`: Unique identifier for the JoshBot agent (default: "joshbot-agent")
- `joshbot.simulateDelay`: Delay in milliseconds between status updates (default: 1000)

## Testing the API

This extension demonstrates all aspects of the Remote Coding Agents status API:

### Status Data Types

- **Files Changed**: Reports created, modified, and deleted files with previews
- **Messages**: Shows request/response communication flow
- **Logs**: Displays info, warning, and error messages with timestamps
- **Links**: Provides clickable links to relevant resources

### Usage Example

```typescript
// Register a status provider
const provider: vscode.RemoteCodingAgentStatusProvider = {
    onDidUpdateStatus: statusEmitter.event
};

const disposable = vscode.remoteCodingAgents.registerStatusProvider(provider);

// Report status updates
statusEmitter.fire({
    agentId: 'joshbot-agent',
    jobId: 'job-123',
    timestamp: Date.now(),
    data: {
        filesChanged: [
            { uri: fileUri, type: 'modified', preview: 'Updated function' }
        ],
        logs: [
            { level: 'info', message: 'Task completed', timestamp: Date.now() }
        ]
    }
});
```

## Development

This extension follows VS Code's standard extension patterns and demonstrates best practices for:

- Extension lifecycle management
- Command registration and handling
- Configuration management
- Status bar integration
- Event-driven architecture

## License

MIT