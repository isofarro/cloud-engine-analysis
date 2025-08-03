# Chess Graph Examples

This directory contains examples demonstrating how to save and load ChessGraph objects to/from the filesystem.

## Examples

- **basic-save-load.ts** - Simple example showing basic save and load operations
- **opening-tree.ts** - Creating and persisting an opening tree with multiple variations
- **graph-management.ts** - Managing multiple graph files (list, delete, etc.)

## Running Examples

```bash
# Run individual examples
npx tsx examples/chess-graph/basic-save-load.ts
npx tsx examples/chess-graph/opening-tree.ts
npx tsx examples/chess-graph/graph-management.ts
```

## Key Features Demonstrated

- Serializing ChessGraph instances to JSON files
- Loading graphs back into memory with full structure preservation
- Managing graph files (listing, deleting)
- Working with complex opening trees
- Error handling and validation