import { Command } from 'commander';
import { ProjectCommands } from './commands/ProjectCommands';
import { AnalysisCommands } from './commands/AnalysisCommands';
import { AnalyzeOptions, CLIDependencies } from './types';
import { createCLIDependencies } from './dependencies';

/**
 * Main CLI application entry point
 */
export class ChessProjectCLI {
  private program: Command;
  private dependencies: CLIDependencies | undefined;
  private projectCommands: ProjectCommands | undefined;
  private analysisCommands: AnalysisCommands | undefined;

  constructor(dependencies?: Partial<CLIDependencies>) {
    this.program = new Command();
    this.init(dependencies);
    this.setupCommands();
  }

  async init(dependencies?: Partial<CLIDependencies>): Promise<void> {
    this.dependencies = await createCLIDependencies(dependencies);
    this.projectCommands = new ProjectCommands(this.dependencies);
    this.analysisCommands = new AnalysisCommands(this.dependencies);
  }

  private setupCommands(): void {
    this.program
      .name('project')
      .description('Chess Project Management and Analysis CLI')
      .version('1.0.0');

    // Top-level create command
    this.program
      .command('create <project-name>')
      .description('Create a new chess project')
      .option(
        '--root-position <fen>',
        'Starting FEN position',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      )
      .option('--engine <engine>', 'Default engine for the project')
      .option('--depth <number>', 'Default analysis depth', '15')
      .action((projectName, options) => {
        this.projectCommands!.create(projectName, options);
      });

    // Analyze command with proper options
    this.program
      .command('analyze <project-name> <fen>')
      .alias('analyse')
      .description('Analyze a chess position in a project')
      .option('-d, --depth <number>', 'Analysis depth')
      .option('-t, --time <seconds>', 'Analysis time limit in seconds')
      .option('-m, --multipv <number>', 'Number of principal variations')
      .option(
        '--type <type>',
        'Analysis type: position, pv-explore, explore',
        'position'
      )
      .action(async (projectName, fen, options) => {
        const analysisOptions: AnalyzeOptions = {
          type: options.type as 'position' | 'pv-explore' | 'explore',
          depth: options.depth,
          time: options.time,
          multipv: options.multipv,
        };
        await this.analysisCommands!.analyze(projectName, fen, analysisOptions);
      });

    // Engine command
    this.program
      .command('engine <project-name> <engine-path>')
      .description('Set the engine for a project')
      .action(async (projectName, enginePath) => {
        await this.projectCommands!.setEngine(projectName, enginePath);
      });

    // List projects command
    this.program
      .command('list')
      .description('List all projects')
      .option(
        '--path <directory>',
        'Base directory to search',
        './_data/projects'
      )
      .action(options => {
        this.projectCommands!.list(options);
      });

    // Delete project command
    this.program
      .command('delete <project-name>')
      .description('Delete a project')
      .option('--force', 'Force deletion without confirmation')
      .action((projectName, options) => {
        this.projectCommands!.delete(projectName, options);
      });

    // Analysis management commands
    const analysisCmd = this.program
      .command('analysis')
      .description('Analysis management commands');

    analysisCmd
      .command('status <project-name>')
      .description('Show analysis status for a project')
      .action(projectName => {
        this.analysisCommands!.status(projectName);
      });

    analysisCmd
      .command('resume <project-name>')
      .description('Resume incomplete analysis')
      .action(projectName => {
        this.analysisCommands!.resume(projectName);
      });

    analysisCmd
      .command('export <project-name>')
      .description('Export analysis results')
      .option('--format <format>', 'Export format: json, epd, pgn', 'json')
      .option('--output <file>', 'Output file path')
      .action((projectName, options) => {
        this.analysisCommands!.export(projectName, options);
      });
  }

  public async run(argv?: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      console.error('CLI Error:', error);
      process.exit(1);
    }
  }

  public getProgram(): Command {
    return this.program;
  }

  public async cleanup(): Promise<void> {
    if (this.dependencies?.analysisStore) {
      await this.dependencies.analysisStore.close();
    }

    // Force exit after a brief delay to ensure cleanup completes
    setTimeout(() => {
      process.exit(0);
    }, 100);
  }
}

export { ProjectCommands, AnalysisCommands };
export * from './types';
