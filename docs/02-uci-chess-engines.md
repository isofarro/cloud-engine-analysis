# UCI Chess Engine System

## Overview

Our chess engine system provides a unified interface for managing both local and remote UCI-compatible chess engines. The system is built around three core components:

- **ChessEngine**: Abstract base class defining the engine interface
- **LocalChessEngine**: Manages local engine processes
- **RemoteChessEngine**: Manages engines over SSH connections
- **EngineService**: Service layer for engine lifecycle management

## Engine Types

### Local Engines
Local engines run as child processes on the same machine. They're ideal for:
- Development and testing
- Single-user applications
- When you have direct access to engine binaries

### Remote Engines
Remote engines run on external servers accessed via SSH. They support:
- Distributed computing across multiple servers
- Access to high-performance remote hardware
- Automatic reconnection and connection pooling
- Resource isolation and management

## Engine Configuration

Each engine supports standard UCI options:

```typescript
type EngineConfig = {
    threads: number;     // CPU cores to use
    hash: number;        // Hash table size in MB
    [key: string]: string | number;  // Additional UCI options
};
```

## Resource Management

The system implements several resource management features:

- **Connection Pooling**: Reuse existing engine connections when possible
- **Health Monitoring**: Automatic health checks with configurable intervals
- **Connection Limits**: Configurable maximum number of concurrent engines
- **Graceful Shutdown**: Proper cleanup of all engine connections

## Hash Table Persistence

Chess engines maintain hash tables that store analysis data. When analyzing related positions (e.g., consecutive moves in a game), keeping the same engine instance improves performance significantly. The EngineService automatically manages engine instances to maximize hash table benefits while respecting resource constraints.

## Analysis Capabilities

The system supports various analysis modes:

- **Position Analysis**: Full analysis with multiple principal variations
- **Best Move**: Quick best move calculation with time/depth limits
- **Multi-PV**: Analysis of multiple best lines simultaneously
- **Time-based**: Analysis with time limits (seconds)
- **Depth-based**: Analysis to specific search depths
