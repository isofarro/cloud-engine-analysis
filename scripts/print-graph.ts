#!/usr/bin/env tsx

import { fileURLToPath } from 'url';
import { loadGraph, printGraph } from '../src/core/utils/graph';

const __filename = fileURLToPath(import.meta.url);

/**
 * Parse command line arguments
 */
function parseArgs(): { graphPath: string } {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: tsx scripts/print-graph.ts <graphPath>');
    console.error('');
    console.error('Arguments:');
    console.error('  graphPath - Path to the graph.json file to print');
    console.error('');
    console.error('Example:');
    console.error('  tsx scripts/print-graph.ts tmp/pv-projects/2025-08-03-test-project/graph.json');
    console.error('  tsx scripts/print-graph.ts tmp/graphs/sicilian-defense.json');
    process.exit(1);
  }

  return {
    graphPath: args[0]
  };
}

/**
 * Main function to load and print the graph
 */
async function main() {
  try {
    const { graphPath } = parseArgs();

    console.log('=== Chess Graph Printer ===');
    console.log(`Graph File: ${graphPath}`);
    console.log('');

    // Load the graph from file
    console.log('📂 Loading graph from file...');
    const graph = loadGraph(graphPath);
    console.log('✅ Graph loaded successfully!');
    console.log('');

    // Print the graph in compact mode (default)
    printGraph(graph);

  } catch (error) {
    console.error('❌ Error loading or printing graph:', error);
    process.exit(1);
  }
}

// Run the script
main();