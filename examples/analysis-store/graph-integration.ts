import sqlite3 from 'sqlite3';
import {
  AnalysisStoreService,
  AnalysisUtils,
  AnalysisStore,
  PVUtils,
} from '../../src/core/analysis-store';
import { ChessGraph } from '../../src/core/graph/ChessGraph';
import { AnalysisResult } from '../../src/core/engine/types';
import { Chess } from 'chess.ts';

/**
 * Advanced example showing integration between the analysis store,
 * chess graph, and PV utilities for exploring variations.
 */
async function graphIntegrationExample() {
  console.log('=== Analysis Store + Chess Graph Integration Example ===\n');

  // Initialize components
  const db = new sqlite3.Database(':memory:');
  const service = new AnalysisStoreService(db);
  const graph = new ChessGraph();
  const analysisStore = PVUtils.createAnalysisStore();

  // Wait for database initialization
  await service.initialize();

  try {
    // Example 1: Analyze a tactical position with multiple variations
    console.log('1. Analyzing tactical position with multiple PV lines...');

    const tacticalPosition =
      'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4';

    // Simulate multi-PV analysis result
    const multiPVResult: AnalysisResult = {
      fen: tacticalPosition,
      depth: 16,
      selDepth: 20,
      multiPV: 3,
      score: { type: 'cp', score: 85 },
      pvs: [
        'f3g5 d7d6 g5f7 e8f7 d1h5 g7g6 h5f3', // Main line
        'f3e5 f6e4 e5c6 d7c6 d1h5 g7g6 h5e2', // Alternative
        'd3d4 e5d4 f3d4 c6d4 d1d4 f6e4', // Third option
      ],
      time: 3500,
      nodes: 1750000,
      nps: 500000,
    };

    // Store in database
    await service.storeAnalysisResult(multiPVResult, 'stockfish-17.0');

    // Add to graph and analysis store
    PVUtils.addAnalysisResultToGraph(graph, analysisStore, multiPVResult);

    console.log('✓ Multi-PV analysis integrated into graph and database\n');

    // Example 2: Explore the principal variation
    console.log('2. Exploring principal variation path...');

    const pvPath = PVUtils.getPrincipalVariationPath(
      analysisStore,
      tacticalPosition,
      5 // Max depth
    );

    console.log(`✓ Principal variation: ${pvPath.join(' ')}`);

    // Show position after each move
    const chess = new Chess(tacticalPosition);
    console.log(`Starting position: ${tacticalPosition}`);

    for (let i = 0; i < pvPath.length; i++) {
      const move = pvPath[i];
      chess.move(move);
      const moveAnalysis = PVUtils.getMoveAnalysis(
        analysisStore,
        i === 0 ? tacticalPosition : chess.fen(),
        move
      );

      console.log(`  ${i + 1}. ${move} -> ${chess.fen().substring(0, 30)}...`);
      if (moveAnalysis) {
        console.log(
          `     Eval: ${AnalysisUtils.formatEvaluation(moveAnalysis.evaluation.score, moveAnalysis.evaluation.type)} (PV rank: ${moveAnalysis.pvRank})`
        );
      }
    }
    console.log();

    // Example 3: Compare different variations
    console.log('3. Comparing variations from the tactical position...');

    const positionNode = graph.findPosition(tacticalPosition);
    if (positionNode) {
      console.log(`✓ Found ${positionNode.moves.length} possible moves:`);

      for (const moveEdge of positionNode.moves) {
        const moveAnalysis = PVUtils.getMoveAnalysis(
          analysisStore,
          tacticalPosition,
          moveEdge.move
        );

        if (moveAnalysis) {
          const evalStr = AnalysisUtils.formatEvaluation(
            moveAnalysis.evaluation.score,
            moveAnalysis.evaluation.type
          );
          const pvIndicator = moveAnalysis.isPrincipalVariation
            ? ` (PV #${moveAnalysis.pvRank})`
            : '';

          console.log(`  ${moveEdge.move}: ${evalStr}${pvIndicator}`);
        } else {
          console.log(`  ${moveEdge.move}: (no analysis)`);
        }
      }
    }
    console.log();

    // Example 4: Analyze a sequence of positions
    console.log('4. Analyzing a game sequence...');

    const gameSequence = [
      {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        analysis: {
          depth: 20,
          score: { type: 'cp' as const, score: 15 },
          pvs: ['e2e4 e7e5 g1f3 b8c6 f1b5'],
        },
      },
      {
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        analysis: {
          depth: 18,
          score: { type: 'cp' as const, score: 25 },
          pvs: ['e7e5 g1f3 b8c6 f1b5 a7a6'],
        },
      },
      {
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
        analysis: {
          depth: 16,
          score: { type: 'cp' as const, score: 20 },
          pvs: ['g1f3 b8c6 f1b5 a7a6 b5a4'],
        },
      },
    ];

    const batchResults = gameSequence.map((pos, index) => ({
      analysisResult: {
        fen: pos.fen,
        depth: pos.analysis.depth,
        selDepth: pos.analysis.depth + 2,
        multiPV: 1,
        score: pos.analysis.score,
        pvs: pos.analysis.pvs,
        time: 2000 + index * 500,
        nodes: 1000000 + index * 250000,
        nps: 500000,
      } as AnalysisResult,
      engineSlug: 'stockfish-17.0',
    }));

    // Store all positions in batch
    await service.storeMultipleAnalysisResults(batchResults);

    // Add to graph
    batchResults.forEach(({ analysisResult }) => {
      PVUtils.addAnalysisResultToGraph(graph, analysisStore, analysisResult);
    });

    console.log(
      `✓ Analyzed and stored ${gameSequence.length} positions in sequence\n`
    );

    // Example 5: Query analysis by depth and compare
    console.log('5. Querying high-depth analysis...');

    const highDepthAnalysis = await service.queryAnalysis({
      min_depth: 16,
      limit: 5,
    });

    console.log(`✓ Found ${highDepthAnalysis.length} high-depth analyses:`);
    highDepthAnalysis.forEach((analysis, index) => {
      const bestMove = analysis.pv.split(' ')[0];
      const eval_str = AnalysisUtils.formatEvaluation(
        analysis.score,
        analysis.score_type
      );
      console.log(
        `  ${index + 1}. Depth ${analysis.depth}: ${bestMove} (${eval_str})`
      );
      console.log(
        `     Position: ${analysis.position_fen.substring(0, 40)}...`
      );
    });
    console.log();

    // Example 6: Performance statistics
    console.log('6. Performance and storage statistics...');

    const dbStats = await service.getStats();
    console.log(`✓ Database statistics:`);
    console.log(`  Total positions analyzed: ${dbStats.totalPositions}`);
    console.log(`  Total engines used: ${dbStats.totalEngines}`);
    console.log(`  Total analysis records: ${dbStats.totalAnalyses}`);
    console.log(`  Average analysis depth: ${dbStats.avgDepth}`);

    // Graph statistics
    const graphStats = {
      totalNodes: Object.keys(graph['nodes']).length,
      totalMoves: Object.values(graph['nodes']).reduce(
        (sum: number, node: any) => sum + node.moves.length,
        0
      ),
    };

    console.log(`\n✓ Graph statistics:`);
    console.log(`  Total position nodes: ${graphStats.totalNodes}`);
    console.log(`  Total move edges: ${graphStats.totalMoves}`);

    // Analysis store statistics
    const storeStats = {
      positionAnalyses: Object.keys(analysisStore.positions).length,
      moveAnalyses: Object.keys(analysisStore.moves).length,
    };

    console.log(`\n✓ In-memory analysis store:`);
    console.log(`  Position analyses: ${storeStats.positionAnalyses}`);
    console.log(`  Move analyses: ${storeStats.moveAnalyses}`);

    console.log('\n=== Integration example completed successfully! ===');
  } catch (error) {
    console.error('Error in graph integration example:', error);
  } finally {
    // Close database connection
    db.close();
  }
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  graphIntegrationExample().catch(console.error);
}

export { graphIntegrationExample };
