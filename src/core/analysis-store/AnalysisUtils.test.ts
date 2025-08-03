import { describe, it, expect } from 'vitest';
import { AnalysisUtils } from './AnalysisUtils';
import type { ScoreType } from './types';

describe('AnalysisUtils', () => {
  describe('compareEvaluations', () => {
    describe('White to move - centipawn vs mate scores', () => {
      it('should prefer positive mate over any centipawn score', () => {
        const mateEval = {
          score: 3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const cpEval = {
          score: 1000,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        expect(AnalysisUtils.compareEvaluations(mateEval, cpEval)).toBe(1);
        expect(AnalysisUtils.compareEvaluations(cpEval, mateEval)).toBe(-1);
      });

      it('should prefer any centipawn score over negative mate', () => {
        const negMateEval = {
          score: -3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const cpEval = {
          score: -500,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        expect(AnalysisUtils.compareEvaluations(negMateEval, cpEval)).toBe(-1);
        expect(AnalysisUtils.compareEvaluations(cpEval, negMateEval)).toBe(1);
      });
    });

    describe('Black to move - centipawn vs mate scores', () => {
      it('should prefer negative mate over any centipawn score', () => {
        const mateEval = {
          score: -3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };
        const cpEval = {
          score: -1000,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };

        expect(AnalysisUtils.compareEvaluations(mateEval, cpEval)).toBe(1);
        expect(AnalysisUtils.compareEvaluations(cpEval, mateEval)).toBe(-1);
      });

      it('should prefer any centipawn score over positive mate', () => {
        const posMateEval = {
          score: 3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };
        const cpEval = {
          score: 500,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };

        expect(AnalysisUtils.compareEvaluations(posMateEval, cpEval)).toBe(-1);
        expect(AnalysisUtils.compareEvaluations(cpEval, posMateEval)).toBe(1);
      });
    });

    describe('White to move - mate vs mate scores', () => {
      it('should prefer shorter positive mate', () => {
        const mate2 = {
          score: 2,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const mate5 = {
          score: 5,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };

        // Mate in 2 is better than mate in 5
        expect(AnalysisUtils.compareEvaluations(mate2, mate5)).toBe(3); // 5 - 2 = 3
        expect(AnalysisUtils.compareEvaluations(mate5, mate2)).toBe(-3); // 2 - 5 = -3
      });

      it('should prefer higher (closer to 0) negative mate', () => {
        const mate2 = {
          score: -2,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const mate5 = {
          score: -5,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };

        // Mate in -2 is better than mate in -5 (getting mated in 2 vs 5 moves)
        expect(AnalysisUtils.compareEvaluations(mate2, mate5)).toBe(3); // -2 - (-5) = 3
        expect(AnalysisUtils.compareEvaluations(mate5, mate2)).toBe(-3); // -5 - (-2) = -3
      });

      it('should handle mixed sign mate scores', () => {
        const posMate = {
          score: 3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const negMate = {
          score: -2,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };

        // Positive mate is always better than negative mate for White
        expect(AnalysisUtils.compareEvaluations(posMate, negMate)).toBe(5); // 3 - (-2) = 5
        expect(AnalysisUtils.compareEvaluations(negMate, posMate)).toBe(-5); // -2 - 3 = -5
      });

      it('should handle equal mate scores', () => {
        const mate3a = {
          score: 3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const mate3b = {
          score: 3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };

        expect(AnalysisUtils.compareEvaluations(mate3a, mate3b)).toBe(0);
      });
    });

    describe('Black to move - mate vs mate scores', () => {
      it('should prefer shorter negative mate', () => {
        const mate2 = {
          score: -2,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };
        const mate5 = {
          score: -5,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };

        // For Black, mate in -2 is better than mate in -5
        expect(AnalysisUtils.compareEvaluations(mate2, mate5)).toBe(3); // -2 - (-5) = 3
        expect(AnalysisUtils.compareEvaluations(mate5, mate2)).toBe(-3); // -5 - (-2) = -3
      });

      it('should prefer higher (closer to 0) positive mate', () => {
        const mate2 = {
          score: 2,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };
        const mate5 = {
          score: 5,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };

        // For Black, getting mated in 5 is better than getting mated in 2 (higher positive mate is less bad)
        expect(AnalysisUtils.compareEvaluations(mate2, mate5)).toBe(3); // 5 - 2 = 3 (mate5 is better)
        expect(AnalysisUtils.compareEvaluations(mate5, mate2)).toBe(-3); // 2 - 5 = -3 (mate2 is worse)
      });

      it('should handle mixed sign mate scores', () => {
        const posMate = {
          score: 3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };
        const negMate = {
          score: -2,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };

        // For Black, negative mate is better than positive mate
        expect(AnalysisUtils.compareEvaluations(posMate, negMate)).toBe(-5); // -2 - 3 = -5
        expect(AnalysisUtils.compareEvaluations(negMate, posMate)).toBe(5); // 3 - (-2) = 5
      });
    });

    describe('White to move - centipawn vs centipawn scores', () => {
      it('should prefer higher centipawn score', () => {
        const cp100 = {
          score: 100,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };
        const cp50 = {
          score: 50,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        expect(AnalysisUtils.compareEvaluations(cp100, cp50)).toBe(50); // 100 - 50 = 50
        expect(AnalysisUtils.compareEvaluations(cp50, cp100)).toBe(-50); // 50 - 100 = -50
      });

      it('should handle negative centipawn scores', () => {
        const cpNeg50 = {
          score: -50,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };
        const cpNeg100 = {
          score: -100,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        // -50 is better than -100 for White
        expect(AnalysisUtils.compareEvaluations(cpNeg50, cpNeg100)).toBe(50); // -50 - (-100) = 50
        expect(AnalysisUtils.compareEvaluations(cpNeg100, cpNeg50)).toBe(-50); // -100 - (-50) = -50
      });

      it('should handle mixed sign centipawn scores', () => {
        const cpPos = {
          score: 75,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };
        const cpNeg = {
          score: -25,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        expect(AnalysisUtils.compareEvaluations(cpPos, cpNeg)).toBe(100); // 75 - (-25) = 100
        expect(AnalysisUtils.compareEvaluations(cpNeg, cpPos)).toBe(-100); // -25 - 75 = -100
      });

      it('should handle equal centipawn scores', () => {
        const cp100a = {
          score: 100,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };
        const cp100b = {
          score: 100,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        expect(AnalysisUtils.compareEvaluations(cp100a, cp100b)).toBe(0);
      });

      it('should handle zero centipawn scores', () => {
        const cp0 = {
          score: 0,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };
        const cp50 = {
          score: 50,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        expect(AnalysisUtils.compareEvaluations(cp0, cp50)).toBe(-50);
        expect(AnalysisUtils.compareEvaluations(cp50, cp0)).toBe(50);
        expect(AnalysisUtils.compareEvaluations(cp0, cp0)).toBe(0);
      });
    });

    describe('Black to move - centipawn vs centipawn scores', () => {
      it('should prefer lower centipawn score', () => {
        const cp100 = {
          score: 100,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };
        const cp50 = {
          score: 50,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };

        // For Black, lower score is better
        expect(AnalysisUtils.compareEvaluations(cp100, cp50)).toBe(-50); // 50 - 100 = -50 (cp50 is better)
        expect(AnalysisUtils.compareEvaluations(cp50, cp100)).toBe(50); // 100 - 50 = 50 (cp100 is worse)
      });

      it('should handle negative centipawn scores', () => {
        const cpNeg50 = {
          score: -50,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };
        const cpNeg100 = {
          score: -100,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };

        // For Black, -100 is better than -50
        expect(AnalysisUtils.compareEvaluations(cpNeg50, cpNeg100)).toBe(-50); // -100 - (-50) = -50 (cpNeg100 is better)
        expect(AnalysisUtils.compareEvaluations(cpNeg100, cpNeg50)).toBe(50); // -50 - (-100) = 50 (cpNeg50 is worse)
      });

      it('should handle equal centipawn scores', () => {
        const cp100a = {
          score: 100,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };
        const cp100b = {
          score: 100,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };

        expect(AnalysisUtils.compareEvaluations(cp100a, cp100b)).toBe(0);
      });
    });

    describe('White to move - edge cases', () => {
      it('should handle mate in 1 vs high centipawn', () => {
        const mate1 = {
          score: 1,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const cp9999 = {
          score: 9999,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        // Mate in 1 should always beat any centipawn score
        expect(AnalysisUtils.compareEvaluations(mate1, cp9999)).toBe(1);
      });

      it('should handle mate in 0 (immediate mate)', () => {
        const mate0 = {
          score: 0,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const mate1 = {
          score: 1,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };

        // Mate in 0 is better than mate in 1 (shorter mate is better)
        // The function returns negative when first eval is better
        expect(AnalysisUtils.compareEvaluations(mate0, mate1)).toBe(-1);
        expect(AnalysisUtils.compareEvaluations(mate1, mate0)).toBe(1);
      });

      it('should handle very large centipawn differences', () => {
        const cpLarge = {
          score: 10000,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };
        const cpSmall = {
          score: 1,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: true,
        };

        expect(AnalysisUtils.compareEvaluations(cpLarge, cpSmall)).toBe(9999);
      });

      it('should handle very large negative mate scores', () => {
        const mateNeg100 = {
          score: -100,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };
        const mateNeg1 = {
          score: -1,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: true,
        };

        // Getting mated in 1 move is worse than getting mated in 100 moves
        expect(AnalysisUtils.compareEvaluations(mateNeg1, mateNeg100)).toBe(99); // -1 - (-100) = 99
      });
    });

    describe('Black to move - edge cases', () => {
      it('should handle negative mate vs low centipawn', () => {
        const mateNeg1 = {
          score: -1,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };
        const cpNeg1000 = {
          score: -1000,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };

        // Negative mate should always win over centipawn for Black
        expect(
          AnalysisUtils.compareEvaluations(mateNeg1, cpNeg1000)
        ).toBeGreaterThan(0);
        expect(
          AnalysisUtils.compareEvaluations(cpNeg1000, mateNeg1)
        ).toBeLessThan(0);
      });

      it('should handle positive mate vs negative centipawn', () => {
        const mate3 = {
          score: 3,
          scoreType: 'mate' as ScoreType,
          isWhiteToMove: false,
        };
        const cpNeg500 = {
          score: -500,
          scoreType: 'cp' as ScoreType,
          isWhiteToMove: false,
        };

        // For Black, negative centipawn is better than positive mate
        expect(AnalysisUtils.compareEvaluations(mate3, cpNeg500)).toBeLessThan(
          0
        );
        expect(
          AnalysisUtils.compareEvaluations(cpNeg500, mate3)
        ).toBeGreaterThan(0);
      });
    });
  });
});
