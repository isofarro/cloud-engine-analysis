import { ChessEngine } from './ChessEngine';
import { UciClient } from './UciClient';
import { RemoteEngineConfig } from './types';
import { spawn } from 'child_process';

export class RemoteChessEngine extends ChessEngine {
  private _config: RemoteEngineConfig;
  private _maxConnectionAttempts: number = 3;
  private _reconnectDelay: number = 1000;

  constructor(config: RemoteEngineConfig) {
    const process = spawn('ssh', [config.host, config.enginePath]);
    const client = new UciClient(process, config.config);
    super(client);
    this._config = config;
  }

  getEngineType(): 'remote' {
    return 'remote';
  }

  getHost(): string {
    return this._config.host;
  }

  getEnginePath(): string {
    return this._config.enginePath;
  }

  getConnectionAttempts(): number {
    return this._maxConnectionAttempts;
  }

  setMaxConnectionAttempts(attempts: number): void {
    this._maxConnectionAttempts = attempts;
  }

  setReconnectDelay(delay: number): void {
    this._reconnectDelay = delay;
  }

  getReconnectDelay(): number {
    return this._reconnectDelay;
  }

  async testConnection(): Promise<boolean> {
    try {
      const testProcess = spawn('ssh', [this._config.host, 'echo "test"']);
      return new Promise(resolve => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            testProcess.kill();
            resolve(false);
          }
        }, 5000);

        testProcess.on('exit', code => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(code === 0);
          }
        });

        testProcess.on('error', () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        });
      });
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    const baseHealth = await super.healthCheck();
    if (!baseHealth) {
      return false;
    }

    // Additional remote-specific health checks
    return this.testConnection();
  }

  async connect(): Promise<void> {
    // Test connection first
    const canConnect = await this.testConnection();
    if (!canConnect) {
      throw new Error(
        `Cannot establish SSH connection to ${this._config.host}`
      );
    }

    await super.connect();
  }
}
