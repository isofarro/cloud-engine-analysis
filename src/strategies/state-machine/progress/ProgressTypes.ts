export enum ProgressEventType {
  EXPLORATION_STARTED = 'exploration_started',
  EXPLORATION_COMPLETED = 'exploration_completed',
  EXPLORATION_PAUSED = 'exploration_paused',
  EXPLORATION_RESUMED = 'exploration_resumed',
  EXPLORATION_CANCELLED = 'exploration_cancelled',

  ROOT_ANALYSIS_STARTED = 'root_analysis_started',
  ROOT_ANALYSIS_COMPLETED = 'root_analysis_completed',

  POSITION_ANALYSIS_STARTED = 'position_analysis_started',
  POSITION_ANALYSIS_COMPLETED = 'position_analysis_completed',
  POSITION_ANALYSIS_FAILED = 'position_analysis_failed',

  QUEUE_UPDATED = 'queue_updated',
  GRAPH_UPDATED = 'graph_updated',

  MILESTONE_REACHED = 'milestone_reached',
  PERFORMANCE_UPDATE = 'performance_update',
  ERROR_OCCURRED = 'error_occurred',
}

export interface ProgressMetrics {
  totalPositions: number;
  analyzedPositions: number;
  queuedPositions: number;
  failedPositions: number;

  currentDepth: number;
  maxDepth: number;

  elapsedTime: number;
  estimatedTimeRemaining: number;

  analysisRate: number; // positions per second
  memoryUsage: number;

  graphNodes: number;
  graphEdges: number;
}

export interface ProgressSnapshot {
  timestamp: number;
  state: string;
  metrics: ProgressMetrics;
  currentPosition?: string;
  lastCompletedPosition?: string;
  recentErrors: string[];
}

export interface ProgressEvent {
  type: ProgressEventType;
  timestamp: number;
  data: any;
  snapshot: ProgressSnapshot;
}

export interface ProgressListener {
  onProgress(event: ProgressEvent): void;
  onMilestone?(milestone: ProgressMilestone): void;
  onError?(error: Error, context: any): void;
}

export interface ProgressMilestone {
  id: string;
  name: string;
  description: string;
  threshold: number;
  achieved: boolean;
  achievedAt?: number;
}

export interface ProgressConfiguration {
  updateInterval: number; // ms
  enableDetailedMetrics: boolean;
  enablePerformanceTracking: boolean;
  milestones: ProgressMilestone[];
  maxHistorySize: number;
}
