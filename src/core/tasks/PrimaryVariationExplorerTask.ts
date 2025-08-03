import { ChessEngine, AnalysisConfig } from '../engine/ChessEngine';
import { AnalysisResult } from '../engine/types';
import { ChessGraph } from '../graph/ChessGraph';
import { saveGraph } from '../utils/graph';
import { AnalysisStoreService } from '../analysis-store/AnalysisStoreService';
import { AnalysisRepo } from '../analysis-store/AnalysisRepo';
import { PositionAnalysisTask } from './PositionAnalysisTask';
import { PVExplorerConfig, ExplorationState } from './types/pv-explorer';
import { FenString } from '../types';
import { Chess } from 'chess.ts';
import { convertMoveToSan } from '../utils/move';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Primary Variation Explorer Task
 *
 * Explores chess positions by analyzing principal variations in depth,
 * building a comprehensive ChessGraph and storing analysis results.
 * Follows the architectural approach documented in 08-explore-primary-variation.md
 */
export class PrimaryVariationExplorerTask {
  private engine: ChessEngine;
  private analysisConfig: AnalysisConfig;
  private config: PVExplorerConfig;
  private positionAnalysisTask: PositionAnalysisTask;
  private analysisStoreService!: AnalysisStoreService;
  private graph: ChessGraph;
  private state: ExplorationState;

  constructor(
    engine: ChessEngine,
    analysisConfig: AnalysisConfig,
    config: PVExplorerConfig,
    analysisStoreService?: AnalysisStoreService
  ) {
    this.engine = engine;
    this.analysisConfig = analysisConfig;
    this.config = config;

    // Initialize position analysis task with same engine and config
    this.positionAnalysisTask = new PositionAnalysisTask(
      engine,
      analysisConfig
    );

    // Initialize analysis store service
    if (analysisStoreService) {
      this.analysisStoreService = analysisStoreService;
    } else {
      this.initializeAnalysisStore();
    }

    // Initialize graph
    this.graph = new ChessGraph(config.rootPosition);

    // Initialize exploration state
    this.state = {
      positionsToAnalyze: [config.rootPosition],
      analyzedPositions: new Set(),
      maxExplorationDepth: 0,
      positionDepths: new Map([[config.rootPosition, 0]]),
    };
  }

  /**
   * Initialize the analysis store service with database
   */
  private initializeAnalysisStore(): void {
    // Ensure database directory exists
    const dbDir = path.dirname(this.config.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database and repository
    const db = new sqlite3.Database(this.config.databasePath);
    const repo = new AnalysisRepo(db);
    this.analysisStoreService = new AnalysisStoreService(repo);
  }

  /**
   * Main exploration method
   * Analyzes the root position and explores the principal variation tree
   */
  async explore(): Promise<void> {
    console.log(
      `Starting Primary Variation exploration from: ${this.config.rootPosition}`
    );
    console.log(
      `Analysis config: depth=${this.analysisConfig.depth}, multiPV=${this.analysisConfig.multiPV}`
    );
    console.log(`Max depth ratio: ${this.config.maxDepthRatio}`);

    try {
      // Step 1: Analyze root position to determine exploration depth
      await this.analyzeRootPosition();

      // Step 2: Process the exploration queue
      await this.processExplorationQueue();

      console.log('\n✅ Primary Variation exploration completed successfully!');
      console.log(
        `📊 Total positions analyzed: ${this.state.analyzedPositions.size}`
      );
      console.log(`📁 ChessGraph saved to: ${this.config.graphPath}`);
      console.log(`🗄️  Analysis database: ${this.config.databasePath}`);
    } catch (error) {
      console.error('❌ Error during exploration:', error);
      throw error;
    }
  }

  /**
   * Analyze the root position and set up exploration parameters
   */
  private async analyzeRootPosition(): Promise<void> {
    console.log('\n🔍 Analyzing root position...');

    const analysisResult = await this.positionAnalysisTask.analysePosition(
      this.config.rootPosition
    );

    // Calculate max exploration depth based on analysis depth and ratio
    this.state.maxExplorationDepth = Math.floor(
      analysisResult.depth * this.config.maxDepthRatio
    );

    console.log(`📏 Initial analysis depth: ${analysisResult.depth}`);
    console.log(`🎯 Max exploration depth: ${this.state.maxExplorationDepth}`);

    // Process the root analysis
    await this.processPositionAnalysis(
      this.config.rootPosition,
      analysisResult
    );
  }

  /**
   * Process the exploration queue until all positions within depth limit are analyzed
   */
  private async processExplorationQueue(): Promise<void> {
    console.log('\n🚀 Starting exploration queue processing...');

    while (this.state.positionsToAnalyze.length > 0) {
      const currentPosition = this.state.positionsToAnalyze.shift()!;
      const currentDepth = this.state.positionDepths.get(currentPosition) || 0;

      // Skip if already analyzed or beyond depth limit
      if (this.state.analyzedPositions.has(currentPosition)) {
        continue;
      }

      if (currentDepth >= this.state.maxExplorationDepth) {
        console.log(
          `⏭️  Skipping position at depth ${currentDepth} (beyond limit ${this.state.maxExplorationDepth})`
        );
        continue;
      }

      console.log(`\n🔍 Analyzing position at depth ${currentDepth}...`);
      console.log(`📍 FEN: ${currentPosition}`);

      try {
        // Analyze the position
        const analysisResult =
          await this.positionAnalysisTask.analysePosition(currentPosition);

        // Process the analysis result
        await this.processPositionAnalysis(currentPosition, analysisResult);
      } catch (error) {
        console.error(`❌ Error analyzing position ${currentPosition}:`, error);
        // Mark as analyzed to avoid infinite loops
        this.state.analyzedPositions.add(currentPosition);
      }
    }
  }

  /**
   * Process analysis result for a position
   * Adds PV to graph, stores analysis, and queues new positions
   */
  private async processPositionAnalysis(
    position: FenString,
    analysisResult: AnalysisResult
  ): Promise<void> {
    // Mark position as analyzed
    this.state.analyzedPositions.add(position);

    // Extract principal variation
    const pv = analysisResult.pvs[0];
    if (!pv || pv.trim() === '') {
      console.log('⚠️  No principal variation found, skipping...');
      return;
    }

    console.log(`📝 Principal Variation: ${pv}`);

    // Add entire PV sequence to graph
    await this.addPVToGraph(position, pv);

    // Store analysis in database
    await this.storeAnalysisResult(analysisResult);

    // Save graph after each analysis
    this.saveGraph();

    console.log(`✅ Position processed and graph updated`);
  }

  /**
   * Add the entire Principal Variation sequence to the ChessGraph
   * Each move in deeper analysis becomes primary, demoting existing moves
   */
  private async addPVToGraph(
    startPosition: FenString,
    pv: string
  ): Promise<void> {
    const moves = pv.split(' ').filter(move => move.trim() !== '');
    if (moves.length === 0) return;

    const chess = new Chess(startPosition);
    let currentPosition = startPosition;
    let currentDepth = this.state.positionDepths.get(startPosition) || 0;

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
        this.graph.addMove(
          currentPosition,
          {
            move: sanMove,
            toFen: nextPosition,
          },
          true
        ); // true = primary, demotes existing primary to alternative

        console.log(
          `  ➕ Added move: ${sanMove} (${currentPosition.substring(0, 20)}... → ${nextPosition.substring(0, 20)}...)`
        );

        // Calculate depth for next position (each move in PV is one ply deeper)
        const nextDepth = currentDepth + 1;
        this.state.positionDepths.set(nextPosition, nextDepth);

        // Queue position for analysis if within depth limits and not already processed
        if (
          nextDepth < this.state.maxExplorationDepth &&
          !this.state.analyzedPositions.has(nextPosition) &&
          !this.state.positionsToAnalyze.includes(nextPosition)
        ) {
          this.state.positionsToAnalyze.push(nextPosition);
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
   * Store analysis result in the database
   */
  private async storeAnalysisResult(
    analysisResult: AnalysisResult
  ): Promise<void> {
    try {
      // Get engine slug from engine info
      const engineInfo = await this.engine.getEngineInfo();
      const engineSlug = `${(engineInfo.name || 'unknown').toLowerCase().replace(/\s+/g, '-')}-${engineInfo.version || '1.0'}`;

      await this.analysisStoreService.storeAnalysisResult(
        analysisResult,
        engineSlug
      );
    } catch (error) {
      console.error('❌ Error storing analysis result:', error);
      // Don't throw - continue exploration even if storage fails
    }
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
   */
  getExplorationState(): ExplorationState {
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
}
