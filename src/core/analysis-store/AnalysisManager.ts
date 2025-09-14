import { UciAnalysisResult } from '../engine/types';
import { ChessGraph } from '../graph/ChessGraph';
import { Chess } from 'chess.ts';
import { convertMoveToSan } from '../utils/move';

/**
 * In-memory analysis store for demonstration and testing purposes.
 * Provides a simple interface for storing position and move analysis data.
 */
export interface AnalysisStore {
  positions: Record<string, any>;
  moves: Record<string, any>;
}

/**
 * Manager class for analysis data operations and integration.
 * Provides methods for creating analysis stores, integrating analysis results
 * with chess graphs, and retrieving analysis data.
 */
export class AnalysisManager {
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
    result: UciAnalysisResult
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

            // Convert UCI moves to SAN format
            const moveResult = convertMoveToSan(chess, move);

            if (!moveResult) {
              // Invalid move, skip it
              break;
            }

            const toFen = chess.fen();
            const sanMove = moveResult.san;

            graph.addMove(fromFen, {
              move: sanMove,
              toFen,
            });

            // Store move analysis
            const moveKey = `${fromFen}:${sanMove}`;
            store.moves[moveKey] = {
              move: sanMove,
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
