# Cloud Engine Analysis

A server for managing chess analysis tasks, from simple position analysis to
deeper iterative and forwards/backwards analysis of a given position.

The output could be a simple EPD (Extended Position Description) string,
or a chess tree.

## Getting Started

### Prerequisites

- Node.js (v20.18.1 or higher)
- Yarn package manager

### Installation

```bash
yarn install
```

### Development

```bash
# Build the project
yarn build

# Start the server
yarn dev

# Or use start command
yarn start
```

### Code Quality

```bash
# Run ESLint
yarn lint

# Fix ESLint issues
yarn lint:fix

# Format code with Prettier
yarn format
```

## API Endpoints

The server runs on `http://localhost:3001` by default.

## Project Structure

```
cloud-engine-analysis/
├── src/
│   ├── app/              # The http API routes and controllers
│   ├── core/             # The core application
│   │   ├── analysis-store/   # Database and storage management
│   │   ├── engine/           # Chess engine integration
│   │   ├── graph/            # Chess graph data structures
│   │   ├── tasks/            # Analysis task implementations
│   │   ├── utils/            # Utility functions and helpers
│   │   ├── types.ts          # Core type definitions
│   │   └── index.ts          # Core module exports
│   └── server.ts         # Main server file
├── examples/             # Example usage and demos
│   ├── analysis/         # Analysis task examples
│   ├── analysis-store/   # Database usage examples
│   ├── chess-graph/      # Graph manipulation examples
│   └── engines/          # Engine integration examples
├── scripts/              # Utility scripts
│   ├── import-epd.ts     # EPD file import script
│   ├── print-graph.ts    # Graph visualization script
│   └── pv-explorer.ts    # Primary variation exploration script
└── docs/                 # Documentation files
```

## Scripts

### EPD Import Script

The `import-epd.ts` script allows you to import EPD (Extended Position Description) files into the Analysis Store database.

#### Usage

```bash
npx tsx scripts/import-epd.ts <epd-file> <database-file> [options]
```

#### Arguments

- `epd-file`: Path to the EPD file to import
- `database-file`: Path to the SQLite database file (created if it doesn't exist)

#### Options

- `--engine <slug>`: Engine identifier (default: `epd-import-1.0`)
- `--verbose`: Enable verbose output

#### Examples

```bash
# Import EPD file with default engine slug
npx tsx scripts/import-epd.ts ./tmp/positions.epd ./data/analysis.db

# Import with custom engine identifier
npx tsx scripts/import-epd.ts ./tmp/positions.epd ./data/analysis.db --engine stockfish-17.0

# Import with verbose output
npx tsx scripts/import-epd.ts ./tmp/positions.epd ./data/analysis.db --engine stockfish-17.0 --verbose
```

#### EPD Format

The script expects EPD files where each line contains:
- FEN position
- Analysis data including centipawn evaluation (`ce`), depth (`acd`), time (`acn`), nodes (`an`), and principal variation (`pv`)

Example EPD line:
```
rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ce 20 acd 15 acn 1000 an 50000 pv e2e4 e7e5
```

#### Features

- **Robust parsing**: Handles various FEN formats and analysis data
- **Database integration**: Uses existing Analysis Store infrastructure
- **Progress reporting**: Shows import progress every 100 positions
- **Statistics**: Displays comprehensive import statistics
- **Error handling**: Skips malformed lines and continues processing

### Primary Variation Explorer Script

The `pv-explorer.ts` script explores primary variations from a given chess position, creating a comprehensive analysis tree and saving both graph and database files.

#### Usage

```bash
npx tsx scripts/pv-explorer.ts <rootFen> <projectName>
```

#### Arguments

- `rootFen`: The starting FEN position (mandatory)
- `projectName`: Name for the project (used for directory and filenames)

#### Examples

```bash
# Explore from starting position
npx tsx scripts/pv-explorer.ts "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" "starting-position"

# Explore from King's Pawn opening
npx tsx scripts/pv-explorer.ts "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1" "Kings Pawn Opening"
```

#### Output

The script creates a timestamped project directory in `tmp/pv-projects/` containing:
- `graph.json`: Chess move tree in JSON format
- `analysis.db`: SQLite database with detailed analysis data

#### Features

- **Organized output**: Creates date-prefixed, slugified project directories
- **Comprehensive analysis**: Explores primary variations to configurable depth
- **Dual storage**: Saves both graph and database formats
- **Progress tracking**: Reports analysis progress and statistics
- **Clean shutdown**: Properly disconnects engines and services

### Graph Printer Script

The `print-graph.ts` script loads and displays chess graphs from JSON files in a compact terminal format.

#### Usage

```bash
npx tsx scripts/print-graph.ts <graphPath>
```

#### Arguments

- `graphPath`: Path to the graph.json file to print

#### Examples

```bash
# Print a PV explorer project graph
npx tsx scripts/print-graph.ts tmp/pv-projects/2025-08-03-test-project/graph.json

# Print any graph file
npx tsx scripts/print-graph.ts tmp/graphs/sicilian-defense.json
```

#### Features

- **Compact display**: Shows chess moves in clean ASCII tree format
- **Error handling**: Proper error messages for missing or invalid files
- **Universal compatibility**: Works with any graph.json file from the system
- **Terminal optimized**: Designed for easy viewing in command-line environments

## Environment Variables

- `PORT`: Server port (default: 3001)

## License

MIT