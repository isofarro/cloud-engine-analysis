# Position Analysis Examples

This directory contains comprehensive examples demonstrating different types of chess position analysis using the cloud-engine-analysis library.

## Configuration

### Engine Configuration
All examples use a shared engine configuration file:
- **File**: `engine-config.json`
- **Purpose**: Centralized engine settings for consistency across examples
- **Contents**: Engine path, threads, hash size, and other UCI options

```json
{
  "enginePath": "/opt/homebrew/bin/stockfish",
  "name": "Stockfish",
  "version": "16",
  "config": {
    "threads": 2,
    "hash": 256
  }
}
```

## Examples

### 1. Quick Analysis (`quick-analysis.ts`)
**Purpose**: Demonstrates basic position analysis with a fixed depth limit.

- **Position**: Starting position
- **Method**: Fixed depth (10 plies)
- **Features**: Single principal variation
- **Use Case**: Quick evaluation of positions

```bash
npx tsx examples/analysis/quick-analysis.ts
```

### 2. Multi-PV Analysis (`multipv-analysis.ts`)
**Purpose**: Shows how to analyze multiple principal variations simultaneously.

- **Position**: Sicilian Defense (1.e4 c5)
- **Method**: Multiple principal variations (3 lines)
- **Features**: Comparative analysis of different continuations
- **Use Case**: Exploring alternative moves and plans

```bash
npx tsx examples/analysis/multipv-analysis.ts
```

### 3. Time-based Analysis (`time-based-analysis.ts`)
**Purpose**: Demonstrates analysis with time limits instead of depth limits.

- **Position**: Sicilian Defense (1.e4 c5)
- **Method**: Time-limited analysis (5 seconds)
- **Features**: Adaptive depth based on available time
- **Use Case**: Real-time analysis with time constraints

```bash
npx tsx examples/analysis/time-based-analysis.ts
```

### 4. Tactical Analysis (`tactical-analysis.ts`)
**Purpose**: Shows analysis of tactical positions with forced sequences.

- **Position**: Légal's Mate setup
- **Method**: Deep tactical search
- **Features**: Mate detection and forced sequence analysis
- **Use Case**: Solving tactical puzzles and finding combinations

```bash
npx tsx examples/analysis/tactical-analysis.ts
```

### 5. Comprehensive Analysis (`comprehensive-analysis.ts`)
**Purpose**: Runs all analysis types in sequence for comparison.

- **Positions**: Multiple test positions
- **Method**: All analysis types
- **Features**: Complete demonstration of library capabilities
- **Use Case**: Testing and validation

```bash
npx tsx examples/analysis/comprehensive-analysis.ts
```

## Key Concepts Demonstrated

### Analysis Configuration
- **Depth-based**: Fixed search depth for consistent results
- **Time-based**: Adaptive search within time constraints
- **Multi-PV**: Multiple principal variations for move comparison

### Position Types
- **Opening positions**: Strategic evaluation
- **Tactical positions**: Combination and mate detection
- **Complex positions**: Deep positional analysis

### Engine Management
- **Connection handling**: Proper engine initialization
- **Resource cleanup**: Disconnection after analysis
- **Error handling**: Graceful failure management

## Usage Patterns

### Basic Analysis
```typescript
const engine = new LocalChessEngine(engineConfig);
const task = new PositionAnalysisTask(engine, fen, config);
const result = await task.execute();
await engine.disconnect();
```

### Configuration Loading
```typescript
const configPath = path.join(__dirname, 'engine-config.json');
const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
```

### Result Processing
```typescript
console.log(`Depth: ${result.depth}`);
console.log(`Score: ${result.score.type} ${result.score.score}`);
console.log(`Best line: ${result.pvs[0]?.join(' ')}`);
```

## Requirements

- **Engine**: Stockfish or compatible UCI engine
- **Node.js**: Version 16 or higher
- **TypeScript**: For running .ts files directly

## Customization

To adapt these examples for your use case:

1. **Engine Path**: Update `engine-config.json` with your engine path
2. **Positions**: Replace FEN strings with your test positions
3. **Analysis Settings**: Adjust depth, time, and multiPV values
4. **Output Format**: Modify console output to suit your needs