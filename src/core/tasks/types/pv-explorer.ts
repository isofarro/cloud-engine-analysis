import { FenString } from '../../types';

/**
 * Configuration interface for Primary Variation Explorer
 */
export interface PVExplorerConfig {
  /** The root position to start exploration from */
  rootPosition: FenString;

  /** Ratio of initial analysis depth to use for exploration depth (e.g., 0.5 = half) */
  maxDepthRatio: number;

  /** Maximum number of positions to explore */
  maxPositions?: number;

  /** Path to the SQLite database file for storing analysis results */
  databasePath: string;

  /** Path to save the ChessGraph JSON file */
  graphPath: string;
}

/**
 * Internal state for tracking exploration progress
 */
export interface ExplorationState {
  /** Queue of positions to analyze */
  positionsToAnalyze: FenString[];

  /** Set of already analyzed positions to avoid duplicates */
  analyzedPositions: Set<FenString>;

  /** Maximum depth for exploration (calculated from initial analysis) */
  maxExplorationDepth: number;

  /** Current depth from root for each position */
  positionDepths: Map<FenString, number>;
}
