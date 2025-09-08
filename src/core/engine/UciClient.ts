import { ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import {
  UciAnalysisOptions,
  UciCommand,
  UciCommandOptions,
  UciInfoPV,
  EngineStatus,
  EngineEvents,
  UciInfo,
  UciBestMove,
  EngineConfig,
} from './types';
import { parseUciString } from './UciParser';

export class UciClient extends EventEmitter {
  protected _process: ChildProcess | null = null;
  protected _status: EngineStatus = 'disconnected';
  protected _engineConfig?: Partial<EngineConfig>;

  constructor(process: ChildProcess, engineConfig?: Partial<EngineConfig>) {
    super();
    this._process = process;
    this._engineConfig = engineConfig;
  }

  async connect(): Promise<void> {
    if (this._status !== 'disconnected') {
      throw new Error('Engine is already connected or connecting');
    }

    try {
      if (!this._process) {
        throw new Error('No process provided to connect to');
      }

      this._initReader();
      this._status = 'idle';

      if (this._engineConfig) {
        await this._initEngine(this._engineConfig);
      }

      this.emit('ready');
    } catch (error) {
      this._status = 'error';
      this.emit('error', error as Error);
      throw error;
    }
  }

  protected _initReader(): void {
    if (!this._process) return;

    this._process.stdout?.on('data', data => {
      data
        .toString()
        .split('\n')
        .filter((line: string) => line.trim())
        .forEach((line: string) => {
          this.emit('line', line);
          this._handleUciOutput(line);
        });
    });

    this._process.stderr?.on('data', data => {
      console.error(`Engine stderr: ${data}`);
    });

    this._process.on('exit', _code => {
      this._status = 'disconnected';
      this.emit('disconnect');
      this._process = null;
    });

    this._process.on('error', error => {
      this._status = 'error';
      this.emit('error', error);
    });
  }

  protected _handleUciOutput(line: string): void {
    const parsed = parseUciString(line);
    if (!parsed) return;

    switch (parsed.type) {
      case 'pv':
      case 'currmove':
        this.emit('info', parsed as UciInfo);
        break;
      case 'bestmove':
        this._status = 'idle';
        this.emit('bestmove', parsed as UciBestMove);
        break;
      case 'string':
        // Handle info strings if needed
        break;
    }
  }

  protected async _initEngine(config: Partial<EngineConfig>): Promise<void> {
    // Wait for UCI initialization
    await this.getUciOptions();

    // Set engine options
    for (const [key, value] of Object.entries(config)) {
      if (value !== undefined) {
        this.setUciOption(key, value.toString());
      }
    }
  }

  isRunning(): boolean {
    return !!(this._process?.pid && this._process.exitCode === null);
  }

  getStatus(): EngineStatus {
    return this._status;
  }

  execute(command: UciCommand, options?: UciCommandOptions): void {
    if (!this._process || !this.isRunning()) {
      throw new Error('Engine is not running');
    }

    let cmd = command;
    if (options?.length) {
      cmd = `${command} ${options.join(' ')}`;
    }

    this._process.stdin?.write(`${cmd}\n`);
  }

  async waitFor(uciText: string, timeout: number = 30000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const buffer: string[] = [];
      const timeoutId = setTimeout(() => {
        this.removeListener('line', lineHandler);
        reject(new Error(`Timeout waiting for: ${uciText}`));
      }, timeout);

      const lineHandler = (line: string) => {
        buffer.push(line);
        if (line === uciText) {
          clearTimeout(timeoutId);
          this.removeListener('line', lineHandler);
          resolve(buffer);
        }
      };

      this.on('line', lineHandler);
    });
  }

  setUciOption(name: string, value: string): void {
    this.execute('setoption', ['name', name, 'value', value]);
  }

  async getUciOptions(): Promise<string[]> {
    this.execute('uci');
    return await this.waitFor('uciok');
  }

  async analyze(options: UciAnalysisOptions): Promise<UciInfoPV[]> {
    return new Promise((resolve, reject) => {
      if (this._status !== 'idle') {
        reject(new Error('Engine is not idle'));
        return;
      }

      this._status = 'analyzing';
      const results: UciInfoPV[] = [];

      if (options.multiPV) {
        this.setUciOption('MultiPV', options.multiPV.toString());
      }

      this.execute('ucinewgame');
      this.execute('position', ['fen', options.position]);

      if (options.time) {
        this.execute('go', ['movetime', (options.time * 1000).toString()]);
      } else if (options.depth) {
        this.execute('go', ['depth', options.depth.toString()]);
      } else {
        this._status = 'idle';
        reject(new Error('No analysis options set'));
        return;
      }

      const infoHandler = (info: any) => {
        if (info.type === 'pv') {
          results.push(info as UciInfoPV);
        }
      };

      const bestmoveHandler = () => {
        this._status = 'idle'; // Add this line to reset status
        this.removeListener('info', infoHandler);
        this.removeListener('bestmove', bestmoveHandler);
        resolve(results);
      };

      this.on('info', infoHandler);
      this.on('bestmove', bestmoveHandler);
    });
  }

  async quit(): Promise<void> {
    if (this._process && this.isRunning()) {
      this.execute('quit');

      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (this.isRunning()) {
        this._process.kill('SIGTERM');

        // Wait another second for SIGTERM to take effect
        await new Promise(resolve => setTimeout(resolve, 1000));

        // If still running, force kill with SIGKILL
        if (this.isRunning()) {
          this._process.kill('SIGKILL');

          // Wait a final moment for SIGKILL
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    // Clean up event listeners
    if (this._process) {
      this._process.removeAllListeners();
    }

    this._process = null;
    this._status = 'disconnected';
  }

  // Type-safe event emitter methods
  on<K extends keyof EngineEvents>(event: K, listener: EngineEvents[K]): this {
    return super.on(event, listener);
  }

  emit<K extends keyof EngineEvents>(
    event: K,
    ...args: Parameters<EngineEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
