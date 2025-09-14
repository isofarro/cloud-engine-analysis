// Consolidated PV Exploration Types
import { IServiceContainer } from '../services/types';

// Unified PV States (consolidating PVState and PVExplorationState)
export enum PVState {
  IDLE = 'IDLE',
  INITIALIZING = 'INITIALIZING',
  ANALYZING_ROOT = 'ANALYZING_ROOT',
  PROCESSING_QUEUE = 'PROCESSING_QUEUE',
  ANALYZING_POSITION = 'ANALYZING_POSITION',
  BUILDING_GRAPH = 'BUILDING_GRAPH',
  STORING_RESULTS = 'STORING_RESULTS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
  CANCELLED = 'CANCELLED',
}

// Unified PV Events (consolidating PVEvent and PVExplorationEvent)
export enum PVEvent {
  START_EXPLORATION = 'START_EXPLORATION',
  INITIALIZATION_COMPLETE = 'INITIALIZATION_COMPLETE',
  ROOT_ANALYSIS_COMPLETE = 'ROOT_ANALYSIS_COMPLETE',
  QUEUE_READY = 'QUEUE_READY',
  POSITION_ANALYSIS_STARTED = 'POSITION_ANALYSIS_STARTED',
  POSITION_ANALYSIS_COMPLETE = 'POSITION_ANALYSIS_COMPLETE',
  GRAPH_UPDATE_COMPLETE = 'GRAPH_UPDATE_COMPLETE',
  STORAGE_COMPLETE = 'STORAGE_COMPLETE',
  QUEUE_PROCESSING_COMPLETE = 'QUEUE_PROCESSING_COMPLETE',
  QUEUE_EMPTY = 'QUEUE_EMPTY',
  PAUSE_REQUESTED = 'PAUSE_REQUESTED',
  RESUME_REQUESTED = 'RESUME_REQUESTED',
  CANCEL_REQUESTED = 'CANCEL_REQUESTED',
  EXPLORATION_ERROR = 'EXPLORATION_ERROR',
  ERROR_OCCURRED = 'ERROR_OCCURRED',
  RETRY_REQUESTED = 'RETRY_REQUESTED',
}

// Unified PV Exploration Context (consolidating both versions)
export interface PVExplorationContext {
  // Configuration
  rootFen: string;
  maxDepth: number;
  maxNodes: number;
  timePerPosition: number;
  engineConfig: any;
  maxRetries: number;

  // Runtime State
  currentPosition?: string;
  explorationQueue: Array<{
    fen: string;
    depth: number;
    parentNodeId?: string;
    move?: string;
  }>;
  processedPositions: Set<string>;
  totalPositions: number;
  analyzedPositions: number;
  startTime: Date;
  graphNodeCount: number;
  retryCount: number;
  rootNodeId?: string;

  // Services
  services: IServiceContainer;

  // State management
  state?: {
    stats: {
      totalAnalyzed: number;
      totalDiscovered: number;
      currentDepth: number;
      maxDepth: number;
    };
  };

  // Error handling
  error?: Error;
  lastError?: Error;
  lastAnalysisResult?: any;
}

// Hook interfaces for PV exploration
export interface PVExplorationHookContext {
  context: PVExplorationContext;
  result?: any;
  stats?: any;
  error?: Error;
  progress?: {
    current: number;
    total: number;
    operation: string;
    metadata?: any;
  };
}

export interface PVExplorationHooks {
  beforeRootAnalysis?: (context: PVExplorationContext) => Promise<void>;
  afterRootAnalysis?: (data: PVExplorationHookContext) => Promise<void>;
  onExplorationComplete?: (data: PVExplorationHookContext) => Promise<void>;
  onExplorationError?: (data: PVExplorationHookContext) => Promise<void>;
  onProgressUpdate?: (data: PVExplorationHookContext) => Promise<void>;
}
