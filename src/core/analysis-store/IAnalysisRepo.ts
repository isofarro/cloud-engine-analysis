import {
  Engine,
  CreateEngineData,
  Position,
  CreatePositionData,
  Analysis,
  CreateAnalysisData,
  AnalysisQuery,
  AnalysisWithDetails,
} from './types';
import { FenString } from '../types';

/**
 * Repository interface for analysis data storage with performance optimizations.
 * Designed for efficient querying and caching of chess engine analysis results.
 */
export interface IAnalysisRepo {
  // Engine operations
  /**
   * Creates or retrieves an existing engine by slug.
   * Uses upsert pattern for performance.
   */
  upsertEngine(data: CreateEngineData): Promise<Engine>;

  /**
   * Gets engine by slug with caching.
   */
  getEngineBySlug(slug: string): Promise<Engine | null>;

  /**
   * Lists all engines with optional pagination.
   */
  listEngines(limit?: number, offset?: number): Promise<Engine[]>;

  // Position operations
  /**
   * Creates or retrieves an existing position by FEN.
   * Uses upsert pattern for performance.
   */
  upsertPosition(data: CreatePositionData): Promise<Position>;

  /**
   * Gets position by FEN with caching.
   */
  getPositionByFen(fen: FenString): Promise<Position | null>;

  // Analysis operations
  /**
   * Stores analysis result. Replaces existing analysis for same position/engine.
   * Uses composite unique constraint (position_id, engine_id).
   */
  upsertAnalysis(data: CreateAnalysisData): Promise<Analysis>;

  /**
   * Gets analysis for a specific position and engine.
   * Optimized with composite index lookup.
   */
  getAnalysis(positionId: number, engineId: number): Promise<Analysis | null>;

  /**
   * Gets analysis by FEN and engine slug.
   * Convenience method that handles position/engine lookups.
   */
  getAnalysisByFenAndEngine(
    fen: FenString,
    engineSlug: string
  ): Promise<AnalysisWithDetails | null>;

  /**
   * Queries analysis with flexible filters and pagination.
   * Optimized for common query patterns.
   */
  queryAnalysis(query: AnalysisQuery): Promise<AnalysisWithDetails[]>;

  /**
   * Gets the best (highest depth) analysis for a position.
   * Useful for finding the most accurate evaluation.
   */
  getBestAnalysisForPosition(
    fen: FenString
  ): Promise<AnalysisWithDetails | null>;

  /**
   * Batch insert multiple analysis results.
   * Optimized for bulk operations.
   */
  batchUpsertAnalysis(analyses: CreateAnalysisData[]): Promise<Analysis[]>;

  // Performance and maintenance
  /**
   * Clears analysis cache (if using in-memory caching).
   */
  clearCache(): Promise<void>;

  /**
   * Gets database statistics for monitoring.
   */
  getStats(): Promise<{
    totalPositions: number;
    totalEngines: number;
    totalAnalyses: number;
    avgDepth: number;
  }>;

  /**
   * Cleanup old analysis data based on criteria.
   * Useful for managing database size.
   */
  cleanupAnalysis(
    olderThanDays: number,
    keepBestDepth?: boolean
  ): Promise<number>;
}
