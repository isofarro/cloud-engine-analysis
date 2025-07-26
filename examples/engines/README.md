# Chess Engine Examples

This directory contains practical examples demonstrating how to use the Chess Engine system. Each example showcases different usage patterns and capabilities.

## Setup

Before running any examples, you need to configure your engines:

1. **Copy the configuration template:**
   ```bash
   cp engine-config.example.json engine-config.json
   ```

2. **Edit `engine-config.json`** to match your setup:
   - Update `enginePath` for local engines (e.g., `/usr/local/bin/stockfish`)
   - Configure remote engine connection details if needed
   - Adjust thread counts and memory allocation

## Examples

### 1. Engine Service Example (`engine-service.ts`)

**What it demonstrates:**
- Using `EngineService` to manage multiple engines
- Engine registration and health monitoring
- Multi-PV analysis and quick move evaluation
- Proper resource cleanup

**Run it:**
```bash
npx tsx examples/engines/engine-service.ts
```

### 2. Local Engine Example (`local-engine.ts`)

**What it demonstrates:**
- Direct usage of `LocalChessEngine`
- Position analysis with different time/depth controls
- Engine information retrieval
- Error handling for missing engine binaries

**Run it:**
```bash
npx tsx examples/engines/local-engine.ts
```

### 3. Remote Engine Example (`remote-engine.ts`)

**What it demonstrates:**
- SSH connection to remote chess engines
- Connection testing and reliability features
- Performance comparison and health checks
- Comprehensive error handling for network issues

**Prerequisites:**
- SSH access to a remote server with a chess engine
- SSH key authentication configured
- Remote engine binary accessible

**Run it:**
```bash
npx tsx examples/engines/remote-engine.ts
```

## Running Multiple Examples

Use the index file to run examples:

```bash
# Run specific example
npx tsx examples/engines/index.ts service
npx tsx examples/engines/index.ts local
npx tsx examples/engines/index.ts remote

# Run safe examples (local only)
npx tsx examples/engines/index.ts

# Run all examples (including remote)
npx tsx examples/engines/index.ts all
```

## Configuration Reference

### Local Engine Configuration
```json
{
  "id": "stockfish-local",
  "name": "Stockfish Local",
  "type": "local",
  "config": {
    "enginePath": "/usr/local/bin/stockfish",
    "config": {
      "threads": 2,
      "hash": 256
    }
  }
}
```

### Remote Engine Configuration
```json
{
  "id": "stockfish-remote",
  "name": "Stockfish Remote",
  "type": "remote",
  "config": {
    "host": "user@server.example.com",
    "enginePath": "/usr/local/bin/stockfish",
    "config": {
      "threads": 8,
      "hash": 1024
    }
  }
}
```

## Common Issues

### Engine Binary Not Found
```
Error: spawn stockfish ENOENT
```

**Solutions:**
- Install Stockfish: `brew install stockfish` (macOS) or `apt-get install stockfish` (Ubuntu)
- Use absolute path in configuration: `"/usr/local/bin/stockfish"`
- Verify engine exists: `which stockfish`

### SSH Connection Issues
```
Error: Connection refused
```

**Solutions:**
- Test SSH manually: `ssh user@hostname`
- Check SSH key authentication: `ssh-add -l`
- Verify remote engine path: `ssh user@hostname 'which stockfish'`

### Permission Issues
```
Error: Permission denied
```

**Solutions:**
- Make engine binary executable: `chmod +x /path/to/engine`
- Check file ownership and permissions
- Run with appropriate user privileges

## Performance Tips

1. **Local Engines:**
   - Use appropriate thread count (usually CPU cores - 1)
   - Allocate sufficient hash memory (256MB-2GB)
   - Consider SSD storage for engine binaries

2. **Remote Engines:**
   - Use persistent SSH connections
   - Configure appropriate timeout values
   - Monitor network latency impact

3. **Analysis Settings:**
   - Use depth-based analysis for consistent results
   - Use time-based analysis for real-time applications
   - Enable multi-PV for exploring alternatives

## Next Steps

- Explore the [API Reference](../../docs/05-api-reference.md)
- Read about [UCI Chess Engines](../../docs/02-uci-chess-engines.md)
- Learn about [Server Resources](../../docs/03-server-resources.md)
- Check out [Analysis Tasks](../../docs/04-simple-analysis-tasks.md)