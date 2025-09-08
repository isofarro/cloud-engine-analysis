import { FenString } from '../../types';
import { PVExplorationState, ExplorationStats } from '../strategies/types';

/**
 * Serializable state for persistence
 */
export interface SerializableState {
  /** Unique identifier for the analysis session */
  sessionId: string;

  /** Strategy name */
  strategyName: string;

  /** Project name */
  projectName: string;

  /** Root position being analyzed */
  rootPosition: FenString;

  /** Serialized strategy state */
  state: SerializablePVExplorationState;

  /** Timestamp when state was saved */
  savedAt: Date;

  /** Analysis configuration */
  config: any;

  /** Progress metadata */
  metadata: {
    version: string;
    engineSlug?: string;
    estimatedCompletion?: Date;
  };
}

/**
 * Serializable version of PVExplorationState
 */
export interface SerializablePVExplorationState {
  /** Positions queued for analysis */
  positionsToAnalyze: FenString[];

  /** Already analyzed positions (as array for JSON serialization) */
  analyzedPositions: FenString[];

  /** Current exploration depth */
  currentDepth: number;

  /** Maximum allowed depth */
  maxDepth: number;

  /** Position depths mapping (as array of tuples) */
  positionDepths: [FenString, number][];

  /** Exploration statistics */
  stats: ExplorationStats;
}

/**
 * State persistence configuration
 */
export interface StatePersistenceConfig {
  /** Directory to store state files */
  stateDirectory: string;

  /** Auto-save interval in milliseconds */
  autoSaveIntervalMs: number;

  /** Maximum number of state snapshots to keep */
  maxSnapshots: number;

  /** Compress state files */
  compress: boolean;
}

/**
 * State restoration result
 */
export interface StateRestorationResult {
  /** Whether restoration was successful */
  success: boolean;

  /** Restored state */
  state?: SerializableState;

  /** Error message if restoration failed */
  error?: string;

  /** Metadata about the restored state */
  metadata?: {
    age: number; // milliseconds since saved
    completionPercentage: number;
    estimatedRemainingTime?: number;
  };
}
