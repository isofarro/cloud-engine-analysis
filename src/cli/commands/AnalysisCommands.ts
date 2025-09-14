import {
  CLIDependencies,
  AnalyzeOptions,
  ExportOptions,
  CommandResult,
  ExploreOptions,
} from '../types';
import {
  ChessProject,
  AnalysisContext,
  AnalysisConfig,
} from '../../core/project/types';
import { FenString } from '../../core/types';
import { AnalysisChecker } from '../../core/project/services/AnalysisChecker';
import { loadGraph, saveGraph } from '../../core/utils/graph';
import * as path from 'path';
import * as fs from 'fs/promises';
import { getProjectDirectory } from '../utils';

export class AnalysisCommands {
  private dependencies: CLIDependencies;

  constructor(dependencies: CLIDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Analyze a single position in a project
   */
  /**
   * Analyze a single position using basic position analysis
   */
  public async analyze(
    projectName: string,
    fen: string,
    options: AnalyzeOptions
  ): Promise<CommandResult> {
    try {
      console.log(`Analyzing position in project: ${projectName}`);
      console.log(`Position (FEN): ${fen}`);

      const projectPath = path.join(getProjectDirectory(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);
      // Fix: Use loadGraph function instead of graph.load method
      const projectGraph = await loadGraph(project.graphPath);
      const analysisStore = this.dependencies.analysisStore;

      // Create analysis configuration
      const analysisConfig: AnalysisConfig = {
        depth: options.depth ? parseInt(options.depth) : undefined,
        // Fix: Use 'time' property (in seconds)
        time: options.time ? parseInt(options.time) : undefined,
        multiPv: options.multipv ? parseInt(options.multipv) : 1,
      };

      console.log(`Analysis config:`, analysisConfig);

      // Get the position strategy (always 'position' for analyze command)
      const strategy = this.dependencies.strategyRegistry.get('position');
      if (!strategy) {
        throw new Error('Position analysis strategy not found');
      }

      // Create analysis context
      const context: AnalysisContext = {
        // Fix: Use position instead of fen
        position: fen as FenString,
        config: analysisConfig,
        graph: projectGraph,
        analysisStore,
        // Add required project and metadata fields
        project,
        metadata: {},
      };

      // Execute analysis
      console.log('Starting position analysis...');
      // Fix: executeStrategies expects (strategies, position, additionalContext)
      await this.dependencies.taskExecutor.executeStrategies(
        [strategy],
        fen as FenString,
        context
      );

      // Fix: Use saveGraph function instead of graph.save method
      await saveGraph(
        projectGraph,
        'graph.json',
        path.dirname(project.graphPath)
      );

      // Save the updated project graph
      await saveGraph(
        projectGraph,
        'graph.json',
        path.dirname(project.graphPath)
      );

      console.log('✓ Analysis completed successfully');
      return {
        success: true,
        message: 'Position analysis completed',
        data: { fen, strategy: 'position' },
      };
    } catch (error) {
      const message = `Failed to analyze position: ${
        error instanceof Error ? error.message : error
      }`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Explore positions using multi-position strategies
   */
  public async explore(
    projectName: string,
    fen: string,
    options: ExploreOptions
  ): Promise<CommandResult> {
    try {
      console.log(`Exploring positions in project: ${projectName}`);
      console.log(`Starting position (FEN): ${fen}`);

      const projectPath = path.join(getProjectDirectory(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);
      const projectGraph = await loadGraph(project.graphPath);
      const analysisStore = this.dependencies.analysisStore;

      // Create analysis configuration for explore method
      const analysisConfig: AnalysisConfig = {
        depth: options.depth ? parseInt(options.depth) : undefined,
        // Fix: Use 'time' property (in seconds)
        time: options.time ? parseInt(options.time) : undefined,
        multiPv: options.multipv ? parseInt(options.multipv) : 1,
      };

      // Parse maxPositions if provided
      const maxPositions = options.maxPositions
        ? parseInt(options.maxPositions)
        : undefined;

      console.log(`Analysis config:`, analysisConfig);
      if (maxPositions !== undefined) {
        console.log(`Max positions limit: ${maxPositions}`);
      } else {
        console.log('No position limit set');
      }

      // Get the exploration strategy (default to 'pv-explore')
      const strategyName = options.strategy || 'pv-explore';
      const strategy = this.dependencies.strategyRegistry.get(strategyName);
      if (!strategy) {
        throw new Error(`Exploration strategy '${strategyName}' not found`);
      }

      // Create analysis context with maxPositions configuration
      const context: AnalysisContext = {
        position: fen as FenString,
        config: analysisConfig, // Remove maxPositions from config
        graph: projectGraph,
        analysisStore,
        project,
        metadata: {
          maxPositions, // Pass maxPositions in metadata instead
        },
      };

      // Execute exploration
      console.log(`Starting ${strategyName} exploration...`);
      await this.dependencies.taskExecutor.executeStrategies(
        [strategy],
        fen as FenString, // Pass the position as second parameter
        context // Pass context as third parameter (additionalContext)
      );

      // Save the updated project graph
      await saveGraph(
        projectGraph,
        'graph.json',
        path.dirname(project.graphPath)
      );

      console.log('✓ Exploration completed successfully');
      return {
        success: true,
        message: 'Position exploration completed',
        data: { fen, strategy: strategyName, maxPositions },
      };
    } catch (error) {
      const message = `Failed to explore positions: ${
        error instanceof Error ? error.message : error
      }`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Show analysis status for a project
   */
  public async status(projectName: string): Promise<CommandResult> {
    try {
      console.log(`Analysis status for project: ${projectName}`);

      const projectPath = path.join(getProjectDirectory(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);

      // Get analysis statistics from the repository
      const positions = await this.getProjectPositions(project);
      const analysisCount = await this.getAnalysisCount(positions);

      console.log(`\nProject: ${project.name}`);
      console.log(`Total positions: ${positions.length}`);
      console.log(`Analyzed positions: ${analysisCount}`);
      console.log(
        `Analysis coverage: ${positions.length > 0 ? Math.round((analysisCount / positions.length) * 100) : 0}%`
      );
      console.log(`Last updated: ${project.updatedAt.toLocaleString()}`);

      return {
        success: true,
        data: { positions: positions.length, analyzed: analysisCount },
      };
    } catch (error) {
      const message = `Failed to get analysis status: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Resume incomplete analysis
   */
  public async resume(projectName: string): Promise<CommandResult> {
    try {
      console.log(`Resuming analysis for project: ${projectName}`);

      const projectPath = path.join(getProjectDirectory(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);

      // Get unanalyzed positions
      const positions = await this.getProjectPositions(project);
      const unanalyzedPositions = await this.getUnanalyzedPositions(positions);

      if (unanalyzedPositions.length === 0) {
        return {
          success: true,
          message: 'No unanalyzed positions found. Analysis is complete.',
        };
      }

      // Resume analysis for the first unanalyzed position
      const fen = unanalyzedPositions[0];
      console.log(`Resuming analysis for position: ${fen}`);

      // Fix: Remove type option from analyze call
      await this.analyze(projectName, fen, {
        depth: '20',
        time: '5000',
        multipv: '1',
      });

      console.log(
        `Found ${unanalyzedPositions.length} positions needing analysis`
      );

      // Analyze each unanalyzed position
      let successCount = 0;
      for (let i = 0; i < unanalyzedPositions.length; i++) {
        const position = unanalyzedPositions[i];
        console.log(
          `\nAnalyzing position ${i + 1}/${unanalyzedPositions.length}: ${position}`
        );

        const result = await this.analyze(projectName, position, {});
        if (result.success) {
          successCount++;
        }
      }

      console.log(
        `\n✓ Resume completed: ${successCount}/${unanalyzedPositions.length} positions analyzed`
      );
      return {
        success: true,
        data: { analyzed: successCount, total: unanalyzedPositions.length },
      };
    } catch (error) {
      const message = `Failed to resume analysis: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Export analysis results
   */
  public async export(
    projectName: string,
    options: ExportOptions
  ): Promise<CommandResult> {
    try {
      const projectPath = path.join(getProjectDirectory(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);

      const format = options.format || 'json';
      const outputFile = options.output || `${projectName}-analysis.${format}`;

      // Get all analysis results
      const positions = await this.getProjectPositions(project);
      const analysisResults = await this.getAnalysisResults(positions);

      // Format and export data
      let exportData: string;
      switch (format) {
        case 'json':
          exportData = JSON.stringify(analysisResults, null, 2);
          break;
        case 'epd':
          exportData = this.formatAsEPD(analysisResults);
          break;
        case 'pgn':
          exportData = this.formatAsPGN(analysisResults);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      await fs.writeFile(outputFile, exportData, 'utf-8');

      console.log(`✓ Analysis exported to: ${outputFile}`);
      console.log(`  - Format: ${format.toUpperCase()}`);
      console.log(`  - Positions: ${analysisResults.length}`);

      return {
        success: true,
        data: { file: outputFile, count: analysisResults.length },
      };
    } catch (error) {
      const message = `Failed to export analysis: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  // Helper methods
  private async getProjectPositions(project: ChessProject): Promise<string[]> {
    // In a real implementation, this would load from the project graph
    // For now, return a placeholder
    return [project.rootPosition];
  }

  private async getAnalysisCount(positions: string[]): Promise<number> {
    // Count how many positions have analysis data using AnalysisChecker
    const analysisChecker = new AnalysisChecker(
      this.dependencies.analysisStore
    );
    let count = 0;
    for (const position of positions) {
      const checkResult = await analysisChecker.checkPosition(
        position as FenString
      );
      if (checkResult.hasAnalysis) count++;
    }
    return count;
  }

  private async getUnanalyzedPositions(positions: string[]): Promise<string[]> {
    const analysisChecker = new AnalysisChecker(
      this.dependencies.analysisStore
    );
    const unanalyzed: string[] = [];
    for (const position of positions) {
      const checkResult = await analysisChecker.checkPosition(
        position as FenString
      );
      if (!checkResult.hasAnalysis) {
        unanalyzed.push(position);
      }
    }
    return unanalyzed;
  }

  private async getAnalysisResults(positions: string[]): Promise<any[]> {
    const results: any[] = [];
    for (const position of positions) {
      // Use getBestAnalysisForPosition which only requires FEN
      const analysis =
        await this.dependencies.analysisStore.getBestAnalysisForPosition(
          position as FenString
        );
      if (analysis) {
        results.push({ position, analysis });
      }
    }
    return results;
  }

  private formatAsEPD(results: any[]): string {
    return results
      .map(r => {
        const analysis = r.analysis; // analysis is now AnalysisWithDetails object
        // Fix property access - use score instead of evaluation
        const evaluation =
          analysis.score_type === 'cp' ? analysis.score : `#${analysis.score}`;
        return `${r.position} ce ${evaluation}; acd ${analysis.depth}; pv ${analysis.pv || ''};`;
      })
      .join('\n');
  }

  private formatAsPGN(results: any[]): string {
    // Basic PGN format - in a real implementation this would be more sophisticated
    return results
      .map((r, index) => {
        const analysis = r.analysis;
        const evaluation =
          analysis.score_type === 'cp' ? analysis.score : `#${analysis.score}`;
        return `[Event "Analysis Export"]\n[Site "Chess Project CLI"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n[Round "${index + 1}"]\n[White "Analysis"]\n[Black "Analysis"]\n[Result "*"]\n[FEN "${r.position}"]\n[Evaluation "${evaluation}"]\n[Depth "${analysis.depth || 'N/A'}"]\n\n*`;
      })
      .join('\n\n');
  }
}
