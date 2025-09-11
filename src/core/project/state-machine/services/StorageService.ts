import { IStorageService, StorageRequest, StorageQuery } from './types';
import { AnalysisStoreService } from '../../../analysis-store/AnalysisStoreService';
import { UciAnalysisResult } from '../../../engine/types';
import { FenString } from '../../../types';

export class StorageService implements IStorageService {
  private store: AnalysisStoreService;

  constructor(store: AnalysisStoreService) {
    this.store = store;
  }

  async storeAnalysis(request: StorageRequest): Promise<void> {
    // Extract engine slug from metadata or use default
    const engineSlug = request.metadata?.engineSlug || 'unknown-engine';

    // Store the analysis result using the AnalysisStoreService
    await this.store.storeAnalysisResult(request.result, engineSlug);
  }

  async getAnalysis(query: StorageQuery): Promise<UciAnalysisResult[]> {
    const analysisQuery = {
      fen: query.position,
      engine_slug: query.engineSlug,
      min_depth: query.minDepth,
      limit: query.limit,
    };

    // Get analyses from the store using queryAnalysis instead of getAnalyses
    const analyses = await this.store.queryAnalysis(analysisQuery);

    // Convert back to UciAnalysisResult format
    return analyses.map((analysis: any) => ({
      fen: analysis.position_fen,
      depth: analysis.depth,
      selDepth: analysis.depth, // Add missing selDepth property
      multiPV: 1, // Add missing multiPV property
      time: analysis.time,
      nodes: analysis.nodes,
      nps: analysis.nps,
      score: {
        type: analysis.score_type,
        score: analysis.score,
      },
      pvs: [analysis.pv], // Convert single PV to array format
    }));
  }

  async hasAnalysis(
    position: FenString,
    engineSlug?: string
  ): Promise<boolean> {
    const query = {
      position,
      engineSlug,
      limit: 1,
    };

    const results = await this.getAnalysis(query);
    return results.length > 0;
  }

  async clearAnalysis(query?: StorageQuery): Promise<void> {
    if (!query) {
      // Clear all analysis - this would require a method on AnalysisStoreService
      // For now, we'll throw an error as this operation is not supported
      throw new Error('Clearing all analysis is not currently supported');
    }

    // Selective clearing would require additional methods on AnalysisStoreService
    // This is a placeholder implementation
    throw new Error('Selective analysis clearing is not currently supported');
  }

  // Legacy methods for backward compatibility
  async saveAnalysis(key: string, data: any, options?: any): Promise<void> {
    // Convert legacy format to new StorageRequest format
    const request: StorageRequest = {
      result: data,
      engineSlug: options?.engineSlug || 'legacy-engine',
      metadata: options?.metadata,
    };

    await this.storeAnalysis(request);
  }

  async loadAnalysis(key: string): Promise<any | null> {
    // Legacy method - try to parse key as FEN and return analysis
    try {
      const results = await this.getAnalysis({ position: key, limit: 1 });
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      return null;
    }
  }

  async deleteAnalysis(key: string): Promise<boolean> {
    // Legacy method - not implemented as it requires additional store methods
    throw new Error('Delete analysis is not currently supported');
  }

  async listAnalyses(prefix?: string): Promise<string[]> {
    // Legacy method - return list of analyzed positions
    const results = await this.getAnalysis({ limit: 1000 });
    return results.map(result => result.fen);
  }

  async analysisExists(key: string): Promise<boolean> {
    return this.hasAnalysis(key);
  }

  async getAnalysisMetadata(key: string): Promise<Record<string, any> | null> {
    const results = await this.getAnalysis({ position: key, limit: 1 });
    if (results.length === 0) return null;

    const result = results[0];
    return {
      depth: result.depth,
      time: result.time,
      nodes: result.nodes,
      nps: result.nps,
      score: result.score,
    };
  }
}
