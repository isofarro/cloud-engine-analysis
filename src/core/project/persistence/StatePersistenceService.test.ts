import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatePersistenceService } from './StatePersistenceService';
import { StatePersistenceConfig } from './types';
import * as fs from 'fs';
import { DEFAULT_STARTING_POSITION } from '../../constants';

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
        positionsToAnalyze: [DEFAULT_STARTING_POSITION],
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

      // Line 55
      await service.saveState(
        'test-session',
        'pv-explore', // ← Changed from 'pv-exploration' to 'pv-explore'
        'test-project',
        DEFAULT_STARTING_POSITION,
        state,
        { maxDepth: 5 }
      );

      expect(fs.existsSync(TEST_STATE_DIR)).toBe(true);
    });
  });

  describe('loadState', () => {
    it('should restore previously saved state', async () => {
      const originalState = {
        positionsToAnalyze: [DEFAULT_STARTING_POSITION],
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

      // Line 87
      await service.saveState(
        'restore-test',
        'pv-explore', // ← Changed from 'pv-exploration' to 'pv-explore'
        'test-project',
        DEFAULT_STARTING_POSITION,
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

      // Line 121
      await service.saveState(
        'session1',
        'pv-explore', // ← Changed from 'pv-exploration' to 'pv-explore'
        'project1',
        DEFAULT_STARTING_POSITION,
        testState,
        {}
      );

      // Line 130
      await service.saveState(
        'session2',
        'pv-explore', // ← Changed from 'pv-exploration' to 'pv-explore'
        'project2',
        DEFAULT_STARTING_POSITION,
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
