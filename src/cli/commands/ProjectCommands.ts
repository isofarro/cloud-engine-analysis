import {
  CLIDependencies,
  CommandResult,
  CreateProjectOptions,
  DeleteProjectOptions,
  ListProjectsOptions,
} from '../types';
import { ChessProject, CreateProjectConfig } from '../../core/project/types';
import { ChessGraph } from '../../core/graph/ChessGraph';
import { saveGraph, loadGraph } from '../../core/utils/graph';
import type { Move } from '../../core/graph/types';
import * as path from 'path';
import { FenString } from '../../core/types';

/**
 * Project management command handlers
 */
export class ProjectCommands {
  private dependencies: CLIDependencies;

  constructor(dependencies: CLIDependencies) {
    this.dependencies = dependencies;
  }

  /**
   * Create a new chess project
   */
  public async create(
    projectName: string,
    options: CreateProjectOptions
  ): Promise<CommandResult> {
    try {
      console.log(`Creating project: ${projectName}`);

      // Use ./_data/projects as the base directory instead of process.cwd()
      const projectPath = path.join('./_data/projects', projectName);

      // Validate FEN if provided
      const rootPosition = options.rootPosition as FenString;
      if (rootPosition && !this.isValidFen(rootPosition)) {
        throw new Error(`Invalid FEN position: ${rootPosition}`);
      }

      const config: CreateProjectConfig = {
        name: projectName,
        projectPath,
        rootPosition,
        config: {
          defaultEngine: options.engine,
          analysisDepth: options.depth ? parseInt(options.depth) : undefined,
        },
      };

      const project = await this.dependencies.projectManager.create(config);

      console.log(`✓ Project created successfully at: ${project.projectPath}`);
      console.log(`  - Name: ${project.name}`);
      console.log(`  - Root position: ${project.rootPosition}`);
      if (project.config.defaultEngine) {
        console.log(`  - Default engine: ${project.config.defaultEngine}`);
      }

      return { success: true, data: project };
    } catch (error) {
      const message = `Failed to create project: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Set engine configuration for a project
   */
  public async setEngine(
    projectName: string,
    engineName: string
  ): Promise<CommandResult> {
    try {
      console.log(`Setting engine ${engineName} for project: ${projectName}`);

      const projectPath = path.join(process.cwd(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);

      project.config.defaultEngine = engineName;
      await this.dependencies.projectManager.save(project);

      console.log(`✓ Engine configuration updated`);
      return { success: true };
    } catch (error) {
      const message = `Failed to set engine: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Add a position to the project graph
   */
  public async addPosition(
    projectName: string,
    fen: string
  ): Promise<CommandResult> {
    try {
      console.log(`Adding position to project: ${projectName}`);

      if (!this.isValidFen(fen)) {
        throw new Error(`Invalid FEN position: ${fen}`);
      }

      const projectPath = path.join(process.cwd(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);

      // Load project graph
      const graph = await this.loadProjectGraph(project);

      // Set as root position if none exists
      if (!graph.rootPosition) {
        graph.rootPosition = fen as FenString;
      }

      // Save graph
      await this.saveProjectGraph(project, graph);

      console.log(`✓ Position added: ${fen}`);
      return { success: true };
    } catch (error) {
      const message = `Failed to add position: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Add a move to the project chess graph
   */
  public async addMove(
    projectName: string,
    fromFen: string,
    move: string,
    toFen: string,
    primary?: boolean
  ): Promise<CommandResult> {
    try {
      console.log(`Adding move to project: ${projectName}`);

      if (!this.isValidFen(fromFen) || !this.isValidFen(toFen)) {
        throw new Error('Invalid FEN positions provided');
      }

      const projectPath = path.join(process.cwd(), projectName);
      const project = await this.dependencies.projectManager.load(projectPath);

      // Load project graph
      const graph = await this.loadProjectGraph(project);

      // Create Move object with correct type
      const moveObj: Move = {
        move: move,
        toFen: toFen as FenString,
      };

      // Add move to graph
      graph.addMove(fromFen as FenString, moveObj, primary || false);

      // Save graph
      await this.saveProjectGraph(project, graph);

      console.log(`✓ Move added: ${fromFen} --${move}--> ${toFen}`);
      return { success: true };
    } catch (error) {
      const message = `Failed to add move: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * List all projects
   */
  public async list(options: ListProjectsOptions): Promise<CommandResult> {
    try {
      const baseDir = options.path || process.cwd();
      console.log(`Listing projects in: ${baseDir}`);

      const projectPaths = await this.dependencies.projectManager.list(baseDir);

      if (projectPaths.length === 0) {
        console.log('No projects found.');
        return { success: true, data: [] };
      }

      console.log(`\nFound ${projectPaths.length} project(s):`);
      for (const projectPath of projectPaths) {
        try {
          const project =
            await this.dependencies.projectManager.load(projectPath);
          console.log(
            `  - ${project.name} (${path.relative(baseDir, projectPath)})`
          );
          console.log(`    Root: ${project.rootPosition}`);
          console.log(`    Created: ${project.createdAt.toLocaleDateString()}`);
        } catch (error) {
          console.log(`  - ${path.basename(projectPath)} (invalid project)`);
        }
      }

      return { success: true, data: projectPaths };
    } catch (error) {
      const message = `Failed to list projects: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Delete a project
   */
  public async delete(
    projectName: string,
    options: DeleteProjectOptions
  ): Promise<CommandResult> {
    try {
      const projectPath = path.join('./_data/projects', projectName);

      if (!options.force) {
        console.log(
          `Warning: This will permanently delete the project at: ${projectPath}`
        );
        console.log('Use --force flag to confirm deletion.');
        return {
          success: false,
          message: 'Deletion cancelled - use --force to confirm',
        };
      }

      await this.dependencies.projectManager.delete(projectPath);

      console.log(`✓ Project deleted: ${projectName}`);
      return { success: true };
    } catch (error) {
      const message = `Failed to delete project: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }

  /**
   * Get project by name or use current directory
   */
  private async getProject(projectName?: string): Promise<ChessProject> {
    const projectPath = projectName
      ? path.join('./_data/projects', projectName)
      : process.cwd();
    return await this.dependencies.projectManager.load(projectPath);
  }

  /**
   * Validate FEN string format
   */
  private isValidFen(fen: string): boolean {
    // Basic FEN validation - in a real implementation you'd use chess.js or similar
    const fenParts = fen.split(' ');
    return fenParts.length === 6 && fenParts[0].includes('/');
  }

  /**
   * Load project graph from file
   */
  private async loadProjectGraph(project: ChessProject): Promise<ChessGraph> {
    const graphPath = path.join(project.projectPath, 'graph.json');
    try {
      return loadGraph(graphPath);
    } catch (error) {
      // If graph doesn't exist, create a new one
      return new ChessGraph();
    }
  }

  /**
   * Save project graph to file
   */
  private async saveProjectGraph(
    project: ChessProject,
    graph: ChessGraph
  ): Promise<void> {
    saveGraph(graph, 'graph.json', project.projectPath);
  }
}
