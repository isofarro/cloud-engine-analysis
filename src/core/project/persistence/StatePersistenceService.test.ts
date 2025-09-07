import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatePersistenceService } from './StatePersistenceService';
import { StatePersistenceConfig } from './types';
import * as fs from 'fs';

const TEST_STATE_DIR = './tmp/test-state';

describe('StatePersistenceService', () => {
  let service: StatePersistenceService;
  let config: StatePersistenceConfig;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }

    config = {
      stateDirectory: TEST_STATE_DIR,
      autoSaveIntervalMs: 1000,
      maxSnapshots: 10,
      compress: false,
    };

    service = new StatePersistenceService(config);
  });

  afterEach(() => {
    if (fs.existsSync(TEST_STATE_DIR)) {
      fs.rmSync(TEST_STATE_DIR, { recursive: true, force: true });
    }
  });

  describe('saveState', () => {
    it('should save PV exploration state', async () => {
      const state = {
        positionsToAnalyze: [
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        ],
        analyzedPositions: new Set<string>(),
        currentDepth: 0,
        maxDepth: 5,
        positionDepths: new Map<string, number>(),
        stats: {
          totalAnalyzed: 0,
          totalDiscovered: 1,
          startTime: new Date(),
          lastUpdate: new Date(),
          avgTimePerPosition: 0,
        },
      };

      await service.saveState(
        'test-session',
        'pv-exploration',
        'test-project',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        state,
        { maxDepth: 5 }
      );

      expect(fs.existsSync(TEST_STATE_DIR)).toBe(true);
    });
  });

  describe('loadState', () => {
    it('should restore previously saved state', async () => {
      const originalState = {
        positionsToAnalyze: [
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        ],
        analyzedPositions: new Set(['test-position']),
        currentDepth: 0,
        maxDepth: 5,
        positionDepths: new Map([['test-position', 2]]),
        stats: {
          totalAnalyzed: 1,
          totalDiscovered: 2,
          startTime: new Date(),
          lastUpdate: new Date(),
          avgTimePerPosition: 1000,
        },
      };

      await service.saveState(
        'restore-test',
        'pv-exploration',
        'test-project',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        originalState,
        { maxDepth: 5 }
      );

      const restored = await service.loadState('restore-test');

      expect(restored.success).toBe(true);
      expect(restored.state).toBeDefined();
      expect(restored.state?.state?.maxDepth).toBe(5);
    });
  });

  describe('listSavedStates', () => {
    it('should list all saved sessions', async () => {
      const testState = {
        positionsToAnalyze: [],
        analyzedPositions: new Set<string>(),
        currentDepth: 0,
        maxDepth: 5,
        positionDepths: new Map<string, number>(),
        stats: {
          totalAnalyzed: 0,
          totalDiscovered: 1,
          startTime: new Date(),
          lastUpdate: new Date(),
          avgTimePerPosition: 0,
        },
      };

      await service.saveState(
        'session1',
        'pv-exploration',
        'project1',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        testState,
        {}
      );

      await service.saveState(
        'session2',
        'pv-exploration',
        'project2',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        testState,
        {}
      );

      const sessions = await service.listSavedStates();

      expect(sessions.length).toBe(2);
      expect(sessions.some(s => s.sessionId === 'session1')).toBe(true);
      expect(sessions.some(s => s.sessionId === 'session2')).toBe(true);
    });
  });
});
