import { describe, it, expect, beforeEach } from 'vitest';
import { AnalysisChecker, AnalysisCheckerConfig } from './AnalysisChecker';
import {
  AnalysisStoreService,
  createAnalysisStoreService,
} from '../../analysis-store';
import sqlite3 from 'sqlite3';
import { DEFAULT_STARTING_POSITION } from '../../constants';

describe('AnalysisChecker', () => {
  let checker: AnalysisChecker;
  let analysisStoreService: AnalysisStoreService;
  let db: sqlite3.Database;

  beforeEach(async () => {
    db = new sqlite3.Database(':memory:');
    analysisStoreService = await createAnalysisStoreService(db);

    const config: AnalysisCheckerConfig = {
      minDepth: 10,
      maxAgeDays: 30,
      preferHigherDepth: true,
    };

    checker = new AnalysisChecker(analysisStoreService, config);
  });

  describe('checkPosition', () => {
    it('should return needs analysis for unanalyzed position', async () => {
      const position = DEFAULT_STARTING_POSITION;
      const result = await checker.checkPosition(position);

      expect(result.hasAnalysis).toBe(false);
      expect(result.bestAnalysis).toBeUndefined();
      expect(result.meetsRequirements).toBe(false);
      expect(result.requirementFailureReason).toBe('No analysis found');
    });
  });

  describe('checkPositions', () => {
    it('should check multiple positions efficiently', async () => {
      const positions = [
        DEFAULT_STARTING_POSITION,
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
        'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
      ];

      const results = await checker.checkPositions(positions);

      expect(results.results.size).toBe(3);
      expect(results.summary.total).toBe(3);
      expect(results.summary.needsAnalysis).toBe(3);
      expect(results.summary.analyzed).toBe(0);
    });
  });
});
