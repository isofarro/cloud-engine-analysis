import sqlite3 from 'sqlite3';
import {
  AnalysisStoreService,
  AnalysisRepo,
  AnalysisUtils,
} from '../../src/core/analysis-store';
import { AnalysisResult } from '../../src/core/engine/types';

/**
 * Basic usage example of the AnalysisRepo for storing and retrieving
 * chess engine analysis results.
 */
async function basicUsageExample() {
  console.log('=== Analysis Store Basic Usage Example ===\n');

  // Initialize in-memory SQLite database for this example
  const db = new sqlite3.Database(':memory:');
  const repo = new AnalysisRepo(db);
  const service = new AnalysisStoreService(repo);

  try {
    // Example 1: Store a single analysis result
    console.log('1. Storing analysis result...');

    const analysisResult: AnalysisResult = {
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
      depth: 15,
      selDepth: 18,
      multiPV: 1,
      score: { type: 'cp', score: 25 },
      pvs: ['e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6'],
      time: 2500,
      nodes: 1250000,
      nps: 500000,
    };

    await service.storeAnalysisResult(analysisResult, 'stockfish-17.0');

    console.log('✓ Analysis stored successfully\n');

    // Example 2: Retrieve the stored analysis
    console.log('2. Retrieving analysis...');

    const retrieved = await service.getAnalysis(
      analysisResult.fen,
      'stockfish-17.0'
    );

    if (retrieved) {
      console.log(`✓ Found analysis:`);
      console.log(
        `  Engine: ${retrieved.engine_name} ${retrieved.engine_version}`
      );
      console.log(`  Depth: ${retrieved.depth}`);
      console.log(
        `  Evaluation: ${AnalysisUtils.formatEvaluation(retrieved.score, retrieved.score_type)}`
      );
      console.log(`  Best move: ${retrieved.pv.split(' ')[0]}`);
      console.log(`  PV: ${retrieved.pv}\n`);
    }

    // Example 3: Store multiple positions
    console.log('3. Storing multiple analysis results...');

    const multipleResults = [
      {
        analysisResult: {
          fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
          depth: 12,
          selDepth: 15,
          multiPV: 1,
          score: { type: 'cp', score: 15 },
          pvs: ['g1f3 b8c6 f1b5 a7a6'],
          time: 1800,
          nodes: 900000,
          nps: 500000,
        } as AnalysisResult,
        engineSlug: 'stockfish-17.0',
      },
      {
        analysisResult: {
          fen: 'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 4 3',
          depth: 14,
          selDepth: 17,
          multiPV: 1,
          score: { type: 'cp', score: 30 },
          pvs: ['f1b5 b8d7 d2d3 f8e7'],
          time: 2200,
          nodes: 1100000,
          nps: 500000,
        } as AnalysisResult,
        engineSlug: 'stockfish-17.0',
      },
    ];

    await service.storeMultipleAnalysisResults(multipleResults);
    console.log('✓ Multiple results stored successfully\n');

    // Example 4: Query analysis with filters
    console.log('4. Querying analysis with filters...');

    const queryResults = await service.queryAnalysis({
      engine_slug: 'stockfish-17.0',
      min_depth: 12,
      limit: 10,
    });

    console.log(
      `✓ Found ${queryResults.length} analysis results with depth >= 12:`
    );
    queryResults.forEach((result, index) => {
      console.log(
        `  ${index + 1}. ${result.position_fen.substring(0, 20)}... (depth: ${result.depth}, eval: ${AnalysisUtils.formatEvaluation(result.score, result.score_type)})`
      );
    });
    console.log();

    // Example 5: Find best analysis for a position
    console.log('5. Finding best analysis for starting position...');

    const bestAnalysis = await service.getBestAnalysisComparison(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    );

    if (bestAnalysis) {
      console.log(`✓ Best analysis found:`);
      console.log(`  Depth: ${bestAnalysis.depth}`);
      console.log(
        `  Evaluation: ${bestAnalysis.evaluation} (${bestAnalysis.scoreType})`
      );
      console.log(`  Best move: ${bestAnalysis.bestMove}`);
      console.log(`  Engine: ${bestAnalysis.engineInfo}`);
      console.log(`  Principal variation: ${bestAnalysis.pv.join(' ')}\n`);
    }

    // Example 6: Database statistics
    console.log('6. Database statistics...');

    const stats = await service.getStats();
    console.log(`✓ Database contains:`);
    console.log(`  Positions: ${stats.totalPositions}`);
    console.log(`  Engines: ${stats.totalEngines}`);
    console.log(`  Analysis results: ${stats.totalAnalyses}`);
    console.log(`  Average depth: ${stats.avgDepth}\n`);

    // Example 7: Compare evaluations
    console.log('7. Comparing evaluations...');

    const eval1 = { score: 25, scoreType: 'cp' as const };
    const eval2 = { score: 3, scoreType: 'mate' as const };

    const comparison = AnalysisUtils.compareEvaluations(eval1, eval2);
    console.log(
      `Comparing ${AnalysisUtils.formatEvaluation(eval1.score, eval1.scoreType)} vs ${AnalysisUtils.formatEvaluation(eval2.score, eval2.scoreType)}:`
    );
    console.log(
      `Result: ${comparison > 0 ? 'First is better' : comparison < 0 ? 'Second is better' : 'Equal'}\n`
    );

    console.log('=== Example completed successfully! ===');
  } catch (error) {
    console.error('Error in analysis store example:', error);
  } finally {
    // Close database connection
    db.close();
  }
}

// ES module entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  basicUsageExample().catch(console.error);
}

export { basicUsageExample };
