import { ChessEngine } from './ChessEngine';
import { UciClient } from './UciClient';
import { LocalEngineConfig } from './types';
import { spawn } from 'child_process';

export class LocalChessEngine extends ChessEngine {
  private _config: LocalEngineConfig;

  constructor(config: LocalEngineConfig) {
    const process = spawn(config.enginePath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const client = new UciClient(process, config.config);
    super(client);
    this._config = config;
  }

  getEngineType(): 'local' {
    return 'local';
  }

  getEnginePath(): string {
    return this._config.enginePath;
  }

  async healthCheck(): Promise<boolean> {
    const baseHealth = await super.healthCheck();
    if (!baseHealth) {
      return false;
    }

    // Additional local-specific health checks
    try {
      const fs = await import('fs/promises');
      await fs.access(this._config.enginePath);
      return true;
    } catch {
      return false;
    }
  }
}
