import {
  AnalysisStrategy,
  AnalysisContext,
  ExecutionEstimate,
} from '../../core/project/types';
import { UciAnalysisResult } from '../../core/engine/types';
import {
  PVExplorationStrategy as StateMachinePVStrategy,
  PVExplorationConfig,
} from '../../core/project/state-machine/pv/PVExplorationStrategy';
import { ChessEngine } from '../../core/engine/ChessEngine';

export class PVStateMachineStrategy implements AnalysisStrategy {
  readonly name = 'pv-explore-sm';
  readonly description = 'Primary Variation exploration using state machine';

  private engine: ChessEngine;

  constructor(engine: ChessEngine) {
    this.engine = engine;
  }

  async execute(context: AnalysisContext): Promise<UciAnalysisResult[]> {
    // Convert CLI context to state machine config
    const config: PVExplorationConfig = {
      rootFen: context.position,
      maxDepth: context.config.depth || 15,
      maxNodes: context.metadata?.maxPositions || 1000,
      timePerPosition: context.config.time || 5,
      engineConfig: {
        depth: context.config.depth,
        multiPV: context.config.multiPv || 1,
        time: context.config.time,
        // Add the actual engine instance
        engine: this.engine,
      },
      graph: context.graph,
      analysisStore: context.analysisStore,
    };

    // Create and run state machine strategy
    const strategy = await StateMachinePVStrategy.create(config);

    // Set up progress reporting
    const progressUnsubscribe = strategy.onProgress(progress => {
      console.log(
        `🔍 Progress: ${progress.current}/${progress.total} positions (${progress.percentage.toFixed(1)}%)`
      );
    });

    try {
      // Start the exploration
      await strategy.start();

      // Wait for completion
      while (!strategy.isCompleted() && !strategy.hasError()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (strategy.hasError()) {
        throw (
          strategy.getLastError() ||
          new Error('State machine exploration failed')
        );
      }

      // Return empty array since state machine handles storage internally
      return [];
    } finally {
      progressUnsubscribe();
      await strategy.dispose();
    }
  }

  canExecute(context: AnalysisContext): boolean {
    return !!(context.position && context.graph && context.analysisStore);
  }

  getExecutionEstimate(context: AnalysisContext): ExecutionEstimate {
    const maxPositions = context.metadata?.maxPositions || 1000;
    const timePerPosition = context.config.time || 5;

    return {
      estimatedTimeMs: maxPositions * timePerPosition * 1000,
      estimatedPositions: maxPositions,
      complexity: maxPositions > 500 ? 'high' : 'medium',
      resumable: true,
    };
  }
}
