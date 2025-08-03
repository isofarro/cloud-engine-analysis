# Scripts

This directory contains utility scripts for the Cloud Engine Analysis project.

## Available Scripts

### import-epd.ts

Imports EPD (Extended Position Description) file data into the Analysis Store database.

**Purpose:**
- Parse EPD files containing chess positions with engine analysis
- Store analysis results in the SQLite database for later retrieval
- Support bulk import of pre-analyzed positions

**Usage:**
```bash
npx tsx scripts/import-epd.ts <epd-file> <database-file> [options]
```

**Arguments:**
- `<epd-file>`: Path to the EPD file to import
- `<database-file>`: Path to the SQLite database file (created if not exists)

**Options:**
- `--engine <slug>`: Engine identifier (default: 'epd-import-1.0')
- `--verbose`: Enable verbose output for detailed logging
- `--version`: Display version information
- `--help`: Show usage information

**Examples:**
```bash
# Basic import
npx tsx scripts/import-epd.ts ./positions.epd ./analysis.db

# With custom engine identifier
npx tsx scripts/import-epd.ts ./positions.epd ./analysis.db --engine stockfish-17.0

# With verbose output
npx tsx scripts/import-epd.ts ./positions.epd ./analysis.db --engine stockfish-17.0 --verbose
```

**EPD Format Requirements:**
The EPD file should contain positions with the following operations:
- `ce`: Centipawn evaluation
- `acd`: Analysis depth
- `pv`: Principal variation (optional)

Example EPD line:
```
rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 ce -25; acd 15; pv e7e5 Ng1f3;
```

## Development

All scripts are written in TypeScript and can be executed using `tsx` or compiled with `tsc` first.

### Adding New Scripts

When adding new scripts:
1. Place them in this `scripts/` directory
2. Use TypeScript for type safety
3. Add proper error handling and user feedback
4. Update this README with documentation
5. Consider using commander.js for CLI argument parsing