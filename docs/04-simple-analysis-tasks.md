# Analysis Tasks and Usage Patterns

## Overview

The chess engine system supports various types of analysis tasks, from quick best move calculations to deep positional analysis. All analysis is performed on chess positions specified in FEN (Forsyth-Edwards Notation) format.

## Analysis Types

### Quick Best Move Analysis
For rapid move suggestions with minimal computational overhead:

```typescript
// Get best move with depth limit
const bestMove = await engine.getBestMove(fenPosition, 10);

// Get best move with time limit (5 seconds)
const bestMove = await engine.getBestMove(fenPosition, { time: 5 });
```

### Full Position Analysis
For comprehensive analysis with multiple variations:

```typescript
const analysis = await engine.analyzePosition(fenPosition, {
    depth: 18,        // Search depth
    multiPV: 3,       // Analyze top 3 moves
    time: 30          // Time limit in seconds
});

console.log(`Best move: ${analysis.bestMove}`);
console.log(`Evaluation: ${analysis.evaluation} centipawns`);
console.log(`Principal variations: ${analysis.lines.length}`);
```

### Multi-PV Analysis
Analyze multiple candidate moves simultaneously:

```typescript
const analysis = await engine.analyzePosition(fenPosition, {
    multiPV: 5,       // Top 5 candidate moves
    depth: 15
});

// Each line contains: moves, evaluation, depth
analysis.lines.forEach((line, index) => {
    console.log(`${index + 1}. ${line.moves[0]} (${line.evaluation}cp)`);
});
```

## Analysis Configuration

### Time-based Analysis
Suitable for real-time applications:

```typescript
const quickAnalysis = await engine.analyzePosition(fen, { time: 5 });
const deepAnalysis = await engine.analyzePosition(fen, { time: 60 });
```

### Depth-based Analysis
Suitable for consistent analysis quality:

```typescript
const shallowAnalysis = await engine.analyzePosition(fen, { depth: 12 });
const deepAnalysis = await engine.analyzePosition(fen, { depth: 20 });
```

### Hybrid Analysis
Combine time and depth limits:

```typescript
const analysis = await engine.analyzePosition(fen, {
    depth: 18,        // Maximum depth
    time: 30,         // Maximum time
    multiPV: 3        // Top 3 variations
});
```

## Performance Considerations

### Engine Selection
- **Local engines**: Best for development, testing, and single-user scenarios
- **Remote engines**: Best for production, high-performance analysis, and distributed computing

### Resource Allocation
```typescript
// High-performance configuration
const engineConfig = {
    threads: 8,       // Use 8 CPU cores
    hash: 2048,       // 2GB hash table
};

// Memory-efficient configuration
const lightConfig = {
    threads: 2,       // Use 2 CPU cores
    hash: 256,        // 256MB hash table
};
```

### Analysis Optimization
- Use the same engine instance for related positions to benefit from hash table persistence
- Configure appropriate thread and hash settings based on available hardware
- Use time limits for real-time applications, depth limits for consistent quality
- Enable multi-PV only when multiple candidate moves are needed

## Error Handling

```typescript
try {
    const analysis = await engine.analyzePosition(fen, { depth: 15 });
    // Process analysis results
} catch (error) {
    if (error.message.includes('Invalid FEN')) {
        console.error('Invalid position format');
    } else if (error.message.includes('Engine not connected')) {
        console.error('Engine connection lost');
        await engine.connect(); // Attempt reconnection
    } else {
        console.error('Analysis failed:', error.message);
    }
}
```

## Example: Complete Analysis Workflow

```typescript
import { EngineService } from './engine';

async function analyzeGame() {
    const service = new EngineService();
    
    // Register and get engine
    service.registerEngine({
        id: 'stockfish',
        name: 'Stockfish',
        type: 'local',
        config: { enginePath: '/usr/local/bin/stockfish' }
    });
    
    const engine = await service.getEngine('stockfish');
    
    // Analyze starting position
    const startPos = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const analysis = await engine.analyzePosition(startPos, {
        depth: 15,
        multiPV: 3
    });
    
    console.log('Opening analysis:', analysis);
    
    // Cleanup
    await service.shutdown();
}
```


