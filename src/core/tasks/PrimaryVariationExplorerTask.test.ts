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
  private db: any = null;

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

  // Add cleanup method
  async cleanup() {
    if (this.db) {
      try {
        await new Promise((resolve, reject) => {
          this.db.close((err: any) => {
            if (err) reject(err);
            else resolve(undefined);
          });
        });
      } catch (error) {
        // Ignore cleanup errors
      }
      this.db = null;
    }
  }
}

describe('PrimaryVariationExplorerTask', () => {
  let tempDir: string;
  let config: PVExplorerConfig;
  let analysisConfig: AnalysisConfig;
  let mockEngine: any;
  let mockAnalysisStoreService: MockAnalysisStoreService;
  let createdExplorers: PrimaryVariationExplorerTask[] = [];

  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = path.join(__dirname, '../../../tmp/test-pv-explorer');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Use unique database paths to avoid conflicts
    const testId = Math.random().toString(36).substring(7);
    const dbPath = path.join(tempDir, `test-${testId}.db`);

    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    config = {
      rootPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      maxDepthRatio: 0.5,
      databasePath: dbPath,
      graphPath: path.join(tempDir, `test-graph-${testId}.json`),
    };

    analysisConfig = {
      depth: 10,
      multiPV: 1,
    };

    mockEngine = new MockChessEngine();
    mockAnalysisStoreService = new MockAnalysisStoreService();
    createdExplorers = [];
  });

  afterEach(async () => {
    // Clean up all created explorers and their database connections
    for (const explorer of createdExplorers) {
      try {
        const repo = explorer.getAnalysisRepo();
        if (repo && typeof (repo as any).cleanup === 'function') {
          await (repo as any).cleanup();
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    // Clean up mock service
    try {
      await mockAnalysisStoreService.cleanup();
    } catch (error) {
      // Ignore cleanup errors
    }

    // Wait a bit for database connections to close
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clean up test files
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
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
      createdExplorers.push(explorer);

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
      createdExplorers.push(explorer);

      const state = explorer.getExplorationState();
      expect(state.currentDepth).toBe(0);
      expect(state.exploredPositions).toBe(0);
      expect(state.isComplete).toBe(false);
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
      createdExplorers.push(explorer);

      const graph = explorer.getGraph();
      expect(graph).toBeDefined();
      expect(graph.rootPosition).toBe(config.rootPosition);
    });
  });

  describe('configuration validation', () => {
    it('should handle valid maxDepthRatio', () => {
      const validConfig = { ...config, maxDepthRatio: 0.8 };
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        validConfig,
        mockAnalysisStoreService as any
      );
      createdExplorers.push(explorer);

      expect(explorer.getConfig().maxDepthRatio).toBe(0.8);
    });

    it('should use provided AnalysisStoreService when passed', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config,
        { analysisRepo: mockAnalysisStoreService as any }
      );
      createdExplorers.push(explorer);

      expect(explorer.getAnalysisRepo()).toBe(mockAnalysisStoreService);
    });

    it('should create database directory when no AnalysisStoreService is provided', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config
      );
      createdExplorers.push(explorer);

      const dbDir = path.dirname(config.databasePath);
      expect(fs.existsSync(dbDir)).toBe(true);
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
      createdExplorers.push(explorer);

      const state1 = explorer.getExplorationState();
      const state2 = explorer.getExplorationState();

      expect(state1).not.toBe(state2); // Different object references
      expect(state1).toEqual(state2); // Same content
    });
  });
});
