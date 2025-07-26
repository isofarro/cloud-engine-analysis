# Getting Started with the Chess Engine System

## Installation and Setup

### Prerequisites
- Node.js 18+ with TypeScript support
- Chess engine binary (e.g., Stockfish) for local engines
- SSH access to remote servers for remote engines

### Basic Usage

```typescript
import { EngineService, LocalChessEngine, RemoteChessEngine } from './src/core/engine';
```

## Quick Start Examples

### 1. Simple Local Engine Usage

```typescript
import { LocalChessEngine } from './src/core/engine';

async function quickStart() {
    const engine = new LocalChessEngine({
        enginePath: '/usr/local/bin/stockfish',
        config: {
            threads: 2,
            hash: 256
        }
    });

    await engine.connect();
    
    const bestMove = await engine.getBestMove(
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        10  // depth
    );
    
    console.log('Best response to 1.e4:', bestMove);
    
    await engine.disconnect();
}
```

### 2. Engine Service with Multiple Engines

```typescript
import { EngineService } from './src/core/engine';

async function serviceExample() {
    const service = new EngineService({
        maxEngines: 4,
        healthCheckInterval: 30000
    });

    // Register engines
    service.registerEngine({
        id: 'stockfish-local',
        name: 'Stockfish Local',
        type: 'local',
        config: {
            enginePath: '/usr/local/bin/stockfish',
            config: { threads: 4, hash: 512 }
        }
    });

    service.registerEngine({
        id: 'stockfish-remote',
        name: 'Stockfish Remote',
        type: 'remote',
        config: {
            host: 'user@server.com',
            enginePath: '/path/to/stockfish',
            config: { threads: 8, hash: 1024 }
        }
    });

    // Use engines
    const localEngine = await service.getEngine('stockfish-local');
    const analysis = await localEngine.analyzePosition(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        { depth: 15, multiPV: 3 }
    );

    console.log('Analysis:', analysis);

    await service.shutdown();
}
```

### 3. Remote Engine with Error Handling

```typescript
import { RemoteChessEngine } from './src/core/engine';

async function remoteExample() {
    const engine = new RemoteChessEngine({
        host: 'user@analysis-server.com',
        enginePath: '/opt/stockfish/bin/stockfish',
        config: {
            threads: 16,
            hash: 4096
        }
    });

    try {
        // Test connection first
        const canConnect = await engine.testConnection();
        if (!canConnect) {
            throw new Error('Cannot connect to remote server');
        }

        await engine.connect();
        
        // Configure reconnection
        engine.setMaxConnectionAttempts(3);
        engine.setReconnectDelay(5000);

        const analysis = await engine.analyzePosition(
            'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4',
            { time: 10, multiPV: 5 }
        );

        console.log('Remote analysis completed:', analysis.bestMove);
        
    } catch (error) {
        console.error('Remote engine error:', error.message);
    } finally {
        await engine.disconnect();
    }
}
```

## Core Concepts

### Engine Types

- **LocalChessEngine**: Manages local engine processes
- **RemoteChessEngine**: Manages engines over SSH connections
- **EngineService**: Service layer for managing multiple engines

### Configuration Objects

```typescript
// Local engine configuration
type LocalEngineConfig = {
    enginePath: string;                    // Path to engine binary
    config?: Partial<EngineConfig>;        // UCI options
};

// Remote engine configuration
type RemoteEngineConfig = {
    host: string;                          // SSH connection string
    enginePath: string;                    // Remote path to engine
    config?: Partial<EngineConfig>;        // UCI options
};

// UCI engine options
type EngineConfig = {
    threads: number;                       // CPU cores
    hash: number;                          // Hash table size (MB)
    [key: string]: string | number;        // Additional UCI options
};
```

### Analysis Options

```typescript
type UciAnalysisOptions = {
    position: string;      // FEN string (auto-provided by methods)
    time?: number;         // Time limit in seconds
    depth?: number;        // Search depth limit
    multiPV?: number;      // Number of principal variations
};
```

### Analysis Results

```typescript
type AnalysisResult = {
    bestMove: string;           // Best move in algebraic notation
    evaluation: number;         // Position evaluation in centipawns
    depth: number;              // Search depth reached
    lines: AnalysisLine[];      // Principal variations
};

type AnalysisLine = {
    moves: string[];            // Move sequence
    evaluation: number;         // Line evaluation
    depth: number;              // Line depth
};
```

## Best Practices

### 1. Resource Management
- Use EngineService for managing multiple engines
- Set appropriate maxEngines limits
- Always call shutdown() or disconnect() when done

### 2. Error Handling
- Wrap engine operations in try-catch blocks
- Test remote connections before use
- Handle reconnection for long-running processes

### 3. Performance Optimization
- Reuse engine instances for related positions
- Configure threads and hash based on available hardware
- Use appropriate time/depth limits for your use case

### 4. Configuration
- Store engine configurations in environment variables or config files
- Use different configurations for development vs production
- Monitor engine health in production environments

## Common Patterns

### Batch Analysis
```typescript
async function batchAnalysis(positions: string[]) {
    const service = new EngineService({ maxEngines: 4 });
    
    // Register engine
    service.registerEngine({
        id: 'batch-engine',
        name: 'Batch Analysis Engine',
        type: 'local',
        config: { enginePath: '/usr/local/bin/stockfish' }
    });

    const engine = await service.getEngine('batch-engine');
    const results = [];

    for (const position of positions) {
        const analysis = await engine.analyzePosition(position, { depth: 12 });
        results.push({
            position,
            bestMove: analysis.bestMove,
            evaluation: analysis.evaluation
        });
    }

    await service.shutdown();
    return results;
}
```

### Health Monitoring
```typescript
async function monitorEngines(service: EngineService) {
    const engines = service.getActiveEngines();
    
    for (const engine of engines) {
        const isHealthy = await service.getEngineHealth(engine.id);
        console.log(`Engine ${engine.id}: ${isHealthy ? 'OK' : 'FAILED'}`);
    }
}
```

## Troubleshooting

### Common Issues

1. **Engine not found**: Verify engine path is correct
2. **SSH connection failed**: Check host, credentials, and network
3. **Analysis timeout**: Increase time limits or reduce depth
4. **Memory issues**: Reduce hash table size or thread count
5. **Health check failures**: Check engine binary and UCI compatibility

### Debug Mode
```typescript
// Enable verbose logging for debugging
const engine = new LocalChessEngine({
    enginePath: '/usr/local/bin/stockfish',
    config: { threads: 1, hash: 64 }
});

// Monitor UCI communication
engine.on('line', (line) => console.log('UCI:', line));
engine.on('error', (error) => console.error('Engine error:', error));
```