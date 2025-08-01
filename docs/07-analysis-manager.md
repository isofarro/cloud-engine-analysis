# AnalysisManager

The `AnalysisManager` class is a comprehensive manager for analysis data operations and integration within the cloud-engine-analysis framework. It provides utilities for creating analysis storage, integrating analysis results with chess graphs, and extracting meaningful data from stored analyses.

## Overview

The `AnalysisManager` serves as the central coordinator for analysis-related operations, bridging the gap between raw engine analysis results and structured data storage. It simplifies complex operations like principal variation extraction, move analysis retrieval, and graph integration.

## Key Features

- **Analysis Store Creation**: Factory methods for creating in-memory analysis storage
- **Graph Integration**: Seamless integration of analysis results with chess position graphs
- **Principal Variation Processing**: Extraction and manipulation of engine principal variations
- **Move Analysis Retrieval**: Efficient querying of stored analysis data

## Core Methods

### `createAnalysisStore()`

Creates a new in-memory analysis store for storing and retrieving chess position analyses.

```typescript
import { AnalysisManager } from '@/core/analysis-store';

const store = AnalysisManager.createAnalysisStore();
```

### `addAnalysisResultToGraph(graph, result)`

Integrates analysis results into a chess graph structure, creating nodes and edges based on principal variations.

```typescript
import { ChessGraph } from '@/core/graph';
import { AnalysisManager } from '@/core/analysis-store';

const graph = new ChessGraph();
const analysisResult = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  depth: 20,
  multiPv: [
    {
      depth: 20,
      score: { type: 'cp', value: 25 },
      pv: ['e2e4', 'e7e5', 'g1f3']
    }
  ]
};

AnalysisManager.addAnalysisResultToGraph(graph, analysisResult);
```

### `getPrincipalVariationPath(store, startFen, moves)`

Extracts the principal variation path from stored analysis data, following a sequence of moves.

```typescript
const pvPath = AnalysisManager.getPrincipalVariationPath(
  store,
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  ['e2e4', 'e7e5']
);
```

### `getMoveAnalysis(store, fen, move)`

Retrieves analysis data for a specific move from a given position.

```typescript
const moveAnalysis = AnalysisManager.getMoveAnalysis(
  store,
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'e2e4'
);
```

## Typical Use Cases

### 1. Multi-PV Analysis Processing

When working with engine analysis that includes multiple principal variations, `AnalysisManager` helps organize and store this data efficiently.

```typescript
import { AnalysisManager } from '@/core/analysis-store';
import { ChessGraph } from '@/core/graph';

// Create storage and graph
const store = AnalysisManager.createAnalysisStore();
const graph = new ChessGraph();

// Process multi-PV analysis results
const analysisResults = [
  {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    depth: 20,
    multiPv: [
      {
        depth: 20,
        score: { type: 'cp', value: 25 },
        pv: ['e2e4', 'e7e5', 'g1f3']
      },
      {
        depth: 20,
        score: { type: 'cp', value: 15 },
        pv: ['d2d4', 'd7d5', 'c2c4']
      }
    ]
  }
];

// Store and integrate each result
analysisResults.forEach(result => {
  store.store(result.fen, result);
  AnalysisManager.addAnalysisResultToGraph(graph, result);
});
```

### 2. Principal Variation Exploration

Explore and analyze principal variations from stored analysis data.

```typescript
// Get the principal variation path for a sequence of moves
const pvPath = AnalysisManager.getPrincipalVariationPath(
  store,
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  ['e2e4', 'e7e5']
);

console.log('Principal Variation Path:', pvPath);
```

### 3. Move Evaluation and Comparison

Analyze and compare different moves from the same position.

```typescript
const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const moves = ['e2e4', 'd2d4', 'g1f3', 'c2c4'];

// Analyze each move
moves.forEach(move => {
  const analysis = AnalysisManager.getMoveAnalysis(store, startFen, move);
  if (analysis) {
    console.log(`Move ${move}:`, analysis.score);
  }
});
```

### 4. Database Integration

Combine `AnalysisManager` with database storage for persistent analysis data.

```typescript
import { Database } from 'better-sqlite3';
import { AnalysisManager } from '@/core/analysis-store';

// Create database and in-memory store
const db = new Database('analysis.db');
const store = AnalysisManager.createAnalysisStore();

// Load existing analysis from database
const existingAnalyses = db.prepare('SELECT * FROM analyses').all();
existingAnalyses.forEach(row => {
  const analysis = JSON.parse(row.analysis_data);
  store.store(row.fen, analysis);
});

// Process new analysis and save to both store and database
function processAndSaveAnalysis(analysisResult) {
  // Store in memory
  store.store(analysisResult.fen, analysisResult);
  
  // Save to database
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analyses (fen, analysis_data, created_at)
    VALUES (?, ?, datetime('now'))
  `);
  stmt.run(analysisResult.fen, JSON.stringify(analysisResult));
}
```

### 5. Performance Analysis and Statistics

Generate performance statistics and insights from stored analysis data.

```typescript
// Get all stored positions
const allPositions = store.getAllPositions();

// Calculate statistics
const stats = {
  totalPositions: allPositions.length,
  averageDepth: 0,
  totalVariations: 0
};

allPositions.forEach(fen => {
  const analysis = store.get(fen);
  if (analysis) {
    stats.averageDepth += analysis.depth;
    stats.totalVariations += analysis.multiPv?.length || 0;
  }
});

stats.averageDepth /= stats.totalPositions;

console.log('Analysis Statistics:', stats);
```

## Integration with Other Components

### ChessGraph Integration

The `AnalysisManager` works seamlessly with the `ChessGraph` class to create visual representations of analysis data:

```typescript
import { ChessGraph } from '@/core/graph';
import { AnalysisManager } from '@/core/analysis-store';

const graph = new ChessGraph();
const store = AnalysisManager.createAnalysisStore();

// Add analysis results to both store and graph
analysisResults.forEach(result => {
  store.store(result.fen, result);
  AnalysisManager.addAnalysisResultToGraph(graph, result);
});

// The graph now contains nodes and edges representing the analysis
console.log('Graph nodes:', graph.getNodes().length);
console.log('Graph edges:', graph.getEdges().length);
```

### AnalysisStore Interface

The `AnalysisManager` creates and works with `AnalysisStore` instances that implement a simple interface:

```typescript
interface AnalysisStore {
  store(fen: string, analysis: any): void;
  get(fen: string): any | undefined;
  has(fen: string): boolean;
  delete(fen: string): boolean;
  clear(): void;
  size(): number;
  getAllPositions(): string[];
}
```

## Best Practices

1. **Memory Management**: For large datasets, consider implementing periodic cleanup of old analysis data
2. **Error Handling**: Always check if analysis data exists before processing
3. **Performance**: Use batch operations when processing multiple analysis results
4. **Data Validation**: Validate analysis results before storing to ensure data integrity

## Examples

For complete working examples, see:
- `examples/analysis-store/basic-usage.ts` - Basic AnalysisStore operations
- `examples/analysis-store/graph-integration.ts` - Integration with ChessGraph
- `scripts/import-epd.ts` - Database integration example

The `AnalysisManager` class provides a powerful and flexible foundation for building sophisticated chess analysis applications with efficient data management and seamless component integration.