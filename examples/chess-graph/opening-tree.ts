#!/usr/bin/env npx tsx

/**
 * Opening Tree Example
 *
 * This example demonstrates:
 * - Building a complex opening tree with multiple variations
 * - Saving and loading larger graph structures
 * - Working with different opening systems
 */

import { ChessGraph } from '../../src/core/graph/ChessGraph';
import { saveGraph, loadGraph } from '../../src/core/utils/graph';

function buildSicilianDefense(): ChessGraph {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const graph = new ChessGraph(startFen);

  // 1.e4
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  graph.addMove(startFen, { move: 'e2e4', toFen: afterE4 }, true);

  // 1...c5 (Sicilian Defense)
  const afterC5 =
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
  graph.addMove(afterE4, { move: 'c7c5', toFen: afterC5 }, true);

  // Alternative responses to 1.e4
  const afterE5 =
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
  const afterE6 =
    'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  graph.addMove(afterE4, { move: 'e7e5', toFen: afterE5 });
  graph.addMove(afterE4, { move: 'e7e6', toFen: afterE6 });

  // 2.Nf3 (Open Sicilian)
  const afterNf3 =
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
  graph.addMove(afterC5, { move: 'Ng1f3', toFen: afterNf3 }, true);

  // Alternative second moves for White
  const afterNc3 =
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2';
  const afterBb5 =
    'rnbqkbnr/pp1ppppp/8/1Bp5/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2';
  graph.addMove(afterC5, { move: 'Nb1c3', toFen: afterNc3 });
  graph.addMove(afterC5, { move: 'Bf1b5', toFen: afterBb5 });

  // Black's responses to 2.Nf3
  const afterD6 =
    'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';
  const afterNc6 =
    'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  const afterG6 =
    'rnbqkbnr/pp1ppp1p/6p1/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3';

  graph.addMove(afterNf3, { move: 'd7d6', toFen: afterD6 }, true); // Najdorf setup
  graph.addMove(afterNf3, { move: 'Nb8c6', toFen: afterNc6 }); // Accelerated Dragon setup
  graph.addMove(afterNf3, { move: 'g7g6', toFen: afterG6 }); // Dragon setup

  // 3.d4 (main line)
  const afterD4 =
    'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq d3 0 3';
  graph.addMove(afterD6, { move: 'd2d4', toFen: afterD4 });

  // 3...cxd4
  const afterCxd4 =
    'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 0 4';
  graph.addMove(afterD4, { move: 'c5d4', toFen: afterCxd4 });

  // 4.Nxd4
  const afterNxd4 =
    'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R b KQkq - 0 4';
  graph.addMove(afterCxd4, { move: 'Nf3d4', toFen: afterNxd4 });

  return graph;
}

function openingTreeExample() {
  console.log('🚀 Opening Tree Save/Load Example\n');

  console.log('🏗️  Building Sicilian Defense opening tree...');
  const sicilianGraph = buildSicilianDefense();

  console.log(
    `   📊 Created graph with ${Object.keys(sicilianGraph.nodes).length} positions`
  );

  // Show the main line
  const startFen = sicilianGraph.rootPosition!;
  const startNode = sicilianGraph.findPosition(startFen);
  console.log(`   🎯 Main line from start: ${startNode?.moves[0].move}`);

  // Show variations
  console.log('   🌳 Opening variations:');
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const e4Node = sicilianGraph.findPosition(afterE4);
  e4Node?.moves.forEach((move, index) => {
    const marker = index === 0 ? '(main)' : '(alt)';
    console.log(`     - 1...${move.move} ${marker}`);
  });

  // Save the opening tree
  console.log('\n💾 Saving Sicilian Defense tree...');
  const savedPath = saveGraph(
    sicilianGraph,
    'sicilian-defense.json',
    './tmp/graphs'
  );
  console.log(`   ✅ Saved to: ${savedPath}`);

  // Load it back
  console.log('\n📂 Loading opening tree...');
  const loadedGraph = loadGraph(savedPath);
  console.log(
    `   ✅ Loaded ${Object.keys(loadedGraph.nodes).length} positions`
  );

  // Verify complex structure preservation
  console.log('\n🔍 Verifying opening tree structure...');

  // Check that main lines are preserved
  const loadedStartNode = loadedGraph.findPosition(startFen);
  const loadedE4Node = loadedGraph.findPosition(afterE4);

  const mainLinePreserved =
    loadedStartNode?.moves[0].move === 'e2e4' &&
    loadedE4Node?.moves[0].move === 'c7c5';

  console.log(`   🎯 Main line preserved: ${mainLinePreserved}`);
  console.log(
    `   📈 Position count matches: ${Object.keys(loadedGraph.nodes).length === Object.keys(sicilianGraph.nodes).length}`
  );

  // Check variation count
  const originalVariations = e4Node?.moves.length || 0;
  const loadedVariations = loadedE4Node?.moves.length || 0;
  console.log(
    `   🌿 Variations preserved: ${originalVariations}/${loadedVariations}`
  );

  // Show the loaded tree structure
  console.log('\n📋 Loaded opening tree structure:');
  console.log(
    `   Root: ${loadedGraph.rootPosition?.split(' ')[0]} (${loadedStartNode?.moves.length} moves)`
  );

  loadedStartNode?.moves.forEach(move => {
    const nextNode = loadedGraph.findPosition(move.toFen);
    console.log(
      `   ├─ ${move.move} → ${nextNode?.moves.length || 0} responses`
    );
  });

  if (mainLinePreserved && originalVariations === loadedVariations) {
    console.log('\n✅ Success! Opening tree structure preserved perfectly.');
  } else {
    console.log(
      '\n❌ Warning! Some opening tree data may not have been preserved.'
    );
  }

  console.log('\n🎉 Opening tree example completed!');
}

// Run the example
openingTreeExample();
