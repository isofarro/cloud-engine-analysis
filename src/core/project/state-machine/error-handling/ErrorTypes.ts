export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ErrorCategory {
  ENGINE_ERROR = 'engine_error',
  NETWORK_ERROR = 'network_error',
  VALIDATION_ERROR = 'validation_error',
  STORAGE_ERROR = 'storage_error',
  GRAPH_ERROR = 'graph_error',
  STATE_ERROR = 'state_error',
  TIMEOUT_ERROR = 'timeout_error',
  RESOURCE_ERROR = 'resource_error',
}

export interface StateMachineError extends Error {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly context?: Record<string, any>;
  readonly timestamp: Date;
  readonly errorId: string;
  readonly cause?: Error;
}

export class StateMachineErrorImpl extends Error implements StateMachineError {
  readonly category: ErrorCategory;
  readonly severity: ErrorSeverity;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly context?: Record<string, any>;
  readonly timestamp: Date;
  readonly errorId: string;
  readonly cause?: Error;

  constructor(
    message: string,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    options: {
      recoverable?: boolean;
      retryable?: boolean;
      context?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'StateMachineError';
    this.category = category;
    this.severity = severity;
    this.recoverable = options.recoverable ?? true;
    this.retryable = options.retryable ?? false;
    this.context = options.context;
    this.timestamp = new Date();
    this.errorId = `${category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.cause = options.cause;
  }
}

// Specific error types
export class EngineError extends StateMachineErrorImpl {
  constructor(
    message: string,
    options?: { cause?: Error; context?: Record<string, any> }
  ) {
    super(message, ErrorCategory.ENGINE_ERROR, ErrorSeverity.HIGH, {
      recoverable: true,
      retryable: true,
      ...options,
    });
  }
}

export class NetworkError extends StateMachineErrorImpl {
  constructor(
    message: string,
    options?: { cause?: Error; context?: Record<string, any> }
  ) {
    super(message, ErrorCategory.NETWORK_ERROR, ErrorSeverity.MEDIUM, {
      recoverable: true,
      retryable: true,
      ...options,
    });
  }
}

export class ValidationError extends StateMachineErrorImpl {
  constructor(
    message: string,
    options?: { cause?: Error; context?: Record<string, any> }
  ) {
    super(message, ErrorCategory.VALIDATION_ERROR, ErrorSeverity.LOW, {
      recoverable: false,
      retryable: false,
      ...options,
    });
  }
}

export class StorageError extends StateMachineErrorImpl {
  constructor(
    message: string,
    options?: { cause?: Error; context?: Record<string, any> }
  ) {
    super(message, ErrorCategory.STORAGE_ERROR, ErrorSeverity.MEDIUM, {
      recoverable: true,
      retryable: true,
      ...options,
    });
  }
}

export class TimeoutError extends StateMachineErrorImpl {
  constructor(
    message: string,
    options?: { cause?: Error; context?: Record<string, any> }
  ) {
    super(message, ErrorCategory.TIMEOUT_ERROR, ErrorSeverity.MEDIUM, {
      recoverable: true,
      retryable: true,
      ...options,
    });
  }
}
