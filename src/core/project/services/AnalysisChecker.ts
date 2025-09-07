import { IAnalysisRepo } from '../../analysis-store/IAnalysisRepo';
import { AnalysisStoreService } from '../../analysis-store/AnalysisStoreService';
import { FenString } from '../../types';
import { AnalysisWithDetails } from '../../analysis-store/types';

/**
 * Configuration for analysis checking behavior
 */
export interface AnalysisCheckerConfig {
  /** Minimum depth required to consider analysis as "complete" */
  minDepth?: number;

  /** Maximum age in days for analysis to be considered fresh */
  maxAgeDays?: number;

  /** Whether to prefer higher depth analysis when multiple exist */
  preferHigherDepth?: boolean;

  /** Specific engines to check (if empty, checks all engines) */
  engineSlugs?: string[];
}

/**
 * Result of position analysis check
 */
export interface AnalysisCheckResult {
  /** Whether the position has been analyzed */
  hasAnalysis: boolean;

  /** The best analysis found (if any) */
  bestAnalysis?: AnalysisWithDetails;

  /** All analyses found for the position */
  allAnalyses: AnalysisWithDetails[];

  /** Whether analysis meets the configured criteria */
  meetsRequirements: boolean;

  /** Reason why requirements are not met (if applicable) */
  requirementFailureReason?: string;
}

/**
 * Batch check result for multiple positions
 */
export interface BatchAnalysisCheckResult {
  /** Results keyed by FEN string */
  results: Map<FenString, AnalysisCheckResult>;

  /** Positions that need analysis */
  needsAnalysis: FenString[];

  /** Positions that already have sufficient analysis */
  hasAnalysis: FenString[];

  /** Summary statistics */
  summary: {
    total: number;
    analyzed: number;
    needsAnalysis: number;
    analysisRate: number;
  };
}

/**
 * Service for checking position analysis status and avoiding duplicate work.
 * Provides efficient deduplication by querying the analysis repository.
 */
export class AnalysisChecker {
  private repo: IAnalysisRepo;
  private config: AnalysisCheckerConfig;

  constructor(
    repoOrService: IAnalysisRepo | AnalysisStoreService,
    config: AnalysisCheckerConfig = {}
  ) {
    // Extract the repository from AnalysisStoreService if needed
    this.repo =
      repoOrService instanceof AnalysisStoreService
        ? repoOrService.getRepository()
        : repoOrService;
    this.config = {
      minDepth: 10,
      maxAgeDays: 30,
      preferHigherDepth: true,
      engineSlugs: [],
      ...config,
    };
  }

  /**
   * Check if a single position has been analyzed according to criteria
   */
  async checkPosition(fen: FenString): Promise<AnalysisCheckResult> {
    try {
      // Get the best analysis for this position
      const bestAnalysis = await this.repo.getBestAnalysisForPosition(fen);

      // Declare allAnalyses variable
      let allAnalyses: AnalysisWithDetails[];

      if (!bestAnalysis) {
        return {
          hasAnalysis: false,
          allAnalyses: [],
          meetsRequirements: false,
          requirementFailureReason: 'No analysis found',
        };
      }

      // Get all analyses based on engine configuration
      if (this.config.engineSlugs?.length) {
        // Check each engine separately and combine results
        const allEngineAnalyses: AnalysisWithDetails[] = [];

        for (const engineSlug of this.config.engineSlugs) {
          const engineAnalyses = await this.repo.queryAnalysis({
            fen,
            engine_slug: engineSlug,
            limit: 100,
          });
          allEngineAnalyses.push(...engineAnalyses);
        }

        allAnalyses = allEngineAnalyses;
      } else {
        // Get all analyses for more detailed checking
        allAnalyses = await this.repo.queryAnalysis({
          fen,
          limit: 100, // Reasonable limit for analysis comparison
        });
      }

      // Check if analysis meets requirements
      const meetsRequirements = this.evaluateAnalysisRequirements(bestAnalysis);
      const requirementFailureReason = meetsRequirements
        ? undefined
        : this.getFailureReason(bestAnalysis);

      return {
        hasAnalysis: true,
        bestAnalysis,
        allAnalyses,
        meetsRequirements,
        requirementFailureReason,
      };
    } catch (error: unknown) {
      return {
        hasAnalysis: false,
        allAnalyses: [],
        meetsRequirements: false,
        requirementFailureReason: `Error during check: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Check multiple positions efficiently in batch
   */
  async checkPositions(fens: FenString[]): Promise<BatchAnalysisCheckResult> {
    const results = new Map<FenString, AnalysisCheckResult>();
    const needsAnalysis: FenString[] = [];
    const hasAnalysis: FenString[] = [];

    // Process positions in parallel for better performance
    const checkPromises = fens.map(async fen => {
      const result = await this.checkPosition(fen);
      results.set(fen, result);

      if (result.meetsRequirements) {
        hasAnalysis.push(fen);
      } else {
        needsAnalysis.push(fen);
      }
    });

    await Promise.all(checkPromises);

    const total = fens.length;
    const analyzed = hasAnalysis.length;
    const analysisRate = total > 0 ? (analyzed / total) * 100 : 0;

    return {
      results,
      needsAnalysis,
      hasAnalysis,
      summary: {
        total,
        analyzed,
        needsAnalysis: needsAnalysis.length,
        analysisRate,
      },
    };
  }

  /**
   * Check if a position needs analysis based on engine and depth criteria
   */
  async needsAnalysis(
    fen: FenString,
    engineSlug?: string,
    minDepth?: number
  ): Promise<boolean> {
    const effectiveMinDepth = minDepth ?? this.config.minDepth ?? 10;

    if (engineSlug) {
      // Check for specific engine
      const analysis = await this.repo.getAnalysisByFenAndEngine(
        fen,
        engineSlug
      );
      return !analysis || analysis.depth < effectiveMinDepth;
    } else {
      // Check for any sufficient analysis
      const result = await this.checkPosition(fen);
      return !result.meetsRequirements;
    }
  }

  /**
   * Get positions that need analysis from a list
   */
  async filterPositionsNeedingAnalysis(
    fens: FenString[],
    engineSlug?: string,
    minDepth?: number
  ): Promise<FenString[]> {
    const needsAnalysisPromises = fens.map(async fen => {
      const needs = await this.needsAnalysis(fen, engineSlug, minDepth);
      return needs ? fen : null;
    });

    const results = await Promise.all(needsAnalysisPromises);
    return results.filter((fen): fen is FenString => fen !== null);
  }

  /**
   * Get analysis coverage statistics for a set of positions
   */
  async getAnalysisCoverage(fens: FenString[]): Promise<{
    total: number;
    analyzed: number;
    coverage: number;
    byEngine: Record<string, number>;
    byDepthRange: Record<string, number>;
  }> {
    const batchResult = await this.checkPositions(fens);
    const byEngine: Record<string, number> = {};
    const byDepthRange: Record<string, number> = {
      '1-10': 0,
      '11-20': 0,
      '21-30': 0,
      '31+': 0,
    };

    for (const result of batchResult.results.values()) {
      if (result.bestAnalysis) {
        // Count by engine
        const engineSlug = result.bestAnalysis.engine_slug;
        byEngine[engineSlug] = (byEngine[engineSlug] || 0) + 1;

        // Count by depth range
        const depth = result.bestAnalysis.depth;
        if (depth <= 10) byDepthRange['1-10']++;
        else if (depth <= 20) byDepthRange['11-20']++;
        else if (depth <= 30) byDepthRange['21-30']++;
        else byDepthRange['31+']++;
      }
    }

    return {
      total: batchResult.summary.total,
      analyzed: batchResult.summary.analyzed,
      coverage: batchResult.summary.analysisRate,
      byEngine,
      byDepthRange,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AnalysisCheckerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): AnalysisCheckerConfig {
    return { ...this.config };
  }

  /**
   * Evaluate if analysis meets the configured requirements
   */
  private evaluateAnalysisRequirements(analysis: AnalysisWithDetails): boolean {
    // Check minimum depth
    if (this.config.minDepth && analysis.depth < this.config.minDepth) {
      return false;
    }

    // Check maximum age
    if (this.config.maxAgeDays) {
      const analysisDate = new Date(analysis.created_at);
      const maxAge = new Date();
      maxAge.setDate(maxAge.getDate() - this.config.maxAgeDays);

      if (analysisDate < maxAge) {
        return false;
      }
    }

    // Check engine filter
    if (
      this.config.engineSlugs?.length &&
      !this.config.engineSlugs.includes(analysis.engine_slug)
    ) {
      return false;
    }

    return true;
  }

  /**
   * Get human-readable reason why analysis doesn't meet requirements
   */
  private getFailureReason(analysis: AnalysisWithDetails): string {
    const reasons: string[] = [];

    if (this.config.minDepth && analysis.depth < this.config.minDepth) {
      reasons.push(
        `Depth ${analysis.depth} < required ${this.config.minDepth}`
      );
    }

    if (this.config.maxAgeDays) {
      const analysisDate = new Date(analysis.created_at);
      const maxAge = new Date();
      maxAge.setDate(maxAge.getDate() - this.config.maxAgeDays);

      if (analysisDate < maxAge) {
        const ageInDays = Math.floor(
          (Date.now() - analysisDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        reasons.push(
          `Analysis is ${ageInDays} days old (max ${this.config.maxAgeDays})`
        );
      }
    }

    if (
      this.config.engineSlugs?.length &&
      !this.config.engineSlugs.includes(analysis.engine_slug)
    ) {
      reasons.push(`Engine ${analysis.engine_slug} not in allowed list`);
    }

    return reasons.length > 0
      ? reasons.join(', ')
      : 'Unknown requirement failure';
  }
}
