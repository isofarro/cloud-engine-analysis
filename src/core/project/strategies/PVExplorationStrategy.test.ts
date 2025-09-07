import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PVExplorationStrategy } from './PVExplorationStrategy';
import { PVExplorationConfig, StrategyContext } from './types';
import { AnalysisConfig } from '../../engine/ChessEngine';
import { ChessGraph } from '../../graph/ChessGraph';
import { AnalysisRepo } from '../../analysis-store/AnalysisRepo';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

// Mock engine for testing
class MockChessEngine {
  private status: 'idle' | 'analyzing' | 'error' | 'disconnected' = 'idle';
  public client: any;
  private currentPosition: string =
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  constructor() {
    this.client = {
      _status: 'idle',
      listeners: new Map(),
      on: function (event: string, callback: Function) {
        if (!this.listeners.has(event)) {
          this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
      },
      off: function (event: string, callback: Function) {
        if (this.listeners.has(event)) {
          const callbacks = this.listeners.get(event);
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      },
      emit: function (event: string, data: any) {
        if (this.listeners.has(event)) {
          this.listeners.get(event).forEach((callback: Function) => {
            callback(data);
          });
        }
      },
      execute: (command: string, args?: string[]) => {
        // Handle UCI commands
        if (command === 'position') {
          // Update current position when position command is sent
          if (args && args.length > 0) {
            if (args[0] === 'fen' && args.length > 6) {
              this.currentPosition = args.slice(1, 7).join(' ');
            } else if (args[0] === 'startpos') {
              this.currentPosition =
                'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
              // Handle moves after startpos
              if (args.includes('moves')) {
                const movesIndex = args.indexOf('moves');
                const moves = args.slice(movesIndex + 1);
                // For simplicity, we'll track some basic positions
                if (moves.length === 1 && moves[0] === 'e2e4') {
                  this.currentPosition =
                    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
                } else if (
                  moves.length === 2 &&
                  moves[0] === 'e2e4' &&
                  moves[1] === 'e7e5'
                ) {
                  this.currentPosition =
                    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
                } else if (
                  moves.length === 3 &&
                  moves[0] === 'e2e4' &&
                  moves[1] === 'e7e5' &&
                  moves[2] === 'g1f3'
                ) {
                  this.currentPosition =
                    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
                } else if (
                  moves.length === 4 &&
                  moves[0] === 'e2e4' &&
                  moves[1] === 'e7e5' &&
                  moves[2] === 'g1f3' &&
                  moves[3] === 'b8c6'
                ) {
                  this.currentPosition =
                    'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
                }
              }
            }
          }
        } else if (command === 'go') {
          // Simulate analysis with position-appropriate moves
          setTimeout(() => {
            const analysisResult = this.getPositionAnalysis();
            this.client.emit('info', {
              type: 'pv',
              depth: 15,
              selDepth: 18,
              multiPV: 1,
              score: { type: 'cp', score: analysisResult.score },
              pv: analysisResult.pv,
              time: 1000,
              nodes: 50000,
              nps: 50000,
            });

            // Emit bestmove to complete analysis
            setTimeout(() => {
              this.client.emit('bestmove', { bestmove: analysisResult.pv[0] });
            }, 10);
          }, 10);
        }
      },
      setUciOption: () => {},
    };
  }

  private getPositionAnalysis() {
    // Return position-specific analysis based on current position
    if (
      this.currentPosition ===
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    ) {
      // Starting position
      return {
        pv: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
        score: 30,
      };
    } else if (
      this.currentPosition ===
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1'
    ) {
      // After 1.e4
      return {
        pv: ['e7e5', 'g1f3', 'b8c6', 'd2d4'],
        score: 25,
      };
    } else if (
      this.currentPosition ===
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2'
    ) {
      // After 1.e4 e5
      return {
        pv: ['g1f3', 'b8c6', 'f1b5', 'a7a6'],
        score: 20,
      };
    } else if (
      this.currentPosition ===
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2'
    ) {
      // After 1.e4 e5 2.Nf3
      return {
        pv: ['b8c6', 'f1b5', 'a7a6', 'b5a4'],
        score: 15,
      };
    } else if (
      this.currentPosition ===
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3'
    ) {
      // After 1.e4 e5 2.Nf3 Nc6
      return {
        pv: ['f1b5', 'a7a6', 'b5a4', 'g8f6'],
        score: 10,
      };
    } else {
      // Default fallback for unknown positions
      return {
        pv: ['d2d4', 'd7d5', 'g1f3', 'g8f6'],
        score: 0,
      };
    }
  }

  async connect() {
    this.status = 'idle';
    this.client._status = 'idle';
    return Promise.resolve();
  }

  async disconnect() {
    this.status = 'disconnected';
    this.client._status = 'disconnected';
    return Promise.resolve();
  }

  getEngineInfo() {
    return { name: 'MockEngine', version: '1.0' };
  }

  getStatus() {
    return this.status;
  }

  isConnected() {
    return this.status !== 'disconnected';
  }

  async setOption() {
    return Promise.resolve();
  }

  async analyzePosition() {
    // This method is not used by PositionAnalysisTask
    // The task uses client.execute directly
    const analysisResult = this.getPositionAnalysis();
    return Promise.resolve({
      depth: 15,
      selDepth: 18,
      multiPV: 1,
      score: { type: 'cp', score: analysisResult.score },
      pvs: [analysisResult.pv.join(' ')],
      time: 1000,
      nodes: 50000,
      nps: 50000,
    });
  }
}

const TEST_DIR = './tmp/test-pv-strategy';

describe('PVExplorationStrategy', () => {
  let strategy: PVExplorationStrategy;
  let mockEngine: MockChessEngine;
  let analysisConfig: AnalysisConfig;
  let strategyConfig: PVExplorationConfig;
  let context: StrategyContext;
  let graph: ChessGraph;
  let analysisRepo: AnalysisRepo;

  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    mockEngine = new MockChessEngine();
    analysisConfig = { depth: 15, multiPV: 1 };
    strategyConfig = {
      maxDepthRatio: 0.6,
      maxPositions: 100,
      exploreAlternatives: false,
      alternativeThreshold: 50,
    };

    strategy = new PVExplorationStrategy(
      mockEngine as any,
      analysisConfig,
      strategyConfig
    );

    // Initialize test dependencies
    graph = new ChessGraph(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
    const db = new sqlite3.Database(':memory:');
    analysisRepo = new AnalysisRepo(db);

    context = {
      position: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      graph,
      analysisRepo,
      config: analysisConfig,
      project: {
        id: 'test-project',
        name: 'Test Project',
        projectPath: TEST_DIR,
        rootPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKQ - 0 1',
        graphPath: path.join(TEST_DIR, 'graph.json'),
        databasePath: path.join(TEST_DIR, 'analysis.db'),
        createdAt: new Date(),
        updatedAt: new Date(),
        config: {},
      },
      state: {
        pvExploration: {
          positionsToAnalyze: [],
          analyzedPositions: new Set<string>(),
          currentDepth: 0,
          maxDepth: 9,
          positionDepths: new Map<string, number>(),
          stats: {
            totalAnalyzed: 0,
            totalDiscovered: 0,
            startTime: new Date(),
            lastUpdate: new Date(),
            avgTimePerPosition: 0,
          },
        },
      },
    };
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('canExecute', () => {
    it('should return true for valid context', () => {
      const canExecute = strategy.canExecute(context);
      expect(canExecute).toBe(true);
    });

    it('should return false for invalid FEN', () => {
      const invalidContext = { ...context, position: 'invalid-fen' };
      const canExecute = strategy.canExecute(invalidContext);
      expect(canExecute).toBe(false);
    });
  });

  describe('getExecutionEstimate', () => {
    it('should provide reasonable execution estimate', () => {
      const estimate = strategy.getExecutionEstimate(context);

      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
      expect(estimate.estimatedPositions).toBeGreaterThan(0);
      expect(['low', 'medium', 'high']).toContain(estimate.complexity);
      expect(estimate.resumable).toBe(true);
    });
  });

  describe('execute', () => {
    it('should execute PV exploration successfully', async () => {
      const progressUpdates: any[] = [];
      const contextWithProgress = {
        ...context,
        onProgress: (progress: any) => progressUpdates.push(progress),
      };

      const results = await strategy.execute(contextWithProgress);

      expect(results).toBeInstanceOf(Array);
      expect(results.length).toBeGreaterThan(0);
      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it('should handle exploration with alternatives', async () => {
      const alternativeConfig = {
        ...strategyConfig,
        exploreAlternatives: true,
        alternativeThreshold: 30,
      };

      const alternativeStrategy = new PVExplorationStrategy(
        mockEngine as any,
        analysisConfig,
        alternativeConfig
      );

      const results = await alternativeStrategy.execute(context);
      expect(results).toBeInstanceOf(Array);
    });
  });

  describe('getExplorationState', () => {
    it('should return current exploration state', () => {
      const state = strategy.getExplorationState(context);

      expect(state).toHaveProperty('positionsToAnalyze');
      expect(state).toHaveProperty('analyzedPositions');
      expect(state).toHaveProperty('maxDepth');
      expect(state).toHaveProperty('positionDepths');
    });
  });
});
