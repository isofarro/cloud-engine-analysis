import { Chess } from 'chess.ts';

/**
 * Represents a UCI move object that can be passed to chess.js
 */
export interface UciMoveObject {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

/**
 * Converts a UCI move string to a move object that can be used with chess.js
 *
 * @param uciMove - The UCI move string (e.g., 'e2e4', 'e7e8q')
 * @returns Move object with from, to, and optional promotion properties
 *
 * @example
 * ```typescript
 * const moveObj = parseUciMove('e2e4');
 * // Returns: { from: 'e2', to: 'e4' }
 *
 * const promotionMove = parseUciMove('e7e8q');
 * // Returns: { from: 'e7', to: 'e8', promotion: 'q' }
 * ```
 */
export function parseUciMove(uciMove: string): UciMoveObject {
  if (uciMove.length < 4) {
    throw new Error(
      `Invalid UCI move: ${uciMove}. Must be at least 4 characters.`
    );
  }

  const from = uciMove.substring(0, 2);
  const to = uciMove.substring(2, 4);
  const promotion =
    uciMove.length > 4
      ? (uciMove.substring(4) as 'q' | 'r' | 'b' | 'n')
      : undefined;

  return { from, to, promotion };
}

/**
 * Checks if a move string is in UCI format
 *
 * @param move - The move string to check
 * @returns True if the move is in UCI format (e.g., 'e2e4'), false otherwise
 *
 * @example
 * ```typescript
 * isUciMove('e2e4'); // true
 * isUciMove('e4');   // false
 * isUciMove('Nf3');  // false
 * ```
 */
export function isUciMove(move: string): boolean {
  return move.length >= 4 && /^[a-h][1-8][a-h][1-8]/.test(move);
}

/**
 * Converts a move (UCI or SAN) to SAN format using chess.js
 *
 * @param chess - The chess.js instance with the current position
 * @param move - The move string (UCI or SAN format)
 * @returns The move result from chess.js with SAN notation, or null if invalid
 *
 * @example
 * ```typescript
 * const chess = new Chess();
 * const result = convertMoveToSan(chess, 'e2e4');
 * // Returns: { san: 'e4', ... } (chess.js move result)
 *
 * const sanResult = convertMoveToSan(chess, 'e4');
 * // Returns: { san: 'e4', ... } (already SAN, still processed)
 * ```
 */
export function convertMoveToSan(chess: Chess, move: string) {
  if (isUciMove(move)) {
    // Convert UCI to move object and execute
    const moveObj = parseUciMove(move);
    return chess.move(moveObj);
  } else {
    // Assume SAN notation
    return chess.move(move);
  }
}
