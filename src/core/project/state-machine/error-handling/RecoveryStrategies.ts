import { StateMachineError, ErrorCategory, ErrorSeverity } from './ErrorTypes';
import { IServiceContainer } from '../services/types';

export interface RecoveryContext<T = any> {
  error: StateMachineError;
  currentState: string;
  context: T;
  attemptCount: number;
  maxAttempts: number;
  services: IServiceContainer;
}

export interface RecoveryResult {
  success: boolean;
  newState?: string;
  shouldRetry: boolean;
  retryDelay?: number;
  message?: string;
}

export interface RecoveryStrategy<T = any> {
  canHandle(error: StateMachineError): boolean;
  recover(context: RecoveryContext<T>): Promise<RecoveryResult>;
}

/**
 * Engine failure recovery strategy
 */
export class EngineRecoveryStrategy implements RecoveryStrategy {
  canHandle(error: StateMachineError): boolean {
    return error.category === ErrorCategory.ENGINE_ERROR;
  }

  async recover(context: RecoveryContext): Promise<RecoveryResult> {
    try {
      const engineService = context.services.engine;

      // Check if engine is ready instead of calling non-existent methods
      const isReady = await engineService.isReady();

      if (!isReady) {
        // Stop any ongoing analysis and try to reinitialize
        await engineService.stop();

        // Wait a bit before checking readiness again
        await new Promise(resolve => setTimeout(resolve, 1000));

        const isReadyAfterStop = await engineService.isReady();

        return {
          success: isReadyAfterStop,
          shouldRetry: isReadyAfterStop,
          retryDelay: isReadyAfterStop ? 0 : 5000,
          message: isReadyAfterStop
            ? 'Engine recovered'
            : 'Engine recovery failed',
        };
      }

      return {
        success: true,
        shouldRetry: false,
        message: 'Engine is already ready',
      };
    } catch (error) {
      return {
        success: false,
        shouldRetry: true,
        retryDelay: 5000,
        message: `Engine recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

/**
 * Network failure recovery strategy
 */
export class NetworkRecoveryStrategy implements RecoveryStrategy {
  canHandle(error: StateMachineError): boolean {
    return error.category === ErrorCategory.NETWORK_ERROR;
  }

  async recover(context: RecoveryContext): Promise<RecoveryResult> {
    try {
      // For network errors, we can try to check engine readiness as a proxy for connectivity
      const engineService = context.services.engine;
      const isReady = await engineService.isReady();

      return {
        success: isReady,
        shouldRetry: !isReady,
        retryDelay: isReady ? 0 : 3000,
        message: isReady
          ? 'Network connection restored'
          : 'Network still unavailable',
      };
    } catch (error) {
      return {
        success: false,
        shouldRetry: true,
        retryDelay: 5000,
        message: `Network recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

/**
 * Storage failure recovery strategy
 */
export class StorageRecoveryStrategy implements RecoveryStrategy {
  canHandle(error: StateMachineError): boolean {
    return error.category === ErrorCategory.STORAGE_ERROR;
  }

  async recover(context: RecoveryContext): Promise<RecoveryResult> {
    try {
      const storageService = context.services.storage;

      // Test storage by trying to query for analysis
      // This will throw if storage is not working
      await storageService.getAnalysis({ limit: 1 });

      return {
        success: true,
        shouldRetry: false,
        message: 'Storage is working',
      };
    } catch (error) {
      return {
        success: false,
        shouldRetry: true,
        retryDelay: 2000,
        message: `Storage recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}

/**
 * State corruption recovery strategy
 */
export class StateRecoveryStrategy implements RecoveryStrategy {
  canHandle(error: StateMachineError): boolean {
    return error.category === ErrorCategory.STATE_ERROR;
  }

  async recover(context: RecoveryContext): Promise<RecoveryResult> {
    try {
      const persistenceService = context.services.persistence;

      // Try to find a resumable state
      const resumableStates = await persistenceService.findResumableStates({
        maxAge: 3600000, // 1 hour
      });

      if (resumableStates.length > 0) {
        return {
          success: true,
          shouldRetry: false,
          newState: 'RECOVERING',
          message: `Found ${resumableStates.length} resumable state(s)`,
        };
      }

      return {
        success: false,
        shouldRetry: false,
        message: 'No resumable states found',
      };
    } catch (error) {
      return {
        success: false,
        shouldRetry: true,
        retryDelay: 1000,
        message: `State recovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
