# API Reference

## Core Classes

### ChessEngine (Abstract Base Class)

Base class for all chess engine implementations.

#### Methods

##### `connect(): Promise<void>`
Establishes connection to the chess engine.

##### `disconnect(): Promise<void>`
Closes connection to the chess engine.

##### `isConnected(): boolean`
Returns true if engine is currently connected.

##### `getStatus(): EngineStatus`
Returns current engine status: 'idle' | 'analyzing' | 'error' | 'disconnected'.

##### `analyzePosition(fen: string, options: UciAnalysisOptions): Promise<AnalysisResult>`
Performs comprehensive position analysis.

**Parameters:**
- `fen`: Position in FEN notation
- `options`: Analysis configuration

**Returns:** Complete analysis with best move, evaluation, and principal variations.

##### `getBestMove(fen: string, depthOrOptions: number | UciAnalysisOptions): Promise<string>`
Quickly calculates the best move for a position.

**Parameters:**
- `fen`: Position in FEN notation
- `depthOrOptions`: Search depth (number) or analysis options (object)

**Returns:** Best move in algebraic notation.

##### `getEngineInfo(): Promise<EngineInfo>`
Retrieves engine information and capabilities.

##### `healthCheck(): Promise<boolean>`
Performs engine health check using UCI 'isready' command.

#### Events

ChessEngine extends EventEmitter and emits the following events:

- `'line'`: Raw UCI output line
- `'info'`: Parsed UCI info messages
- `'bestmove'`: Best move results
- `'ready'`: Engine ready state
- `'error'`: Error events
- `'disconnect'`: Disconnection events

---

### LocalChessEngine

Manages local chess engine processes.

#### Constructor

```typescript
new LocalChessEngine(config: LocalEngineConfig)
```

**Parameters:**
- `config.enginePath`: Path to engine binary
- `config.config`: Optional UCI configuration

#### Additional Methods

##### `getEnginePath(): string`
Returns the path to the engine binary.

---

### RemoteChessEngine

Manages chess engines over SSH connections.

#### Constructor

```typescript
new RemoteChessEngine(config: RemoteEngineConfig)
```

**Parameters:**
- `config.host`: SSH connection string (user@host)
- `config.enginePath`: Remote path to engine binary
- `config.config`: Optional UCI configuration

#### Additional Methods

##### `getHost(): string`
Returns the SSH host connection string.

##### `testConnection(): Promise<boolean>`
Tests SSH connection without starting the engine.

##### `setMaxConnectionAttempts(attempts: number): void`
Configures maximum reconnection attempts.

##### `setReconnectDelay(delay: number): void`
Configures delay between reconnection attempts (milliseconds).

---

### EngineService

Service layer for managing multiple chess engine instances.

#### Constructor

```typescript
new EngineService(config?: EngineServiceConfig)
```

**Parameters:**
- `config.defaultEngineConfig`: Default UCI options for all engines
- `config.maxEngines`: Maximum concurrent engines (default: 10)
- `config.healthCheckInterval`: Health check frequency in ms (default: 30000)

#### Engine Management

##### `registerEngine(definition: EngineDefinition): void`
Registers an engine definition for later instantiation.

##### `unregisterEngine(engineId: string): void`
Removes engine definition and disconnects any active instance.

##### `getRegisteredEngines(): EngineDefinition[]`
Returns all registered engine definitions.

##### `getEngine(engineId: string): Promise<ChessEngine>`
Returns engine instance, creating and connecting if necessary.

#### Instance Management

##### `disconnectEngine(engineId: string): Promise<void>`
Disconnects specific engine instance.

##### `disconnectAllEngines(): Promise<void>`
Disconnects all active engine instances.

##### `shutdown(): Promise<void>`
Shuts down service, disconnects all engines, and stops health checks.

#### Monitoring

##### `getActiveEngines(): Array<{id: string, status: string, type: string}>`
Returns status of all active engine instances.

##### `getEngineHealth(engineId: string): Promise<boolean>`
Checks health of specific engine instance.

##### `updateConfig(config: Partial<EngineServiceConfig>): void`
Updates service configuration.

---

### UciClient

Low-level UCI protocol client.

#### Constructor

```typescript
new UciClient()
```

#### Methods

##### `connect(process: ChildProcess | any): void`
Connects to engine process or stream.

##### `disconnect(): Promise<void>`
Disconnects from engine.

##### `sendCommand(command: string): void`
Sends UCI command to engine.

##### `waitForReady(): Promise<void>`
Waits for engine to respond with 'readyok'.

##### `setOption(name: string, value: string | number): void`
Sets UCI option.

##### `newGame(): void`
Sends 'ucinewgame' command.

##### `position(fen: string): void`
Sets position using FEN notation.

##### `go(options: UciAnalysisOptions): void`
Starts analysis with specified options.

##### `stop(): void`
Stops current analysis.

##### `quit(): void`
Sends quit command to engine.

---

## Type Definitions

### Configuration Types

```typescript
type LocalEngineConfig = {
    enginePath: string;
    config?: Partial<EngineConfig>;
};

type RemoteEngineConfig = {
    host: string;
    enginePath: string;
    config?: Partial<EngineConfig>;
};

type EngineConfig = {
    threads: number;
    hash: number;
    [key: string]: string | number;
};

type EngineServiceConfig = {
    defaultEngineConfig?: Partial<EngineConfig>;
    maxEngines?: number;
    healthCheckInterval?: number;
};

type EngineDefinition = {
    id: string;
    name: string;
    type: 'local' | 'remote';
    config: LocalEngineConfig | RemoteEngineConfig;
};
```

### Analysis Types

```typescript
type UciAnalysisOptions = {
    position: string;  // FEN string
    time?: number;     // Time limit in seconds
    depth?: number;    // Search depth
    multiPV?: number;  // Number of principal variations
};

type AnalysisResult = {
    bestMove: string;
    evaluation: number;
    depth: number;
    lines: AnalysisLine[];
};

type AnalysisLine = {
    moves: string[];
    evaluation: number;
    depth: number;
};

type AnalysisConfig = {
    depth?: number;
    time?: number;
    multiPV?: number;
};
```

### Engine Information

```typescript
type EngineInfo = {
    name: string;
    author: string;
    version?: string;
    options: Record<string, any>;
};

type EngineStatus = 'idle' | 'analyzing' | 'error' | 'disconnected';
```

### UCI Protocol Types

```typescript
type UciScore = {
    type: 'cp' | 'mate';
    score: number;
};

type UciMove = string;

type UciInfoPV = {
    depth: number;
    selDepth: number;
    multiPV: number;
    score: UciScore;
    pv: UciMove[];
    time: number;
    nodes: number;
    nps: number;
    tbhits: number;
    hashfull: number;
};

type UciBestMove = {
    bestMove: UciMove;
    ponder?: UciMove;
};

type UciOutput = UciInfoPV | UciBestMove | UciInfoString;
```

## Utility Functions

### parseUciString

```typescript
function parseUciString(line: string): UciOutput | null
```

Parses UCI output strings into structured objects.

**Parameters:**
- `line`: Raw UCI output line

**Returns:** Parsed UCI object or null if not parseable.

## Error Handling

### Common Error Types

- **Connection Errors**: Network or process connection failures
- **UCI Protocol Errors**: Invalid UCI commands or responses
- **Analysis Errors**: Engine analysis failures or timeouts
- **Configuration Errors**: Invalid engine paths or options

### Error Handling Patterns

```typescript
try {
    const engine = await service.getEngine('my-engine');
    const result = await engine.analyzePosition(fen, options);
} catch (error) {
    if (error.message.includes('not registered')) {
        // Handle unregistered engine
    } else if (error.message.includes('connection')) {
        // Handle connection issues
    } else {
        // Handle other errors
    }
}
```

## Performance Considerations

### Memory Usage
- Hash table size directly affects memory usage
- Larger hash tables improve analysis quality but use more RAM
- Typical values: 64-256MB for development, 512-4096MB for production

### CPU Usage
- Thread count should match available CPU cores
- More threads improve analysis speed but increase CPU usage
- Consider system load when setting thread counts

### Connection Management
- Reuse engine instances when possible
- Remote engines have connection overhead
- Health checks help detect failed connections

### Analysis Optimization
- Use appropriate time/depth limits for your use case
- Multi-PV analysis is more expensive than single-line analysis
- Hash table persistence improves performance for related positions