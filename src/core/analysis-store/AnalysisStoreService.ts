import { IAnalysisRepo } from './IAnalysisRepo';
import { AnalysisUtils } from './AnalysisUtils';
import { AnalysisResult } from '../engine/types';
import {
  Engine,
  Analysis,
  AnalysisQuery,
  AnalysisWithDetails,
  CreateAnalysisData,
  ScoreType,
} from './types';
import { FenString } from '../types';

/**
 * High-level service for chess analysis storage and retrieval.
 * Provides a clean interface that abstracts away the repository layer.
 */
export class AnalysisStoreService {
  private repo: IAnalysisRepo;

  constructor(repo: IAnalysisRepo) {
    this.repo = repo;
  }

  /**
   * Initialize the service (no-op since repository is injected).
   */
  async initialize(): Promise<void> {
    // Repository is already initialized when injected
  }

  /**
   * Store an analysis result with automatic engine and position management.
   */
  async storeAnalysisResult(
    result: AnalysisResult,
    engineSlug: string
  ): Promise<void> {
    return AnalysisUtils.storeAnalysisResult(this.repo, result, engineSlug);
  }

  /**
   * Store multiple analysis results efficiently.
   */
  async storeMultipleAnalysisResults(
    results: Array<{ analysisResult: AnalysisResult; engineSlug: string }>
  ): Promise<void> {
    return AnalysisUtils.batchStoreAnalysisResults(this.repo, results);
  }

  /**
   * Retrieve analysis for a specific position and engine.
   */
  async getAnalysis(
    fen: FenString,
    engineSlug: string
  ): Promise<AnalysisWithDetails | null> {
    return this.repo.getAnalysisByFenAndEngine(fen, engineSlug);
  }

  /**
   * Query analysis with various filters.
   */
  async queryAnalysis(query: AnalysisQuery): Promise<AnalysisWithDetails[]> {
    return this.repo.queryAnalysis(query);
  }

  /**
   * Get the best analysis for a position across all engines.
   */
  async getBestAnalysisForPosition(
    fen: FenString
  ): Promise<AnalysisWithDetails | null> {
    return this.repo.getBestAnalysisForPosition(fen);
  }

  /**
   * Get the best analysis using utility comparison.
   */
  async getBestAnalysisComparison(fen: FenString): Promise<{
    evaluation: number;
    scoreType: ScoreType;
    depth: number;
    bestMove: string;
    pv: string[];
    engineInfo: string;
  } | null> {
    return AnalysisUtils.getBestAnalysisForPosition(this.repo, fen);
  }

  /**
   * List all available engines.
   */
  async listEngines(limit = 100, offset = 0): Promise<Engine[]> {
    return this.repo.listEngines(limit, offset);
  }

  /**
   * Get comprehensive statistics about stored analysis data.
   */
  async getStats(): Promise<{
    totalPositions: number;
    totalEngines: number;
    totalAnalyses: number;
    avgDepth: number;
  }> {
    return this.repo.getStats();
  }

  /**
   * Clear all caches for fresh data retrieval.
   */
  async clearCache(): Promise<void> {
    return this.repo.clearCache();
  }

  /**
   * Clean up old analysis data.
   */
  async cleanupAnalysis(
    olderThanDays: number,
    keepBestDepth = true
  ): Promise<number> {
    return this.repo.cleanupAnalysis(olderThanDays, keepBestDepth);
  }

  /**
   * Batch upsert analysis data for performance.
   */
  async batchUpsertAnalysis(
    analyses: CreateAnalysisData[]
  ): Promise<Analysis[]> {
    return this.repo.batchUpsertAnalysis(analyses);
  }

  /**
   * Get the underlying repository for advanced operations.
   * Use sparingly - prefer the service methods when possible.
   */
  getRepository(): IAnalysisRepo {
    return this.repo;
  }
}
