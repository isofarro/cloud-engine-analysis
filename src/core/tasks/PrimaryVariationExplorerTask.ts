import { ChessEngine, AnalysisConfig } from '../engine/ChessEngine';
import { ChessGraph } from '../graph/ChessGraph';
import { saveGraph, loadGraph } from '../utils/graph';
import { AnalysisStoreService } from '../analysis-store';
import { PVExplorerConfig, ExplorationState } from './types/pv-explorer';
import { PVExplorationStrategy } from '../project/strategies/PVExplorationStrategy';
import { PVExplorationConfig } from '../project/strategies/types';
import * as fs from 'fs';
import * as path from 'path';
import { StrategyContext, ProgressUpdate } from '../project/strategies/types';
import { FenString } from '../types';
import { ChessProject } from '../project/types'; // Add this import

/**
 * Dependencies for PrimaryVariationExplorerTask
 */
export interface PVExplorerDependencies {
  graph?: ChessGraph;
  strategy?: PVExplorationStrategy;
  analysisStore?: AnalysisStoreService;
}

/**
 * Primary Variation Explorer Task (Refactored)
 *
 * Now uses dependency injection and delegates core exploration logic
 * to PVExplorationStrategy for better modularity and testability.
 * Uses AnalysisStoreService instead of direct repository access.
 */
export class PrimaryVariationExplorerTask {
  private engine: ChessEngine;
  private analysisConfig: AnalysisConfig;
  private config: PVExplorerConfig;
  private graph: ChessGraph;
  private analysisStore: AnalysisStoreService;
  private strategy: PVExplorationStrategy;
  private state: ExplorationState;
  private project: ChessProject; // Add project property

  constructor(
    engine: ChessEngine,
    analysisConfig: AnalysisConfig,
    config: PVExplorerConfig,
    project: ChessProject, // Add project parameter
    dependencies?: PVExplorerDependencies
  ) {
    this.engine = engine;
    this.analysisConfig = analysisConfig;
    this.config = config;
    this.project = project; // Store project

    // Initialize dependencies with fallbacks for backward compatibility
    this.graph = dependencies?.graph || this.initializeGraph();
    this.analysisStore =
      dependencies?.analysisStore || this.getDefaultAnalysisStore();

    // Create strategy config from PVExplorerConfig
    const strategyConfig: PVExplorationConfig = {
      maxPlyDistance: this.config.maxPlyDistance,
      maxPositions: this.config.maxPositions,
      exploreAlternatives: false, // Default value
      alternativeThreshold: 30, // Default value
    };

    this.strategy =
      dependencies?.strategy ||
      new PVExplorationStrategy(engine, analysisConfig, strategyConfig);

    // Initialize state to match ExplorationState interface
    this.state = {
      positionsToAnalyze: [this.config.rootPosition],
      analyzedPositions: new Set<FenString>(),
      maxExplorationDepth: 0,
      positionDepths: new Map<FenString, number>(),
      currentDepth: 0,
      exploredPositions: 0,
      isComplete: false,
    };
  }

  /**
   * Execute the primary variation exploration
   */
  async explore(): Promise<void> {
    // Update state to indicate exploration is running
    this.state.isComplete = false;

    try {
      const context: StrategyContext = {
        position: this.config.rootPosition,
        graph: this.graph,
        analysisStore: this.analysisStore,
        config: this.analysisConfig,
        project: this.project, // Use the stored project
        onProgress: (update: ProgressUpdate) => {
          this.handleProgressUpdate(update);
        },
      };

      // Execute the strategy
      const results = await this.strategy.execute(context);

      // Mark exploration as complete
      this.state.isComplete = true;

      // Save the graph
      this.saveGraph();

      console.log(
        `✅ Exploration completed with ${results.length} analysis results`
      );
    } catch (error) {
      console.error('❌ Error during exploration:', error);
      throw error;
    }
  }

  /**
   * Initialize graph with fallback behavior
   */
  private initializeGraph(): ChessGraph {
    const graph = new ChessGraph(this.config.rootPosition); // Pass rootPosition to constructor

    // Try to load existing graph if path is provided
    if (this.config.graphPath && fs.existsSync(this.config.graphPath)) {
      try {
        return loadGraph(this.config.graphPath);
      } catch (error) {
        console.warn(
          `Failed to load graph from ${this.config.graphPath}:`,
          error
        );
      }
    }

    return graph;
  }

  /**
   * Get default analysis store (in-memory for backward compatibility)
   */
  private getDefaultAnalysisStore(): AnalysisStoreService {
    // Note: This returns a Promise, but we need synchronous initialization
    // In practice, this should be injected from outside
    throw new Error(
      'AnalysisStoreService must be provided via dependencies. Use createInMemoryAnalysisStoreService() to create one.'
    );
  }

  /**
   * Handle progress updates from strategy
   */
  private handleProgressUpdate(update: ProgressUpdate): void {
    // Update current depth if provided in metadata
    if (update.metadata?.depth) {
      this.state.currentDepth = update.metadata.depth;
    }

    // Update explored positions count
    this.state.exploredPositions = update.current;

    // Update analyzed positions if position is provided in metadata
    if (update.metadata?.position) {
      this.state.analyzedPositions.add(update.metadata.position);
    }

    // Update max exploration depth if provided in metadata
    if (update.metadata?.maxDepth) {
      this.state.maxExplorationDepth = update.metadata.maxDepth;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      this.saveGraph();
      // Note: AnalysisStoreService cleanup should be handled by the caller
      // since it might be shared across multiple tasks
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }

  /**
   * Save graph to disk if path is configured
   */
  private saveGraph(): void {
    if (this.config.graphPath) {
      try {
        const dir = path.dirname(this.config.graphPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        saveGraph(this.graph, this.config.graphPath);
      } catch (error) {
        console.error(
          `Failed to save graph to ${this.config.graphPath}:`,
          error
        );
      }
    }
  }

  /**
   * Get current exploration state
   */
  getExplorationState(): ExplorationState {
    return {
      positionsToAnalyze: this.state.positionsToAnalyze,
      analyzedPositions: this.state.analyzedPositions, // Keep as Set, don't convert to Array
      maxExplorationDepth: this.state.maxExplorationDepth,
      positionDepths: this.state.positionDepths,
      currentDepth: this.state.currentDepth,
      exploredPositions: this.state.exploredPositions,
      isComplete: this.state.isComplete,
    };
  }

  // Getters for accessing internal state
  getGraph(): ChessGraph {
    return this.graph;
  }

  getAnalysisConfig(): AnalysisConfig {
    return this.analysisConfig;
  }

  getConfig(): PVExplorerConfig {
    return this.config;
  }

  getStrategy(): PVExplorationStrategy {
    return this.strategy;
  }

  getAnalysisStore(): AnalysisStoreService {
    return this.analysisStore;
  }

  /**
   * Get the analysis repository (for backward compatibility)
   * @deprecated Use getAnalysisStore() instead
   */
  getAnalysisRepo() {
    return this.analysisStore.getRepository();
  }
}
