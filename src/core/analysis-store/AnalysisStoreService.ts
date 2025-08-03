import { IAnalysisRepo } from './IAnalysisRepo';
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
   * Store an analysis result with automatic engine and position management.
   */
  async storeAnalysisResult(
    analysisResult: AnalysisResult,
    engineSlug: string
  ): Promise<void> {
    // Ensure position exists
    const position = await this.repo.upsertPosition({
      fen: analysisResult.fen,
    });

    // Ensure engine exists (extract name/version from slug)
    const [name, version] = this.parseEngineSlug(engineSlug);
    const engine = await this.repo.upsertEngine({
      slug: engineSlug,
      name,
      version,
    });

    // Convert and store analysis
    const analysisData: CreateAnalysisData = {
      position_id: position.id,
      engine_id: engine.id,
      depth: analysisResult.depth,
      time: analysisResult.time || 0,
      nodes: analysisResult.nodes || 0,
      nps: analysisResult.nps || 0,
      score_type: analysisResult.score.type as ScoreType,
      score: analysisResult.score.score,
      pv: analysisResult.pvs[0] || '', // Use first PV line
    };

    await this.repo.upsertAnalysis(analysisData);
  }

  /**
   * Store multiple analysis results efficiently.
   * Uses transactions and batch operations for optimal performance.
   */
  async storeMultipleAnalysisResults(
    results: Array<{ analysisResult: AnalysisResult; engineSlug: string }>
  ): Promise<void> {
    // Group by unique positions and engines to minimize upserts
    const uniquePositions = new Set<FenString>();
    const uniqueEngines = new Set<string>();

    results.forEach(({ analysisResult, engineSlug }) => {
      uniquePositions.add(analysisResult.fen);
      uniqueEngines.add(engineSlug);
    });

    // Batch upsert positions
    const positionMap = new Map<FenString, number>();
    for (const fen of uniquePositions) {
      const position = await this.repo.upsertPosition({ fen });
      positionMap.set(fen, position.id);
    }

    // Batch upsert engines
    const engineMap = new Map<string, number>();
    for (const slug of uniqueEngines) {
      const [name, version] = this.parseEngineSlug(slug);
      const engine = await this.repo.upsertEngine({ slug, name, version });
      engineMap.set(slug, engine.id);
    }

    // Prepare analysis data
    const analysisData: CreateAnalysisData[] = results.map(
      ({ analysisResult, engineSlug }) => ({
        position_id: positionMap.get(analysisResult.fen)!,
        engine_id: engineMap.get(engineSlug)!,
        depth: analysisResult.depth,
        time: analysisResult.time || 0,
        nodes: analysisResult.nodes || 0,
        nps: analysisResult.nps || 0,
        score_type: analysisResult.score.type as ScoreType,
        score: analysisResult.score.score,
        pv: analysisResult.pvs[0] || '',
      })
    );

    // Batch insert analysis
    await this.repo.batchUpsertAnalysis(analysisData);
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
    const analysis = await this.repo.getBestAnalysisForPosition(fen);
    if (!analysis) return null;

    return {
      evaluation: analysis.score,
      scoreType: analysis.score_type,
      depth: analysis.depth,
      bestMove: analysis.pv.split(' ')[0] || '',
      pv: analysis.pv.split(' ').filter(move => move.length > 0),
      engineInfo: `${analysis.engine_name} ${analysis.engine_version}`,
    };
  }

  /**
   * Parse engine slug into name and version components.
   */
  private parseEngineSlug(slug: string): [string, string] {
    const parts = slug.split('-');
    if (parts.length >= 2) {
      const version = parts[parts.length - 1];
      const name = parts.slice(0, -1).join('-');
      return [name, version];
    }
    return [slug, '1.0.0'];
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
