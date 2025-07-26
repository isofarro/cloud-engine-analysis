# Chess Engine System Documentation

A comprehensive TypeScript/Node.js system for managing UCI-compatible chess engines, supporting both local processes and remote SSH connections.

## Documentation Overview

### 📚 [Getting Started](./01-getting-started.md)
Quick start guide with examples and basic usage patterns. Perfect for developers new to the system.

**Contents:**
- Installation and setup
- Quick start examples
- Core concepts
- Best practices
- Common patterns
- Troubleshooting

### 🏗️ [UCI Chess Engine System](./02-uci-chess-engines.md)
Architectural overview of the chess engine system and its components.

**Contents:**
- System architecture
- Engine types (local vs remote)
- Configuration options
- Resource management
- Hash table persistence
- Analysis capabilities

### ⚙️ [Engine Service and Resource Management](./03-server-resources.md)
Detailed guide to the EngineService class and resource management features.

**Contents:**
- EngineService overview
- Configuration options
- Engine registration
- Resource management features
- Usage patterns
- Monitoring and optimization

### 🎯 [Analysis Tasks and Usage Patterns](./04-simple-analysis-tasks.md)
Comprehensive guide to performing different types of chess analysis.

**Contents:**
- Analysis types (quick moves, full analysis, multi-PV)
- Configuration options (time-based, depth-based, hybrid)
- Performance considerations
- Error handling
- Complete workflow examples

### 📖 [API Reference](./05-api-reference.md)
Complete API documentation for all classes, methods, and types.

**Contents:**
- Core classes (ChessEngine, LocalChessEngine, RemoteChessEngine, EngineService)
- Type definitions
- Method signatures
- Event handling
- Utility functions
- Error handling

## System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │    │   EngineService  │    │  ChessEngine    │
│                 │───▶│                  │───▶│   (Abstract)    │
│  - Game Logic   │    │  - Registration  │    │                 │
│  - UI/API       │    │  - Pooling       │    │  - UCI Protocol │
│  - Analysis     │    │  - Health Check  │    │  - Analysis     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                        ┌────────────────┼────────────────┐
                                        │                │                │
                               ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
                               │LocalChess   │  │RemoteChess  │  │   Future    │
                               │Engine       │  │Engine       │  │ Extensions  │
                               │             │  │             │  │             │
                               │- Process    │  │- SSH Conn   │  │- Cloud APIs │
                               │- Pipes      │  │- Reconnect  │  │- WebSocket  │
                               └─────────────┘  └─────────────┘  └─────────────┘
```

## Key Features

### 🚀 **Unified Interface**
- Single API for local and remote engines
- Consistent analysis methods across engine types
- Event-driven architecture with TypeScript support

### 🔧 **Flexible Configuration**
- UCI option management (threads, hash, custom options)
- Engine-specific configurations
- Runtime configuration updates

### 🌐 **Remote Engine Support**
- SSH-based remote engine connections
- Automatic reconnection with configurable retry logic
- Connection testing and health monitoring

### 📊 **Advanced Analysis**
- Multiple analysis modes (depth, time, hybrid)
- Multi-PV support for analyzing multiple candidate moves
- Real-time analysis progress via events

### 🛡️ **Production Ready**
- Comprehensive error handling
- Resource management and connection pooling
- Health monitoring and automatic recovery
- Graceful shutdown and cleanup

### 🔍 **Developer Experience**
- Full TypeScript support with detailed type definitions
- Extensive documentation and examples
- Debug-friendly with event logging
- Modular architecture for easy extension

## Quick Example

```typescript
import { EngineService } from './src/core/engine';

// Create service and register engines
const service = new EngineService();
service.registerEngine({
    id: 'stockfish',
    name: 'Stockfish',
    type: 'local',
    config: { enginePath: '/usr/local/bin/stockfish' }
});

// Analyze position
const engine = await service.getEngine('stockfish');
const analysis = await engine.analyzePosition(
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    { depth: 15, multiPV: 3 }
);

console.log(`Best move: ${analysis.bestMove}`);
console.log(`Evaluation: ${analysis.evaluation} centipawns`);

// Cleanup
await service.shutdown();
```

## Supported Engines

The system works with any UCI-compatible chess engine, including:

- **Stockfish** - Most popular open-source engine
- **Komodo** - Commercial engine with strong positional play
- **Leela Chess Zero** - Neural network-based engine
- **Dragon** - Commercial engine by Komodo team
- **And many others** - Any engine supporting UCI protocol

## Use Cases

### 🎮 **Game Applications**
- Chess training applications
- Game analysis tools
- Move suggestion systems
- Position evaluation services

### 📈 **Analysis Services**
- Batch game analysis
- Opening preparation
- Endgame tablebase integration
- Tournament analysis

### 🔬 **Research and Development**
- Engine comparison studies
- Algorithm testing
- Performance benchmarking
- Chess AI research

### ☁️ **Cloud Services**
- Distributed analysis across multiple servers
- Scalable chess analysis APIs
- Multi-tenant engine services
- Resource-optimized analysis

## Contributing

The system is designed to be extensible. Common extension points:

- **New Engine Types**: Implement ChessEngine for cloud APIs, WebSocket connections, etc.
- **Analysis Modes**: Add specialized analysis types (tactical, positional, endgame)
- **Monitoring**: Integrate with monitoring systems for production deployments
- **Caching**: Add analysis result caching for improved performance

## Performance Guidelines

### Development
- Use local engines with modest settings (1-2 threads, 256MB hash)
- Enable health checks for debugging
- Use shorter time limits for faster iteration

### Production
- Use remote engines for scalability
- Configure appropriate resource limits
- Implement proper error handling and monitoring
- Consider analysis result caching

### High Performance
- Use dedicated servers with high-end CPUs
- Allocate sufficient memory for hash tables (1-4GB)
- Use multiple engines for parallel analysis
- Optimize engine configurations for specific use cases

---

**Next Steps:** Start with the [Getting Started Guide](./01-getting-started.md) for hands-on examples, or dive into the [API Reference](./05-api-reference.md) for detailed technical documentation.