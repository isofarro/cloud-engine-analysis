/**
 * Service abstraction interfaces for state machine-based strategies
 *
 * These interfaces decouple strategy logic from implementation details,
 * enabling clean testing, mocking, and service substitution.
 */

import { UciAnalysisResult } from '../../../engine/types.js';
import { EngineInfo } from '../../../engine/ChessEngine.js';
import { FenString } from '../../../types.js';
import { SerializableState } from '../../persistence/types.js';

// ============================================================================
// Engine Service Abstraction
// ============================================================================

/**
 * Configuration for position analysis
 */
export interface AnalysisRequest {
  /** Position to analyze in FEN format */
  position: FenString;

  /** Analysis configuration */
  config: {
    /** Search depth (if not time-based) */
    depth?: number;

    /** Analysis time in seconds */
    time?: number;

    /** Number of principal variations */
    multiPV?: number;

    /** Additional engine options */
    options?: Record<string, any>;
  };

  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Result of position analysis
 */
export interface AnalysisResponse {
  /** The analysis result */
  result: UciAnalysisResult;

  /** Time taken for analysis in milliseconds */
  duration: number;

  /** Engine that performed the analysis */
  engineInfo: EngineInfo;
}

/**
 * Abstraction for chess engine operations
 */
export interface IEngineService {
  /**
   * Analyze a chess position
   * @param request - Analysis request configuration
   * @returns Promise resolving to analysis response
   */
  analyzePosition(request: AnalysisRequest): Promise<AnalysisResponse>;

  /**
   * Get engine information
   * @returns Promise resolving to engine info
   */
  getEngineInfo(): Promise<EngineInfo>;

  /**
   * Check if engine is ready for analysis
   * @returns Whether engine is ready
   */
  isReady(): Promise<boolean>;

  /**
   * Stop any ongoing analysis
   */
  stop(): Promise<void>;
}

// ============================================================================
// Graph Service Abstraction
// ============================================================================

/**
 * Represents a chess move in the graph
 */
export interface GraphMove {
  /** Move in SAN notation */
  move: string;

  /** Resulting position FEN */
  toFen: FenString;

  /** Optional move metadata */
  metadata?: Record<string, any>;
}

/**
 * Options for adding moves to the graph
 */
export interface AddMoveOptions {
  /** Whether this is the primary variation */
  isPrimary?: boolean;

  /** Whether to overwrite existing moves */
  overwrite?: boolean;

  /** Additional metadata for the move */
  metadata?: Record<string, any>;
}

/**
 * Graph traversal result
 */
export interface GraphPath {
  /** Sequence of positions */
  positions: FenString[];

  /** Sequence of moves */
  moves: GraphMove[];

  /** Total path length */
  length: number;
}

/**
 * Abstraction for chess graph operations
 */
export interface IGraphService {
  /**
   * Add a move to the graph
   * @param fromPosition - Starting position FEN
   * @param move - Move to add
   * @param options - Addition options
   */
  addMove(
    fromPosition: FenString,
    move: GraphMove,
    options?: AddMoveOptions
  ): Promise<void>;

  /**
   * Get all moves from a position
   * @param position - Position FEN
   * @returns Array of available moves
   */
  getMoves(position: FenString): Promise<GraphMove[]>;

  /**
   * Get the primary variation from a position
   * @param position - Starting position FEN
   * @param maxDepth - Maximum depth to traverse
   * @returns Primary variation path
   */
  getPrimaryVariation(
    position: FenString,
    maxDepth?: number
  ): Promise<GraphPath>;

  /**
   * Check if a position exists in the graph
   * @param position - Position FEN
   * @returns Whether position exists
   */
  hasPosition(position: FenString): Promise<boolean>;

  /**
   * Save the current graph state
   */
  save(): Promise<void>;

  /**
   * Get graph statistics
   */
  getStats(): Promise<{
    totalPositions: number;
    totalMoves: number;
    maxDepth: number;
  }>;
}

// ============================================================================
// Storage Service Abstraction
// ============================================================================

/**
 * Storage request for analysis results
 */
export interface StorageRequest {
  /** Analysis result to store */
  result: UciAnalysisResult;

  /** Engine identifier */
  engineSlug: string;

  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * Storage query parameters
 */
export interface StorageQuery {
  /** Position FEN to query */
  position?: FenString;

  /** Engine slug filter */
  engineSlug?: string;

  /** Minimum depth filter */
  minDepth?: number;

  /** Date range filter */
  dateRange?: {
    from: Date;
    to: Date;
  };

  /** Maximum results to return */
  limit?: number;
}

/**
 * Abstraction for analysis result storage
 */
export interface IStorageService {
  /**
   * Store an analysis result
   * @param request - Storage request
   */
  storeAnalysis(request: StorageRequest): Promise<void>;

  /**
   * Retrieve analysis results
   * @param query - Query parameters
   * @returns Array of matching analysis results
   */
  getAnalysis(query: StorageQuery): Promise<UciAnalysisResult[]>;

  /**
   * Check if analysis exists for a position
   * @param position - Position FEN
   * @param engineSlug - Engine identifier
   * @returns Whether analysis exists
   */
  hasAnalysis(position: FenString, engineSlug?: string): Promise<boolean>;

  /**
   * Clear stored analysis
   * @param query - Optional query to filter what to clear
   */
  clearAnalysis(query?: StorageQuery): Promise<void>;
}

// ============================================================================
// State Persistence Service Abstraction
// ============================================================================

/**
 * State persistence request
 */
export interface PersistenceRequest {
  /** Unique session identifier */
  sessionId: string;

  /** State data to persist */
  state: SerializableState;

  /** Optional metadata */
  metadata?: Record<string, any>;
}

/**
 * State recovery query
 */
export interface RecoveryQuery {
  /** Session identifier */
  sessionId?: string;

  /** Strategy name filter */
  strategyName?: string;

  /** Maximum age in milliseconds */
  maxAge?: number;
}

/**
 * Abstraction for state persistence operations
 */
export interface IPersistenceService {
  /**
   * Save state for later resumption
   * @param request - Persistence request
   */
  saveState(request: PersistenceRequest): Promise<void>;

  /**
   * Load previously saved state
   * @param sessionId - Session identifier
   * @returns Saved state or null if not found
   */
  loadState(sessionId: string): Promise<SerializableState | null>;

  /**
   * Find resumable states
   * @param query - Recovery query parameters
   * @returns Array of available states
   */
  findResumableStates(query: RecoveryQuery): Promise<SerializableState[]>;

  /**
   * Delete saved state
   * @param sessionId - Session identifier
   */
  deleteState(sessionId: string): Promise<void>;

  /**
   * Clean up old states
   * @param maxAge - Maximum age in milliseconds
   */
  cleanup(maxAge: number): Promise<void>;
}

// ============================================================================
// Progress Reporting Service Abstraction
// ============================================================================

/**
 * Progress update information
 */
export interface ProgressUpdate {
  /** Current step description */
  step: string;

  /** Current progress (0-1) */
  progress: number;

  /** Current position being processed */
  currentPosition?: FenString;

  /** Statistics */
  stats: {
    /** Total positions analyzed */
    analyzed: number;

    /** Total positions discovered */
    discovered: number;

    /** Positions remaining in queue */
    remaining: number;

    /** Current depth */
    currentDepth: number;

    /** Maximum depth */
    maxDepth: number;
  };

  /** Timestamp */
  timestamp: number;

  /** Optional additional data */
  data?: Record<string, any>;
}

/**
 * Log level enumeration
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Abstraction for progress reporting and logging
 */
export interface IProgressService {
  /**
   * Report progress update
   * @param update - Progress information
   */
  reportProgress(update: ProgressUpdate): Promise<void>;

  /**
   * Log a message
   * @param level - Log level
   * @param message - Log message
   * @param data - Optional additional data
   */
  log(level: LogLevel, message: string, data?: any): Promise<void>;

  /**
   * Start a new progress session
   * @param sessionId - Unique session identifier
   * @param description - Session description
   */
  startSession(sessionId: string, description: string): Promise<void>;

  /**
   * End a progress session
   * @param sessionId - Session identifier
   * @param success - Whether session completed successfully
   */
  endSession(sessionId: string, success: boolean): Promise<void>;
}

// ============================================================================
// Service Container
// ============================================================================

/**
 * Container for all strategy services
 */
export interface IServiceContainer {
  /** Engine service for position analysis */
  readonly engine: IEngineService;

  /** Graph service for move management */
  readonly graph: IGraphService;

  /** Storage service for analysis persistence */
  readonly storage: IStorageService;

  /** State persistence service */
  readonly persistence: IPersistenceService;

  /** Progress reporting service */
  readonly progress: IProgressService;
}

// ============================================================================
// Service Factory
// ============================================================================

/**
 * Configuration for service creation
 */
export interface ServiceConfig {
  /** Engine configuration */
  engine?: {
    type: 'local' | 'remote';
    options: Record<string, any>;
  };

  /** Graph configuration */
  graph?: {
    type: 'memory' | 'file' | 'database';
    options: Record<string, any>;
  };

  /** Storage configuration */
  storage?: {
    type: 'memory' | 'file' | 'database';
    options: Record<string, any>;
  };

  /** Persistence configuration */
  persistence?: {
    type: 'memory' | 'file' | 'database';
    options: Record<string, any>;
  };

  /** Progress configuration */
  progress?: {
    type: 'console' | 'file' | 'event';
    options: Record<string, any>;
  };
}

/**
 * Factory for creating service instances
 */
export interface IServiceFactory {
  /**
   * Create a complete service container
   * @param config - Service configuration
   * @returns Service container
   */
  createServices(config: ServiceConfig): Promise<IServiceContainer>;

  /**
   * Create individual services
   */
  createEngineService(config: ServiceConfig['engine']): Promise<IEngineService>;
  createGraphService(config: ServiceConfig['graph']): Promise<IGraphService>;
  createStorageService(
    config: ServiceConfig['storage']
  ): Promise<IStorageService>;
  createPersistenceService(
    config: ServiceConfig['persistence']
  ): Promise<IPersistenceService>;
  createProgressService(
    config: ServiceConfig['progress']
  ): Promise<IProgressService>;
}
