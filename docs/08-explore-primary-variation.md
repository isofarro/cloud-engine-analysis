# Explore Primary variation

This is forwards propagation of the PV of an analysis.

Starting with the current position fen we do a long analysis on that position. And we put the resulting PV moves into a new ChessGraph. The root position of that graph is the start position.

Then we step one move forward in the PV. We do a long analysis on that position. We add that resulting PV to the graph. We iterate by taking this move and repeating the process.

Lets set a depth limit to half the depth the analysis of the first position reached.

The resulting graph will be a tree with the root position as the start position. And the PV of the analysis as the path from the root to the leaf. And moves further down in the tree are better than the original PV line are added as primary variations, to show where improvements were found in the deeper analysis state.

The end result is that all moves within the set depth from the root position have been analysed, whether they were from the original PV, or from PVs of deeper analysis states.

The analysis is stored in an analysis-store database that's specific for the task. The ChessGraph is saved as a JSON file with a similar name to the analysis database.

The initial implementation we'll assume that we start from just the root position, and create the analysis db and chess graph based on that and the analysis returned. Later on we'll figure out how we can continue a previously unfinished analysis by loading the chess graph and analysis db, and continue the analysis from where we left off.

## Architectural Approach

### Core Components

**PrimaryVariationExplorerTask**
- Follows the same constructor pattern as `PositionAnalysisTask`
- Accepts engine instance (from EngineService), analysis config, and explorer config
- Manages analysis database and ChessGraph synchronization
- Controls exploration depth via `maxDepthRatio`

**Configuration Interfaces**
```typescript
interface PVExplorerConfig {
  rootPosition: FenString;
  maxDepthRatio: number; // 0.5 = half the initial analysis depth
  databasePath: string;
  graphPath: string;
}

class PrimaryVariationExplorerTask {
  constructor(
    private engine: ChessEngine,
    private analysisConfig: AnalysisConfig,
    private config: PVExplorerConfig
  ) {}
}
```

### Implementation Strategy

#### 1. Engine Management
- Use EngineService to obtain engine instances (following existing patterns)
- Reuse the same engine instance throughout the entire exploration
- Engine configuration loaded from `engine-config.json` via EngineService

#### 2. Full PV Integration
- Extract complete Principal Variation from each analysis result
- Add entire PV sequence to ChessGraph, not just the top move
- Each move in a deeper-analyzed PV becomes primary, demoting existing moves to alternatives
- Queue all positions in the PV for further analysis (within depth limits)

#### 3. Primary/Alternative Logic
- **Simplified Rule**: Deeper analysis always wins
- No score comparison needed - any move found in deeper analysis automatically becomes primary
- Existing primary moves are demoted to alternatives when better moves are found
- This creates a clear hierarchy based on analysis depth

#### 4. Synchronization Pattern
```typescript
// After each position analysis:
const analysisResult = await positionAnalysisTask.analysePosition(currentFen);
const pv = analysisResult.pvs[0]; // Get the principal variation

// Add the entire PV sequence to the graph
let currentPosition = currentFen;
for (const move of pv.split(' ')) {
  const nextPosition = applyMoveToFen(currentPosition, move);

  // Always add as primary - deeper analysis is always better
  graph.addMove(currentPosition, {
    move: move,
    toFen: nextPosition
  }, true); // true = primary, demotes existing primary to alternative

  currentPosition = nextPosition;

  // Queue the new position for analysis if within depth limit
  if (getDepthFromRoot(nextPosition) < maxDepth) {
    positionsToAnalyze.push(nextPosition);
  }
}

// Save graph after adding complete PV
saveGraph(graph, config.graphPath);

// Store analysis in database
await analysisRepo.createAnalysis(analysisData);
```

#### 5. Exploration Flow
1. **Initialization**: Analyze root position to determine max exploration depth
2. **Queue Management**: Maintain positions to analyze, starting with root
3. **Analysis Loop**: For each position within depth limit:
   - Analyze using consistent AnalysisConfig
   - Extract complete PV from results
   - Add entire PV sequence to ChessGraph
   - Queue all PV positions for further analysis
   - Save ChessGraph immediately after each update
   - Store analysis results in database
4. **Termination**: Continue until all positions within maxDepth are analyzed

### Key Design Decisions

1. **Engine Dependency Injection**: Engine instance passed in constructor, following PositionAnalysisTask pattern
2. **Complete PV Capture**: Entire principal variations preserved in graph, not just top moves
3. **Depth-Based Hierarchy**: Deeper analysis automatically wins, creating clear move hierarchy
4. **Immediate Synchronization**: ChessGraph saved after every position analysis
5. **Consistent Analysis**: Same engine instance and AnalysisConfig throughout exploration
6. **No Score Comparison**: Eliminates complexity - deeper analysis is always considered better

### Usage Pattern
```typescript
// Client code:
const engineService = new EngineService(serviceConfig);
const engine = await engineService.getEngine('stockfish-local');

const analysisConfig = { depth: 20, multiPV: 1 };
const pvConfig = {
  rootPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  maxDepthRatio: 0.5,
  databasePath: './analysis.db',
  graphPath: './graph.json'
};

const explorer = new PrimaryVariationExplorerTask(
  engine,
  analysisConfig,
  pvConfig
);

await explorer.explore();
```

### File Structure
```
src/core/tasks/
├── PrimaryVariationExplorerTask.ts
└── types/
    └── pv-explorer.ts
```

This approach ensures modularity, consistency with existing codebase patterns, and creates rich graph structures that capture complete analytical depth while maintaining clear hierarchies based on analysis depth.

