import {
  AnalysisStrategy,
  AnalysisContext,
  AnalysisConfig,
  ExecutionEstimate,
} from '../types';
import { AnalysisResult } from '../../engine/types';
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

/**
 * Primary Variation Exploration Strategy
 *
 * Implements the AnalysisStrategy interface to provide systematic exploration
 * of chess positions by analyzing principal variations in depth.
 * Extracted from PrimaryVariationExplorerTask for better modularity.
 */
export class PVExplorationStrategy implements AnalysisStrategy {
  readonly name = 'pv-exploration';
  readonly description =
    'Explores chess positions by analyzing principal variations in depth';

  private engine: ChessEngine;
  private analysisConfig: AnalysisConfig;
  private config: PVExplorationConfig;
  private positionAnalysisTask: PositionAnalysisTask;

  constructor(
    engine: ChessEngine,
    analysisConfig: AnalysisConfig,
    config: PVExplorationConfig
  ) {
    this.engine = engine;
    this.analysisConfig = analysisConfig;
    this.config = config;
    this.positionAnalysisTask = new PositionAnalysisTask(
      engine,
      analysisConfig
    );
  }

  /**
   * Execute the PV exploration strategy
   */
  async execute(context: AnalysisContext): Promise<AnalysisResult[]> {
    const strategyContext = context as StrategyContext;
    const results: AnalysisResult[] = [];

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
  }

  /**
   * Check if strategy can be applied to the given context
   */
  canExecute(context: AnalysisContext): boolean {
    // PV exploration can be applied to any valid chess position
    try {
      const chess = new Chess(context.position);
      return chess.gameOver() === false; // Only explore non-terminal positions
    } catch {
      return false; // Invalid FEN
    }
  }

  /**
   * Get execution estimate for the strategy
   */
  getExecutionEstimate(context: AnalysisContext): ExecutionEstimate {
    const baseDepth = this.analysisConfig.depth || 20;
    const maxDepth = Math.floor(baseDepth * this.config.maxDepthRatio);
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
  ): Promise<AnalysisResult> {
    console.log('🔍 Analyzing root position...');

    const analysisResult = await this.positionAnalysisTask.analysePosition(
      context.position
    );

    // Calculate max exploration depth based on analysis depth and ratio
    state.maxDepth = Math.floor(
      analysisResult.depth * this.config.maxDepthRatio
    );

    console.log(`📏 Initial analysis depth: ${analysisResult.depth}`);
    console.log(`🎯 Max exploration depth: ${state.maxDepth}`);

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
  ): Promise<AnalysisResult[]> {
    console.log('🚀 Starting exploration queue processing...');
    const results: AnalysisResult[] = [];

    while (state.positionsToAnalyze.length > 0) {
      const currentPosition = state.positionsToAnalyze.shift()!;
      const currentDepth = state.positionDepths.get(currentPosition) || 0;

      // Skip if already analyzed or beyond depth limit
      if (state.analyzedPositions.has(currentPosition)) {
        continue;
      }

      if (currentDepth >= state.maxDepth) {
        console.log(
          `⏭️  Skipping position at depth ${currentDepth} (beyond limit ${state.maxDepth})`
        );
        continue;
      }

      // Check position limit
      if (
        this.config.maxPositions &&
        state.stats.totalAnalyzed >= this.config.maxPositions
      ) {
        console.log(
          `⏭️  Reached maximum position limit (${this.config.maxPositions})`
        );
        break;
      }

      console.log(`\n🔍 Analyzing position at depth ${currentDepth}...`);
      console.log(`📍 FEN: ${currentPosition}`);

      try {
        // Analyze the position
        const analysisResult =
          await this.positionAnalysisTask.analysePosition(currentPosition);
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
    analysisResult: AnalysisResult
  ): Promise<void> {
    // Mark position as analyzed
    state.analyzedPositions.add(position);
    state.stats.totalAnalyzed++;
    state.stats.lastUpdate = new Date();

    // Extract principal variation
    const pv = analysisResult.pvs[0];
    if (!pv || pv.trim() === '') {
      console.log('⚠️  No principal variation found, skipping...');
      return;
    }

    console.log(`📝 Principal Variation: ${pv}`);

    // Add entire PV sequence to graph
    await this.addPVToGraph(context, state, position, pv);

    // Store analysis in repository
    await this.storeAnalysisResult(context, analysisResult);

    console.log(`✅ Position processed and graph updated`);
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

    const chess = new Chess(startPosition);
    let currentPosition = startPosition;
    let currentDepth = state.positionDepths.get(startPosition) || 0;

    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];

      try {
        // Convert UCI moves to SAN format
        const moveResult = convertMoveToSan(chess, move);
        if (!moveResult) {
          console.log(`  ⚠️  Invalid move '${move}', stopping PV processing`);
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

        console.log(`  ➕ Added move: ${sanMove} (${nextPosition})`);

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
          console.log(
            `  📋 Queued position for analysis at depth ${nextDepth}`
          );
        }

        // Update current depth for next iteration
        currentDepth = nextDepth;
        currentPosition = nextPosition;
      } catch (error) {
        console.log(`  ⚠️  Invalid move '${move}', stopping PV processing`);
        break;
      }
    }
  }

  /**
   * Store analysis result in the repository
   */
  private async storeAnalysisResult(
    context: AnalysisContext,
    analysisResult: AnalysisResult
  ): Promise<void> {
    try {
      // Get engine slug from engine info
      const engineInfo = await this.engine.getEngineInfo();
      const engineSlug = `${(engineInfo.name || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${engineInfo.version || '1.0'}`;

      // Store using the analysis repository directly
      // First ensure position exists
      const position = await context.analysisRepo.upsertPosition({
        fen: analysisResult.fen,
      });

      // Ensure engine exists
      const [name, version] = this.parseEngineSlug(engineSlug);
      const engine = await context.analysisRepo.upsertEngine({
        slug: engineSlug,
        name,
        version,
      });

      // Store analysis
      await context.analysisRepo.upsertAnalysis({
        position_id: position.id,
        engine_id: engine.id,
        depth: analysisResult.depth,
        time: analysisResult.time || 0,
        nodes: analysisResult.nodes || 0,
        nps: analysisResult.nps || 0,
        score_type: analysisResult.score.type as 'cp' | 'mate',
        score: analysisResult.score.score,
        pv: analysisResult.pvs[0] || '',
      });
    } catch (error) {
      console.error('❌ Error storing analysis result:', error);
      // Don't throw - continue exploration even if storage fails
    }
  }

  /**
   * Parse engine slug into name and version components
   */
  private parseEngineSlug(slug: string): [string, string] {
    const parts = slug.split('-');
    if (parts.length >= 2) {
      const version = parts[parts.length - 1];
      const name = parts.slice(0, -1).join('-');
      return [name, version];
    }
    return [slug, '1.0'];
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
