# Analysis Store

An SQL database to store engine analysis results.

## Supported Use Cases

The analysis store provides comprehensive functionality for managing chess engine analysis data:

### Core Storage Operations
- **Single Analysis Storage**: Store individual engine analysis results with position, evaluation, depth, and principal variation
- **Batch Analysis Storage**: Efficiently store multiple analysis results using transactions for optimal performance
- **Engine Management**: Track different chess engines with versioning (e.g., "stockfish-17.0")
- **Position Management**: Store and normalize chess positions using FEN notation

### Query and Retrieval
- **Flexible Analysis Queries**: Search analysis by position (FEN), engine, depth range, with pagination support
- **Best Analysis Retrieval**: Find the highest-depth analysis for any position, prioritizing depth then recency
- **Engine-Specific Lookups**: Retrieve analysis results for specific engine-position combinations
- **Filtered Searches**: Query analysis with multiple criteria (engine, depth range, time period)

### Analysis Comparison and Evaluation
- **Evaluation Comparison**: Compare positions using both centipawn and mate scores with proper precedence
- **Best Move Identification**: Extract the best move and principal variation from stored analysis
- **Score Formatting**: Display evaluations in human-readable format (+2.50, +M5, etc.)
- **Multi-Engine Comparison**: Compare analysis results from different engines for the same position

### Performance and Maintenance
- **Caching System**: In-memory caching for engines, positions, and analysis for fast repeated access
- **Database Statistics**: Track total positions, engines, analyses, and average analysis depth
- **Cleanup Operations**: Remove old analysis data while optionally preserving best-depth results
- **Batch Operations**: Optimized bulk operations using database transactions

### Integration Capabilities
- **Graph Integration**: Connect analysis results with chess move graphs for game tree analysis
- **Principal Variation Tracking**: Store and retrieve complete PV lines for tactical analysis
- **Multi-PV Support**: Handle multiple principal variations from engine analysis
- **FEN Normalization**: Consistent position storage regardless of move counters

### Data Validation and Utilities
- **FEN Validation**: Verify chess position format before storage
- **Engine Slug Parsing**: Extract engine name and version from standardized slugs
- **Score Type Handling**: Manage both centipawn and mate score types consistently
- **Time and Node Tracking**: Store performance metrics (time, nodes, nps) for analysis comparison

## Database Schema

## Table: engines

This stores the engines that have been used for analysis.

* id - primary key
* slug - engine slug (made from engine name and version e.g. `stockfish-17.0`)
* name - engine name
* version - engine version

## Table: positions

* id - primary key
* fen - a normalised FEN of the position. This is the key.

## Table: analysis

This stores the analysis results.

* id - primary key
* position_id - foreign key to positions.id
* engine_id - foreign key to engine.id
* depth - depth of analysis
* time - time taken for analysis
* nodes - number of nodes searched
* nps - nodes per second, an estimate of the engine's performance
* score_type - the type of score `cp` or `mate`
* score - score of the position
* pv - principal variation

Supplementary indexes:

* Composite index: position_id, engine_id - unique.

