import { IEngineService, AnalysisRequest, AnalysisResponse } from './types';
import { LocalChessEngine } from '../../../engine/LocalChessEngine';
import { LocalEngineConfig } from '../../../engine/types';
import { EngineInfo } from '../../../engine/ChessEngine';

export class EngineService implements IEngineService {
  private engines: Map<string, LocalChessEngine> = new Map();
  private defaultEngineId?: string;

  async initializeEngine(
    config: LocalEngineConfig,
    engineId?: string
  ): Promise<string> {
    const id = engineId || `engine_${Date.now()}`;
    const engine = new LocalChessEngine(config);
    await engine.connect();
    this.engines.set(id, engine);

    if (!this.defaultEngineId) {
      this.defaultEngineId = id;
    }

    return id;
  }

  async analyzePosition(request: AnalysisRequest): Promise<AnalysisResponse> {
    const engine = this.getDefaultEngine();

    const startTime = Date.now();
    const result = await engine.analyzePosition(request.position, {
      depth: request.config.depth,
      time: request.config.time,
      multiPV: request.config.multiPV || 1,
    });
    const duration = Date.now() - startTime;

    const engineInfo = await engine.getEngineInfo();

    return {
      result: {
        fen: request.position,
        depth: result.depth,
        selDepth: result.depth, // LocalChessEngine doesn't provide selDepth
        multiPV: request.config.multiPV || 1,
        score: {
          type: result.evaluation > 0 ? 'cp' : 'cp', // Simplified for now
          score: result.evaluation,
        },
        pvs: result.lines.map(line => line.moves.join(' ')),
        time: duration,
        nodes: result.engineInfo.nodes,
        nps: result.engineInfo.nps,
      },
      duration,
      engineInfo,
    };
  }

  async getEngineInfo(): Promise<EngineInfo> {
    const engine = this.getDefaultEngine();
    return await engine.getEngineInfo();
  }

  async isReady(): Promise<boolean> {
    const engine = this.engines.get(this.defaultEngineId || '');
    if (!engine) return false;

    return engine.isConnected();
  }

  async stop(): Promise<void> {
    for (const engine of this.engines.values()) {
      await engine.disconnect();
    }
    this.engines.clear();
    this.defaultEngineId = undefined;
  }

  private getDefaultEngine(): LocalChessEngine {
    if (!this.defaultEngineId) {
      throw new Error('No engine initialized');
    }

    const engine = this.engines.get(this.defaultEngineId);
    if (!engine) {
      throw new Error(`Engine ${this.defaultEngineId} not found`);
    }

    return engine;
  }

  // Additional utility methods
  async stopAnalysis(engineId?: string): Promise<void> {
    const id = engineId || this.defaultEngineId;
    if (!id) {
      throw new Error('No engine available');
    }

    const engine = this.engines.get(id);
    if (engine) {
      // LocalChessEngine doesn't have a specific stop method, but we can disconnect/reconnect
      await engine.disconnect();
    }
  }

  async shutdown(engineId?: string): Promise<void> {
    if (engineId) {
      const engine = this.engines.get(engineId);
      if (engine) {
        await engine.disconnect();
        this.engines.delete(engineId);
        if (this.defaultEngineId === engineId) {
          this.defaultEngineId = undefined;
        }
      }
    } else {
      await this.stop();
    }
  }

  getAvailableEngines(): string[] {
    return Array.from(this.engines.keys());
  }

  isEngineReady(engineId?: string): boolean {
    const id = engineId || this.defaultEngineId;
    if (!id) return false;

    const engine = this.engines.get(id);
    return engine ? engine.isConnected() : false;
  }

  /**
   * Get the underlying ChessEngine instance
   * @param engineId Optional engine ID, defaults to default engine
   * @returns The ChessEngine instance
   */
  getEngine(engineId?: string): LocalChessEngine {
    const id = engineId || this.defaultEngineId;
    if (!id) {
      throw new Error('No engine initialized');
    }

    const engine = this.engines.get(id);
    if (!engine) {
      throw new Error(`Engine ${id} not found`);
    }

    return engine;
  }

  /**
   * Register an existing engine instance
   * @param engine The engine instance to register
   * @param engineId Optional engine ID
   * @returns The engine ID
   */
  registerExistingEngine(engine: LocalChessEngine, engineId?: string): string {
    const id = engineId || `engine_${Date.now()}`;
    this.engines.set(id, engine);

    if (!this.defaultEngineId) {
      this.defaultEngineId = id;
    }

    return id;
  }
}
