# Architecture Plan for Chess Engine Analysis System
Based on the documentation, here's a comprehensive plan for building the remote server, chess engines, and UCI connections:

## Core Requirements Analysis
1. Remote Chess Engines : Binaries running on remote servers, controlled via UCI protocol over SSH
2. Resource Management : 50% average CPU utilization with rest periods between tasks
3. Engine Diversity : Support multiple chess engines with different configurations
4. Hash Table Optimization : Retain engine instances for sequential position analysis
5. Configurable Resources : JSON config + REST API for server management
## Proposed Architecture
### Current Implementation in src/core/

```
src/core/
├── engine/                     # ✅ IMPLEMENTED
│   ├── index.ts               # Main exports and public API
│   ├── types.ts               # UCI and engine type definitions
│   ├── ChessEngine.ts         # Abstract base class for engines
│   ├── LocalChessEngine.ts    # Local engine implementation
│   ├── RemoteChessEngine.ts   # Remote engine with SSH support
│   ├── EngineService.ts       # Engine management service
│   ├── UciClient.ts           # UCI protocol client
│   ├── LocalUciClient.ts      # Local UCI implementation
│   └── RemoteUciClient.ts     # Remote UCI over SSH
├── server/                     # 🔄 PLANNED
│   ├── ServerPool.ts          # Manages pool of available servers
│   ├── ServerResource.ts      # Individual server resource tracking
│   ├── ResourceManager.ts     # CPU/RAM allocation and utilization tracking
│   └── ServerConfig.ts        # Server configuration management
├── analysis/                   # 🔄 PLANNED
│   ├── AnalysisTask.ts        # Analysis task definition
│   ├── TaskQueue.ts           # Task scheduling and queuing
│   └── AnalysisConfig.ts      # Analysis configuration types
└── types/                      # 🔄 PLANNED
    ├── ServerTypes.ts         # Server-related type definitions
    └── AnalysisTypes.ts       # Analysis-related type definitions
```

## Key Components Design
### 1. EngineService (✅ IMPLEMENTED)

```typescript
class EngineService {
  // Current implementation provides:
  registerEngine(definition: EngineDefinition): void
  async getEngine(engineId: string): Promise<ChessEngine>
  getRegisteredEngines(): EngineDefinition[]
  getActiveEngines(): EngineStatus[]
  async shutdown(): Promise<void>
  
  // Future enhancement for resource-aware allocation:
  async getEngine(config: AnalysisConfig): Promise<ChessEngine> {
    // 1. Determine required resources (CPU, RAM, engine type)
    // 2. Find available server with matching engine
    // 3. Check resource utilization constraints
    // 4. Allocate or reuse existing engine instance
    // 5. Return connected ChessEngine instance
  }
}
```

### 2. Resource Management Strategy
- ServerResource : Track CPU/RAM usage, utilization history
- ResourceManager : Enforce 50% average utilization with rest periods
- ServerPool : Maintain pool of servers with different engine capabilities
### 3. Engine Management (✅ IMPLEMENTED)
- ChessEngine : Abstract base class with analyzePosition(), getBestMove(), healthCheck()
- LocalChessEngine : Local engine implementation with process spawning
- RemoteChessEngine : SSH-based remote engine with connection management
- EngineService : Engine registration, pooling, and lifecycle management
- UciClient : UCI protocol communication (local and remote variants)
## Configuration Approach
### Server Configuration (JSON)
```json
{
  "servers": [
    {
      "id": "server-1",
      "host": "chess-server-1.example.com",
      "availableCPU": 16,
      "availableRAM": "32GB",
      "targetUtilization": 0.5,
      "engines": ["stockfish", "komodo"]
    }
  ]
}
```
### Analysis Configuration
```typescript
interface AnalysisConfig {
  engineType: 'stockfish' | 'komodo' | 'leela';
  analysisType: 'short' | 'long';
  cpuCores: number;
  memoryMB: number;
  timeLimit?: number;
  depth?: number;
  engineOptions?: Record<string, any>;
}
```
## Implementation Strategy
### Phase 1: Core Infrastructure
1. Server resource management and configuration
2. SSH connection pooling
3. Basic UCI protocol implementation
### Phase 2: Engine Management
1. Chess engine abstraction layer
2. Engine-specific implementations (Stockfish first)
3. Engine instance pooling
### Phase 3: Analysis Service
1. EngineService with getEngine() method
2. Task queuing and scheduling
3. Resource utilization enforcement
### Phase 4: REST API
1. Server management endpoints
2. Analysis task submission
3. Monitoring and metrics
## Key Design Principles
1. Separation of Concerns : Clear boundaries between server management, engine control, and analysis tasks
2. Resource Efficiency : Smart pooling and reuse of connections and engine instances
3. Scalability : Support for multiple servers and engine types
4. Configurability : JSON config + REST API for dynamic management
5. Reliability : Connection health monitoring and automatic recovery

This architecture provides a solid foundation for building a scalable chess engine analysis system that efficiently manages remote resources while maintaining optimal performance through intelligent engine instance reuse.