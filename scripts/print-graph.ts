#!/usr/bin/env tsx

import { fileURLToPath } from 'url';
import { Command } from 'commander';
import { loadGraph, printGraph } from '../src/core/utils/graph';

const __filename = fileURLToPath(import.meta.url);

/**
 * Parse command line arguments using Commander.js
 */
function parseArgs(): { graphPath: string; maxDepth?: number } {
  const program = new Command();

  program
    .name('print-graph')
    .description('Print a chess graph from a JSON file')
    .argument('<graphPath>', 'Path to the graph.json file to print')
    .option('--maxDepth <depth>', 'Maximum depth to print (default: 10)', (value) => parseInt(value, 10))
    .addHelpText('after', '\nExamples:\n  tsx scripts/print-graph.ts tmp/pv-projects/2025-08-03-test-project/graph.json\n  tsx scripts/print-graph.ts tmp/graphs/sicilian-defense.json --maxDepth 3')
    .parse();

  const options = program.opts();
  const args = program.args;

  return {
    graphPath: args[0],
    maxDepth: options.maxDepth
  };
}

/**
 * Main function to load and print the graph
 */
async function main() {
  try {
    const { graphPath, maxDepth } = parseArgs();

    console.log(`Graph File: ${graphPath}`);
    if (maxDepth !== undefined) {
      console.log(`Max Depth: ${maxDepth}`);
    }

    const graph = loadGraph(graphPath);

    // Print the graph in compact mode (default)
    printGraph(graph, maxDepth);

  } catch (error) {
    console.error('❌ Error loading or printing graph:', error);
    process.exit(1);
  }
}

// Run the script
main();