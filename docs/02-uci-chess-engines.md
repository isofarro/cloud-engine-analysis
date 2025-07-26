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

## EngineService Management

### Service Configuration

```typescript
interface EngineServiceConfig {
    defaultEngineConfig?: Partial<EngineConfig>;
    maxEngines?: number;              // Maximum concurrent engines
    healthCheckInterval?: number;     // Health check frequency (ms)
}
```

### Engine Registration

Engines are registered as definitions that can be instantiated on demand:

```typescript
type EngineDefinition = {
    id: string;
    name: string;
    type: 'local' | 'remote';
    config: LocalEngineConfig | RemoteEngineConfig;
};
```

### Service Usage Patterns

#### Basic Service Setup
```typescript
const engineService = new EngineService({
    defaultEngineConfig: { threads: 2, hash: 512 },
    maxEngines: 8,
    healthCheckInterval: 30000
});

// Register engine definitions
engineService.registerEngine({
    id: 'stockfish-local',
    name: 'Stockfish Local',
    type: 'local',
    config: { enginePath: '/usr/local/bin/stockfish' }
});
```

#### Engine Access
```typescript
// Get engine instance (creates if needed, reuses if available)
const engine = await engineService.getEngine('stockfish-local');

// Use engine for analysis
const result = await engine.analyzePosition(fen, { depth: 15 });
```

#### Monitoring
```typescript
// Check active engines
const active = engineService.getActiveEngines();
// Returns: [{ id: 'stockfish-local', status: 'idle', type: 'local' }]

// Check specific engine health
const isHealthy = await engineService.getEngineHealth('stockfish-local');
```

## Resource Management Features

### Connection Pooling
- Engines are created on-demand and reused when possible
- Disconnected engines are automatically removed from the pool
- Maximum engine limit prevents resource exhaustion

### Health Monitoring
- Configurable automatic health checks
- Failed engines are automatically disconnected
- Health status available via `getEngineHealth()`

### Lifecycle Management
- Graceful shutdown of all engines
- Individual engine disconnection
- Automatic cleanup of failed connections

### Engine Optimization
- Hash table sizes are configured per engine
- Engines maintain their hash tables between analyses
- Failed engines are promptly disconnected to free resources
- Remote engines support automatic reconnection
- Configurable connection retry limits and delays
- SSH connection pooling for remote engines

## Hash Table Persistence

Chess engines maintain hash tables that store analysis data. When analyzing related positions (e.g., consecutive moves in a game), keeping the same engine instance improves performance significantly. The EngineService automatically manages engine instances to maximize hash table benefits while respecting resource constraints.

## Analysis Capabilities

The system supports various analysis modes:

- **Position Analysis**: Full analysis with multiple principal variations
- **Best Move**: Quick best move calculation with time/depth limits
- **Multi-PV**: Analysis of multiple best lines simultaneously
- **Time-based**: Analysis with time limits (seconds)
- **Depth-based**: Analysis to specific search depths
