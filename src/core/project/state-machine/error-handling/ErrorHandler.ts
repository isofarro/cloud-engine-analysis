import { StateMachineError, ErrorCategory, ErrorSeverity } from './ErrorTypes';
import {
  RecoveryStrategy,
  RecoveryContext,
  RecoveryResult,
} from './RecoveryStrategies';
import { CircuitBreaker, CircuitBreakerConfig } from './CircuitBreaker';
import { IServiceContainer } from '../services/types';
import { EventBus } from '../types';

export interface ErrorHandlerConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  circuitBreakerConfig: CircuitBreakerConfig;
  enableCircuitBreaker: boolean;
  logErrors: boolean;
}

export class ErrorHandler {
  private recoveryStrategies: RecoveryStrategy[] = [];
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private errorHistory: StateMachineError[] = [];
  private maxHistorySize = 100;

  constructor(
    private config: ErrorHandlerConfig,
    private services: IServiceContainer,
    private eventBus: EventBus
  ) {}

  addRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.push(strategy);
  }

  async handleError<T>(
    error: Error | StateMachineError,
    context: {
      currentState: string;
      stateMachineContext: T;
      operationName?: string;
    }
  ): Promise<RecoveryResult> {
    // Convert to StateMachineError if needed
    const stateMachineError = this.normalizeError(error);

    // Add to error history
    this.addToHistory(stateMachineError);

    // Log error if enabled
    if (this.config.logErrors) {
      this.logError(stateMachineError, context);
    }

    // Emit error event
    await this.eventBus.emit({
      type: 'error',
      payload: {
        error: stateMachineError,
        context: context.stateMachineContext,
        state: context.currentState,
      },
      timestamp: Date.now(),
    });

    // Check circuit breaker
    if (this.config.enableCircuitBreaker && context.operationName) {
      const circuitBreaker = this.getOrCreateCircuitBreaker(
        context.operationName
      );

      try {
        return await circuitBreaker.execute(() =>
          this.attemptRecovery(stateMachineError, context)
        );
      } catch (circuitError) {
        return {
          success: false,
          shouldRetry: false,
          message: `Circuit breaker open for ${context.operationName}`,
        };
      }
    }

    return this.attemptRecovery(stateMachineError, context);
  }

  private async attemptRecovery<T>(
    error: StateMachineError,
    context: {
      currentState: string;
      stateMachineContext: T;
    }
  ): Promise<RecoveryResult> {
    // Find appropriate recovery strategy
    const strategy = this.recoveryStrategies.find(s => s.canHandle(error));

    if (!strategy) {
      console.error(
        `❌ No recovery strategy found for error: ${error.category}`
      );
      return {
        success: false,
        shouldRetry: false,
        message: `No recovery strategy available for ${error.category}`,
      };
    }

    // Attempt recovery with retry logic
    for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
      try {
        const recoveryContext: RecoveryContext<T> = {
          error,
          currentState: context.currentState,
          context: context.stateMachineContext,
          attemptCount: attempt,
          maxAttempts: this.config.maxRetryAttempts,
          services: this.services,
        };

        const result = await strategy.recover(recoveryContext);

        if (result.success) {
          console.log(`✅ Recovery successful on attempt ${attempt}`);
          await this.eventBus.emit({
            type: 'recovery_success',
            payload: {
              error,
              attempt,
              result,
            },
            timestamp: Date.now(),
          });
          return result;
        }

        if (!result.shouldRetry) {
          console.log(`🛑 Recovery strategy indicated no retry`);
          return result;
        }

        // Wait before next attempt
        if (result.retryDelay && attempt < this.config.maxRetryAttempts) {
          console.log(`⏳ Waiting ${result.retryDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, result.retryDelay));
        }
      } catch (recoveryError) {
        console.error(`❌ Recovery attempt ${attempt} failed:`, recoveryError);

        if (attempt === this.config.maxRetryAttempts) {
          return {
            success: false,
            shouldRetry: false,
            message: `Recovery failed after ${this.config.maxRetryAttempts} attempts`,
          };
        }
      }
    }

    return {
      success: false,
      shouldRetry: false,
      message: 'Recovery attempts exhausted',
    };
  }

  private normalizeError(error: Error | StateMachineError): StateMachineError {
    if ('category' in error && 'severity' in error) {
      return error as StateMachineError;
    }

    // Convert regular Error to StateMachineError
    return {
      ...error,
      category: ErrorCategory.STATE_ERROR,
      severity: ErrorSeverity.MEDIUM,
      recoverable: true,
      retryable: true,
      timestamp: new Date(),
      errorId: `unknown_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    } as StateMachineError;
  }

  private getOrCreateCircuitBreaker(operationName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationName)) {
      this.circuitBreakers.set(
        operationName,
        new CircuitBreaker(this.config.circuitBreakerConfig, operationName)
      );
    }
    return this.circuitBreakers.get(operationName)!;
  }

  private addToHistory(error: StateMachineError): void {
    this.errorHistory.push(error);
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }
  }

  private logError<T>(
    error: StateMachineError,
    context: { currentState: string; stateMachineContext: T }
  ): void {
    const logLevel = this.getLogLevel(error.severity);
    const message = `[${error.category}] ${error.message} (State: ${context.currentState}, ID: ${error.errorId})`;

    switch (logLevel) {
      case 'error':
        console.error(`❌ ${message}`, { error, context: error.context });
        break;
      case 'warn':
        console.warn(`⚠️ ${message}`, { error, context: error.context });
        break;
      case 'info':
        console.info(`ℹ️ ${message}`, { error, context: error.context });
        break;
    }
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      case ErrorSeverity.LOW:
        return 'info';
    }
  }

  getErrorHistory(): StateMachineError[] {
    return [...this.errorHistory];
  }

  getCircuitBreakerMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    for (const [name, breaker] of this.circuitBreakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  clearHistory(): void {
    this.errorHistory = [];
  }
}
