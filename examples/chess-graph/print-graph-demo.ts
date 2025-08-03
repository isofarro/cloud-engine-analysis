#!/usr/bin/env npx tsx

/**
 * Print Graph Demo
 *
 * This example demonstrates the printGraph function that renders
 * a chess graph as an ASCII tree structure in the terminal.
 */

import { ChessGraph } from '../../src/core/graph/ChessGraph';
import { printGraph } from '../../src/core/utils/graph';

function createSicilianDefenseTree(): ChessGraph {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const graph = new ChessGraph(startFen);

  // 1. e4
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  graph.addMove(startFen, { move: 'e4', toFen: afterE4 });

  // Alternative first moves
  const afterD4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';
  const afterNf3 = 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1';
  graph.addMove(startFen, { move: 'd4', toFen: afterD4 });
  graph.addMove(startFen, { move: 'Nf3', toFen: afterNf3 });

  // Sicilian Defense: 1...c5
  const afterC5 =
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
  graph.addMove(afterE4, { move: 'c5', toFen: afterC5 });

  // Other responses to 1.e4
  const afterE5 =
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
  const afterE6 =
    'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  graph.addMove(afterE4, { move: 'e5', toFen: afterE5 });
  graph.addMove(afterE4, { move: 'e6', toFen: afterE6 });

  // Sicilian variations: 2.Nf3
  const afterNf3Sicilian =
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
  graph.addMove(afterC5, { move: 'Nf3', toFen: afterNf3Sicilian });

  // 2.Nc3 (Closed Sicilian)
  const afterNc3 =
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2';
  graph.addMove(afterC5, { move: 'Nc3', toFen: afterNc3 });

  // Responses to 2.Nf3: 2...d6 (Najdorf setup)
  const afterD6 =
    'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
  graph.addMove(afterNf3Sicilian, { move: 'd6', toFen: afterD6 });

  // 2...Nc6 (Accelerated Dragon setup)
  const afterNc6 =
    'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  graph.addMove(afterNf3Sicilian, { move: 'Nc6', toFen: afterNc6 });

  return graph;
}

function createKingsIndianTree(): ChessGraph {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const graph = new ChessGraph(startFen);

  // 1.d4
  const afterD4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';
  graph.addMove(startFen, { move: 'd4', toFen: afterD4 });

  // 1...Nf6
  const afterNf6 =
    'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2';
  graph.addMove(afterD4, { move: 'Nf6', toFen: afterNf6 });

  // 2.c4
  const afterC4 =
    'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq c3 0 2';
  graph.addMove(afterNf6, { move: 'c4', toFen: afterC4 });

  // 2...g6 (King's Indian setup)
  const afterG6 =
    'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3';
  graph.addMove(afterC4, { move: 'g6', toFen: afterG6 });

  return graph;
}

function main() {
  console.log('🎯 Chess Graph ASCII Tree Visualization Demo\n');

  console.log('='.repeat(60));
  console.log('📋 Example 1: Sicilian Defense Opening Tree (Compact Mode)');
  console.log('='.repeat(60));
  const sicilianTree = createSicilianDefenseTree();
  printGraph(sicilianTree); // Default compact mode

  console.log('\n' + '='.repeat(60));
  console.log('📋 Example 2: Same Tree in Verbose Mode');
  console.log('='.repeat(60));
  printGraph(sicilianTree, 10, true); // Verbose mode

  console.log('\n' + '='.repeat(60));
  console.log("📋 Example 3: King's Indian Defense Setup (Compact)");
  console.log('='.repeat(60));
  const kingsIndianTree = createKingsIndianTree();
  printGraph(kingsIndianTree);

  console.log('\n' + '='.repeat(60));
  console.log('📋 Example 4: Limited Depth View (maxDepth=2)');
  console.log('='.repeat(60));
  printGraph(sicilianTree, 2);

  console.log('\n' + '='.repeat(60));
  console.log('📋 Example 5: Empty Graph');
  console.log('='.repeat(60));
  const emptyGraph = new ChessGraph();
  printGraph(emptyGraph);

  console.log('\n✅ Demo completed! The printGraph function shows:');
  console.log('   • Tree structure with ASCII pipe characters');
  console.log('   • Branching when multiple moves exist from a position');
  console.log('   • Move sequences with (main) and (2), (3), etc. indicators');
  console.log('   • Position information and move counts');
  console.log('   • Graph statistics summary');
  console.log('   • Depth limiting to prevent overwhelming output');
  console.log(
    '   • Compact mode (default) vs verbose mode with full FEN strings'
  );
}

// Run the demo if this file is executed directly
main();

export { createSicilianDefenseTree, createKingsIndianTree };
