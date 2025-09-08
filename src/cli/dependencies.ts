import { CLIDependencies } from './types';
import {
  AnalysisStrategyRegistry,
  AnalysisStrategy,
  AnalysisContext,
  ExecutionEstimate,
} from '../core/project/types';
import { ChessGraph } from '../core/graph/ChessGraph';
import { AnalysisTaskExecutor } from '../core/project/services/AnalysisTaskExecutor';
import { createInMemoryAnalysisStoreService } from '../core/analysis-store';
import { createProjectManager } from '../core/project';
import { UciAnalysisResult } from '../core/engine/types';
import { PositionAnalysisTask } from '../core/tasks/PositionAnalysisTask';
import { LocalChessEngine } from '../core/engine/LocalChessEngine';
import { AnalysisConfig, ChessEngine } from '../core/engine/ChessEngine';
import { PVExplorationStrategy } from '../core/project/strategies/PVExplorationStrategy';
import { PVExplorationConfig } from '../core/project/strategies/types';
import { getProjectDirectory } from './utils';

/**
 * Simple implementation of AnalysisStrategyRegistry for CLI
 */
class SimpleAnalysisStrategyRegistry implements AnalysisStrategyRegistry {
  private strategies = new Map<string, AnalysisStrategy>();

  register(strategy: AnalysisStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  get(name: string): AnalysisStrategy | undefined {
    return this.strategies.get(name);
  }

  list(): string[] {
    return Array.from(this.strategies.keys());
  }

  findApplicable(context: AnalysisContext): AnalysisStrategy[] {
    return Array.from(this.strategies.values()).filter(strategy =>
      strategy.canExecute(context)
    );
  }
}

/**
 * Basic position analysis strategy for CLI
 */
class BasicPositionAnalysisStrategy implements AnalysisStrategy {
  readonly name = 'position';
  readonly description = 'Basic position analysis using chess engine';

  private engine: ChessEngine;

  constructor(engine: ChessEngine) {
    this.engine = engine;
  }

  async execute(context: AnalysisContext): Promise<UciAnalysisResult[]> {
    const analysisConfig: AnalysisConfig = {
      depth: context.config.timeLimit ? undefined : context.config.depth || 15,
      multiPV: context.config.multiPv || 1,
      time: context.config.timeLimit, // This is already in milliseconds from AnalysisCommands
    };

    const task = new PositionAnalysisTask(this.engine, analysisConfig);
    const result = await task.analysePosition(context.position);

    // Get engine info dynamically
    const engineInfo = await this.engine.getEngineInfo();
    const engineSlug = `${(engineInfo.name || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${engineInfo.version || '1.0'}`;

    // Use the project-specific analysis store from context
    await context.analysisStore.storeAnalysisResult(result, engineSlug);

    return [result];
  }

  canExecute(context: AnalysisContext): boolean {
    // Check if we have a valid position
    if (!context.position || context.position.trim() === '') {
      return false;
    }

    // Check if we have required dependencies
    if (!context.graph || !context.analysisStore) {
      return false;
    }

    // Accept any analysis type that includes 'position'
    const analysisType = context.metadata?.analysisType || 'position';
    return analysisType === 'position' || analysisType.includes('position');
  }

  getExecutionEstimate(context: AnalysisContext): ExecutionEstimate {
    const depth = context.config.depth || 15;
    const estimatedTimeMs = depth * 1000; // Rough estimate: 1 second per depth

    return {
      estimatedTimeMs,
      estimatedPositions: 1,
      complexity: depth > 20 ? 'high' : depth > 10 ? 'medium' : 'low',
      resumable: false,
    };
  }
}

/**
 * Creates CLI dependencies with optional overrides.
 */
export async function createCLIDependencies(
  overrides?: Partial<CLIDependencies>
): Promise<CLIDependencies> {
  // Create real implementations with custom base directory
  const projectManager = createProjectManager(getProjectDirectory());
  const strategyRegistry = new SimpleAnalysisStrategyRegistry();
  const analysisStore = await createInMemoryAnalysisStoreService();
  const graph = new ChessGraph();

  // Create shared engine configuration
  const engineConfig = {
    enginePath: '/opt/homebrew/bin/stockfish',
    config: {
      threads: 1,
      hash: 128,
    },
  };

  // Create shared engine for both strategies
  const sharedEngine = new LocalChessEngine(engineConfig);

  // Register basic position analysis strategy with engine
  const basicStrategy = new BasicPositionAnalysisStrategy(sharedEngine);
  strategyRegistry.register(basicStrategy);

  // Register PV exploration strategy
  const pvAnalysisConfig: AnalysisConfig = {
    depth: 15,
    multiPV: 1,
  };

  const pvStrategyConfig: PVExplorationConfig = {
    maxDepthRatio: 0.6,
    maxPositions: 100,
    exploreAlternatives: false,
    alternativeThreshold: 50,
  };

  const pvStrategy = new PVExplorationStrategy(
    sharedEngine,
    pvAnalysisConfig,
    pvStrategyConfig
  );

  strategyRegistry.register(pvStrategy);

  // Create task executor with dependencies
  const taskExecutor = new AnalysisTaskExecutor({
    graph,
    analysisStore,
    strategyRegistry,
    projectManager,
  });

  const defaults: CLIDependencies = {
    projectManager,
    strategyRegistry,
    taskExecutor,
    analysisStore,
    graph,
  };

  return { ...defaults, ...overrides };
}
