import { ChessEngine, AnalysisConfig } from '../engine/ChessEngine';
import { UciInfoPV, AnalysisResult } from '../engine/types';
import { normalizeFen } from '../utils/fen';

export class PositionAnalysisTask {
  private engine: ChessEngine;
  private config: AnalysisConfig;

  constructor(engine: ChessEngine, config: AnalysisConfig) {
    this.engine = engine;
    this.config = config;
  }

  /**
   * Analyze a chess position
   * @param fen The FEN string of the position to analyze
   * @returns Promise<AnalysisResult> containing depth, selDepth, multiPV, score, and PVs
   */
  async analysePosition(fen: string): Promise<AnalysisResult> {
    return this.execute(fen);
  }

  /**
   * Execute the position analysis task
   * @param fen The FEN string of the position to analyze
   * @returns Promise<AnalysisResult> containing depth, selDepth, multiPV, score, and PVs
   */
  private async execute(fen: string): Promise<AnalysisResult> {
    // Ensure engine is connected
    const client = (this.engine as any).client;
    if (client.getStatus() === 'disconnected') {
      await this.engine.connect();
    }

    // Get raw UCI results directly to avoid conflicts
    const uciResults = await this._getRawUciResults(fen);

    // Find the best result for primary metrics
    const bestResult = this._findBestResult(uciResults);

    // Extract all PVs from the results
    const pvs = this._extractPVs(uciResults);

    return {
      fen: normalizeFen(fen),
      depth: bestResult.depth,
      selDepth: bestResult.selDepth,
      multiPV: this.config.multiPV || 1,
      score: bestResult.score,
      pvs,
    };
  }

  /**
   * Get raw UCI results by directly interfacing with the engine's UCI client
   * @param fen The FEN string of the position to analyze
   */
  private async _getRawUciResults(fen: string): Promise<UciInfoPV[]> {
    const client = (this.engine as any).client;

    // Wait for engine to be ready (connected and idle)
    if (client.getStatus() !== 'idle') {
      await new Promise<void>(resolve => {
        const checkStatus = () => {
          const status = client.getStatus();
          if (status === 'idle') {
            resolve();
          } else if (status === 'disconnected') {
            setTimeout(checkStatus, 500);
          } else {
            setTimeout(checkStatus, 100);
          }
        };
        checkStatus();
      });
    }

    return new Promise((resolve, reject) => {
      if (client.getStatus() !== 'idle') {
        reject(new Error('Engine is not idle'));
        return;
      }

      // Set analyzing status
      (client as any)._status = 'analyzing';
      const results: UciInfoPV[] = [];

      const timeout = setTimeout(
        () => {
          (client as any)._status = 'idle';
          client.off('info', onInfo);
          client.off('bestmove', onBestMove);
          reject(new Error('Analysis timeout'));
        },
        (this.config.time || 30) * 1000 + 5000
      ); // Add 5s buffer

      const onInfo = (info: any) => {
        if (info.type === 'pv' && info.pv && info.pv.length > 0) {
          results.push(info as UciInfoPV);
        }
      };

      const onBestMove = () => {
        clearTimeout(timeout);
        (client as any)._status = 'idle';
        client.off('info', onInfo);
        client.off('bestmove', onBestMove);
        resolve(results);
      };

      client.on('info', onInfo);
      client.on('bestmove', onBestMove);

      try {
        // Configure multiPV if specified
        if (this.config.multiPV && this.config.multiPV > 1) {
          client.setUciOption('MultiPV', this.config.multiPV.toString());
        }

        // Set up position and start analysis
        client.execute('ucinewgame');
        client.execute('position', ['fen', fen]);

        // Build and execute go command
        const goParts = ['go'];
        if (this.config.depth) {
          goParts.push('depth', this.config.depth.toString());
        } else if (this.config.time) {
          goParts.push('movetime', (this.config.time * 1000).toString());
        } else {
          goParts.push('depth', '15'); // Default depth
        }

        client.execute(goParts[0], goParts.slice(1));
      } catch (error) {
        clearTimeout(timeout);
        (client as any)._status = 'idle';
        client.off('info', onInfo);
        client.off('bestmove', onBestMove);
        reject(error);
      }
    });
  }

  /**
   * Find the best result from UCI results (highest depth, multiPV 1)
   */
  private _findBestResult(results: UciInfoPV[]): UciInfoPV {
    if (results.length === 0) {
      throw new Error('No analysis results received');
    }

    // Filter for multiPV 1 (main line) and find highest depth
    const mainLineResults = results.filter(r => r.multiPV === 1);
    if (mainLineResults.length === 0) {
      throw new Error('No main line results found');
    }

    return mainLineResults.reduce((best, current) =>
      current.depth > best.depth ? current : best
    );
  }

  /**
   * Extract all principal variations from the results
   */
  private _extractPVs(results: UciInfoPV[]): string[] {
    if (results.length === 0) {
      return [];
    }

    // Get the maximum depth to filter final results
    const maxDepth = Math.max(...results.map(r => r.depth));
    const finalResults = results.filter(r => r.depth === maxDepth);

    // Sort by multiPV and extract PVs (convert arrays to space-separated strings)
    return finalResults
      .sort((a, b) => a.multiPV - b.multiPV)
      .map(result => result.pv.join(' '));
  }

  /**
   * Get the analysis configuration
   */
  getConfig(): AnalysisConfig {
    return { ...this.config };
  }

  /**
   * Get the engine being used
   */
  getEngine(): ChessEngine {
    return this.engine;
  }
}
