import { ChessEngine } from './ChessEngine';
import { UciClient } from './UciClient';
import { LocalEngineConfig } from './types';
import { spawn } from 'child_process';

export class LocalChessEngine extends ChessEngine {
  private _config: LocalEngineConfig;

  constructor(config: LocalEngineConfig) {
    console.log('🔍 DEBUG: LocalChessEngine constructor called with config:', {
      enginePath: config.enginePath,
      enginePathType: typeof config.enginePath,
      configKeys: Object.keys(config),
      fullConfig: config,
    });

    const process = spawn(config.enginePath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const client = new UciClient(process, config.config);
    super(client);
    this._config = config;

    console.log(
      '🔍 DEBUG: LocalChessEngine constructor completed, stored config:',
      {
        storedEnginePath: this._config.enginePath,
        storedEnginePathType: typeof this._config.enginePath,
      }
    );
  }

  getEngineType(): 'local' {
    return 'local';
  }

  getEnginePath(): string {
    console.log('🔍 DEBUG: getEnginePath called, returning:', {
      path: this._config.enginePath,
      type: typeof this._config.enginePath,
    });
    return this._config.enginePath;
  }

  async healthCheck(): Promise<boolean> {
    console.log('🔍 DEBUG: healthCheck started');

    const baseHealth = await super.healthCheck();
    console.log('🔍 DEBUG: baseHealth result:', baseHealth);

    if (!baseHealth) {
      console.log('🔍 DEBUG: baseHealth failed, returning false');
      return false;
    }

    // Additional local-specific health checks
    try {
      console.log('🔍 DEBUG: About to import fs/promises');
      const fs = await import('fs/promises');
      console.log('🔍 DEBUG: fs/promises imported successfully');

      console.log('🔍 DEBUG: About to call fs.access with:', {
        enginePath: this._config.enginePath,
        enginePathType: typeof this._config.enginePath,
        enginePathLength: this._config.enginePath?.length,
        isUndefined: this._config.enginePath === undefined,
        isNull: this._config.enginePath === null,
        isEmpty: this._config.enginePath === '',
        configObject: this._config,
      });

      await fs.access(this._config.enginePath);
      console.log('🔍 DEBUG: fs.access completed successfully');
      return true;
    } catch (error) {
      console.error('🔍 DEBUG: fs.access failed with error:', {
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : 'No stack',
        enginePath: this._config.enginePath,
        enginePathType: typeof this._config.enginePath,
      });
      return false;
    }
  }
}
