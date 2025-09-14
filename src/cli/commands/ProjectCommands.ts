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
import { getProjectDirectory } from '../utils';
import { Chess } from 'chess.ts';
import { printGraph } from '../../core/utils/graph';

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
      const projectPath = path.join(getProjectDirectory(), projectName);

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
      const project = await this.getProject(projectName);

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

      const project = await this.getProject(projectName);
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
    toFen?: string, // Now optional
    primary?: boolean
  ): Promise<CommandResult> {
    try {
      console.log(`Adding move to project: ${projectName}`);

      if (!this.isValidFen(fromFen)) {
        throw new Error('Invalid fromFen position provided');
      }

      // Calculate toFen if not provided
      let calculatedToFen: string;
      if (toFen) {
        // Validate provided toFen
        if (!this.isValidFen(toFen)) {
          throw new Error('Invalid toFen position provided');
        }
        calculatedToFen = toFen;
      } else {
        // Calculate toFen using chess.ts
        const chess = new Chess(fromFen);

        // Validate and make the move
        const moveResult = chess.move(move);
        if (!moveResult) {
          throw new Error(`Invalid move '${move}' for position '${fromFen}'`);
        }

        calculatedToFen = chess.fen();
        console.log(`✓ Calculated resulting position: ${calculatedToFen}`);
      }

      const project = await this.getProject(projectName);
      const graph = await this.loadProjectGraph(project);

      // Create Move object with correct type
      const moveObj: Move = {
        move: move,
        toFen: calculatedToFen as FenString,
      };

      // Add move to graph
      graph.addMove(fromFen as FenString, moveObj, primary || false);

      // Save graph
      await this.saveProjectGraph(project, graph);

      console.log(`✓ Move added: ${fromFen} --${move}--> ${calculatedToFen}`);
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

      const projects = await this.dependencies.projectManager.list(baseDir);

      if (projects.length === 0) {
        console.log('No projects found.');
        return { success: true, data: [] };
      }

      console.log(`\nFound ${projects.length} project(s):`);
      for (const projectName of projects) {
        try {
          const project =
            await this.dependencies.projectManager.load(projectName);
          console.log(
            `  - ${project.name} (${path.relative(baseDir, project.projectPath)})`
          );
          console.log(`    Root: ${project.rootPosition}`);
          console.log(`    Created: ${project.createdAt.toLocaleDateString()}`);
        } catch (error) {
          console.log(`  - ${projectName} (invalid project)`);
        }
      }

      return { success: true, data: projects };
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
      const projectPath = path.join(getProjectDirectory(), projectName);

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
      ? path.join(getProjectDirectory(), projectName)
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

  /**
   * Print the project graph with board and compact tree
   */
  public async printGraph(
    projectName: string,
    maxDepth?: number,
    verbose?: boolean,
    startPosition?: string // Add optional FEN parameter
  ): Promise<CommandResult> {
    try {
      const project = await this.getProject(projectName);

      // Load project graph
      const graph = await this.loadProjectGraph(project);

      // Check if graph has any content
      if (!graph.rootPosition && Object.keys(graph.nodes).length === 0) {
        console.log('📊 Empty graph (no positions or moves)');
        return { success: true };
      }

      console.log(`\n📁 Project: ${projectName}`);

      if (startPosition) {
        console.log(`🎯 Start position: ${startPosition}`);
      }

      if (maxDepth !== undefined) {
        console.log(`🔍 Max depth: ${maxDepth}`);
      }

      // Print the graph using the same function as scripts/print-graph.ts
      // Pass the startPosition parameter to focus on specific part of graph
      printGraph(graph, maxDepth || 10, verbose || false, startPosition);

      return { success: true };
    } catch (error) {
      const message = `Failed to print graph: ${error instanceof Error ? error.message : error}`;
      console.error(message);
      return { success: false, error: error as Error, message };
    }
  }
}
