import { AnalysisStrategy, AnalysisContext } from '../types';
import { FenString } from '../../types';

/**
 * Configuration for Primary Variation exploration strategy
 */
export interface PVExplorationConfig {
  /** Maximum depth ratio relative to initial analysis */
  maxDepthRatio: number;
  
  /** Maximum number of positions to explore */
  maxPositions?: number;
  
  /** Whether to explore alternative moves */
  exploreAlternatives?: boolean;
  
  /** Minimum evaluation difference to explore alternative */
  alternativeThreshold?: number;
}

/**
 * State tracking for PV exploration
 */
export interface PVExplorationState {
  /** Positions queued for analysis */
  positionsToAnalyze: FenString[];
  
  /** Already analyzed positions */
  analyzedPositions: Set<FenString>;
  
  /** Current exploration depth */
  currentDepth: number;
  
  /** Maximum allowed depth */
  maxDepth: number;
  
  /** Position depths mapping */
  positionDepths: Map<FenString, number>;
  
  /** Exploration statistics */
  stats: ExplorationStats;
}

/**
 * Statistics for exploration progress
 */
export interface ExplorationStats {
  /** Total positions analyzed */
  totalAnalyzed: number;
  
  /** Total positions discovered */
  totalDiscovered: number;
  
  /** Analysis start time */
  startTime: Date;
  
  /** Last update time */
  lastUpdate: Date;
  
  /** Average time per position */
  avgTimePerPosition: number;
}

/**
 * Base interface for strategy-specific contexts
 */
export interface StrategyContext extends AnalysisContext {
  /** Strategy-specific state */
  state?: any;
  
  /** Progress callback */
  onProgress?: (progress: ProgressUpdate) => void;
}

/**
 * Progress update information
 */
export interface ProgressUpdate {
  /** Current step */
  current: number;
  
  /** Total steps */
  total: number;
  
  /** Progress percentage */
  percentage: number;
  
  /** Current operation description */
  operation: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}