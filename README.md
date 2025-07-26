# Cloud Engine Analysis

A Node.js server project built with TypeScript and Restify.

## Features

- **TypeScript**: Full TypeScript support with strict type checking
- **Restify**: Lightweight HTTP server framework
- **ESLint**: Code linting with TypeScript support
- **Prettier**: Code formatting
- **Yarn**: Package management

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
│   └── server.ts          # Main server file
├── dist/                  # Compiled JavaScript files
├── .prettierrc           # Prettier configuration
├── eslint.config.js      # ESLint configuration
├── tsconfig.json         # TypeScript configuration
├── package.json          # Project dependencies and scripts
└── README.md             # This file
```

## Environment Variables

- `PORT`: Server port (default: 3001)

## License

MIT