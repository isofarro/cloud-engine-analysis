import { AnalysisResult } from '../engine/types';
import { ChessGraph } from '../graph/ChessGraph';
import { Chess } from 'chess.ts';
import { AnalysisStore } from './AnalysisStore';

/**
 * Utility class for working with Principal Variations and analysis data.
 * Provides methods for integrating analysis results with chess graphs and stores.
 */
export class PVUtils {
  /**
   * Creates a new empty analysis store.
   */
  static createAnalysisStore(): AnalysisStore {
    return {
      positions: {},
      moves: {},
    };
  }

  /**
   * Adds an analysis result to both the graph and analysis store.
   * Processes the principal variation and stores move-by-move analysis.
   */
  static addAnalysisResultToGraph(
    graph: ChessGraph,
    store: AnalysisStore,
    result: AnalysisResult
  ): void {
    // Store analysis in our simple store
    store.positions[result.fen] = {
      fen: result.fen,
      depth: result.depth,
      score: result.score,
      pvs: result.pvs,
    };

    // Add moves to graph if we have PV lines
    if (result.pvs && result.pvs.length > 0) {
      const chess = new Chess(result.fen);
      const mainPV = result.pvs[0].split(' ');

      for (let i = 0; i < mainPV.length; i++) {
        const move = mainPV[i];
        if (move) {
          try {
            const fromFen = chess.fen();
            chess.move(move);
            const toFen = chess.fen();

            graph.addMove(fromFen, {
              move,
              toFen,
            });

            // Store move analysis
            const moveKey = `${fromFen}:${move}`;
            store.moves[moveKey] = {
              move,
              fromFen,
              toFen,
              evaluation: {
                score: result.score.score,
                type: result.score.type,
              },
              isPrincipalVariation: i === 0,
              pvRank: 1,
            };
          } catch (error) {
            // Invalid move, skip it
            break;
          }
        }
      }
    }
  }

  /**
   * Extracts the principal variation path from stored analysis.
   * Returns an array of moves up to the specified maximum depth.
   */
  static getPrincipalVariationPath(
    store: AnalysisStore,
    fen: string,
    maxDepth: number
  ): string[] {
    const positionAnalysis = store.positions[fen];
    if (
      !positionAnalysis ||
      !positionAnalysis.pvs ||
      positionAnalysis.pvs.length === 0
    ) {
      return [];
    }

    const mainPV = positionAnalysis.pvs[0].split(' ');
    return mainPV.slice(0, maxDepth);
  }

  /**
   * Retrieves move analysis data for a specific position and move.
   * Returns null if no analysis is found.
   */
  static getMoveAnalysis(store: AnalysisStore, fen: string, move: string) {
    const moveKey = `${fen}:${move}`;
    return store.moves[moveKey] || null;
  }
}
