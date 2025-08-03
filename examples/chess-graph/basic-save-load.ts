#!/usr/bin/env npx tsx

/**
 * Basic Chess Graph Save/Load Example
 *
 * This example demonstrates:
 * - Creating a simple chess graph
 * - Saving it to a file
 * - Loading it back from the file
 * - Verifying the data integrity
 */

import { ChessGraph } from '../../src/core/graph/ChessGraph';
import { saveGraph, loadGraph } from '../../src/core/utils/graph';

function basicSaveLoadExample() {
  console.log('🚀 Basic Chess Graph Save/Load Example\n');

  // Create a new chess graph starting from the initial position
  const startingFen =
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const graph = new ChessGraph(startingFen);

  console.log('📊 Creating a simple chess graph...');
  console.log(`   Root position: ${graph.rootPosition}`);

  // Add a few opening moves
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const afterE5 =
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

  // Add the moves: 1.e4 e5
  graph.addMove(startingFen, { move: 'e2e4', toFen: afterE4 }, true);
  graph.addMove(afterE4, { move: 'e7e5', toFen: afterE5 });

  // Add an alternative first move: 1.d4
  graph.addMove(startingFen, {
    move: 'd2d4',
    toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
  });

  console.log(`   Added ${Object.keys(graph.nodes).length} positions`);

  const startNode = graph.findPosition(startingFen);
  console.log(
    `   Moves from start: ${startNode?.moves.map(m => m.move).join(', ')}`
  );

  // Save the graph
  console.log('\n💾 Saving graph to file...');
  const savedPath = saveGraph(graph, 'basic-example.json', './tmp/graphs');
  console.log(`   ✅ Saved to: ${savedPath}`);

  // Load the graph back
  console.log('\n📂 Loading graph from file...');
  const loadedGraph = loadGraph(savedPath);
  console.log(`   ✅ Loaded successfully`);

  // Verify the loaded graph
  console.log('\n🔍 Verifying loaded graph...');
  console.log(
    `   Root position matches: ${loadedGraph.rootPosition === graph.rootPosition}`
  );
  console.log(
    `   Position count matches: ${Object.keys(loadedGraph.nodes).length === Object.keys(graph.nodes).length}`
  );

  const loadedStartNode = loadedGraph.findPosition(startingFen);
  const originalMoves = startNode?.moves.map(m => `${m.move}:${m.seq}`).sort();
  const loadedMoves = loadedStartNode?.moves
    .map(m => `${m.move}:${m.seq}`)
    .sort();
  const movesMatch =
    JSON.stringify(originalMoves) === JSON.stringify(loadedMoves);

  console.log(`   Moves match: ${movesMatch}`);
  console.log(
    `   Primary move preserved: ${loadedStartNode?.moves[0].move === 'e2e4'}`
  );

  if (movesMatch && loadedGraph.rootPosition === graph.rootPosition) {
    console.log('\n✅ Success! Graph was saved and loaded correctly.');
  } else {
    console.log('\n❌ Error! Graph data was not preserved correctly.');
  }

  console.log('\n🎉 Basic example completed!');
}

// Run the example
basicSaveLoadExample();
