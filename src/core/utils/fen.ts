/**
 * FEN (Forsyth-Edwards Notation) utility functions
 */

/**
 * Normalize FEN by keeping only the first 4 segments (position, side to move, castling, en-passant)
 * This removes the halfmove clock and fullmove number for consistent position comparison
 * 
 * @param fen - The FEN string to normalize
 * @returns Normalized FEN string with only essential position data
 * 
 * @example
 * normalizeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
 * // Returns: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -'
 */
export function normalizeFen(fen: string): string {
    const segments = fen.split(' ');
    return segments.slice(0, 4).join(' ');
}