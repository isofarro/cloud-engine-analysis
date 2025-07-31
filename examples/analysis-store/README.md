# Analysis Store Examples

This directory contains worked examples demonstrating how to use the analysis store system for chess engine analysis results.

## Examples

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates fundamental operations with the `AnalysisRepo` and `AnalysisUtils`:

- Setting up an in-memory SQLite database
- Storing single and multiple analysis results
- Retrieving engines, positions, and analysis data
- Querying with filters (depth, engine, time range)
- Finding the best analysis for a position
- Comparing evaluations and formatting output

**Key Features Shown:**
- Database initialization and schema creation
- CRUD operations for engines, positions, and analysis
- Performance-optimized batch operations
- Query filtering and sorting
- Evaluation comparison utilities

### 2. Graph Integration (`graph-integration.ts`)

Shows advanced integration between the analysis store, chess graph, and PV utilities:

- Multi-PV analysis integration
- Principal variation exploration
- Variation comparison across moves
- Game sequence analysis
- Performance statistics and monitoring

**Key Features Shown:**
- `ChessGraph` and `AnalysisStore` integration
- `PVUtils` for processing principal variations
- Move-by-move analysis tracking
- Batch processing of game sequences
- Statistical analysis of stored data

## Running the Examples

### Prerequisites

Make sure you have the required dependencies installed:

```bash
npm install sqlite3 chess.ts
```

### Running Basic Usage Example

```bash
# From the project root
npx ts-node examples/analysis-store/basic-usage.ts
```

### Running Graph Integration Example

```bash
# From the project root
npx ts-node examples/analysis-store/graph-integration.ts
```

## Example Output

### Basic Usage Output
```
=== Analysis Store Basic Usage Example ===

1. Setting up database and storing engines...
✓ Stored engines: stockfish-17.0, lc0-0.31.0

2. Storing analysis results...
✓ Stored analysis for starting position
✓ Stored analysis for Sicilian Defense

3. Retrieving and querying data...
✓ Found 2 engines in database
✓ Found 2 positions analyzed
✓ Found 2 analysis records

4. Querying with filters...
✓ High-depth analysis (depth >= 15): 1 results
✓ Stockfish analysis: 1 results

5. Finding best analysis and comparing evaluations...
✓ Best analysis for starting position: +0.15 at depth 20
✓ Comparison: +0.15 vs +0.25 = worse
```

### Graph Integration Output
```
=== Analysis Store + Chess Graph Integration Example ===

1. Analyzing tactical position with multiple PV lines...
✓ Multi-PV analysis integrated into graph and database

2. Exploring principal variation path...
✓ Principal variation: f3g5 d7d6 g5f7 e8f7 d1h5
Starting position: r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4
  1. f3g5 -> r1bqkb1r/pppp1ppp/2n5/4p1N1/2B1P3/3P4/PPP2PPP/RNBQK2R b KQkq - 5 4
     Eval: +0.85 (PV rank: 1)
  2. d7d6 -> r1bqkb1r/ppp2ppp/2np4/4p1N1/2B1P3/3P4/PPP2PPP/RNBQK2R w KQkq - 0 5

3. Comparing variations from the tactical position...
✓ Found 3 possible moves:
  f3g5: +0.85 (PV #1)
  f3e5: +0.65 (PV #2)
  d3d4: +0.45 (PV #3)
```

## Architecture Overview

The examples demonstrate a clean separation of concerns:

1. **`AnalysisRepo`**: Persistent storage layer using SQLite
2. **`ChessGraph`**: Pure graph structure for move relationships
3. **`AnalysisStore`**: In-memory lookup maps for analysis data
4. **`PVUtils`**: Utility functions for integrating PV data
5. **`AnalysisUtils`**: Helper functions for data transformation

## Performance Considerations

The examples showcase several performance optimizations:

- **Batch Operations**: Multiple analysis results stored in single transactions
- **Indexing**: Optimized database indexes for common queries
- **Caching**: In-memory caching for frequently accessed data
- **Lazy Loading**: Analysis data loaded on-demand
- **Memory Efficiency**: Separate storage prevents graph bloat

## Use Cases

These examples are relevant for:

- Chess engine analysis storage and retrieval
- Opening book preparation with engine evaluations
- Game analysis with multiple engine perspectives
- Position database creation and querying
- Training data preparation for chess AI
- Tournament preparation and analysis

## Next Steps

To extend these examples:

1. Add real engine integration (UCI protocol)
2. Implement analysis comparison across engines
3. Add time-based analysis tracking
4. Create analysis export/import functionality
5. Build web interface for analysis browsing