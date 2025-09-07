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
import { createAnalysisRepo } from '../analysis-store';

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

    // Ensure project directory exists with enhanced error handling
    try {
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      // Enhanced verification with retries
      let retries = 0;
      const maxRetries = 5;
      while (!fs.existsSync(projectPath) && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries++;
      }

      if (!fs.existsSync(projectPath)) {
        throw new Error(
          `Failed to create project directory after ${maxRetries} retries: ${projectPath}`
        );
      }

      // Extended wait for file system stabilization
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      throw new Error(`Directory creation failed: ${error}`);
    }

    // Generate project ID and metadata
    const projectId = this.generateProjectId(config.name);
    const rootPosition = config.rootPosition || DEFAULT_STARTING_POSITION;
    const now = new Date();

    const metadata: ProjectMetadata = {
      id: projectId,
      name: config.name,
      rootPosition,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      config: config.config || {},
    };

    // Save project metadata with enhanced error handling
    const metadataPath = path.join(projectPath, PROJECT_METADATA_FILE);
    try {
      // Ensure parent directory exists
      const parentDir = path.dirname(metadataPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8'
      );

      // Verify file was written
      if (!fs.existsSync(metadataPath)) {
        throw new Error(`Metadata file was not created: ${metadataPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to write project metadata: ${error}`);
    }

    // Create and save chess graph with verification
    const graph = new ChessGraph(rootPosition);
    const graphPath = path.join(projectPath, 'graph.json');
    try {
      saveGraph(graph, 'graph.json', projectPath);

      // Verify graph file was created
      let graphRetries = 0;
      while (!fs.existsSync(graphPath) && graphRetries < 5) {
        await new Promise(resolve => setTimeout(resolve, 100));
        graphRetries++;
      }

      if (!fs.existsSync(graphPath)) {
        throw new Error(`Graph file was not created: ${graphPath}`);
      }
    } catch (error) {
      throw new Error(`Failed to save chess graph: ${error}`);
    }

    // Create analysis database with proper schema initialization
    const databasePath = path.join(projectPath, 'analysis.db');
    // In ProjectManager.create() around line 140
    try {
      // Create database and initialize schema properly
      const db = new sqlite3.Database(databasePath);

      // Replace both instances:
      const repo = await createAnalysisRepo(db);

      // Wait for database operations to complete using serialize
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          // Verify the schema was created successfully
          db.run('SELECT 1', err => {
            if (err) {
              reject(new Error(`Database verification error: ${err.message}`));
            } else {
              resolve();
            }
          });
        });
      });

      // Now safely close the database
      await new Promise<void>((resolve, reject) => {
        db.close(err => {
          if (err) {
            reject(new Error(`Database close error: ${err.message}`));
          } else {
            resolve();
          }
        });
      });

      // Extended wait for database file to be fully written
      await new Promise(resolve => setTimeout(resolve, 300));

      // Verify database file exists
      if (!fs.existsSync(databasePath)) {
        throw new Error(`Database file was not created: ${databasePath}`);
      }
    } catch (error) {
      throw new Error(`Failed to create analysis database: ${error}`);
    }

    // Final verification with extended wait
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify all required files exist
    const requiredFiles = [projectPath, graphPath, databasePath, metadataPath];
    const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

    if (missingFiles.length > 0) {
      throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
    }

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
   * Delete a project with enhanced cleanup
   */
  async delete(projectPath: string): Promise<void> {
    const absolutePath = path.resolve(projectPath);

    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Project directory does not exist: ${absolutePath}`);
    }

    // Enhanced database cleanup
    const dbPath = path.join(absolutePath, 'analysis.db');
    if (fs.existsSync(dbPath)) {
      try {
        // Try to rename first to detect file locks
        const tempPath = `${dbPath}.deleting`;
        fs.renameSync(dbPath, tempPath);

        // Wait for any pending operations
        await new Promise(resolve => setTimeout(resolve, 300));

        // Delete the renamed file
        fs.unlinkSync(tempPath);
      } catch (error) {
        console.warn('Database cleanup error:', error);
        // Try direct deletion as fallback
        try {
          fs.unlinkSync(dbPath);
        } catch (fallbackError) {
          console.warn('Fallback database deletion failed:', fallbackError);
        }
      }
    }

    // Wait before directory removal
    await new Promise(resolve => setTimeout(resolve, 200));

    // Enhanced directory removal with retries
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        fs.rmSync(absolutePath, { recursive: true, force: true });

        // Verify deletion
        if (!fs.existsSync(absolutePath)) {
          return; // Success
        }

        // If still exists, wait and retry
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        if (attempt === 4) {
          throw new Error(
            `Failed to delete project directory after 5 attempts: ${error}`
          );
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
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

      // Check for required files including metadata
      const graphPath = path.join(resolvedPath, 'graph.json');
      const databasePath = path.join(resolvedPath, 'analysis.db');
      const metadataPath = path.join(resolvedPath, PROJECT_METADATA_FILE);

      return (
        fs.existsSync(graphPath) &&
        fs.existsSync(databasePath) &&
        fs.existsSync(metadataPath)
      );
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
