import { FenString } from '../types';
import { ScoreType } from './types';

/**
 * Utility class for common analysis operations and data transformations.
 * Provides helper methods for working with the AnalysisRepo efficiently.
 */
export class AnalysisUtils {
  /**
   * Compares two positions to find the better evaluation.
   * Handles both centipawn and mate scores, considering whose turn it is to move.
   * For White to move: higher scores are better
   * For Black to move: lower scores are better (scores are from perspective of side to move)
   */
  static compareEvaluations(
    eval1: { score: number; scoreType: ScoreType },
    eval2: { score: number; scoreType: ScoreType },
    isWhiteToMove: boolean
  ): number {
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
