import { FenString } from '../core/types';

/**
 * Unicode chess piece characters
 */
const PIECE_SYMBOLS = {
  // White pieces
  K: '♔', // King
  Q: '♕', // Queen
  R: '♖', // Rook
  B: '♗', // Bishop
  N: '♘', // Knight
  P: '♙', // Pawn

  // Black pieces
  k: '♚', // King
  q: '♛', // Queen
  r: '♜', // Rook
  b: '♝', // Bishop
  n: '♞', // Knight
  p: '♟', // Pawn
};

/**
 * Prints a chess board to the console using Unicode characters
 * @param fen - FEN string representing the chess position
 */
export function printBoard(fen: FenString): void {
  // Parse the board part of the FEN string (first part before space)
  const boardPart = fen.split(' ')[0];
  const ranks = boardPart.split('/');

  console.log();

  // Print each rank (8 to 1)
  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    const rank = ranks[rankIndex];
    const rankNumber = 8 - rankIndex;
    let line = `${rankNumber} `;

    // Process each character in the rank
    for (const char of rank) {
      if (char >= '1' && char <= '8') {
        // Number indicates empty squares
        const emptySquares = parseInt(char);
        for (let i = 0; i < emptySquares; i++) {
          line += '· ';
        }
      } else {
        // Character is a piece
        const piece = PIECE_SYMBOLS[char as keyof typeof PIECE_SYMBOLS];
        line += `${piece} `;
      }
    }

    console.log(line);
  }

  // Print file labels
  console.log('  a b c d e f g h');
  console.log();
}

/**
 * Example usage and testing function
 */
export function testPrintBoard(): void {
  console.log('=== Chess Board Printer Test ===');

  // Starting position
  console.log('Starting position:');
  printBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

  // After 1.e4
  console.log('After 1.e4:');
  printBoard('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');

  // Sicilian Defense
  console.log('Sicilian Defense (1.e4 c5):');
  printBoard('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2');
}
