import { describe, it, expect } from 'vitest';
import {
  parseEPD,
  formatEPDAsAnalysisResult,
  parseEPDLine,
  ParsedEPD,
} from './epd';

describe('EPD Utils', () => {
  describe('parseEPD', () => {
    it('should parse a valid EPD line', () => {
      const epdLine =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ce 20; acd 10; acs 1000; acn 50000; pv e2e4';
      const result = parseEPD(epdLine);

      expect(result).toEqual({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          ce: '20',
          acd: '10',
          acs: '1000',
          acn: '50000',
          pv: 'e2e4',
        },
      });
    });

    it('should parse EPD with multiple PV moves', () => {
      const epdLine =
        'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - ce -30; acd 12; pv Bb5 a6 Ba4';
      const result = parseEPD(epdLine);

      expect(result?.operations.pv).toBe('Bb5 a6 Ba4');
    });

    it('should handle EPD with en passant square', () => {
      const epdLine =
        'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 ce 15; acd 8';
      const result = parseEPD(epdLine);

      expect(result?.fen).toBe(
        'rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 1'
      );
    });

    it('should handle EPD with no castling rights', () => {
      const epdLine = 'r3k2r/8/8/8/8/8/8/R3K2R b - - ce 0; acd 5';
      const result = parseEPD(epdLine);

      expect(result?.fen).toBe('r3k2r/8/8/8/8/8/8/R3K2R b - - 0 1');
    });

    it('should return null for empty line', () => {
      expect(parseEPD('')).toBeNull();
      expect(parseEPD('   ')).toBeNull();
    });

    it('should return null for insufficient FEN parts', () => {
      const invalidEpd = 'rnbqkbnr/pppppppp/8/8 w KQkq';
      expect(parseEPD(invalidEpd)).toBeNull();
    });

    it('should return null when no operations found', () => {
      const epdWithoutOps =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
      expect(parseEPD(epdWithoutOps)).toBeNull();
    });

    it('should handle operations with semicolons and spaces', () => {
      const epdLine =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ce 25; acd 15; acs 2000; pv e2e4 e7e5; acn 100000';
      const result = parseEPD(epdLine);

      expect(result?.operations).toEqual({
        ce: '25',
        acd: '15',
        acs: '2000',
        pv: 'e2e4 e7e5',
        acn: '100000',
      });
    });

    it('should handle operations without operands', () => {
      const epdLine =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ce 20; acd 10; bm; pv e2e4';
      const result = parseEPD(epdLine);

      expect(result?.operations.bm).toBe('');
    });
  });

  describe('formatEPDAsAnalysisResult', () => {
    it('should format valid ParsedEPD to AnalysisResult', () => {
      const parsedEPD: ParsedEPD = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          ce: '20',
          acd: '10',
          acs: '1000',
          acn: '50000',
          pv: 'e2e4 e7e5',
        },
      };

      const result = formatEPDAsAnalysisResult(parsedEPD);

      expect(result).toEqual({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        depth: 10,
        selDepth: 10,
        multiPV: 1,
        score: {
          type: 'cp',
          score: 20,
        },
        pvs: ['e2e4 e7e5'],
        time: 1000,
        nodes: 50000,
        nps: 50000,
      });
    });

    it('should handle negative centipawn scores', () => {
      const parsedEPD: ParsedEPD = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          ce: '-150',
          acd: '12',
        },
      };

      const result = formatEPDAsAnalysisResult(parsedEPD);

      expect(result?.score).toEqual({
        type: 'cp',
        score: -150,
      });
    });

    it('should handle missing optional operations', () => {
      const parsedEPD: ParsedEPD = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          ce: '30',
          acd: '8',
        },
      };

      const result = formatEPDAsAnalysisResult(parsedEPD);

      expect(result).toEqual({
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        depth: 8,
        selDepth: 8,
        multiPV: 1,
        score: {
          type: 'cp',
          score: 30,
        },
        pvs: [],
        time: 0,
        nodes: 0,
        nps: 0,
      });
    });

    it('should calculate NPS correctly when time > 0', () => {
      const parsedEPD: ParsedEPD = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          ce: '25',
          acd: '15',
          acs: '2000',
          acn: '100000',
        },
      };

      const result = formatEPDAsAnalysisResult(parsedEPD);

      expect(result?.nps).toBe(50000); // 100000 nodes / (2000ms / 1000) = 50000 nps
    });

    it('should return null when missing required ce operation', () => {
      const parsedEPD: ParsedEPD = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          acd: '10',
        },
      };

      expect(formatEPDAsAnalysisResult(parsedEPD)).toBeNull();
    });

    it('should return null when missing required acd operation', () => {
      const parsedEPD: ParsedEPD = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          ce: '20',
        },
      };

      expect(formatEPDAsAnalysisResult(parsedEPD)).toBeNull();
    });

    it('should return null for invalid centipawn value', () => {
      const parsedEPD: ParsedEPD = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          ce: 'invalid',
          acd: '10',
        },
      };

      expect(formatEPDAsAnalysisResult(parsedEPD)).toBeNull();
    });

    it('should return null for invalid depth value', () => {
      const parsedEPD: ParsedEPD = {
        fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        operations: {
          ce: '20',
          acd: 'invalid',
        },
      };

      expect(formatEPDAsAnalysisResult(parsedEPD)).toBeNull();
    });
  });

  describe('parseEPDLine', () => {
    it('should parse a complete EPD line end-to-end', () => {
      const epdLine =
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 ce 25; acd 12; acs 1500; acn 75000; pv e7e5';
      const result = parseEPDLine(epdLine);

      expect(result).toEqual({
        fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        depth: 12,
        selDepth: 12,
        multiPV: 1,
        score: {
          type: 'cp',
          score: 25,
        },
        pvs: ['e7e5'],
        time: 1500,
        nodes: 75000,
        nps: 50000,
      });
    });

    it('should return null for invalid EPD line', () => {
      expect(parseEPDLine('')).toBeNull();
      expect(parseEPDLine('invalid epd')).toBeNull();
      expect(
        parseEPDLine(
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - invalid'
        )
      ).toBeNull();
    });

    it('should handle EPD line with mate score operations', () => {
      const epdLine =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - ce 32000; acd 5; pv Qh5';
      const result = parseEPDLine(epdLine);

      expect(result?.score).toEqual({
        type: 'cp',
        score: 32000,
      });
    });
  });
});
