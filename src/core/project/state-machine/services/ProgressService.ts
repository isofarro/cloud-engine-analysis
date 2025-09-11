import { IProgressService, ProgressUpdate, LogLevel } from './types';
import { EventEmitter } from 'events';

export class ProgressService implements IProgressService {
  private emitter = new EventEmitter();
  private sessions = new Map<
    string,
    { description: string; startTime: number }
  >();

  async reportProgress(update: ProgressUpdate): Promise<void> {
    this.emitter.emit('progress', update);
    this.emitter.emit(`progress:${update.step}`, update);
  }

  async log(level: LogLevel, message: string, data?: any): Promise<void> {
    const logEntry = {
      level,
      message,
      data,
      timestamp: Date.now(),
    };

    this.emitter.emit('log', logEntry);
    this.emitter.emit(`log:${level}`, logEntry);

    // Also log to console for development
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message, data);
        break;
      case LogLevel.INFO:
        console.info(message, data);
        break;
      case LogLevel.WARN:
        console.warn(message, data);
        break;
      case LogLevel.ERROR:
        console.error(message, data);
        break;
    }
  }

  async startSession(sessionId: string, description: string): Promise<void> {
    this.sessions.set(sessionId, {
      description,
      startTime: Date.now(),
    });

    await this.log(LogLevel.INFO, `Started session: ${description}`, {
      sessionId,
    });
    this.emitter.emit('session:start', { sessionId, description });
  }

  async endSession(sessionId: string, success: boolean): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const duration = Date.now() - session.startTime;
      await this.log(
        success ? LogLevel.INFO : LogLevel.ERROR,
        `Ended session: ${session.description} (${success ? 'success' : 'failed'})`,
        { sessionId, duration, success }
      );

      this.sessions.delete(sessionId);
      this.emitter.emit('session:end', { sessionId, success, duration });
    }
  }

  // Event subscription methods for backward compatibility
  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    this.emitter.off(event, listener);
  }

  // Helper method to create progress updates
  createProgressUpdate(
    step: string,
    progress: number,
    stats: ProgressUpdate['stats'],
    currentPosition?: string,
    data?: Record<string, any>
  ): ProgressUpdate {
    return {
      step,
      progress,
      currentPosition,
      stats,
      timestamp: Date.now(),
      data,
    };
  }
}
