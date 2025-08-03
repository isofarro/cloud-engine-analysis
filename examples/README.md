# Examples

This directory contains practical examples demonstrating various features of the Cloud Engine Analysis system.

## Available Examples

### 🏗️ Analysis Examples (`analysis/`)
Demonstrates different types of chess position analysis:
- **basic-analysis.ts** - Simple position analysis
- **comprehensive-analysis.ts** - Deep analysis with multiple variations
- **multipv-analysis.ts** - Multi-PV (principal variation) analysis
- **quick-analysis.ts** - Fast analysis for rapid evaluation
- **reusable-analysis-demo.ts** - Reusing analysis results
- **tactical-analysis.ts** - Tactical position analysis
- **time-based-analysis.ts** - Analysis with time constraints

### 📊 Analysis Store Examples (`analysis-store/`)
Shows how to work with the analysis storage system:
- **basic-usage.ts** - Basic analysis store operations
- **graph-integration.ts** - Integration with chess graphs

### 🎮 Chess Graph Examples (`chess-graph/`)
Demonstrates saving and loading chess position graphs:
- **basic-save-load.ts** - Simple save and load operations
- **opening-tree.ts** - Complex opening trees with variations
- **graph-management.ts** - Managing multiple graph files
- **index.ts** - Interactive menu to run all examples

### 🔧 Engine Examples (`engines/`)
Shows how to work with chess engines:
- **engine-service.ts** - Engine service management
- **local-engine.ts** - Working with local engines
- **remote-engine.ts** - Remote engine integration
- **index.ts** - Engine examples index

## Quick Start

### Run All Chess Graph Examples
```bash
# Interactive menu
npx tsx examples/chess-graph/index.ts

# Run all examples
npx tsx examples/chess-graph/index.ts 0

# Run specific example
npx tsx examples/chess-graph/index.ts 1  # Basic save/load
npx tsx examples/chess-graph/index.ts 2  # Opening tree
npx tsx examples/chess-graph/index.ts 3  # Graph management
```

### Run Individual Examples
```bash
# Chess graph examples
npx tsx examples/chess-graph/basic-save-load.ts
npx tsx examples/chess-graph/opening-tree.ts
npx tsx examples/chess-graph/graph-management.ts

# Analysis examples
npx tsx examples/analysis/quick-analysis.ts
npx tsx examples/analysis/comprehensive-analysis.ts

# Engine examples
npx tsx examples/engines/local-engine.ts
```

## Prerequisites

Before running examples, ensure you have:

1. **Node.js** (v18 or later)
2. **Dependencies installed**: `npm install`
3. **Chess engine** (for analysis examples):
   - Copy `engine-config.example.json` to `engine-config.json`
   - Configure your engine path

## Example Output

Most examples include:
- 📊 **Visual output** with emojis and formatting
- ✅ **Success/failure indicators**
- 📈 **Statistics and metrics**
- 💡 **Tips and explanations**

## File Structure

```
examples/
├── README.md                    # This file
├── analysis/                    # Analysis examples
│   ├── README.md
│   └── *.ts
├── analysis-store/              # Storage examples
│   ├── README.md
│   └── *.ts
├── chess-graph/                 # Graph save/load examples
│   ├── README.md
│   ├── index.ts                 # Interactive menu
│   ├── basic-save-load.ts
│   ├── opening-tree.ts
│   └── graph-management.ts
└── engines/                     # Engine examples
    ├── README.md
    ├── index.ts
    └── *.ts
```

## Contributing

When adding new examples:
1. Create descriptive filenames
2. Include comprehensive comments
3. Add error handling
4. Update relevant README files
5. Test examples thoroughly

## Support

If you encounter issues running examples:
1. Check that all dependencies are installed
2. Verify engine configuration (for analysis examples)
3. Ensure you have proper file permissions
4. Check the console output for specific error messages