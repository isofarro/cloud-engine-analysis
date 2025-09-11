import { StateMachineEngine } from './StateMachineEngine.js';
import { StateMachineConfig, State, Event, EventBus } from './types.js';
import { IServiceContainer } from './services/types.js';
import { ErrorHandler } from './error-handling/ErrorHandler.js';
import {
  EngineRecoveryStrategy,
  NetworkRecoveryStrategy,
  StorageRecoveryStrategy,
  StateRecoveryStrategy,
} from './error-handling/RecoveryStrategies.js';
import { SerializableState } from '../persistence/types.js';

// Define ErrorHandlerConfig interface
interface ErrorHandlerConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  circuitBreakerConfig: {
    failureThreshold: number;
    recoveryTimeout: number;
    monitoringPeriod: number;
    halfOpenMaxCalls: number;
  };
  enableCircuitBreaker: boolean;
  logErrors: boolean;
}

export class ResilientStateMachineEngine<
  TState = any,
  TEvent extends Event = Event,
  TContext = any,
> extends StateMachineEngine<TState, TEvent, TContext> {
  private errorHandler: ErrorHandler;
  private checkpointInterval?: NodeJS.Timeout;
  private lastCheckpointTime = Date.now();
  private definition: StateMachineConfig<TState, TEvent, TContext>;
  private services: IServiceContainer;

  constructor(
    definition: StateMachineConfig<TState, TEvent, TContext>,
    services: IServiceContainer,
    errorHandlerConfig?: Partial<ErrorHandlerConfig>
  ) {
    super(definition);
    this.definition = definition;
    this.services = services;

    const defaultConfig: ErrorHandlerConfig = {
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      circuitBreakerConfig: {
        failureThreshold: 5,
        recoveryTimeout: 30000,
        monitoringPeriod: 60000,
        halfOpenMaxCalls: 3,
      },
      enableCircuitBreaker: true,
      logErrors: true,
      ...errorHandlerConfig,
    };

    // Create a simple event bus for the error handler
    const errorEventBus: EventBus = {
      subscribe: () => () => {},
      emit: async () => {},
      clear: () => {},
      listenerCount: () => 0,
    };

    this.errorHandler = new ErrorHandler(
      defaultConfig,
      services,
      errorEventBus
    );

    // Register default recovery strategies
    this.errorHandler.addRecoveryStrategy(new EngineRecoveryStrategy());
    this.errorHandler.addRecoveryStrategy(new NetworkRecoveryStrategy());
    this.errorHandler.addRecoveryStrategy(new StorageRecoveryStrategy());
    this.errorHandler.addRecoveryStrategy(new StateRecoveryStrategy());

    // Start automatic checkpointing
    this.startCheckpointing(services);
  }

  async sendWithRecovery(event: TEvent): Promise<void> {
    try {
      await super.send(event);
    } catch (error) {
      await this.handleTransitionError(error, event);
    }
  }

  private async handleTransitionError(
    error: unknown,
    event: TEvent
  ): Promise<void> {
    const recoveryResult = await this.errorHandler.handleError(error as Error, {
      currentState: this.currentState.id,
      stateMachineContext: this.context,
      operationName: `transition_${event.type}`,
    });

    if (recoveryResult.success) {
      // If recovery suggests a new state, we would need to implement state transition logic
      if (recoveryResult.newState) {
        console.log(
          `Recovery suggests transitioning to state: ${recoveryResult.newState}`
        );
      }

      // If recovery suggests retry, attempt the transition again
      if (recoveryResult.shouldRetry) {
        if (recoveryResult.retryDelay) {
          await new Promise(resolve =>
            setTimeout(resolve, recoveryResult.retryDelay)
          );
        }
        await super.send(event);
      }
    } else {
      // Recovery failed, find error state if available
      const errorState = this.findErrorState();
      if (errorState) {
        console.error(`Transitioning to error state: ${errorState.id}`);
      } else {
        // No error state defined, re-throw the error
        throw error;
      }
    }
  }

  private findErrorState(): State<TState> | null {
    // Look for a state that might be an error state
    const errorStateNames = ['ERROR', 'FAILED', 'FAULT', 'CRASHED'];

    for (const state of this.definition.states) {
      if (errorStateNames.includes(state.id.toUpperCase())) {
        return state;
      }
    }

    return null;
  }

  private startCheckpointing(services: IServiceContainer): void {
    // Create checkpoint every 30 seconds
    this.checkpointInterval = setInterval(async () => {
      try {
        await this.createCheckpoint(services);
      } catch (error) {
        console.error('❌ Failed to create checkpoint:', error);
      }
    }, 30000);
  }

  private async createCheckpoint(services: IServiceContainer): Promise<void> {
    const checkpoint = {
      sessionId: `checkpoint-${Date.now()}`,
      state: {
        currentState: this.currentState.id,
        timestamp: new Date(),
        errorHistory: this.errorHandler.getErrorHistory().slice(-10), // Last 10 errors
        circuitBreakerMetrics: this.errorHandler.getCircuitBreakerMetrics(),
      },
      savedAt: new Date(),
      config: {},
      metadata: {
        version: '1.0.0',
        type: 'checkpoint',
      },
    };

    await services.persistence.saveState({
      sessionId: checkpoint.sessionId,
      state: checkpoint as any,
      metadata: checkpoint.metadata,
    });
    this.lastCheckpointTime = Date.now();
    console.log(`💾 Checkpoint created at state: ${this.currentState.id}`);
  }

  private async saveCheckpoint(): Promise<void> {
    try {
      // Create a proper SerializableState structure
      const checkpointState: SerializableState = {
        sessionId: this.id,
        strategyName: 'checkpoint',
        projectName: 'state-machine',
        rootPosition:
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' as any,
        state: {
          positionsToAnalyze: [],
          analyzedPositions: [],
          currentDepth: 0,
          maxDepth: 10,
          positionDepths: [],
          stats: {
            totalAnalyzed: 0,
            totalDiscovered: 0,
            startTime: new Date(),
            lastUpdate: new Date(),
            avgTimePerPosition: 0,
          },
        },
        savedAt: new Date(),
        config: {
          currentState: this.currentState.id,
          context: this.context,
          stateHistory: this.getStateHistory().map(s => s.id),
        },
        metadata: {
          version: '1.0.0',
          engineSlug: 'state-machine',
        },
      };

      await this.services.persistence.saveState({
        sessionId: this.id,
        state: checkpointState,
        metadata: {
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.warn('Failed to save checkpoint:', error);
    }
  }

  private async loadLastCheckpoint(): Promise<boolean> {
    try {
      const states = await this.services.persistence.findResumableStates({
        sessionId: this.id,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      });

      if (states.length === 0) {
        return false;
      }

      // Sort by timestamp and get the most recent
      const sortedStates = states
        .filter(
          (state: SerializableState) => state.metadata?.version === '1.0.0'
        )
        .sort(
          (a: SerializableState, b: SerializableState) =>
            b.savedAt.getTime() - a.savedAt.getTime()
        );

      if (sortedStates.length === 0) {
        return false;
      }

      const latestState = sortedStates[0];

      // Find the state by ID from the config
      const targetStateId = latestState.config?.currentState;
      if (!targetStateId) {
        return false;
      }

      const allStates = Array.from(
        (this as any).states.values()
      ) as State<TState>[];
      const targetState = allStates.find(
        (state: State<TState>) => state.id === targetStateId
      );

      if (targetState) {
        // Reset to the checkpoint state
        (this as any)._currentState = targetState;
        if (latestState.config?.context) {
          (this as any)._context = latestState.config.context;
        }
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Failed to load checkpoint:', error);
      return false;
    }
  }

  getErrorMetrics() {
    return {
      errorHistory: this.errorHandler.getErrorHistory(),
      circuitBreakerMetrics: this.errorHandler.getCircuitBreakerMetrics(),
      lastCheckpointTime: this.lastCheckpointTime,
    };
  }

  async dispose(): Promise<void> {
    try {
      if (this.checkpointInterval) {
        clearInterval(this.checkpointInterval);
      }
      await this.reset();
    } catch (error) {
      console.warn('Error during disposal:', error);
    }
  }
}
