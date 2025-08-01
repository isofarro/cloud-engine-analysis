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

### Available Endpoints

- `GET /` - Welcome message with available endpoints
- `GET /hello` - Hello World endpoint
- `GET /health` - Health check endpoint

### Example Responses

**GET /hello**
```json
{
  "message": "Hello, World!"
}
```

**GET /health**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

**GET /**
```json
{
  "message": "Welcome to Cloud Engine Analysis API",
  "endpoints": {
    "hello": "/hello",
    "health": "/health"
  }
}
```

## Project Structure

```
cloud-engine-analysis/
├── src/
│   ├── app               # The http API routes and controllers
│   ├── core              # The core application
│   └── server.ts         # Main server file
├── dist/                 # Compiled JavaScript files
├── .prettierrc           # Prettier configuration
├── eslint.config.js      # ESLint configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Project dependencies and scripts
└── README.md             # This file
```

## Scripts

### EPD Import Script

The `import-epd.ts` script allows you to import EPD (Extended Position Description) files into the Analysis Store database.

#### Usage

```bash
npx tsx scripts/import-epd.ts <epd-file> <database-file> [engine-slug]
```

#### Arguments

- `epd-file`: Path to the EPD file to import
- `database-file`: Path to the SQLite database file (created if it doesn't exist)
- `engine-slug`: Optional engine identifier (default: `epd-import-1.0`)

#### Examples

```bash
# Import EPD file with default engine slug
npx tsx scripts/import-epd.ts ./tmp/positions.epd ./data/analysis.db

# Import with custom engine identifier
npx tsx scripts/import-epd.ts ./tmp/positions.epd ./data/analysis.db stockfish-17.0
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

## Environment Variables

- `PORT`: Server port (default: 3001)

## License

MIT