import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AnalysisTaskExecutor,
  TaskExecutionConfig,
} from './AnalysisTaskExecutor';
import {
  AnalysisDependencies,
  AnalysisStrategy,
  AnalysisContext,
} from '../types';
import { UciAnalysisResult } from '../../engine/types';
import { ChessGraph } from '../../graph/ChessGraph';
import {
  AnalysisStoreService,
  createAnalysisStoreService,
} from '../../analysis-store';
import sqlite3 from 'sqlite3';

// Mock strategy for testing
class MockAnalysisStrategy implements AnalysisStrategy {
  readonly name = 'mock-strategy';
  readonly description = 'Mock strategy for testing';

  async execute(context: AnalysisContext): Promise<UciAnalysisResult[]> {
    return [
      {
        fen: context.position,
        depth: 10,
        selDepth: 12,
        multiPV: 1,
        score: { type: 'cp' as const, score: 25 },
        pvs: ['e2e4'],
        time: 1000,
        nodes: 10000,
        nps: 10000,
      },
    ];
  }

  canExecute(context: AnalysisContext): boolean {
    return true;
  }

  getExecutionEstimate(context: AnalysisContext) {
    return {
      estimatedTimeMs: 5000,
      estimatedPositions: 10,
      complexity: 'medium' as const,
      resumable: true,
    };
  }
}

class FailingMockStrategy implements AnalysisStrategy {
  readonly name = 'failing-strategy';
  readonly description = 'Failing mock strategy for testing';

  async execute(context: AnalysisContext): Promise<UciAnalysisResult[]> {
    throw new Error('Mock strategy failure');
  }

  canExecute(context: AnalysisContext): boolean {
    return true;
  }

  getExecutionEstimate(context: AnalysisContext) {
    return {
      estimatedTimeMs: 5000,
      estimatedPositions: 10,
      complexity: 'medium' as const,
      resumable: true,
    };
  }
}

describe('AnalysisTaskExecutor', () => {
  let executor: AnalysisTaskExecutor;
  let dependencies: AnalysisDependencies;
  let mockStrategy: MockAnalysisStrategy;
  let failingStrategy: FailingMockStrategy;

  beforeEach(async () => {
    const graph = new ChessGraph();
    const db = new sqlite3.Database(':memory:');
    const analysisStore = await createAnalysisStoreService(db);

    mockStrategy = new MockAnalysisStrategy();
    failingStrategy = new FailingMockStrategy();

    const strategyRegistry = {
      register: vi.fn(),
      get: vi.fn((name: string) => {
        if (name === 'mock-strategy') return mockStrategy;
        if (name === 'failing-strategy') return failingStrategy;
        return undefined;
      }),
      list: vi.fn(() => ['mock-strategy', 'failing-strategy']),
      findApplicable: vi.fn(() => [mockStrategy]),
    };

    const projectManager = {
      create: vi.fn(),
      load: vi.fn(),
      save: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
      isValidProject: vi.fn(),
      getAnalysisStore: vi.fn(),
      closeAnalysisStore: vi.fn(),
      loadGraph: vi.fn(),
      saveGraph: vi.fn(),
    };

    dependencies = {
      graph,
      analysisStore,
      strategyRegistry,
      projectManager,
    };

    const config: TaskExecutionConfig = {
      maxExecutionTimeMs: 10000,
      continueOnError: true,
      maxRetries: 2,
    };

    executor = new AnalysisTaskExecutor(dependencies, config);
  });

  describe('executeStrategy', () => {
    it('should execute strategy successfully', async () => {
      const context = {
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        graph: dependencies.graph,
        analysisStore: dependencies.analysisStore,
        config: { depth: 15 },
        project: {
          id: 'test',
          name: 'Test',
          projectPath: '/tmp/test',
          rootPosition:
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          graphPath: '/tmp/test/graph.json',
          databasePath: '/tmp/test/analysis.db',
          createdAt: new Date(),
          updatedAt: new Date(),
          config: {},
        },
      };

      const result = await executor.executeStrategy(
        mockStrategy.name,
        context.position
      );

      expect(result.success).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.metadata.strategiesExecuted).toBe(1);
      expect(result.metadata.strategiesFailed).toBe(0);
    });

    it('should handle strategy failures with retries', async () => {
      const context = {
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        graph: dependencies.graph,
        analysisStore: dependencies.analysisStore,
        config: { depth: 15 },
        project: {
          id: 'test',
          name: 'Test',
          projectPath: '/tmp/test',
          rootPosition:
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          graphPath: '/tmp/test/graph.json',
          databasePath: '/tmp/test/analysis.db',
          createdAt: new Date(),
          updatedAt: new Date(),
          config: {},
        },
      };

      const result = await executor.executeStrategy(
        failingStrategy.name,
        context.position
      );

      await executor.executeStrategy(mockStrategy.name, context.position);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.metadata.strategiesFailed).toBe(1);
    });
  });

  describe('progress tracking', () => {
    it('should track progress during execution', async () => {
      const progressUpdates: any[] = [];

      executor.onProgress(progress => {
        progressUpdates.push(progress);
      });

      const context = {
        position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        graph: dependencies.graph,
        analysisStore: dependencies.analysisStore,
        config: { depth: 15 },
        project: {
          id: 'test',
          name: 'Test',
          projectPath: '/tmp/test',
          rootPosition:
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          graphPath: '/tmp/test/graph.json',
          databasePath: '/tmp/test/analysis.db',
          createdAt: new Date(),
          updatedAt: new Date(),
          config: {},
        },
      };

      await executor.executeStrategy(mockStrategy.name, context.position);

      expect(progressUpdates.length).toBeGreaterThan(0);
    });
  });
});
