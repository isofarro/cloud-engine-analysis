import {
  ProjectManager,
  AnalysisStrategyRegistry,
} from '../core/project/types';
import { ChessGraph } from '../core/graph/ChessGraph';
import { AnalysisStoreService } from '../core/analysis-store/AnalysisStoreService';
import { AnalysisTaskExecutor } from '../core/project/services/AnalysisTaskExecutor';

/**
 * CLI command options for project creation
 */
export interface CreateProjectOptions {
  rootPosition?: string;
  engine?: string;
  depth?: string;
}

/**
 * CLI command options for analysis
 */
export interface AnalyzeOptions {
  depth?: string;
  time?: string;
  multipv?: string;
}

/**
 * CLI command options for exploration
 */
export interface ExploreOptions {
  strategy?: 'pv-explore';
  depth?: string;
  time?: string;
  multipv?: string;
  maxPositions?: string;
}

/**
 * CLI command options for project listing
 */
export interface ListProjectsOptions {
  path?: string;
}

/**
 * CLI command options for project deletion
 */
export interface DeleteProjectOptions {
  force?: boolean;
}

/**
 * CLI command options for analysis export
 */
export interface ExportOptions {
  format?: 'json' | 'epd' | 'pgn';
  output?: string;
}

/**
 * Dependencies required by CLI commands
 */
export interface CLIDependencies {
  projectManager: ProjectManager;
  strategyRegistry: AnalysisStrategyRegistry;
  taskExecutor: AnalysisTaskExecutor;
  analysisStore: AnalysisStoreService;
  graph: ChessGraph;
}

/**
 * CLI command execution result
 */
export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: Error;
}

/**
 * Progress callback for long-running operations
 */
export type ProgressCallback = (progress: {
  current: number;
  total: number;
  message?: string;
}) => void;
