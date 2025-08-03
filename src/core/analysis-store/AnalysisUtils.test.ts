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
        };
        const cpEval = {
          score: 1000,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(mateEval, cpEval, true)).toBe(
          1
        );
        expect(AnalysisUtils.compareEvaluations(cpEval, mateEval, true)).toBe(
          -1
        );
      });

      it('should prefer any centipawn score over negative mate', () => {
        const negMateEval = {
          score: -3,
          scoreType: 'mate' as ScoreType,
        };
        const cpEval = {
          score: -500,
          scoreType: 'cp' as ScoreType,
        };

        expect(
          AnalysisUtils.compareEvaluations(negMateEval, cpEval, true)
        ).toBe(-1);
        expect(
          AnalysisUtils.compareEvaluations(cpEval, negMateEval, true)
        ).toBe(1);
      });
    });

    describe('Black to move - centipawn vs mate scores', () => {
      it('should prefer negative mate over any centipawn score', () => {
        const mateEval = {
          score: -3,
          scoreType: 'mate' as ScoreType,
        };
        const cpEval = {
          score: -1000,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(mateEval, cpEval, false)).toBe(
          1
        );
        expect(AnalysisUtils.compareEvaluations(cpEval, mateEval, false)).toBe(
          -1
        );
      });

      it('should prefer any centipawn score over positive mate', () => {
        const posMateEval = {
          score: 3,
          scoreType: 'mate' as ScoreType,
        };
        const cpEval = {
          score: 500,
          scoreType: 'cp' as ScoreType,
        };

        expect(
          AnalysisUtils.compareEvaluations(posMateEval, cpEval, false)
        ).toBe(-1);
        expect(
          AnalysisUtils.compareEvaluations(cpEval, posMateEval, false)
        ).toBe(1);
      });
    });

    describe('White to move - mate vs mate scores', () => {
      it('should prefer shorter positive mate', () => {
        const mate2 = {
          score: 2,
          scoreType: 'mate' as ScoreType,
        };
        const mate5 = {
          score: 5,
          scoreType: 'mate' as ScoreType,
        };

        // Mate in 2 is better than mate in 5
        expect(AnalysisUtils.compareEvaluations(mate2, mate5, true)).toBe(3); // 5 - 2 = 3
        expect(AnalysisUtils.compareEvaluations(mate5, mate2, true)).toBe(-3); // 2 - 5 = -3
      });

      it('should prefer higher (closer to 0) negative mate', () => {
        const mate2 = {
          score: -2,
          scoreType: 'mate' as ScoreType,
        };
        const mate5 = {
          score: -5,
          scoreType: 'mate' as ScoreType,
        };

        // Mate in -2 is better than mate in -5 (getting mated in 2 vs 5 moves)
        expect(AnalysisUtils.compareEvaluations(mate2, mate5, true)).toBe(3); // -2 - (-5) = 3
        expect(AnalysisUtils.compareEvaluations(mate5, mate2, true)).toBe(-3); // -5 - (-2) = -3
      });

      it('should handle mixed sign mate scores', () => {
        const posMate = {
          score: 3,
          scoreType: 'mate' as ScoreType,
        };
        const negMate = {
          score: -2,
          scoreType: 'mate' as ScoreType,
        };

        // Positive mate is always better than negative mate for White
        expect(AnalysisUtils.compareEvaluations(posMate, negMate, true)).toBe(
          5
        ); // 3 - (-2) = 5
        expect(AnalysisUtils.compareEvaluations(negMate, posMate, true)).toBe(
          -5
        ); // -2 - 3 = -5
      });

      it('should handle equal mate scores', () => {
        const mate3a = {
          score: 3,
          scoreType: 'mate' as ScoreType,
        };
        const mate3b = {
          score: 3,
          scoreType: 'mate' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(mate3a, mate3b, true)).toBe(0);
      });
    });

    describe('Black to move - mate vs mate scores', () => {
      it('should prefer shorter negative mate', () => {
        const mate2 = {
          score: -2,
          scoreType: 'mate' as ScoreType,
        };
        const mate5 = {
          score: -5,
          scoreType: 'mate' as ScoreType,
        };

        // For Black, mate in -2 is better than mate in -5
        expect(AnalysisUtils.compareEvaluations(mate2, mate5, false)).toBe(3); // -2 - (-5) = 3
        expect(AnalysisUtils.compareEvaluations(mate5, mate2, false)).toBe(-3); // -5 - (-2) = -3
      });

      it('should prefer higher (closer to 0) positive mate', () => {
        const mate2 = {
          score: 2,
          scoreType: 'mate' as ScoreType,
        };
        const mate5 = {
          score: 5,
          scoreType: 'mate' as ScoreType,
        };

        // For Black, mate in 5 is better than mate in 2 (less bad)
        expect(AnalysisUtils.compareEvaluations(mate2, mate5, false)).toBe(3); // 5 - 2 = 3 (mate5 is better)
        expect(AnalysisUtils.compareEvaluations(mate5, mate2, false)).toBe(-3); // 2 - 5 = -3 (mate2 is worse)
      });

      it('should handle mixed sign mate scores', () => {
        const posMate = {
          score: 3,
          scoreType: 'mate' as ScoreType,
        };
        const negMate = {
          score: -2,
          scoreType: 'mate' as ScoreType,
        };

        // For Black, negative mate is always better than positive mate
        expect(AnalysisUtils.compareEvaluations(posMate, negMate, false)).toBe(
          -5
        ); // -2 - 3 = -5
        expect(AnalysisUtils.compareEvaluations(negMate, posMate, false)).toBe(
          5
        ); // 3 - (-2) = 5
      });
    });

    describe('White to move - centipawn vs centipawn scores', () => {
      it('should prefer higher centipawn score', () => {
        const cp100 = {
          score: 100,
          scoreType: 'cp' as ScoreType,
        };
        const cp50 = {
          score: 50,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(cp100, cp50, true)).toBe(50); // 100 - 50 = 50
        expect(AnalysisUtils.compareEvaluations(cp50, cp100, true)).toBe(-50); // 50 - 100 = -50
      });

      it('should handle negative centipawn scores', () => {
        const cpNeg50 = {
          score: -50,
          scoreType: 'cp' as ScoreType,
        };
        const cpNeg100 = {
          score: -100,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(cpNeg50, cpNeg100, true)).toBe(
          50
        ); // -50 - (-100) = 50
        expect(AnalysisUtils.compareEvaluations(cpNeg100, cpNeg50, true)).toBe(
          -50
        ); // -100 - (-50) = -50
      });

      it('should handle mixed sign centipawn scores', () => {
        const cpPos = {
          score: 75,
          scoreType: 'cp' as ScoreType,
        };
        const cpNeg = {
          score: -25,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(cpPos, cpNeg, true)).toBe(100); // 75 - (-25) = 100
        expect(AnalysisUtils.compareEvaluations(cpNeg, cpPos, true)).toBe(-100); // -25 - 75 = -100
      });

      it('should handle equal centipawn scores', () => {
        const cp100a = {
          score: 100,
          scoreType: 'cp' as ScoreType,
        };
        const cp100b = {
          score: 100,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(cp100a, cp100b, true)).toBe(0);
      });

      it('should handle zero centipawn scores', () => {
        const cp0 = { score: 0, scoreType: 'cp' as ScoreType };
        const cp50 = { score: 50, scoreType: 'cp' as ScoreType };

        expect(AnalysisUtils.compareEvaluations(cp0, cp50, true)).toBe(-50);
        expect(AnalysisUtils.compareEvaluations(cp50, cp0, true)).toBe(50);
        expect(AnalysisUtils.compareEvaluations(cp0, cp0, true)).toBe(0);
      });
    });

    describe('Black to move - centipawn vs centipawn scores', () => {
      it('should prefer lower centipawn score', () => {
        const cp100 = {
          score: 100,
          scoreType: 'cp' as ScoreType,
        };
        const cp50 = {
          score: 50,
          scoreType: 'cp' as ScoreType,
        };

        // For Black, lower score is better
        expect(AnalysisUtils.compareEvaluations(cp100, cp50, false)).toBe(-50); // 50 - 100 = -50 (cp50 is better)
        expect(AnalysisUtils.compareEvaluations(cp50, cp100, false)).toBe(50); // 100 - 50 = 50 (cp100 is worse)
      });

      it('should handle negative centipawn scores', () => {
        const cpNeg50 = {
          score: -50,
          scoreType: 'cp' as ScoreType,
        };
        const cpNeg100 = {
          score: -100,
          scoreType: 'cp' as ScoreType,
        };

        // For Black, -100 is better than -50
        expect(AnalysisUtils.compareEvaluations(cpNeg50, cpNeg100, false)).toBe(
          -50
        ); // -100 - (-50) = -50 (cpNeg100 is better)
        expect(AnalysisUtils.compareEvaluations(cpNeg100, cpNeg50, false)).toBe(
          50
        ); // -50 - (-100) = 50 (cpNeg50 is worse)
      });

      it('should handle equal centipawn scores', () => {
        const cp100a = {
          score: 100,
          scoreType: 'cp' as ScoreType,
        };
        const cp100b = {
          score: 100,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(cp100a, cp100b, false)).toBe(0);
      });
    });

    describe('White to move - edge cases', () => {
      it('should prefer mate over very high centipawn', () => {
        const mate1 = {
          score: 1,
          scoreType: 'mate' as ScoreType,
        };
        const cp9999 = {
          score: 9999,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(mate1, cp9999, true)).toBe(1);
      });

      it('should handle mate in 0 vs mate in 1', () => {
        const mate0 = {
          score: 0,
          scoreType: 'mate' as ScoreType,
        };
        const mate1 = {
          score: 1,
          scoreType: 'mate' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(mate0, mate1, true)).toBe(-1);
        expect(AnalysisUtils.compareEvaluations(mate1, mate0, true)).toBe(1);
      });

      it('should handle very large centipawn differences', () => {
        const cpLarge = {
          score: 10000,
          scoreType: 'cp' as ScoreType,
        };
        const cpSmall = {
          score: 1,
          scoreType: 'cp' as ScoreType,
        };

        expect(AnalysisUtils.compareEvaluations(cpLarge, cpSmall, true)).toBe(
          9999
        );
      });
    });

    describe('Black to move - edge cases', () => {
      it('should prefer negative mate over low centipawn', () => {
        const mateNeg1 = {
          score: -1,
          scoreType: 'mate' as ScoreType,
        };
        const mateNeg100 = {
          score: -100,
          scoreType: 'mate' as ScoreType,
        };

        // For Black, -1 is better than -100 (shorter mate)
        expect(
          AnalysisUtils.compareEvaluations(mateNeg1, mateNeg100, false)
        ).toBe(99); // -1 - (-100) = 99
      });

      it('should prefer negative mate over negative centipawn', () => {
        const mateNeg1 = {
          score: -1,
          scoreType: 'mate' as ScoreType,
        };
        const cpNeg1000 = {
          score: -1000,
          scoreType: 'cp' as ScoreType,
        };

        // Negative mate is always better than centipawn for Black
        expect(
          AnalysisUtils.compareEvaluations(mateNeg1, cpNeg1000, false)
        ).toBe(1);
        expect(
          AnalysisUtils.compareEvaluations(cpNeg1000, mateNeg1, false)
        ).toBe(-1);
      });

      it('should prefer positive mate over negative centipawn', () => {
        const mate3 = {
          score: 3,
          scoreType: 'mate' as ScoreType,
        };
        const cpNeg500 = {
          score: -500,
          scoreType: 'cp' as ScoreType,
        };

        // For Black, positive mate is worse than negative centipawn
        expect(
          AnalysisUtils.compareEvaluations(mate3, cpNeg500, false)
        ).toBeLessThan(0);
        expect(
          AnalysisUtils.compareEvaluations(cpNeg500, mate3, false)
        ).toBeGreaterThan(0);
      });
    });
  });
});
