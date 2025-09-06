import * as fs from 'fs';
import * as path from 'path';
import { ChessGraph } from '../graph/ChessGraph';
import { AnalysisStoreService } from '../analysis-store/AnalysisStoreService';
import { AnalysisRepo } from '../analysis-store/AnalysisRepo';
import { loadGraph, saveGraph } from '../utils/graph';
import { FenString } from '../types';
import {
  ChessProject,
  ProjectManager as IProjectManager,
  CreateProjectConfig,
  ProjectConfig,
} from './types';
import sqlite3 from 'sqlite3';

/**
 * Default starting position FEN
 */
const DEFAULT_STARTING_POSITION =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Project metadata file name
 */
const PROJECT_METADATA_FILE = 'project.json';

/**
 * Project metadata structure
 */
interface ProjectMetadata {
  id: string;
  name: string;
  rootPosition: FenString;
  createdAt: string;
  updatedAt: string;
  config: ProjectConfig;
}

/**
 * Implementation of ProjectManager for managing chess project directories
 */
export class ProjectManager implements IProjectManager {
  private readonly defaultBaseDir: string;

  constructor(baseDir: string = './tmp/pv-projects') {
    this.defaultBaseDir = path.resolve(baseDir);
  }

  /**
   * Create a new chess project
   */
  async create(config: CreateProjectConfig): Promise<ChessProject> {
    const projectPath = path.resolve(config.projectPath);

    // Check if project already exists
    if (await this.isValidProject(projectPath)) {
      throw new Error(`Project already exists at: ${projectPath}`);
    }

    // Ensure project directory exists
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    // Generate project ID
    const projectId = this.generateProjectId(config.name);
    const rootPosition = config.rootPosition || DEFAULT_STARTING_POSITION;
    const now = new Date();

    // Create project metadata
    const metadata: ProjectMetadata = {
      id: projectId,
      name: config.name,
      rootPosition,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      config: config.config || {},
    };

    // Save project metadata
    const metadataPath = path.join(projectPath, PROJECT_METADATA_FILE);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

    // Create initial chess graph
    const graph = new ChessGraph(rootPosition);
    const graphPath = path.join(projectPath, 'graph.json');
    saveGraph(graph, 'graph.json', projectPath);

    // Create analysis database
    const databasePath = path.join(projectPath, 'analysis.db');

    // Ensure database directory exists
    const dbDir = path.dirname(databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create SQLite database instance and repository
    const db = new sqlite3.Database(databasePath);
    const repo = new AnalysisRepo(db);
    const analysisStore = new AnalysisStoreService(repo);

    // Close database connection after initialization
    db.close();

    // Return project instance
    return {
      id: projectId,
      name: config.name,
      projectPath,
      rootPosition,
      graphPath,
      databasePath,
      createdAt: now,
      updatedAt: now,
      config: metadata.config,
    };
  }

  /**
   * Load an existing project
   */
  async load(projectPath: string): Promise<ChessProject> {
    const resolvedPath = path.resolve(projectPath);

    if (!(await this.isValidProject(resolvedPath))) {
      throw new Error(`Invalid project directory: ${resolvedPath}`);
    }

    // Load project metadata
    const metadataPath = path.join(resolvedPath, PROJECT_METADATA_FILE);
    let metadata: ProjectMetadata;

    if (fs.existsSync(metadataPath)) {
      // Load from metadata file
      const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
      metadata = JSON.parse(metadataContent);
    } else {
      // Fallback: infer from existing files (for backward compatibility)
      metadata = await this.inferProjectMetadata(resolvedPath);
    }

    return {
      id: metadata.id,
      name: metadata.name,
      projectPath: resolvedPath,
      rootPosition: metadata.rootPosition,
      graphPath: path.join(resolvedPath, 'graph.json'),
      databasePath: path.join(resolvedPath, 'analysis.db'),
      createdAt: new Date(metadata.createdAt),
      updatedAt: new Date(metadata.updatedAt),
      config: metadata.config,
    };
  }

  /**
   * Save project state
   */
  async save(project: ChessProject): Promise<void> {
    const metadata: ProjectMetadata = {
      id: project.id,
      name: project.name,
      rootPosition: project.rootPosition,
      createdAt: project.createdAt.toISOString(),
      updatedAt: new Date().toISOString(),
      config: project.config,
    };

    const metadataPath = path.join(project.projectPath, PROJECT_METADATA_FILE);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  /**
   * List all projects in a directory
   */
  async list(baseDir?: string): Promise<string[]> {
    const searchDir = baseDir ? path.resolve(baseDir) : this.defaultBaseDir;

    if (!fs.existsSync(searchDir)) {
      return [];
    }

    const entries = fs.readdirSync(searchDir, { withFileTypes: true });
    const projectPaths: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const projectPath = path.join(searchDir, entry.name);
        if (await this.isValidProject(projectPath)) {
          projectPaths.push(projectPath);
        }
      }
    }

    return projectPaths.sort();
  }

  /**
   * Delete a project
   */
  async delete(projectPath: string): Promise<void> {
    const resolvedPath = path.resolve(projectPath);

    if (!(await this.isValidProject(resolvedPath))) {
      throw new Error(`Invalid project directory: ${resolvedPath}`);
    }

    // Remove the entire project directory
    fs.rmSync(resolvedPath, { recursive: true, force: true });
  }

  /**
   * Check if path contains a valid project
   */
  async isValidProject(projectPath: string): Promise<boolean> {
    try {
      const resolvedPath = path.resolve(projectPath);

      // Check if directory exists
      if (
        !fs.existsSync(resolvedPath) ||
        !fs.statSync(resolvedPath).isDirectory()
      ) {
        return false;
      }

      // Check for required files
      const graphPath = path.join(resolvedPath, 'graph.json');
      const databasePath = path.join(resolvedPath, 'analysis.db');

      return fs.existsSync(graphPath) && fs.existsSync(databasePath);
    } catch {
      return false;
    }
  }

  /**
   * Get project info without fully loading it
   */
  async getProjectInfo(projectPath: string): Promise<Partial<ChessProject>> {
    const resolvedPath = path.resolve(projectPath);

    if (!(await this.isValidProject(resolvedPath))) {
      throw new Error(`Invalid project directory: ${resolvedPath}`);
    }

    const metadataPath = path.join(resolvedPath, PROJECT_METADATA_FILE);

    if (fs.existsSync(metadataPath)) {
      const metadataContent = fs.readFileSync(metadataPath, 'utf-8');
      const metadata: ProjectMetadata = JSON.parse(metadataContent);

      return {
        id: metadata.id,
        name: metadata.name,
        projectPath: resolvedPath,
        rootPosition: metadata.rootPosition,
        createdAt: new Date(metadata.createdAt),
        updatedAt: new Date(metadata.updatedAt),
      };
    }

    // Fallback: infer basic info
    const projectName = path.basename(resolvedPath);
    return {
      name: projectName,
      projectPath: resolvedPath,
    };
  }

  /**
   * Load chess graph from project
   */
  async loadGraph(project: ChessProject): Promise<ChessGraph> {
    return loadGraph(project.graphPath);
  }

  /**
   * Save chess graph to project
   */
  async saveGraph(project: ChessProject, graph: ChessGraph): Promise<void> {
    saveGraph(graph, 'graph.json', project.projectPath);

    // Update project timestamp
    await this.save({
      ...project,
      updatedAt: new Date(),
    });
  }

  /**
   * Get analysis store service for project
   */
  async getAnalysisStore(project: ChessProject): Promise<AnalysisStoreService> {
    // Ensure database directory exists
    const dbDir = path.dirname(project.databasePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Create SQLite database instance
    const db = new sqlite3.Database(project.databasePath);

    // Create repository with database
    const repo = new AnalysisRepo(db);

    // Create and return service
    const analysisStore = new AnalysisStoreService(repo);
    return analysisStore;
  }

  /**
   * Close analysis store service (cleanup database connections)
   */
  async closeAnalysisStore(analysisStore: AnalysisStoreService): Promise<void> {
    // Get the underlying repository and close database connection
    const repo = analysisStore.getRepository() as AnalysisRepo;
    if (repo && typeof (repo as any).close === 'function') {
      await (repo as any).close();
    }
  }

  /**
   * Generate a unique project ID
   */
  private generateProjectId(name: string): string {
    const timestamp = Date.now();
    const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${sanitizedName}-${timestamp}`;
  }

  /**
   * Infer project metadata from existing files (backward compatibility)
   */
  private async inferProjectMetadata(
    projectPath: string
  ): Promise<ProjectMetadata> {
    const projectName = path.basename(projectPath);
    const graphPath = path.join(projectPath, 'graph.json');

    let rootPosition = DEFAULT_STARTING_POSITION;

    // Try to extract root position from graph
    if (fs.existsSync(graphPath)) {
      try {
        const graph = loadGraph(graphPath);
        if (graph.rootPosition) {
          rootPosition = graph.rootPosition;
        }
      } catch {
        // Ignore errors, use default
      }
    }

    // Get file stats for timestamps
    const stats = fs.statSync(projectPath);

    return {
      id: this.generateProjectId(projectName),
      name: projectName,
      rootPosition,
      createdAt: stats.birthtime.toISOString(),
      updatedAt: stats.mtime.toISOString(),
      config: {},
    };
  }
}
