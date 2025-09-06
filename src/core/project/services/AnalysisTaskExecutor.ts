import {
  AnalysisStrategy,
  AnalysisContext,
  AnalysisResult,
  AnalysisDependencies,
  ExecutionEstimate,
} from '../types';
import { FenString } from '../../types';
import { ProgressUpdate } from '../strategies/types';

/**
 * Configuration for task execution
 */
export interface TaskExecutionConfig {
  /** Maximum execution time in milliseconds */
  maxExecutionTimeMs?: number;

  /** Whether to continue on strategy failures */
  continueOnError?: boolean;

  /** Maximum number of retry attempts */
  maxRetries?: number;

  /** Delay between retries in milliseconds */
  retryDelayMs?: number;

  /** Whether to run strategies in parallel when possible */
  enableParallelExecution?: boolean;

  /** Maximum number of concurrent strategy executions */
  maxConcurrency?: number;
}

/**
 * Result of task execution
 */
export interface TaskExecutionResult {
  /** Whether execution completed successfully */
  success: boolean;

  /** Analysis results from all strategies */
  results: AnalysisResult[];

  /** Execution metadata */
  metadata: {
    /** Total execution time in milliseconds */
    executionTimeMs: number;

    /** Number of strategies executed */
    strategiesExecuted: number;

    /** Number of failed strategies */
    strategiesFailed: number;

    /** Execution estimates vs actual */
    estimates: ExecutionEstimate[];
  };

  /** Errors encountered during execution */
  errors: TaskExecutionError[];

  /** Progress updates during execution */
  progressUpdates: ProgressUpdate[];
}

/**
 * Error information for failed strategy execution
 */
export interface TaskExecutionError {
  /** Strategy that failed */
  strategyName: string;

  /** Error message */
  message: string;

  /** Original error object */
  originalError: Error;

  /** Timestamp of error */
  timestamp: Date;

  /** Whether this was a retry attempt */
  isRetry: boolean;

  /** Attempt number */
  attemptNumber: number;
}

/**
 * Coordinates execution of analysis strategies with dependency injection,
 * error handling, progress tracking, and performance monitoring.
 */
export class AnalysisTaskExecutor {
  private dependencies: AnalysisDependencies;
  private config: TaskExecutionConfig;
  private progressCallbacks: ((progress: ProgressUpdate) => void)[] = [];

  constructor(
    dependencies: AnalysisDependencies,
    config: TaskExecutionConfig = {}
  ) {
    this.dependencies = dependencies;
    this.config = {
      maxExecutionTimeMs: 300000, // 5 minutes default
      continueOnError: true,
      maxRetries: 2,
      retryDelayMs: 1000,
      enableParallelExecution: false,
      maxConcurrency: 3,
      ...config,
    };
  }

  /**
   * Execute a specific strategy on a position
   */
  async executeStrategy(
    strategyName: string,
    position: FenString,
    additionalContext?: Partial<AnalysisContext>
  ): Promise<TaskExecutionResult> {
    const strategy = this.dependencies.strategyRegistry.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy '${strategyName}' not found in registry`);
    }

    return this.executeStrategies([strategy], position, additionalContext);
  }

  /**
   * Execute multiple strategies on a position
   */
  async executeStrategies(
    strategies: AnalysisStrategy[],
    position: FenString,
    additionalContext?: Partial<AnalysisContext>
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();
    const results: AnalysisResult[] = [];
    const errors: TaskExecutionError[] = [];
    const progressUpdates: ProgressUpdate[] = [];
    const estimates: ExecutionEstimate[] = [];

    // Build analysis context
    const context: AnalysisContext = {
      position,
      graph: this.dependencies.graph,
      analysisRepo: this.dependencies.analysisRepo,
      project: additionalContext?.project || this.createDefaultProject(),
      config: additionalContext?.config || this.createDefaultConfig(),
      metadata: additionalContext?.metadata || {},
      ...additionalContext,
    };

    // Filter applicable strategies
    const applicableStrategies = strategies.filter(strategy => {
      try {
        return strategy.canExecute(context);
      } catch (error) {
        this.logError(strategy.name, error as Error, 0, false);
        return false;
      }
    });

    if (applicableStrategies.length === 0) {
      return {
        success: false,
        results: [],
        metadata: {
          executionTimeMs: Date.now() - startTime,
          strategiesExecuted: 0,
          strategiesFailed: 0,
          estimates: [],
        },
        errors: [
          {
            strategyName: 'N/A',
            message: 'No applicable strategies found for the given context',
            originalError: new Error('No applicable strategies'),
            timestamp: new Date(),
            isRetry: false,
            attemptNumber: 1,
          },
        ],
        progressUpdates,
      };
    }

    // Get execution estimates
    for (const strategy of applicableStrategies) {
      try {
        const estimate = strategy.getExecutionEstimate(context);
        estimates.push(estimate);
      } catch (error) {
        // Estimation failure shouldn't block execution
        console.warn(
          `Failed to get estimate for strategy ${strategy.name}:`,
          error
        );
      }
    }

    // Execute strategies
    if (
      this.config.enableParallelExecution &&
      applicableStrategies.length > 1
    ) {
      await this.executeStrategiesInParallel(
        applicableStrategies,
        context,
        results,
        errors,
        progressUpdates
      );
    } else {
      await this.executeStrategiesSequentially(
        applicableStrategies,
        context,
        results,
        errors,
        progressUpdates
      );
    }

    const executionTimeMs = Date.now() - startTime;
    const strategiesExecuted = results.length;
    const strategiesFailed = errors.length;

    return {
      success:
        strategiesFailed === 0 ||
        (this.config.continueOnError === true && strategiesExecuted > 0),
      results,
      metadata: {
        executionTimeMs,
        strategiesExecuted,
        strategiesFailed,
        estimates,
      },
      errors,
      progressUpdates,
    };
  }

  /**
   * Execute strategies sequentially
   */
  private async executeStrategiesSequentially(
    strategies: AnalysisStrategy[],
    context: AnalysisContext,
    results: AnalysisResult[],
    errors: TaskExecutionError[],
    progressUpdates: ProgressUpdate[]
  ): Promise<void> {
    for (let i = 0; i < strategies.length; i++) {
      const strategy = strategies[i];

      // Update progress
      const progress: ProgressUpdate = {
        current: i + 1,
        total: strategies.length,
        percentage: ((i + 1) / strategies.length) * 100,
        operation: `Executing strategy: ${strategy.name}`,
        metadata: { strategyName: strategy.name },
      };
      progressUpdates.push(progress);
      this.notifyProgress(progress);

      try {
        const strategyResults = await this.executeStrategyWithRetry(
          strategy,
          context
        );
        results.push(...strategyResults);
      } catch (error) {
        const taskError = this.createTaskError(
          strategy.name,
          error as Error,
          false,
          this.config.maxRetries || 0
        );
        errors.push(taskError);

        if (!this.config.continueOnError) {
          break;
        }
      }
    }
  }

  /**
   * Execute strategies in parallel with concurrency control
   */
  private async executeStrategiesInParallel(
    strategies: AnalysisStrategy[],
    context: AnalysisContext,
    results: AnalysisResult[],
    errors: TaskExecutionError[],
    progressUpdates: ProgressUpdate[]
  ): Promise<void> {
    const maxConcurrency = this.config.maxConcurrency || 3;
    const semaphore = new Array(maxConcurrency).fill(null);
    let completed = 0;

    const executeWithSemaphore = async (
      strategy: AnalysisStrategy
    ): Promise<void> => {
      try {
        const strategyResults = await this.executeStrategyWithRetry(
          strategy,
          context
        );
        results.push(...strategyResults);
      } catch (error) {
        const taskError = this.createTaskError(
          strategy.name,
          error as Error,
          false,
          this.config.maxRetries || 0
        );
        errors.push(taskError);
      } finally {
        completed++;
        const progress: ProgressUpdate = {
          current: completed,
          total: strategies.length,
          percentage: (completed / strategies.length) * 100,
          operation: `Completed strategy: ${strategy.name}`,
          metadata: { strategyName: strategy.name },
        };
        progressUpdates.push(progress);
        this.notifyProgress(progress);
      }
    };

    // Execute with concurrency control
    const promises: Promise<void>[] = [];
    for (let i = 0; i < strategies.length; i += maxConcurrency) {
      const batch = strategies.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(strategy =>
        executeWithSemaphore(strategy)
      );
      promises.push(...batchPromises);

      // Wait for current batch to complete before starting next
      await Promise.all(batchPromises);
    }
  }

  /**
   * Execute strategy with retry logic
   */
  private async executeStrategyWithRetry(
    strategy: AnalysisStrategy,
    context: AnalysisContext
  ): Promise<AnalysisResult[]> {
    const maxRetries = this.config.maxRetries || 0;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        // Add timeout wrapper
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(
              new Error(
                `Strategy execution timeout after ${this.config.maxExecutionTimeMs}ms`
              )
            );
          }, this.config.maxExecutionTimeMs);
        });

        const executionPromise = strategy.execute(context);
        const results = await Promise.race([executionPromise, timeoutPromise]);

        return results;
      } catch (error) {
        lastError = error as Error;
        this.logError(strategy.name, lastError, attempt, attempt > 1);

        if (attempt <= maxRetries) {
          // Wait before retry
          await new Promise(resolve =>
            setTimeout(resolve, this.config.retryDelayMs)
          );
        }
      }
    }

    throw lastError!;
  }

  /**
   * Add progress callback
   */
  onProgress(callback: (progress: ProgressUpdate) => void): void {
    this.progressCallbacks.push(callback);
  }

  /**
   * Remove progress callback
   */
  removeProgressCallback(callback: (progress: ProgressUpdate) => void): void {
    const index = this.progressCallbacks.indexOf(callback);
    if (index > -1) {
      this.progressCallbacks.splice(index, 1);
    }
  }

  /**
   * Find and execute applicable strategies for a position
   */
  async executeApplicableStrategies(
    position: FenString,
    additionalContext?: Partial<AnalysisContext>
  ): Promise<TaskExecutionResult> {
    const context: AnalysisContext = {
      position,
      graph: this.dependencies.graph,
      analysisRepo: this.dependencies.analysisRepo,
      project: additionalContext?.project || this.createDefaultProject(),
      config: additionalContext?.config || this.createDefaultConfig(),
      metadata: additionalContext?.metadata || {},
      ...additionalContext,
    };

    const applicableStrategies =
      this.dependencies.strategyRegistry.findApplicable(context);
    return this.executeStrategies(
      applicableStrategies,
      position,
      additionalContext
    );
  }

  /**
   * Get execution estimates for strategies
   */
  async getExecutionEstimates(
    strategies: AnalysisStrategy[],
    position: FenString,
    additionalContext?: Partial<AnalysisContext>
  ): Promise<ExecutionEstimate[]> {
    const context: AnalysisContext = {
      position,
      graph: this.dependencies.graph,
      analysisRepo: this.dependencies.analysisRepo,
      project: additionalContext?.project || this.createDefaultProject(),
      config: additionalContext?.config || this.createDefaultConfig(),
      metadata: additionalContext?.metadata || {},
      ...additionalContext,
    };

    const estimates: ExecutionEstimate[] = [];
    for (const strategy of strategies) {
      try {
        if (strategy.canExecute(context)) {
          const estimate = strategy.getExecutionEstimate(context);
          estimates.push(estimate);
        }
      } catch (error) {
        console.warn(
          `Failed to get estimate for strategy ${strategy.name}:`,
          error
        );
      }
    }

    return estimates;
  }

  // Helper methods
  private notifyProgress(progress: ProgressUpdate): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  private logError(
    strategyName: string,
    error: Error,
    attempt: number,
    isRetry: boolean
  ): void {
    console.error(
      `Strategy '${strategyName}' failed (attempt ${attempt}${isRetry ? ', retry' : ''}):`,
      error.message
    );
  }

  private createTaskError(
    strategyName: string,
    error: Error,
    isRetry: boolean,
    attemptNumber: number
  ): TaskExecutionError {
    return {
      strategyName,
      message: error.message,
      originalError: error,
      timestamp: new Date(),
      isRetry,
      attemptNumber,
    };
  }

  private createDefaultProject(): any {
    // Return a minimal project object for backward compatibility
    return {
      id: 'default',
      name: 'Default Project',
      description: 'Default project for analysis execution',
    };
  }

  private createDefaultConfig(): any {
    return {
      depth: 15,
      timeLimit: 30000,
      multiPv: 1,
    };
  }
}
