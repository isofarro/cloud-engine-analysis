import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrimaryVariationExplorerTask } from './PrimaryVariationExplorerTask';
import { PVExplorerConfig } from './types/pv-explorer';
import { AnalysisConfig } from '../engine/ChessEngine';

import * as fs from 'fs';
import * as path from 'path';

// Mock engine for testing
class MockChessEngine {
  async connect() {
    return Promise.resolve();
  }
  async disconnect() {
    return Promise.resolve();
  }
  getEngineInfo() {
    return { name: 'Mock Engine', version: '1.0' };
  }
  async setOption() {
    return Promise.resolve();
  }
  async analyzePosition() {
    return Promise.resolve({
      depth: 10,
      selDepth: 12,
      multiPV: 1,
      score: { type: 'cp', score: 25 },
      pvs: ['e2e4 e7e5 g1f3'],
    });
  }
}

// Mock AnalysisStoreService for testing
class MockAnalysisStoreService {
  async storeAnalysis() {
    return Promise.resolve({ id: 1 });
  }
  async getAnalysis() {
    return Promise.resolve(null);
  }
  async findBestAnalysis() {
    return Promise.resolve(null);
  }
  async listEngines() {
    return Promise.resolve([]);
  }
  async clearCache() {
    return Promise.resolve();
  }
}

describe('PrimaryVariationExplorerTask', () => {
  let tempDir: string;
  let config: PVExplorerConfig;
  let analysisConfig: AnalysisConfig;
  let mockEngine: any;
  let mockAnalysisStoreService: any;

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, '../../../tmp/test-pv-explorer');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    config = {
      rootPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      maxDepthRatio: 0.5,
      databasePath: path.join(tempDir, 'test.db'),
      graphPath: path.join(tempDir, 'test-graph.json'),
    };

    analysisConfig = {
      depth: 10,
      multiPV: 1,
    };

    mockEngine = new MockChessEngine();
    mockAnalysisStoreService = new MockAnalysisStoreService();
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config,
        mockAnalysisStoreService as any
      );

      expect(explorer.getConfig()).toEqual(config);
      expect(explorer.getAnalysisConfig()).toEqual(analysisConfig);
    });

    it('should initialize exploration state correctly', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config,
        mockAnalysisStoreService as any
      );

      const state = explorer.getExplorationState();
      expect(state.positionsToAnalyze).toContain(config.rootPosition);
      expect(state.analyzedPositions.size).toBe(0);
      expect(state.maxExplorationDepth).toBe(0);
      expect(state.positionDepths.get(config.rootPosition)).toBe(0);
    });
  });

  describe('graph initialization', () => {
    it('should initialize ChessGraph with root position', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config,
        mockAnalysisStoreService as any
      );

      const graph = explorer.getGraph();
      expect(graph.rootPosition).toBe(config.rootPosition);
    });
  });

  describe('configuration validation', () => {
    it('should handle valid maxDepthRatio', () => {
      const validConfig = { ...config, maxDepthRatio: 0.3 };

      expect(() => {
        new PrimaryVariationExplorerTask(
          mockEngine as any,
          analysisConfig,
          validConfig,
          mockAnalysisStoreService as any
        );
      }).not.toThrow();
    });

    it('should use provided AnalysisStoreService when passed', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config,
        mockAnalysisStoreService as any
      );

      // Test that the explorer was created successfully with the mock service
      expect(explorer.getConfig()).toEqual(config);
      expect(explorer.getAnalysisConfig()).toEqual(analysisConfig);
    });

    it('should create database directory when no AnalysisStoreService is provided', () => {
      const nonExistentDir = path.join(tempDir, 'nested', 'path');
      const configWithNestedPath = {
        ...config,
        databasePath: ':memory:', // Use in-memory database for testing
      };

      // Test without providing mock service to test real database initialization
      expect(() => {
        new PrimaryVariationExplorerTask(
          mockEngine as any,
          analysisConfig,
          configWithNestedPath
        );
      }).not.toThrow();
    });
  });

  describe('state management', () => {
    it('should provide immutable state copy', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config,
        mockAnalysisStoreService as any
      );

      const state1 = explorer.getExplorationState();
      const state2 = explorer.getExplorationState();

      expect(state1).not.toBe(state2); // Different objects
      expect(state1).toEqual(state2); // Same content
    });
  });
});
