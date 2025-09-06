import { Command } from 'commander';
import { ProjectCommands } from './commands/ProjectCommands';
import { AnalysisCommands } from './commands/AnalysisCommands';
import { CLIDependencies } from './types';
import { createCLIDependencies } from './dependencies';

/**
 * Main CLI application entry point
 */
export class ChessProjectCLI {
  private program: Command;
  private dependencies: CLIDependencies;
  private projectCommands: ProjectCommands;
  private analysisCommands: AnalysisCommands;

  constructor(dependencies?: Partial<CLIDependencies>) {
    this.program = new Command();
    this.dependencies = createCLIDependencies(dependencies);
    this.projectCommands = new ProjectCommands(this.dependencies);
    this.analysisCommands = new AnalysisCommands(this.dependencies);
    this.setupCommands();
  }

  private setupCommands(): void {
    this.program
      .name('chess-project')
      .description('Chess Project Management and Analysis CLI')
      .version('1.0.0');

    // Project management commands
    const projectCmd = this.program
      .command('project <project-name>')
      .description('Manage chess projects');

    // Project subcommands
    projectCmd
      .command('create')
      .description('Create a new chess project')
      .option(
        '--root-position <fen>',
        'Starting FEN position',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      )
      .option('--engine <engine>', 'Default engine for the project')
      .option('--depth <number>', 'Default analysis depth', '15')
      .action((options, cmd) => {
        const projectName = cmd.parent?.args[0];
        this.projectCommands.create(projectName, options);
      });

    projectCmd
      .command('engine <engine-name>')
      .description('Set engine configuration for the project')
      .action((engineName, options, cmd) => {
        const projectName = cmd.parent?.parent?.args[0];
        this.projectCommands.setEngine(projectName, engineName);
      });

    projectCmd
      .command('add <fen>')
      .description('Add a position to the project graph')
      .action((fen, options, cmd) => {
        const projectName = cmd.parent?.parent?.args[0];
        this.projectCommands.addPosition(projectName, fen);
      });

    projectCmd
      .command('move <from-fen> <move> <to-fen>')
      .description('Add a move to the project chess graph')
      .action((fromFen, move, toFen, options, cmd) => {
        const projectName = cmd.parent?.parent?.args[0];
        this.projectCommands.addMove(projectName, fromFen, move, toFen);
      });

    projectCmd
      .command('analyze <fen>')
      .description('Analyze a position in the project')
      .option(
        '--type <type>',
        'Analysis type: position, pv-explore, explore',
        'position'
      )
      .option('--depth <number>', 'Analysis depth')
      .option('--time <seconds>', 'Analysis time limit in seconds')
      .option('--multipv <number>', 'Number of principal variations')
      .action((fen, options, cmd) => {
        const projectName = cmd.parent?.parent?.args[0];
        this.analysisCommands.analyze(projectName, fen, options);
      });

    // Global project commands
    this.program
      .command('list')
      .description('List all projects')
      .option('--path <directory>', 'Base directory to search', process.cwd())
      .action(options => {
        this.projectCommands.list(options);
      });

    this.program
      .command('delete <project-name>')
      .description('Delete a project')
      .option('--force', 'Force deletion without confirmation')
      .action((projectName, options) => {
        this.projectCommands.delete(projectName, options);
      });

    // Analysis commands
    const analysisCmd = this.program
      .command('analysis')
      .description('Analysis management commands');

    analysisCmd
      .command('status <project-name>')
      .description('Show analysis status for a project')
      .action(projectName => {
        this.analysisCommands.status(projectName);
      });

    analysisCmd
      .command('resume <project-name>')
      .description('Resume incomplete analysis')
      .action(projectName => {
        this.analysisCommands.resume(projectName);
      });

    analysisCmd
      .command('export <project-name>')
      .description('Export analysis results')
      .option('--format <format>', 'Export format: json, epd, pgn', 'json')
      .option('--output <file>', 'Output file path')
      .action((projectName, options) => {
        this.analysisCommands.export(projectName, options);
      });
  }

  /**
   * Parse command line arguments and execute commands
   */
  public async run(argv?: string[]): Promise<void> {
    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      console.error(
        'CLI Error:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  }

  /**
   * Get the commander program instance for testing
   */
  public getProgram(): Command {
    return this.program;
  }
}

// Export for direct usage
export { ProjectCommands, AnalysisCommands };
export * from './types';
