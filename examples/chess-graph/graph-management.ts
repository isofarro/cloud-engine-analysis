#!/usr/bin/env npx tsx

/**
 * Graph Management Example
 *
 * This example demonstrates:
 * - Managing multiple graph files
 * - Listing and organizing saved graphs
 * - Deleting and cleaning up graph files
 * - Working with different graph directories
 */

import { ChessGraph } from '../../src/core/graph/ChessGraph';
import {
  saveGraph,
  loadGraph,
  listGraphFiles,
  deleteGraph,
} from '../../src/core/utils/graph';
import * as path from 'path';

function createSampleGraphs(): string[] {
  const graphDir = './tmp/graph-examples';
  const savedPaths: string[] = [];

  // Create different types of chess graphs

  // 1. Empty graph
  const emptyGraph = new ChessGraph();
  savedPaths.push(saveGraph(emptyGraph, 'empty-graph.json', graphDir));

  // 2. Starting position only
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const startGraph = new ChessGraph(startFen);
  savedPaths.push(saveGraph(startGraph, 'starting-position.json', graphDir));

  // 3. King's Pawn opening
  const kingsGraph = new ChessGraph(startFen);
  const afterE4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const afterE5 =
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
  kingsGraph.addMove(startFen, { move: 'e2e4', toFen: afterE4 });
  kingsGraph.addMove(afterE4, { move: 'e7e5', toFen: afterE5 });
  savedPaths.push(saveGraph(kingsGraph, 'kings-pawn.json', graphDir));

  // 4. Queen's Pawn opening
  const queensGraph = new ChessGraph(startFen);
  const afterD4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';
  const afterD5 =
    'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq d6 0 2';
  queensGraph.addMove(startFen, { move: 'd2d4', toFen: afterD4 });
  queensGraph.addMove(afterD4, { move: 'd7d5', toFen: afterD5 });
  savedPaths.push(saveGraph(queensGraph, 'queens-pawn.json', graphDir));

  // 5. English Opening
  const englishGraph = new ChessGraph(startFen);
  const afterC4 = 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 1';
  englishGraph.addMove(startFen, { move: 'c2c4', toFen: afterC4 });
  savedPaths.push(saveGraph(englishGraph, 'english-opening.json', graphDir));

  // 6. Auto-generated filename
  const autoGraph = new ChessGraph(startFen);
  autoGraph.addMove(startFen, {
    move: 'Ng1f3',
    toFen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
  });
  savedPaths.push(saveGraph(autoGraph, undefined, graphDir)); // Auto-generated name

  return savedPaths;
}

function analyzeGraphFile(filePath: string): void {
  try {
    const graph = loadGraph(filePath);
    const filename = path.basename(filePath);
    const positionCount = Object.keys(graph.nodes).length;
    const hasRoot = graph.rootPosition !== undefined;

    let moveCount = 0;
    Object.values(graph.nodes).forEach(node => {
      moveCount += node.moves.length;
    });

    console.log(`   📄 ${filename}:`);
    console.log(`      - Root position: ${hasRoot ? '✅' : '❌'}`);
    console.log(`      - Positions: ${positionCount}`);
    console.log(`      - Total moves: ${moveCount}`);

    if (hasRoot && graph.rootPosition) {
      const rootNode = graph.findPosition(graph.rootPosition);
      if (rootNode && rootNode.moves.length > 0) {
        console.log(`      - First move: ${rootNode.moves[0].move}`);
      }
    }
  } catch (error) {
    console.log(`   ❌ ${path.basename(filePath)}: Error loading - ${error}`);
  }
}

function graphManagementExample() {
  console.log('🚀 Graph Management Example\n');

  // Create sample graphs
  console.log('🏗️  Creating sample chess graphs...');
  const savedPaths = createSampleGraphs();
  console.log(`   ✅ Created ${savedPaths.length} sample graphs`);

  // List all graph files
  console.log('\n📁 Listing all graph files...');
  const graphFiles = listGraphFiles('./tmp/graph-examples');
  console.log(`   Found ${graphFiles.length} graph files:`);

  graphFiles.forEach(file => {
    console.log(`   - ${path.basename(file)}`);
  });

  // Analyze each graph file
  console.log('\n🔍 Analyzing graph files...');
  graphFiles.forEach(analyzeGraphFile);

  // Demonstrate loading specific graphs
  console.log('\n📂 Loading specific graphs...');

  const kingsGraphPath = graphFiles.find(f => f.includes('kings-pawn'));
  if (kingsGraphPath) {
    const kingsGraph = loadGraph(kingsGraphPath);
    console.log(
      `   🏰 Kings Pawn: ${Object.keys(kingsGraph.nodes).length} positions`
    );

    const rootNode = kingsGraph.findPosition(kingsGraph.rootPosition!);
    if (rootNode) {
      console.log(
        `      Opening moves: ${rootNode.moves.map(m => m.move).join(', ')}`
      );
    }
  }

  const queensGraphPath = graphFiles.find(f => f.includes('queens-pawn'));
  if (queensGraphPath) {
    const queensGraph = loadGraph(queensGraphPath);
    console.log(
      `   👑 Queens Pawn: ${Object.keys(queensGraph.nodes).length} positions`
    );
  }

  // Compare graphs
  console.log('\n⚖️  Comparing graphs...');
  const graphStats = graphFiles.map(filePath => {
    try {
      const graph = loadGraph(filePath);
      return {
        name: path.basename(filePath, '.json'),
        positions: Object.keys(graph.nodes).length,
        hasRoot: graph.rootPosition !== undefined,
      };
    } catch {
      return {
        name: path.basename(filePath, '.json'),
        positions: 0,
        hasRoot: false,
      };
    }
  });

  // Sort by position count
  graphStats.sort((a, b) => b.positions - a.positions);

  console.log('   📊 Graphs by complexity:');
  graphStats.forEach((stat, index) => {
    const medal =
      index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
    console.log(`   ${medal} ${stat.name}: ${stat.positions} positions`);
  });

  // Clean up demonstration
  console.log('\n🧹 Cleanup demonstration...');

  // Delete the empty graph
  const emptyGraphPath = graphFiles.find(f => f.includes('empty-graph'));
  if (emptyGraphPath) {
    const deleted = deleteGraph(emptyGraphPath);
    console.log(`   🗑️  Deleted empty graph: ${deleted}`);
  }

  // Show remaining files
  const remainingFiles = listGraphFiles('./tmp/graph-examples');
  console.log(`   📁 Remaining files: ${remainingFiles.length}`);

  // Batch operations example
  console.log('\n📦 Batch operations...');

  // Load all remaining graphs and calculate total statistics
  let totalPositions = 0;
  let totalMoves = 0;
  let graphsWithRoot = 0;

  remainingFiles.forEach(filePath => {
    try {
      const graph = loadGraph(filePath);
      totalPositions += Object.keys(graph.nodes).length;

      Object.values(graph.nodes).forEach(node => {
        totalMoves += node.moves.length;
      });

      if (graph.rootPosition) {
        graphsWithRoot++;
      }
    } catch (error) {
      console.log(`   ⚠️  Error loading ${path.basename(filePath)}: ${error}`);
    }
  });

  console.log(`   📈 Total statistics across all graphs:`);
  console.log(`      - Graphs: ${remainingFiles.length}`);
  console.log(`      - Graphs with root: ${graphsWithRoot}`);
  console.log(`      - Total positions: ${totalPositions}`);
  console.log(`      - Total moves: ${totalMoves}`);
  console.log(
    `      - Average positions per graph: ${(totalPositions / remainingFiles.length).toFixed(1)}`
  );

  console.log('\n✅ Graph management example completed!');
  console.log(
    '\n💡 Tip: You can find all created graphs in ./tmp/graph-examples/'
  );
}

// Run the example
graphManagementExample();
