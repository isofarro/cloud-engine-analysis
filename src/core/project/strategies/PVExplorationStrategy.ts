import {
  AnalysisStrategy,
  AnalysisContext,
  AnalysisConfig,
  ExecutionEstimate,
} from '../types';
import { UciAnalysisResult } from '../../engine/types';
import { FenString } from '../../types';
import { Chess } from 'chess.ts';
import { convertMoveToSan } from '../../utils/move';
import {
  PVExplorationConfig,
  PVExplorationState,
  StrategyContext,
} from './types';
import { PositionAnalysisTask } from '../../tasks/PositionAnalysisTask';
import { ChessEngine } from '../../engine/ChessEngine';
import { AnalysisUtils } from '../../analysis-store/AnalysisUtils';

/**
 * Primary Variation Exploration Strategy
 *
 * Implements the AnalysisStrategy interface to provide systematic exploration
 * of chess positions by analyzing principal variations in depth.
 * Extracted from PrimaryVariationExplorerTask for better modularity.
 */
// Add these imports
import { StatePersistenceService } from '../persistence/StatePersistenceService';
import { SerializableState } from '../persistence/types';
import { v4 as uuidv4 } from 'uuid';

// Add to the PVExplorationStrategy class:
export class PVExplorationStrategy implements AnalysisStrategy {
  readonly name = 'pv-explore'; // ← Changed from 'pv-exploration' to 'pv-explore'
  readonly description =
    'Explores chess positions by analyzing principal variations in depth';

  private engine: ChessEngine;
  private analysisConfig: AnalysisConfig;
  private config: PVExplorationConfig;
  private persistenceService?: StatePersistenceService;
  private currentSessionId?: string;

  constructor(
    engine: ChessEngine,
    analysisConfig: AnalysisConfig,
    config: PVExplorationConfig,
    persistenceService?: StatePersistenceService
  ) {
    this.engine = engine;
    this.analysisConfig = analysisConfig;
    this.config = config;
    this.persistenceService = persistenceService;
  }

  /**
   * Execute analysis with state persistence support
   */
  async execute(context: AnalysisContext): Promise<UciAnalysisResult[]> {
    // Generate session ID for this analysis run
    this.currentSessionId = uuidv4();

    // Check for existing state to resume
    const resumeState = await this.checkForResumableState(context);

    let state: PVExplorationState;
    if (resumeState) {
      state = this.persistenceService!.deserializeState(resumeState.state); // Remove the extra .state
    } else {
      // Initialize new state
      state = {
        positionsToAnalyze: [],
        analyzedPositions: new Set<FenString>(),
        currentDepth: 0,
        maxDepth: Math.min(
          this.config.maxPlyDistance,
          this.analysisConfig.depth || 15
        ),
        positionDepths: new Map<FenString, number>(),
        stats: {
          totalAnalyzed: 0,
          totalDiscovered: 1,
          startTime: new Date(),
          lastUpdate: new Date(),
          avgTimePerPosition: 0,
        },
      };
    }

    // Start auto-save if persistence is enabled
    if (this.persistenceService && this.currentSessionId) {
      this.persistenceService.startAutoSave(this.currentSessionId, () => ({
        strategyName: this.name,
        projectName: context.project.name,
        rootPosition: context.position,
        state,
        config: this.config,
        metadata: {
          // Remove engineSlug since it's not available in AnalysisContext
          // engineSlug: context.engineSlug
        },
      }));
    }

    try {
      const strategyContext = context as StrategyContext;
      const results: UciAnalysisResult[] = [];

      // Initialize exploration state
      const state: PVExplorationState = {
        positionsToAnalyze: [context.position],
        analyzedPositions: new Set(),
        currentDepth: 0,
        maxDepth: 0,
        positionDepths: new Map([[context.position, 0]]),
        stats: {
          totalAnalyzed: 0,
          totalDiscovered: 1,
          startTime: new Date(),
          lastUpdate: new Date(),
          avgTimePerPosition: 0,
        },
      };

      // Store state in context for progress tracking
      if (strategyContext.state) {
        strategyContext.state.pvExploration = state;
      }

      try {
        // Step 1: Analyze root position to determine exploration depth
        const rootResult = await this.analyzeRootPosition(context, state);
        results.push(rootResult);

        // Step 2: Process the exploration queue
        const explorationResults = await this.processExplorationQueue(
          context,
          state,
          strategyContext.onProgress
        );
        results.push(...explorationResults);

        return results;
      } catch (error) {
        console.error('❌ Error during PV exploration:', error);
        throw error;
      }
    } finally {
      // Stop auto-save when execution completes
      if (this.persistenceService) {
        this.persistenceService.stopAutoSave();
      }
    }
  }

  /**
   * Check if strategy can be applied to the given context
   */
  canExecute(context: AnalysisContext): boolean {
    // Check if we have a valid position
    if (!context.position || context.position.trim() === '') {
      return false;
    }

    // Check if we have required dependencies
    if (!context.graph || !context.analysisStore) {
      return false;
    }

    // Check if the position is valid FEN using the proper utility
    return AnalysisUtils.isValidFen(context.position);
  }

  /**
   * Get execution estimate for the strategy
   */
  getExecutionEstimate(_context: AnalysisContext): ExecutionEstimate {
    const baseDepth = this.analysisConfig.depth || 20;
    const maxDepth = Math.min(this.config.maxPlyDistance, baseDepth);
    const estimatedPositions = Math.min(
      Math.pow(2, maxDepth), // Exponential growth estimate
      this.config.maxPositions || 1000
    );

    return {
      estimatedTimeMs: estimatedPositions * 2000, // ~2 seconds per position
      estimatedPositions,
      complexity:
        estimatedPositions > 100
          ? 'high'
          : estimatedPositions > 20
            ? 'medium'
            : 'low',
      resumable: true,
    };
  }

  /**
   * Analyze the root position and set up exploration parameters
   */
  private async analyzeRootPosition(
    context: AnalysisContext,
    state: PVExplorationState
  ): Promise<UciAnalysisResult> {
    // Transform context.config (project AnalysisConfig) to engine AnalysisConfig
    const engineConfig = {
      depth: context.config?.time
        ? undefined
        : context.config?.depth || this.analysisConfig.depth,
      multiPV: context.config?.multiPv || this.analysisConfig.multiPv,
      time: context.config?.time || this.analysisConfig.time,
    };

    // Create a position analysis task with the engine config
    const contextAnalysisTask = new PositionAnalysisTask(
      this.engine,
      engineConfig
    );

    const analysisResult = await contextAnalysisTask.analysePosition(
      context.position
    );

    // Calculate max exploration depth based on analysis depth and ratio
    state.maxDepth = Math.min(analysisResult.depth, this.config.maxPlyDistance);

    // Process the root analysis
    await this.processPositionAnalysis(
      context,
      state,
      context.position,
      analysisResult
    );

    return analysisResult;
  }

  /**
   * Process the exploration queue until all positions within depth limit are analyzed
   */
  private async processExplorationQueue(
    context: AnalysisContext,
    state: PVExplorationState,
    onProgress?: (progress: any) => void
  ): Promise<UciAnalysisResult[]> {
    const results: UciAnalysisResult[] = [];

    // Transform context.config (project AnalysisConfig) to engine AnalysisConfig
    const engineConfig = {
      depth: context.config?.time
        ? undefined
        : context.config?.depth || this.analysisConfig.depth,
      multiPV: context.config?.multiPv || this.analysisConfig.multiPv,
      time: context.config?.time || this.analysisConfig.time,
    };

    // Create a position analysis task with the engine config
    const contextAnalysisTask = new PositionAnalysisTask(
      this.engine,
      engineConfig
    );

    while (state.positionsToAnalyze.length > 0) {
      const currentPosition = state.positionsToAnalyze.shift()!;
      const currentDepth = state.positionDepths.get(currentPosition) || 0;

      // Skip if already analyzed or beyond depth limit
      if (state.analyzedPositions.has(currentPosition)) {
        continue;
      }

      if (currentDepth >= state.maxDepth) {
        continue;
      }

      // Check position limit
      if (
        context.metadata?.maxPositions &&
        state.stats.totalAnalyzed >= context.metadata.maxPositions
      ) {
        break;
      }

      try {
        // Add user-facing log to show which position is being analyzed
        console.log(
          `🔍 Analyzing position at depth ${currentDepth}: ${currentPosition}...`
        );

        // Use the context-aware analysis task instead of this.positionAnalysisTask
        const analysisResult =
          await contextAnalysisTask.analysePosition(currentPosition);
        results.push(analysisResult);

        // Process the analysis result
        await this.processPositionAnalysis(
          context,
          state,
          currentPosition,
          analysisResult
        );

        // Update progress
        if (onProgress) {
          onProgress({
            current: state.stats.totalAnalyzed,
            total: state.stats.totalDiscovered,
            percentage:
              (state.stats.totalAnalyzed / state.stats.totalDiscovered) * 100,
            operation: `Analyzing position at depth ${currentDepth}`,
            metadata: {
              currentDepth,
              maxDepth: state.maxDepth,
              queueSize: state.positionsToAnalyze.length,
            },
          });
        }
      } catch (error) {
        console.error(`❌ Error analyzing position ${currentPosition}:`, error);
        // Mark as analyzed to avoid infinite loops
        state.analyzedPositions.add(currentPosition);
      }
    }

    return results;
  }

  /**
   * Process analysis result for a position
   * Adds PV to graph, stores analysis, and queues new positions
   */
  private async processPositionAnalysis(
    context: AnalysisContext,
    state: PVExplorationState,
    position: FenString,
    analysisResult: UciAnalysisResult
  ): Promise<void> {
    // Mark position as analyzed
    state.analyzedPositions.add(position);
    state.stats.totalAnalyzed++;
    state.stats.lastUpdate = new Date();

    // Extract principal variation
    const pv = analysisResult.pvs[0];
    if (!pv || pv.trim() === '') {
      return;
    }

    // Add user-facing log to show the PV result
    const evaluation = analysisResult.score
      ? `${analysisResult.score.type} ${analysisResult.score.score}`
      : 'N/A';
    console.log(
      `📊 PV result: ${pv.split(' ').slice(0, 5).join(' ')}${pv.split(' ').length > 5 ? '...' : ''} (eval: ${evaluation})`
    );

    // Add entire PV sequence to graph
    await this.addPVToGraph(context, state, position, pv);

    // Save graph immediately after adding PV
    try {
      // Use the saveGraph utility directly
      const { saveGraph } = await import('../../utils/graph');
      await saveGraph(context.graph, 'graph.json', context.project.projectPath);
    } catch (error) {
      console.error('❌ Failed to save graph:', error);
    }

    // Store analysis in repository
    await this.storeAnalysisResult(context, analysisResult);
  }

  /**
   * Add the entire Principal Variation sequence to the ChessGraph
   * Each move in deeper analysis becomes primary, demoting existing moves
   */
  private async addPVToGraph(
    context: AnalysisContext,
    state: PVExplorationState,
    startPosition: FenString,
    pv: string
  ): Promise<void> {
    const moves = pv.split(' ').filter(move => move.trim() !== '');
    if (moves.length === 0) return;

    // Add user-facing log to show moves being added to graph
    console.log(
      `🌳 Adding ${moves.length} moves to graph: ${moves.slice(0, 5).join(' ')}${moves.length > 5 ? '...' : ''}`
    );

    const chess = new Chess(startPosition);
    let currentPosition = startPosition;
    let currentDepth = state.positionDepths.get(startPosition) || 0;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];

      try {
        // Convert UCI moves to SAN format
        const moveResult = convertMoveToSan(chess, move);
        if (!moveResult) {
          break;
        }
        const nextPosition = chess.fen();

        // Add move to graph as primary (deeper analysis always wins)
        const sanMove = moveResult.san;
        context.graph.addMove(
          currentPosition,
          {
            move: sanMove,
            toFen: nextPosition,
          },
          true // true = primary, demotes existing primary to alternative
        );

        // Calculate depth for next position (each move in PV is one ply deeper)
        const nextDepth = currentDepth + 1;
        state.positionDepths.set(nextPosition, nextDepth);

        // Queue position for analysis if within depth limits and not already processed
        if (
          nextDepth < state.maxDepth &&
          !state.analyzedPositions.has(nextPosition) &&
          !state.positionsToAnalyze.includes(nextPosition)
        ) {
          state.positionsToAnalyze.push(nextPosition);
          state.stats.totalDiscovered++;
        }

        // Update current depth for next iteration
        currentDepth = nextDepth;
        currentPosition = nextPosition;
      } catch (error) {
        break;
      }
    }
  }

  /**
   * Store analysis result using the analysis store service
   */
  private async storeAnalysisResult(
    context: AnalysisContext,
    analysisResult: UciAnalysisResult
  ): Promise<void> {
    try {
      // Get engine slug from engine info
      const engineInfo = await this.engine.getEngineInfo();
      const engineSlug = `${(engineInfo.name || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${engineInfo.version || '1.0'}`;

      // Use the analysis store service instead of direct repo access
      await context.analysisStore.storeAnalysisResult(
        analysisResult,
        engineSlug
      );
    } catch (error) {
      console.error('❌ Error storing analysis result:', error);
      // Don't throw - continue exploration even if storage fails
    }
  }

  /**
   * Check for resumable state
   */
  private async checkForResumableState(
    context: AnalysisContext
  ): Promise<SerializableState | null> {
    if (!this.persistenceService) return null;

    const savedStates = await this.persistenceService.listSavedStates();

    // Look for incomplete analysis of the same position
    const resumableState = savedStates.find(
      s =>
        s.projectName === context.project.name &&
        s.strategyName === this.name &&
        s.completionPercentage < 100
    );

    if (resumableState) {
      const result = await this.persistenceService.loadState(
        resumableState.sessionId
      );
      if (result.success && result.state) {
        return result.state;
      }
    }

    return null;
  }

  /**
   * Get current exploration state (for monitoring/debugging)
   */
  getExplorationState(
    context: StrategyContext
  ): PVExplorationState | undefined {
    return context.state?.pvExploration;
  }
}
