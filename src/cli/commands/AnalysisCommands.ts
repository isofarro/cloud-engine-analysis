import {
  CLIDependencies,
  AnalyzeOptions,
  ExportOptions,
  CommandResult,
  ProgressCallback,
} from '../types';
import {
  ChessProject,
  AnalysisContext,
  AnalysisConfig,
} from '../../core/project/types';
import { FenString } from '../../core/types';
import { TaskExecutionConfig } from '../../core/project/services/AnalysisTaskExecutor';
import { AnalysisChecker } from '../../core/project/services/AnalysisChecker';
import * as path from 'path';
import * as fs from 'fs/promises';

export class AnalysisCommands {
  private dependencies: CLIDependencies;

  constructor(dependencies: CLIDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Analyze a position in a project
   */
  public async analyze(
    projectName: string,
    fen: string,
    options: AnalyzeOptions
  ): Promise<CommandResult> {
    try {
      console.log(`Analyzing position in project: ${projectName}`);
      console.log(`Position: ${fen}`);
      console.log(`Analysis type: ${options.type || 'position'}`);

      const projectPath = path.join(process.cwd(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);

      // Create analysis configuration
      const analysisConfig: AnalysisConfig = {
        depth: options.depth
          ? parseInt(options.depth)
          : project.config.analysisDepth || 15,
        timeLimit: options.time ? parseInt(options.time) * 1000 : undefined,
        multiPv: options.multipv
          ? parseInt(options.multipv)
          : project.config.multiPv || 1,
      };

      // Create analysis context
      const context: AnalysisContext = {
        position: fen as FenString,
        graph: this.dependencies.graph,
        analysisRepo: this.dependencies.analysisRepo,
        config: analysisConfig,
        project,
        metadata: {
          analysisType: options.type || 'position',
          requestedAt: new Date().toISOString(),
        },
      };

      // Find applicable strategies
      const strategies =
        this.dependencies.strategyRegistry.findApplicable(context);

      if (strategies.length === 0) {
        throw new Error(
          `No applicable strategies found for analysis type: ${options.type}`
        );
      }

      console.log(
        `Found ${strategies.length} applicable strategy(ies): ${strategies.map(s => s.name).join(', ')}`
      );

      // Configure task execution
      const executionConfig: TaskExecutionConfig = {
        maxExecutionTimeMs: analysisConfig.timeLimit || 300000, // 5 minutes default
        continueOnError: true,
        maxRetries: 2,
        enableParallelExecution: false,
      };

      // Set up progress tracking
      const progressCallback: ProgressCallback = progress => {
        const percentage = Math.round(
          (progress.current / progress.total) * 100
        );
        console.log(
          `Progress: ${percentage}% (${progress.current}/${progress.total}) ${progress.message || ''}`
        );
      };

      // Execute analysis - fix the parameter: use 'fen' instead of 'position'
      console.log('Starting analysis...');
      const startTime = Date.now();

      const result = await this.dependencies.taskExecutor.executeStrategies(
        strategies,
        fen as FenString, // Use 'fen' parameter instead of 'position'
        { project, config: analysisConfig } // Pass additional context
      );

      const executionTime = Date.now() - startTime;

      if (result.success) {
        console.log(
          `\n✓ Analysis completed successfully in ${executionTime}ms`
        );
        console.log(
          `  - Strategies executed: ${result.metadata.strategiesExecuted}`
        );
        console.log(`  - Results generated: ${result.results.length}`);
        console.log(
          `  - Failed strategies: ${result.metadata.strategiesFailed}`
        );

        // Display key results - fix property access
        if (result.results.length > 0) {
          console.log('\nTop analysis results:');
          result.results.slice(0, 3).forEach((analysis, index) => {
            // Use score instead of evaluation, and pvs instead of pv
            const evaluation = analysis.score
              ? `${analysis.score.type} ${analysis.score.score}`
              : 'N/A';
            console.log(
              `  ${index + 1}. Eval: ${evaluation}, Depth: ${analysis.depth || 'N/A'}`
            );
            if (analysis.pvs && analysis.pvs.length > 0) {
              const pv = analysis.pvs[0].split(' ').slice(0, 5).join(' ');
              console.log(
                `     PV: ${pv}${analysis.pvs[0].split(' ').length > 5 ? '...' : ''}`
              );
            }
          });
        }
      } else {
        console.log(`\n✗ Analysis failed or partially completed`);
        console.log(`  - Execution time: ${executionTime}ms`);
        console.log(`  - Errors: ${result.errors.length}`);

        if (result.errors.length > 0) {
          console.log('\nErrors encountered:');
          result.errors.forEach((error, index) => {
            console.log(`  ${index + 1}. ${error.message}`);
          });
        }
      }

      return { success: result.success, data: result };
    } catch (error) {
      const message = `Failed to analyze position: ${error instanceof Error ? error.message : error}`;
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

      const projectPath = path.join(process.cwd(), projectName);
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

      const projectPath = path.join(process.cwd(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);

      // Find positions that need analysis
      const positions = await this.getProjectPositions(project);
      const unanalyzedPositions = await this.getUnanalyzedPositions(positions);

      if (unanalyzedPositions.length === 0) {
        console.log('✓ All positions are already analyzed');
        return { success: true, message: 'No analysis needed' };
      }

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

        const result = await this.analyze(projectName, position, {
          type: 'position',
        });
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
      console.log(`Exporting analysis for project: ${projectName}`);

      const projectPath = path.join(process.cwd(), projectName);
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
    const analysisChecker = new AnalysisChecker(this.dependencies.analysisRepo);
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
    const analysisChecker = new AnalysisChecker(this.dependencies.analysisRepo);
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
        await this.dependencies.analysisRepo.getBestAnalysisForPosition(
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
