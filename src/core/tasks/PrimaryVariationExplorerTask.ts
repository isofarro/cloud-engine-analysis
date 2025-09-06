import { ChessEngine, AnalysisConfig } from '../engine/ChessEngine';
import { AnalysisResult } from '../engine/types';
import { ChessGraph } from '../graph/ChessGraph';
import { saveGraph, loadGraph } from '../utils/graph';
import { AnalysisStoreService } from '../analysis-store/AnalysisStoreService';
import { AnalysisRepo } from '../analysis-store/AnalysisRepo';
import { IAnalysisRepo } from '../analysis-store/IAnalysisRepo';
import { PVExplorerConfig, ExplorationState } from './types/pv-explorer';
import { FenString } from '../types';
import { PVExplorationStrategy } from '../project/strategies/PVExplorationStrategy';
import { PVExplorationConfig } from '../project/strategies/types';
import { AnalysisContext } from '../project/types';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { StrategyContext, ProgressUpdate } from '../project/strategies/types';

/**
 * Primary Variation Explorer Task (Refactored)
 *
 * Now uses dependency injection and delegates core exploration logic
 * to PVExplorationStrategy for better modularity and testability.
 * Maintains backward compatibility with existing usage patterns.
 */
export class PrimaryVariationExplorerTask {
  private engine: ChessEngine;
  private analysisConfig: AnalysisConfig;
  private config: PVExplorerConfig;
  private graph: ChessGraph;
  private analysisRepo: IAnalysisRepo;
  private strategy: PVExplorationStrategy;
  private state: ExplorationState;

  constructor(
    engine: ChessEngine,
    analysisConfig: AnalysisConfig,
    config: PVExplorerConfig,
    dependencies?: {
      graph?: ChessGraph;
      analysisRepo?: IAnalysisRepo;
      strategy?: PVExplorationStrategy;
    }
  ) {
    this.engine = engine;
    this.analysisConfig = analysisConfig;
    this.config = config;

    // Initialize dependencies with fallbacks for backward compatibility
    this.graph = dependencies?.graph || this.initializeGraph();
    this.analysisRepo =
      dependencies?.analysisRepo || this.initializeAnalysisRepo();

    // Create strategy if not provided
    if (dependencies?.strategy) {
      this.strategy = dependencies.strategy;
    } else {
      const strategyConfig: PVExplorationConfig = {
        maxDepthRatio: config.maxDepthRatio,
        maxPositions: config.maxPositions,
        exploreAlternatives: false, // Default for backward compatibility
        alternativeThreshold: 50, // Default threshold in centipawns
      };
      this.strategy = new PVExplorationStrategy(
        engine,
        analysisConfig,
        strategyConfig
      );
    }

    // Initialize exploration state for backward compatibility
    this.state = {
      positionsToAnalyze: [config.rootPosition],
      analyzedPositions: new Set(),
      maxExplorationDepth: 0,
      positionDepths: new Map([[config.rootPosition, 0]]),
    };
  }

  /**
   * Main exploration method - now delegates to strategy
   */
  async explore(): Promise<void> {
    console.log(
      `Starting Primary Variation exploration from: ${this.config.rootPosition}`
    );
    console.log(
      `Analysis config: depth=${this.analysisConfig.depth}, time=${this.analysisConfig.time}, multiPV=${this.analysisConfig.multiPV}`
    );
    console.log(`Max depth ratio: ${this.config.maxDepthRatio}`);

    try {
      // Create strategy context (not just AnalysisContext)
      const context: StrategyContext = {
        position: this.config.rootPosition,
        graph: this.graph,
        analysisRepo: this.analysisRepo,
        config: {
          depth: this.analysisConfig.depth,
          timeLimit: this.analysisConfig.time,
          multiPv: this.analysisConfig.multiPV,
          engineOptions: {},
        },
        project: {
          id: 'legacy-pv-explorer',
          name: 'Legacy PV Explorer',
          projectPath: path.dirname(this.config.graphPath),
          rootPosition: this.config.rootPosition,
          graphPath: this.config.graphPath,
          databasePath: this.config.databasePath,
          createdAt: new Date(),
          updatedAt: new Date(),
          config: {},
        },
        metadata: {
          legacyMode: true,
          originalConfig: this.config,
        },
        state: { pvExploration: undefined },
        onProgress: (progress: ProgressUpdate) => {
          console.log(
            `📊 Progress: ${progress.percentage.toFixed(1)}% - ${progress.operation}`
          );
        },
      };

      // Execute strategy with properly typed context
      const results = await this.strategy.execute(context);

      // Save graph after exploration
      this.saveGraph();

      console.log('\n✅ Primary Variation exploration completed successfully!');
      console.log(`📊 Total analysis results: ${results.length}`);
      console.log(`📁 ChessGraph saved to: ${this.config.graphPath}`);
      console.log(`🗄️  Analysis database: ${this.config.databasePath}`);
    } catch (error) {
      console.error('❌ Error during exploration:', error);
      throw error;
    }
  }

  /**
   * Initialize the ChessGraph - either load from existing file or create new
   */
  private initializeGraph(): ChessGraph {
    if (this.config.graphPath && fs.existsSync(this.config.graphPath)) {
      try {
        console.log(`Loading existing graph from: ${this.config.graphPath}`);
        const loadedGraph = loadGraph(this.config.graphPath);

        // Verify the loaded graph has the expected root position
        if (loadedGraph.rootPosition !== this.config.rootPosition) {
          console.warn(
            `Warning: Loaded graph root position (${loadedGraph.rootPosition}) ` +
              `differs from config root position (${this.config.rootPosition}). ` +
              `Using loaded graph's root position.`
          );
        }
        return loadedGraph;
      } catch (error) {
        console.warn(
          `Failed to load graph from ${this.config.graphPath}: ${error}. ` +
            `Creating new graph instead.`
        );
        return new ChessGraph(this.config.rootPosition);
      }
    } else {
      console.log('Creating new ChessGraph');
      return new ChessGraph(this.config.rootPosition);
    }
  }

  /**
   * Initialize the analysis repository
   */
  private initializeAnalysisRepo(): IAnalysisRepo {
    // Ensure database directory exists
    const dbDir = path.dirname(this.config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database and repository
    const db = new sqlite3.Database(this.config.databasePath);
    return new AnalysisRepo(db);
  }

  /**
   * Save the ChessGraph to file
   */
  private saveGraph(): void {
    try {
      const graphDir = path.dirname(this.config.graphPath);
      if (!fs.existsSync(graphDir)) {
        fs.mkdirSync(graphDir, { recursive: true });
      }

      const filename = path.basename(this.config.graphPath);
      const directory = path.dirname(this.config.graphPath);

      saveGraph(this.graph, filename, directory);
    } catch (error) {
      console.error('❌ Error saving graph:', error);
      // Don't throw - continue exploration even if graph save fails
    }
  }

  /**
   * Get the current exploration state (for monitoring/debugging)
   * Now delegates to strategy when possible
   */
  getExplorationState(): ExplorationState {
    // Try to get state from strategy first
    const strategyState = this.strategy.getExplorationState({
      position: this.config.rootPosition,
      graph: this.graph,
      analysisRepo: this.analysisRepo,
      config: {},
      project: {} as any,
      state: { pvExploration: undefined },
    });

    if (strategyState) {
      // Convert strategy state to legacy format
      return {
        positionsToAnalyze: strategyState.positionsToAnalyze,
        analyzedPositions: strategyState.analyzedPositions,
        maxExplorationDepth: strategyState.maxDepth,
        positionDepths: strategyState.positionDepths,
      };
    }

    // Fallback to legacy state
    return { ...this.state };
  }

  /**
   * Get the current ChessGraph
   */
  getGraph(): ChessGraph {
    return this.graph;
  }

  /**
   * Get analysis configuration
   */
  getAnalysisConfig(): AnalysisConfig {
    return this.analysisConfig;
  }

  /**
   * Get explorer configuration
   */
  getConfig(): PVExplorerConfig {
    return this.config;
  }

  /**
   * Get the strategy instance (for advanced usage)
   */
  getStrategy(): PVExplorationStrategy {
    return this.strategy;
  }

  /**
   * Get the analysis repository (for advanced usage)
   */
  getAnalysisRepo(): IAnalysisRepo {
    return this.analysisRepo;
  }
}
