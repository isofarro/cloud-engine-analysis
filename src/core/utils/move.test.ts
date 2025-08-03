import { describe, it, expect, beforeEach } from 'vitest';
import { Chess } from 'chess.ts';
import { parseUciMove, isUciMove, convertMoveToSan } from './move';

describe('Move Utils', () => {
  describe('parseUciMove', () => {
    it('should parse basic UCI moves', () => {
      const result = parseUciMove('e2e4');
      expect(result).toEqual({ from: 'e2', to: 'e4' });
    });

    it('should parse UCI moves with promotion', () => {
      const result = parseUciMove('e7e8q');
      expect(result).toEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    });

    it('should parse UCI moves with different promotion pieces', () => {
      expect(parseUciMove('a7a8r')).toEqual({
        from: 'a7',
        to: 'a8',
        promotion: 'r',
      });
      expect(parseUciMove('b7b8b')).toEqual({
        from: 'b7',
        to: 'b8',
        promotion: 'b',
      });
      expect(parseUciMove('c7c8n')).toEqual({
        from: 'c7',
        to: 'c8',
        promotion: 'n',
      });
    });

    it('should throw error for invalid UCI moves', () => {
      expect(() => parseUciMove('e4')).toThrow(
        'Invalid UCI move: e4. Must be at least 4 characters.'
      );
      expect(() => parseUciMove('abc')).toThrow(
        'Invalid UCI move: abc. Must be at least 4 characters.'
      );
    });
  });

  describe('isUciMove', () => {
    it('should identify UCI moves correctly', () => {
      expect(isUciMove('e2e4')).toBe(true);
      expect(isUciMove('a1h8')).toBe(true);
      expect(isUciMove('g1f3')).toBe(true);
      expect(isUciMove('e7e8q')).toBe(true);
    });

    it('should identify non-UCI moves correctly', () => {
      expect(isUciMove('e4')).toBe(false);
      expect(isUciMove('Nf3')).toBe(false);
      expect(isUciMove('O-O')).toBe(false);
      expect(isUciMove('Qh5+')).toBe(false);
      expect(isUciMove('Rxe4#')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isUciMove('')).toBe(false);
      expect(isUciMove('abc')).toBe(false);
      expect(isUciMove('e9e4')).toBe(false); // Invalid square
      expect(isUciMove('i2e4')).toBe(false); // Invalid file
    });
  });

  describe('convertMoveToSan', () => {
    let chess: Chess;

    beforeEach(() => {
      chess = new Chess();
    });

    it('should convert UCI moves to SAN', () => {
      const result = convertMoveToSan(chess, 'e2e4');
      expect(result).toBeTruthy();
      expect(result?.san).toBe('e4');
    });

    it('should handle SAN moves directly', () => {
      const result = convertMoveToSan(chess, 'e4');
      expect(result).toBeTruthy();
      expect(result?.san).toBe('e4');
    });

    it('should handle UCI moves with promotion', () => {
      // Set up a position where pawn promotion is possible
      chess.load('8/P7/8/8/8/8/8/8 w - - 0 1');
      const result = convertMoveToSan(chess, 'a7a8q');
      expect(result).toBeTruthy();
      expect(result?.san).toBe('a8=Q#'); // This move results in checkmate
    });

    it('should return null for invalid moves', () => {
      const result = convertMoveToSan(chess, 'e2e5'); // Invalid move from starting position
      expect(result).toBeNull();
    });

    it('should handle knight moves correctly', () => {
      const result = convertMoveToSan(chess, 'g1f3');
      expect(result).toBeTruthy();
      expect(result?.san).toBe('Nf3');
    });

    it('should handle castling moves', () => {
      // Set up position for castling
      chess.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
      const result = convertMoveToSan(chess, 'e1g1');
      expect(result).toBeTruthy();
      expect(result?.san).toBe('O-O');
    });
  });
});
