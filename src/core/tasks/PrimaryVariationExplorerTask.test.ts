import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PrimaryVariationExplorerTask } from './PrimaryVariationExplorerTask';
import { PVExplorerConfig } from './types/pv-explorer';
import { AnalysisConfig } from '../engine/ChessEngine';
import { ChessProject } from '../project/types';
import * as fs from 'fs';
import * as path from 'path';
import { DEFAULT_STARTING_POSITION } from '../constants';

class MockChessEngine {
  async connect() {
    return Promise.resolve();
  }
  async disconnect() {
    return Promise.resolve();
  }
  getEngineInfo() {
    return { name: 'MockEngine', version: '1.0' };
  }
  async setOption() {
    return Promise.resolve();
  }
  async analyzePosition() {
    return Promise.resolve({
      bestMove: 'e2e4',
      evaluation: { type: 'cp', value: 20 },
      depth: 10,
      nodes: 1000,
      time: 100,
      pv: ['e2e4'],
      multipv: 1,
    });
  }
}

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

  // Add missing getRepository method
  getRepository() {
    return {
      close: async () => Promise.resolve(),
      upsertPosition: async () => Promise.resolve({ id: 1 }),
      upsertEngine: async () => Promise.resolve({ id: 1 }),
      upsertAnalysis: async () => Promise.resolve({ id: 1 }),
    };
  }

  // Add missing storeAnalysisResult method
  async storeAnalysisResult() {
    return Promise.resolve({ id: 1 });
  }

  // Add close method
  async close() {
    return Promise.resolve();
  }

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
  let mockEngine: MockChessEngine;
  let mockAnalysisStoreService: MockAnalysisStoreService;
  let mockProject: ChessProject;
  let analysisConfig: AnalysisConfig;
  let config: PVExplorerConfig;
  let createdExplorers: PrimaryVariationExplorerTask[] = [];

  beforeEach(() => {
    mockEngine = new MockChessEngine();
    mockAnalysisStoreService = new MockAnalysisStoreService();

    // Create mock project
    mockProject = {
      id: 'test-project-id',
      name: 'test-project',
      projectPath: '/tmp/test-project',
      graphPath: '/tmp/test-project/graph.json',
      databasePath: '/tmp/test-project/analysis.db',
      rootPosition: DEFAULT_STARTING_POSITION,
      createdAt: new Date(),
      updatedAt: new Date(),
      config: {},
    };

    analysisConfig = {
      depth: 15,
      time: 1000,
      multiPV: 1,
    };

    config = {
      rootPosition: DEFAULT_STARTING_POSITION,
      maxPositions: 100,
      maxDepthRatio: 1.0,
      databasePath: './test-analysis.db',
      graphPath: './test-graph.json',
    };
  });

  afterEach(async () => {
    // Clean up all created explorers
    for (const explorer of createdExplorers) {
      try {
        await explorer.cleanup();
      } catch (error) {
        // Ignore cleanup errors in tests
      }
    }

    // Clear the array
    createdExplorers = [];
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config,
        mockProject,
        { analysisStore: mockAnalysisStoreService as any }
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
        mockProject,
        { analysisStore: mockAnalysisStoreService as any }
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
        mockProject,
        { analysisStore: mockAnalysisStoreService as any }
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
        mockProject,
        { analysisStore: mockAnalysisStoreService as any }
      );
      createdExplorers.push(explorer);

      expect(explorer.getConfig().maxDepthRatio).toBe(0.8);
    });

    it('should use provided AnalysisStoreService when passed', () => {
      const explorer = new PrimaryVariationExplorerTask(
        mockEngine as any,
        analysisConfig,
        config,
        mockProject,
        { analysisStore: mockAnalysisStoreService as any }
      );
      createdExplorers.push(explorer);

      expect(explorer.getAnalysisStore()).toBe(mockAnalysisStoreService);
    });

    it('should create database directory when no AnalysisStoreService is provided', () => {
      // This test should be updated to expect an error since AnalysisStoreService is now required
      expect(() => {
        new PrimaryVariationExplorerTask(
          mockEngine as any,
          analysisConfig,
          config,
          mockProject
          // No dependencies provided
        );
      }).toThrow('AnalysisStoreService must be provided via dependencies');
    });
  });
});
