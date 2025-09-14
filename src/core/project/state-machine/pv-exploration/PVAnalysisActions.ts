import { IServiceContainer } from '../services/types';
import {
  PVExplorationContext,
  PVExplorationState,
  PVExplorationEvent,
} from './types';
import { UciAnalysisResult } from '../../../engine/types';
import { FenString } from '../../../types';
import { Chess } from 'chess.ts';
import { convertMoveToSan } from '../../../utils/move';
import { PositionAnalysisTask } from '../../../tasks/PositionAnalysisTask';
import { SimpleEventBus } from '../EventBus';

export class PVAnalysisActions {
  private eventBus: SimpleEventBus;

  constructor(private services: IServiceContainer) {
    // Create event bus since it's not available in IServiceContainer
    this.eventBus = new SimpleEventBus();
  }

  /**
   * Initialize exploration state and validate context
   */
  async initializeExploration(context: PVExplorationContext): Promise<void> {
    // Initialize exploration state
    context.state = {
      stats: {
        totalAnalyzed: 0,
        totalDiscovered: 1,
        currentDepth: 0,
        maxDepth: context.maxDepth,
      },
    };

    // Initialize exploration queue with root position
    context.explorationQueue = [
      {
        fen: context.rootFen,
        depth: 0,
      },
    ];
    context.processedPositions = new Set();
    context.totalPositions = 1;
    context.analyzedPositions = 0;
    context.startTime = new Date();
    context.graphNodeCount = 0;
    context.retryCount = 0;

    console.log('🚀 PV exploration initialized');
  }

  /**
   * Analyze root position to determine exploration depth
   */
  async analyzeRootPosition(
    context: PVExplorationContext
  ): Promise<UciAnalysisResult> {
    try {
      this.eventBus.emit({
        type: 'progress',
        payload: {
          phase: 'analysis',
          message: 'Analyzing root position',
          data: {
            position: context.rootFen,
            depth: context.maxDepth,
          },
        },
        timestamp: Date.now(),
      });

      const task = new PositionAnalysisTask(
        (context.services.engine as any).getEngine(),
        {
          depth: context.maxDepth || 20,
          time: context.timePerPosition,
          multiPV: 1,
        }
      );

      const result = await task.analysePosition(context.rootFen);
      const state = context.state!;

      // Update max depth based on analysis
      state.stats.maxDepth = Math.min(
        context.maxDepth,
        Math.floor((result.pvs[0]?.split(' ').length || 0) * 0.7)
      );

      console.log(
        `📊 Root analysis complete. Max depth: ${state.stats.maxDepth}`
      );

      // Process the root analysis result
      await this.processPositionAnalysis(context, context.rootFen, result);

      return result;
    } catch (error) {
      console.error('❌ Error analyzing root position:', error);
      throw error;
    }
  }

  /**
   * Process exploration queue - analyze queued positions
   */
  async processExplorationQueue(
    context: PVExplorationContext
  ): Promise<UciAnalysisResult[]> {
    const state = context.state!;
    const results: UciAnalysisResult[] = [];

    while (context.explorationQueue.length > 0) {
      const queueItem = context.explorationQueue.shift()!;
      const currentPosition = queueItem.fen;
      const currentDepth = queueItem.depth;

      // Check depth and position limits
      if (currentDepth >= state.stats.maxDepth) continue;
      if (context.processedPositions.has(currentPosition)) continue;
      if (context.analyzedPositions >= context.maxNodes) {
        console.log('🛑 Reached maximum position limit');
        break;
      }

      try {
        // Emit progress event
        this.eventBus.emit({
          type: PVExplorationEvent.POSITION_ANALYSIS_STARTED,
          payload: {
            position: currentPosition,
            depth: currentDepth,
            queueSize: context.explorationQueue.length,
          },
          timestamp: Date.now(),
        });

        // Analyze position
        const task = new PositionAnalysisTask(
          (context.services.engine as any).getEngine(),
          {
            depth: 20,
            time: context.timePerPosition,
            multiPV: 1,
          }
        );

        const analysisResult = await task.analysePosition(currentPosition);
        results.push(analysisResult);

        // Process the analysis result
        await this.processPositionAnalysis(
          context,
          currentPosition,
          analysisResult
        );

        // Emit completion event
        this.eventBus.emit({
          type: PVExplorationEvent.POSITION_ANALYSIS_COMPLETE,
          payload: {
            position: currentPosition,
            result: analysisResult,
            stats: state.stats,
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`❌ Error analyzing position ${currentPosition}:`, error);
        context.processedPositions.add(currentPosition);

        this.eventBus.emit({
          type: PVExplorationEvent.EXPLORATION_ERROR,
          payload: {
            position: currentPosition,
            error: error instanceof Error ? error.message : String(error),
          },
          timestamp: Date.now(),
        });
      }
    }

    return results;
  }

  /**
   * Process analysis result for a position
   */
  private async processPositionAnalysis(
    context: PVExplorationContext,
    position: FenString,
    analysisResult: UciAnalysisResult
  ): Promise<void> {
    const state = context.state!;

    // Mark position as analyzed
    context.processedPositions.add(position);
    context.analyzedPositions++;
    state.stats.totalAnalyzed++;

    // Extract principal variation
    const pv = analysisResult.pvs[0];
    if (!pv || pv.trim() === '') return;

    // Log PV result
    const evaluation = analysisResult.score
      ? `${analysisResult.score.type} ${analysisResult.score.score}`
      : 'N/A';
    console.log(
      `📊 PV result: ${pv.split(' ').slice(0, 5).join(' ')}${pv.split(' ').length > 5 ? '...' : ''} (eval: ${evaluation})`
    );

    // Add PV to graph
    await this.addPVToGraph(context, position, pv);

    // Store analysis result
    await context.services.storage.storeAnalysis({
      result: analysisResult,
      engineSlug: 'pv-exploration',
      metadata: {
        rootFen: context.rootFen,
        depth: analysisResult.depth,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Add Principal Variation sequence to the graph
   */
  private async addPVToGraph(
    context: PVExplorationContext,
    startPosition: FenString,
    pv: string
  ): Promise<void> {
    const state = context.state!;
    const moves = pv.split(' ').filter(move => move.trim() !== '');
    if (moves.length === 0) return;

    console.log(
      `🌳 Adding ${moves.length} moves to graph: ${moves.slice(0, 5).join(' ')}${moves.length > 5 ? '...' : ''}`
    );

    const chess = new Chess(startPosition);
    let currentPosition = startPosition;
    let currentDepth = 0;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];

      try {
        // Validate and make move
        const moveResult = convertMoveToSan(chess, move);
        if (!moveResult) {
          console.warn(
            `⚠️ Invalid move: ${move} from position ${currentPosition}`
          );
          break;
        }

        chess.move(move);
        const newPosition = chess.fen();

        // Add move to graph
        await context.services.graph.addMove(
          currentPosition,
          {
            move: moveResult.san,
            toFen: newPosition,
            metadata: { isPrimary: true, depth: currentDepth + 1 },
          },
          { isPrimary: true }
        );

        // Queue new position for analysis if within depth limits
        const newDepth = currentDepth + 1;
        if (
          newDepth < state.stats.maxDepth &&
          !context.processedPositions.has(newPosition) &&
          !context.explorationQueue.some(item => item.fen === newPosition)
        ) {
          context.explorationQueue.push({
            fen: newPosition,
            depth: newDepth,
          });
          state.stats.totalDiscovered++;
        }

        currentPosition = newPosition;
        currentDepth = newDepth;
      } catch (error) {
        console.error(`❌ Error processing move ${move}:`, error);
        break;
      }
    }
  }

  /**
   * Finalize exploration and cleanup
   */
  async finalizeExploration(context: PVExplorationContext): Promise<void> {
    const state = context.state!;

    // Log completion stats
    const elapsed = Date.now() - context.startTime.getTime();
    console.log(`✅ PV exploration complete:`);
    console.log(`   📊 Analyzed: ${state.stats.totalAnalyzed} positions`);
    console.log(`   🕒 Time: ${Math.round(elapsed / 1000)}s`);
    console.log(
      `   ⚡ Avg: ${Math.round(elapsed / state.stats.totalAnalyzed)}ms/position`
    );

    // Emit completion event using QUEUE_PROCESSING_COMPLETE instead of EXPLORATION_COMPLETE
    this.eventBus.emit({
      type: PVExplorationEvent.QUEUE_PROCESSING_COMPLETE,
      payload: {
        stats: state.stats,
        totalTime: elapsed,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle exploration errors
   */
  async handleExplorationError(
    context: PVExplorationContext,
    error: Error
  ): Promise<void> {
    console.error('❌ PV exploration error:', error);

    // Emit error event
    this.eventBus.emit({
      type: PVExplorationEvent.EXPLORATION_ERROR,
      payload: {
        error: error.message,
        context: {
          rootFen: context.rootFen,
        },
      },
      timestamp: Date.now(),
    });

    throw error;
  }
}
