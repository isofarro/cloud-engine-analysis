# Engine Service and Resource Management

## EngineService Overview

The `EngineService` class provides centralized management of chess engine instances with built-in resource management, health monitoring, and connection pooling.

## Configuration

```typescript
interface EngineServiceConfig {
    defaultEngineConfig?: Partial<EngineConfig>;
    maxEngines?: number;              // Maximum concurrent engines
    healthCheckInterval?: number;     // Health check frequency (ms)
}
```

## Engine Registration

Engines are registered as definitions that can be instantiated on demand:

```typescript
type EngineDefinition = {
    id: string;
    name: string;
    type: 'local' | 'remote';
    config: LocalEngineConfig | RemoteEngineConfig;
};
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

## Usage Patterns

### Basic Service Setup
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

### Engine Access
```typescript
// Get engine instance (creates if needed, reuses if available)
const engine = await engineService.getEngine('stockfish-local');

// Use engine for analysis
const result = await engine.analyzePosition(fen, { depth: 15 });
```

### Monitoring
```typescript
// Check active engines
const active = engineService.getActiveEngines();
// Returns: [{ id: 'stockfish-local', status: 'idle', type: 'local' }]

// Check specific engine health
const isHealthy = await engineService.getEngineHealth('stockfish-local');
```

## Resource Optimization

### Engine Reuse
The service automatically reuses existing engine connections when:
- The engine is already connected and healthy
- The same engine ID is requested
- The engine is not currently analyzing

### Memory Management
- Hash table sizes are configured per engine
- Engines maintain their hash tables between analyses
- Failed engines are promptly disconnected to free resources

### Connection Management
- Remote engines support automatic reconnection
- Configurable connection retry limits and delays
- SSH connection pooling for remote engines

