import { FenString } from '../types';
import { ChessGraph } from '../graph/ChessGraph';
import { AnalysisStoreService } from '../analysis-store/AnalysisStoreService';
import { UciAnalysisResult } from '../engine/types';

/**
 * Represents a chess project with its associated graph and analysis data
 */
export interface ChessProject {
  /** Unique project identifier */
  id: string;

  /** Human-readable project name */
  name: string;

  /** Absolute path to project directory */
  projectPath: string;

  /** Root position for the project (starting FEN) */
  rootPosition: FenString;

  /** Path to the chess graph file (graph.json) */
  graphPath: string;

  /** Path to the analysis database (analysis.db) */
  databasePath: string;

  /** Project creation timestamp */
  createdAt: Date;

  /** Last modification timestamp */
  updatedAt: Date;

  /** Project configuration metadata */
  config: ProjectConfig;
}

/**
 * Configuration options for a chess project
 */
export interface ProjectConfig {
  /** Default engine configuration to use */
  defaultEngine?: string;

  /** Analysis depth settings */
  analysisDepth?: number;

  /** Multi-PV settings */
  multiPv?: number;

  /** Custom project settings */
  [key: string]: any;
}

/**
 * Strategy interface for different types of analysis
 */
export interface AnalysisStrategy {
  /** Strategy identifier */
  readonly name: string;

  /** Strategy description */
  readonly description: string;

  /**
   * Execute the analysis strategy
   * @param context Analysis execution context
   * @returns Promise resolving to analysis results
   */
  execute(context: AnalysisContext): Promise<UciAnalysisResult[]>;

  /**
   * Validate if the strategy can be applied to the given context
   * @param context Analysis execution context
   * @returns True if strategy is applicable
   */
  canExecute(context: AnalysisContext): boolean;

  /**
   * Get estimated execution time/complexity
   * @param context Analysis execution context
   * @returns Estimated execution metadata
   */
  getExecutionEstimate(context: AnalysisContext): ExecutionEstimate;
}

/**
 * Context provided to analysis strategies
 */
export interface AnalysisContext {
  /** Current position being analyzed */
  position: FenString;

  /** Chess graph for position relationships */
  graph: ChessGraph;

  /** Analysis store service for storing/retrieving results */
  analysisStore: AnalysisStoreService;

  /** Analysis configuration */
  config: AnalysisConfig;

  /** Project context */
  project: ChessProject;

  /** Additional context data */
  metadata?: Record<string, any>;
}

/**
 * Analysis configuration for strategies
 */
export interface AnalysisConfig {
  /** Analysis depth */
  depth?: number;

  /** Time limit in milliseconds */
  timeLimit?: number;

  /** Number of principal variations */
  multiPv?: number;

  /** Engine-specific options */
  engineOptions?: Record<string, any>;
}

/**
 * Execution estimate for analysis strategies
 */
export interface ExecutionEstimate {
  /** Estimated time in milliseconds */
  estimatedTimeMs: number;

  /** Estimated number of positions to analyze */
  estimatedPositions: number;

  /** Complexity level (low, medium, high) */
  complexity: 'low' | 'medium' | 'high';

  /** Whether analysis can be resumed if interrupted */
  resumable: boolean;
}

/**
 * Dependency injection container interface
 */
export interface AnalysisDependencies {
  /** Chess graph instance */
  graph: ChessGraph;

  /** Analysis store service instance */
  analysisStore: AnalysisStoreService;

  /** Analysis strategy registry */
  strategyRegistry: AnalysisStrategyRegistry;

  /** Project manager instance */
  projectManager: ProjectManager;
}

/**
 * Registry for managing analysis strategies
 */
export interface AnalysisStrategyRegistry {
  /**
   * Register a new analysis strategy
   * @param strategy Strategy to register
   */
  register(strategy: AnalysisStrategy): void;

  /**
   * Get strategy by name
   * @param name Strategy name
   * @returns Strategy instance or undefined
   */
  get(name: string): AnalysisStrategy | undefined;

  /**
   * List all registered strategies
   * @returns Array of strategy names
   */
  list(): string[];

  /**
   * Find strategies applicable to context
   * @param context Analysis context
   * @returns Array of applicable strategies
   */
  findApplicable(context: AnalysisContext): AnalysisStrategy[];
}

/**
 * Project manager interface for CRUD operations
 */
export interface ProjectManager {
  /**
   * Create a new chess project
   * @param config Project creation configuration
   * @returns Created project
   */
  create(config: CreateProjectConfig): Promise<ChessProject>;

  /**
   * Load an existing project
   * @param projectPath Path to project directory
   * @returns Loaded project
   */
  load(projectPath: string): Promise<ChessProject>;

  /**
   * Save project state
   * @param project Project to save
   */
  save(project: ChessProject): Promise<void>;

  /**
   * List all projects in a directory
   * @param baseDir Base directory to search
   * @returns Array of project paths
   */
  list(baseDir?: string): Promise<string[]>;

  /**
   * Delete a project
   * @param projectPath Path to project directory
   */
  delete(projectPath: string): Promise<void>;

  /**
   * Check if path contains a valid project
   * @param projectPath Path to check
   * @returns True if valid project
   */
  isValidProject(projectPath: string): Promise<boolean>;

  /**
   * Get analysis store service for project
   * @param project Project to get analysis store for
   * @returns Analysis store service connected to project's database
   */
  getAnalysisStore(project: ChessProject): Promise<AnalysisStoreService>;

  /**
   * Close analysis store service (cleanup database connections)
   * @param analysisStore Analysis store service to close
   */
  closeAnalysisStore(analysisStore: AnalysisStoreService): Promise<void>;

  /**
   * Load chess graph from project
   * @param project Project to load graph from
   * @returns Chess graph
   */
  loadGraph(project: ChessProject): Promise<ChessGraph>;

  /**
   * Save chess graph to project
   * @param project Project to save graph to
   * @param graph Chess graph to save
   */
  saveGraph(project: ChessProject, graph: ChessGraph): Promise<void>;
}

/**
 * Configuration for creating new projects
 */
export interface CreateProjectConfig {
  /** Project name */
  name: string;

  /** Project directory path */
  projectPath: string;

  /** Root position (defaults to starting position) */
  rootPosition?: FenString;

  /** Initial project configuration */
  config?: Partial<ProjectConfig>;
}
