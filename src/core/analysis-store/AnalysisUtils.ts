import { AnalysisResult } from '../engine/types';
import { FenString } from '../types';
import { IAnalysisRepo } from './IAnalysisRepo';
import { CreateAnalysisData, ScoreType } from './types';

/**
 * Utility class for common analysis operations and data transformations.
 * Provides helper methods for working with the AnalysisRepo efficiently.
 */
export class AnalysisUtils {
  /**
   * Converts engine AnalysisResult to database format.
   * Handles the transformation between engine output and storage schema.
   */
  static async storeAnalysisResult(
    repo: IAnalysisRepo,
    analysisResult: AnalysisResult,
    engineSlug: string
  ): Promise<void> {
    // Ensure position exists
    const position = await repo.upsertPosition({ fen: analysisResult.fen });

    // Ensure engine exists (extract name/version from slug)
    const [name, version] = this.parseEngineSlug(engineSlug);
    const engine = await repo.upsertEngine({ slug: engineSlug, name, version });

    // Convert and store analysis
    const analysisData: CreateAnalysisData = {
      position_id: position.id,
      engine_id: engine.id,
      depth: analysisResult.depth,
      time: analysisResult.time || 0,
      nodes: analysisResult.nodes || 0,
      nps: analysisResult.nps || 0,
      score_type: analysisResult.score.type as ScoreType,
      score: analysisResult.score.score,
      pv: analysisResult.pvs[0] || '', // Use first PV line
    };

    await repo.upsertAnalysis(analysisData);
  }

  /**
   * Batch stores multiple analysis results efficiently.
   * Uses transactions and batch operations for optimal performance.
   */
  static async batchStoreAnalysisResults(
    repo: IAnalysisRepo,
    results: Array<{ analysisResult: AnalysisResult; engineSlug: string }>
  ): Promise<void> {
    // Group by unique positions and engines to minimize upserts
    const uniquePositions = new Set<FenString>();
    const uniqueEngines = new Set<string>();

    results.forEach(({ analysisResult, engineSlug }) => {
      uniquePositions.add(analysisResult.fen);
      uniqueEngines.add(engineSlug);
    });

    // Batch upsert positions
    const positionMap = new Map<FenString, number>();
    for (const fen of uniquePositions) {
      const position = await repo.upsertPosition({ fen });
      positionMap.set(fen, position.id);
    }

    // Batch upsert engines
    const engineMap = new Map<string, number>();
    for (const slug of uniqueEngines) {
      const [name, version] = this.parseEngineSlug(slug);
      const engine = await repo.upsertEngine({ slug, name, version });
      engineMap.set(slug, engine.id);
    }

    // Prepare analysis data
    const analysisData: CreateAnalysisData[] = results.map(
      ({ analysisResult, engineSlug }) => ({
        position_id: positionMap.get(analysisResult.fen)!,
        engine_id: engineMap.get(engineSlug)!,
        depth: analysisResult.depth,
        time: analysisResult.time || 0,
        nodes: analysisResult.nodes || 0,
        nps: analysisResult.nps || 0,
        score_type: analysisResult.score.type as ScoreType,
        score: analysisResult.score.score,
        pv: analysisResult.pvs[0] || '',
      })
    );

    // Batch insert analysis
    await repo.batchUpsertAnalysis(analysisData);
  }

  /**
   * Retrieves the best available analysis for a position.
   * Prioritizes depth, then recency.
   */
  static async getBestAnalysisForPosition(
    repo: IAnalysisRepo,
    fen: FenString
  ): Promise<{
    evaluation: number;
    scoreType: ScoreType;
    depth: number;
    bestMove: string;
    pv: string[];
    engineInfo: string;
  } | null> {
    const analysis = await repo.getBestAnalysisForPosition(fen);
    if (!analysis) return null;

    return {
      evaluation: analysis.score,
      scoreType: analysis.score_type,
      depth: analysis.depth,
      bestMove: analysis.pv.split(' ')[0] || '',
      pv: analysis.pv.split(' ').filter(move => move.length > 0),
      engineInfo: `${analysis.engine_name} ${analysis.engine_version}`,
    };
  }

  /**
   * Compares two positions to find the better evaluation.
   * Handles both centipawn and mate scores, considering whose turn it is to move.
   * For White to move: higher scores are better
   * For Black to move: lower scores are better (scores are from perspective of side to move)
   */
  static compareEvaluations(
    eval1: { score: number; scoreType: ScoreType; isWhiteToMove: boolean },
    eval2: { score: number; scoreType: ScoreType; isWhiteToMove: boolean }
  ): number {
    // Both evaluations must be from the same perspective
    if (eval1.isWhiteToMove !== eval2.isWhiteToMove) {
      throw new Error('Cannot compare evaluations from different perspectives');
    }

    const isWhiteToMove = eval1.isWhiteToMove;

    // Helper function to determine if score1 is better than score2
    const isBetterScore = (
      score1: number,
      score2: number,
      scoreType1: ScoreType,
      scoreType2: ScoreType
    ): number => {
      // Mate scores always beat centipawn scores
      if (scoreType1 === 'mate' && scoreType2 === 'cp') {
        if (isWhiteToMove) {
          return score1 > 0 ? 1 : -1; // White: positive mate is better
        } else {
          return score1 < 0 ? 1 : -1; // Black: negative mate is better
        }
      }
      if (scoreType2 === 'mate' && scoreType1 === 'cp') {
        if (isWhiteToMove) {
          return score2 > 0 ? -1 : 1; // White: positive mate is better
        } else {
          return score2 < 0 ? -1 : 1; // Black: negative mate is better
        }
      }

      // Both mate scores: shorter mate is better
      if (scoreType1 === 'mate' && scoreType2 === 'mate') {
        if (isWhiteToMove) {
          // For White: positive mates are good, negative mates are bad
          if (score1 > 0 && score2 > 0) {
            return score2 - score1; // Lower positive mate is better
          }
          if (score1 < 0 && score2 < 0) {
            return score1 - score2; // Higher negative mate is better (less bad)
          }
          return score1 - score2; // Mixed signs: positive beats negative
        } else {
          // For Black: negative mates are good, positive mates are bad
          if (score1 < 0 && score2 < 0) {
            return score1 - score2; // Lower negative mate is better
          }
          if (score1 > 0 && score2 > 0) {
            return score2 - score1; // Higher positive mate is better (less bad)
          }
          return score2 - score1; // Mixed signs: negative beats positive
        }
      }

      // Both centipawn scores
      if (isWhiteToMove) {
        return score1 - score2; // Higher is better for White
      } else {
        return score2 - score1; // Lower is better for Black
      }
    };

    return isBetterScore(
      eval1.score,
      eval2.score,
      eval1.scoreType,
      eval2.scoreType
    );
  }

  /**
   * Formats evaluation for display.
   */
  static formatEvaluation(score: number, scoreType: ScoreType): string {
    if (scoreType === 'mate') {
      return score > 0 ? `+M${score}` : `-M${Math.abs(score)}`;
    }

    const pawns = score / 100;
    return pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2);
  }

  /**
   * Parses engine slug to extract name and version.
   * Format: "enginename-version" (e.g., "stockfish-17.0")
   */
  private static parseEngineSlug(slug: string): [string, string] {
    const lastDashIndex = slug.lastIndexOf('-');
    if (lastDashIndex === -1) {
      return [slug, '1.0']; // Default version if no dash found
    }

    const name = slug.substring(0, lastDashIndex);
    const version = slug.substring(lastDashIndex + 1);

    return [name, version];
  }

  /**
   * Creates a normalized FEN for consistent storage.
   * Removes move counters that don't affect position evaluation.
   */
  static normalizeFen(fen: FenString): FenString {
    const parts = fen.split(' ');
    if (parts.length >= 4) {
      // Keep position, active color, castling, en passant
      // Reset halfmove and fullmove counters for consistency
      return `${parts[0]} ${parts[1]} ${parts[2]} ${parts[3]} 0 1`;
    }
    return fen;
  }

  /**
   * Validates if a FEN string is properly formatted.
   */
  static isValidFen(fen: FenString): boolean {
    const parts = fen.split(' ');
    if (parts.length !== 6) return false;

    // Basic validation of FEN components
    const [, activeColor, castling, enPassant, halfmove, fullmove] = parts;

    // Validate active color
    if (!['w', 'b'].includes(activeColor)) return false;

    // Validate castling rights
    if (!/^[KQkq-]*$/.test(castling)) return false;

    // Validate en passant
    if (enPassant !== '-' && !/^[a-h][36]$/.test(enPassant)) return false;

    // Validate move counters
    if (isNaN(parseInt(halfmove)) || isNaN(parseInt(fullmove))) return false;

    return true;
  }
}
