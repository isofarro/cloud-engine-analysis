import { ChessEngine } from './ChessEngine';
import { LocalChessEngine } from './LocalChessEngine';
import { RemoteChessEngine } from './RemoteChessEngine';
import { LocalEngineConfig, RemoteEngineConfig, EngineConfig } from './types';

export interface EngineServiceConfig {
  defaultEngineConfig?: Partial<EngineConfig>;
  maxEngines?: number;
  healthCheckInterval?: number; // milliseconds
}

export type EngineDefinition =
  | {
      id: string;
      name: string;
      type: 'local';
      config: LocalEngineConfig;
    }
  | {
      id: string;
      name: string;
      type: 'remote';
      config: RemoteEngineConfig;
    };

export class EngineService {
  private _engines: Map<string, ChessEngine> = new Map();
  private _engineDefinitions: Map<string, EngineDefinition> = new Map();
  private _config: EngineServiceConfig;
  private _healthCheckTimer?: NodeJS.Timeout;

  constructor(config: EngineServiceConfig = {}) {
    this._config = {
      maxEngines: 10,
      healthCheckInterval: 30000, // 30 seconds
      ...config,
    };

    if (
      this._config.healthCheckInterval &&
      this._config.healthCheckInterval > 0
    ) {
      this._startHealthChecks();
    }
  }

  // Engine definition management
  registerEngine(definition: EngineDefinition): void {
    this._engineDefinitions.set(definition.id, definition);
  }

  unregisterEngine(engineId: string): void {
    this._engineDefinitions.delete(engineId);
    // Also disconnect and remove any active instance
    this._disconnectEngine(engineId);
  }

  getRegisteredEngines(): EngineDefinition[] {
    return Array.from(this._engineDefinitions.values());
  }

  // Main method to get an engine instance
  async getEngine(engineId: string): Promise<ChessEngine> {
    // Check if we already have a connected instance
    const existingEngine = this._engines.get(engineId);
    if (existingEngine && existingEngine.isConnected()) {
      return existingEngine;
    }

    // Remove disconnected instance if it exists
    if (existingEngine) {
      this._engines.delete(engineId);
    }

    // Check engine limit
    if (this._engines.size >= this._config.maxEngines!) {
      throw new Error(
        `Maximum number of engines (${this._config.maxEngines}) reached`
      );
    }

    // Get engine definition
    const definition = this._engineDefinitions.get(engineId);
    if (!definition) {
      throw new Error(`Engine '${engineId}' is not registered`);
    }

    // Create and connect new engine instance
    const engine = this._createEngine(definition);
    await engine.connect();

    this._engines.set(engineId, engine);
    return engine;
  }

  private _createEngine(definition: EngineDefinition): ChessEngine {
    // Merge default config with engine-specific config
    const mergedConfig = {
      ...definition.config,
      config: {
        ...this._config.defaultEngineConfig,
        ...definition.config.config,
      },
    };

    switch (definition.type) {
      case 'local':
        return new LocalChessEngine(mergedConfig as LocalEngineConfig);
      case 'remote':
        return new RemoteChessEngine(mergedConfig as RemoteEngineConfig);
      default:
        throw new Error(`Unknown engine type: ${(definition as any).type}`);
    }
  }

  // Engine instance management
  async disconnectEngine(engineId: string): Promise<void> {
    await this._disconnectEngine(engineId);
  }

  private async _disconnectEngine(engineId: string): Promise<void> {
    const engine = this._engines.get(engineId);
    if (engine) {
      try {
        await engine.disconnect();
      } catch (error) {
        console.error(`Error disconnecting engine ${engineId}:`, error);
      }
      this._engines.delete(engineId);
    }
  }

  async disconnectAllEngines(): Promise<void> {
    const disconnectPromises = Array.from(this._engines.keys()).map(engineId =>
      this._disconnectEngine(engineId)
    );

    await Promise.allSettled(disconnectPromises);
  }

  // Status and monitoring
  getActiveEngines(): { id: string; status: string; type: string }[] {
    const result: { id: string; status: string; type: string }[] = [];

    for (const [engineId, engine] of this._engines.entries()) {
      const definition = this._engineDefinitions.get(engineId);
      result.push({
        id: engineId,
        status: engine.getStatus(),
        type: definition?.type || 'unknown',
      });
    }

    return result;
  }

  async getEngineHealth(engineId: string): Promise<boolean> {
    const engine = this._engines.get(engineId);
    if (!engine) {
      return false;
    }

    return engine.healthCheck();
  }

  // Health monitoring
  private _startHealthChecks(): void {
    this._healthCheckTimer = setInterval(async () => {
      await this._performHealthChecks();
    }, this._config.healthCheckInterval);
  }

  private async _performHealthChecks(): Promise<void> {
    const healthPromises = Array.from(this._engines.entries()).map(
      async ([engineId, engine]) => {
        try {
          const isHealthy = await engine.healthCheck();
          if (!isHealthy) {
            console.warn(
              `Engine ${engineId} failed health check, disconnecting...`
            );
            await this._disconnectEngine(engineId);
          }
        } catch (error) {
          console.error(`Health check error for engine ${engineId}:`, error);
          await this._disconnectEngine(engineId);
        }
      }
    );

    await Promise.allSettled(healthPromises);
  }

  // Cleanup
  async shutdown(): Promise<void> {
    if (this._healthCheckTimer) {
      clearInterval(this._healthCheckTimer);
      this._healthCheckTimer = undefined;
    }

    await this.disconnectAllEngines();
  }

  // Configuration
  updateConfig(config: Partial<EngineServiceConfig>): void {
    this._config = { ...this._config, ...config };

    // Restart health checks if interval changed
    if (config.healthCheckInterval !== undefined) {
      if (this._healthCheckTimer) {
        clearInterval(this._healthCheckTimer);
      }
      if (config.healthCheckInterval > 0) {
        this._startHealthChecks();
      }
    }
  }

  getConfig(): EngineServiceConfig {
    return { ...this._config };
  }
}
