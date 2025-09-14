import * as fs from 'fs';
import * as path from 'path';
import { ChessGraph } from '../graph/ChessGraph';
import { AnalysisStoreService } from '../analysis-store/AnalysisStoreService';
import { loadGraph, saveGraph } from '../utils/graph';
import { FenString } from '../types';
import {
  ChessProject,
  ProjectManager as IProjectManager,
  CreateProjectConfig,
  ProjectConfig,
} from './types';
import sqlite3 from 'sqlite3';
import { createAnalysisStoreService } from '../analysis-store';
import { DEFAULT_STARTING_POSITION } from '../constants';

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
    const projectId = this.generateProjectId(config.name);
    const rootPosition = config.rootPosition || DEFAULT_STARTING_POSITION;

    // Check if project already exists
    if (await this.isValidProject(projectPath)) {
      throw new Error(
        `Project already exists at: ${path.relative(process.cwd(), projectPath)}`
      );
    }

    // Create project directory with enhanced error handling
    try {
      await fs.promises.mkdir(projectPath, { recursive: true });

      // Verify directory was created successfully
      let retries = 3;
      while (retries > 0 && !fs.existsSync(projectPath)) {
        await new Promise(resolve => setTimeout(resolve, 100));
        retries--;
      }

      if (!fs.existsSync(projectPath)) {
        throw new Error(`Failed to create project directory: ${projectPath}`);
      }
    } catch (error: any) {
      throw new Error(`Failed to create project directory: ${error.message}`);
    }

    // Wait for filesystem to stabilize
    await new Promise(resolve => setTimeout(resolve, 200));

    const now = new Date();

    const project: ChessProject = {
      id: projectId,
      name: config.name,
      projectPath,
      rootPosition,
      graphPath: path.join(projectPath, 'graph.json'),
      databasePath: path.join(projectPath, 'analysis.db'),
      createdAt: now,
      updatedAt: now,
      config: {
        defaultEngine: config.config?.defaultEngine,
        analysisDepth: config.config?.analysisDepth,
        multiPv: config.config?.multiPv,
        ...config.config,
      },
    };

    // Save project metadata
    await this.save(project);

    // Create and save initial chess graph
    const graph = new ChessGraph(rootPosition);
    await this.saveGraph(project, graph);

    // Initialize analysis database with proper synchronization
    try {
      // Ensure the database file doesn't exist from a previous failed attempt
      if (fs.existsSync(project.databasePath)) {
        fs.unlinkSync(project.databasePath);
      }

      // Create database with a timeout and proper error handling
      const db = new sqlite3.Database(
        project.databasePath,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
      );

      // Wait for database to be ready before initializing schema
      await new Promise<void>((resolve, reject) => {
        db.serialize(() => {
          // Enable WAL mode for better concurrency
          db.run('PRAGMA journal_mode=WAL', err => {
            if (err) {
              reject(new Error(`Failed to set WAL mode: ${err.message}`));
              return;
            }

            // Set a reasonable timeout for database operations
            db.run('PRAGMA busy_timeout=5000', err => {
              if (err) {
                reject(new Error(`Failed to set busy timeout: ${err.message}`));
                return;
              }
              resolve();
            });
          });
        });
      });

      const analysisStore = await createAnalysisStoreService(db);
      await this.closeAnalysisStore(analysisStore);

      // Wait for database file to be fully written to disk
      await new Promise(resolve => setTimeout(resolve, 500)); // Increased from 300ms
    } catch (error: any) {
      throw new Error(`Failed to initialize database: ${error.message}`);
    }

    // Enhanced verification with more retries for concurrent test scenarios
    let verificationRetries = 10; // Increased from 5
    while (verificationRetries > 0) {
      if (
        fs.existsSync(project.projectPath) &&
        fs.existsSync(project.graphPath) &&
        fs.existsSync(project.databasePath)
      ) {
        break; // All files exist, verification passed
      }

      // Wait longer between retries for concurrent scenarios
      await new Promise(resolve => setTimeout(resolve, 200)); // Increased from 100ms
      verificationRetries--;
    }

    // Final check after retries
    if (
      !fs.existsSync(project.projectPath) ||
      !fs.existsSync(project.graphPath) ||
      !fs.existsSync(project.databasePath)
    ) {
      // Provide more detailed error information
      const missingFiles = [];
      if (!fs.existsSync(project.projectPath))
        missingFiles.push('project directory');
      if (!fs.existsSync(project.graphPath)) missingFiles.push('graph.json');
      if (!fs.existsSync(project.databasePath))
        missingFiles.push('analysis.db');

      throw new Error(
        `Project creation incomplete - missing: ${missingFiles.join(', ')}`
      );
    }

    return project;
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

    // Save project metadata with enhanced error handling
    const metadataPath = path.join(project.projectPath, PROJECT_METADATA_FILE);
    try {
      // Ensure project directory exists before writing
      await fs.promises.mkdir(project.projectPath, { recursive: true });

      await fs.promises.writeFile(
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
    const projects: string[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        projects.push(entry.name);
        // const projectPath = path.join(searchDir, entry.name);
        // if (await this.isValidProject(projectPath)) {
        //   projectPaths.push(projectPath);
        // }
      }
    }

    return projects.sort();
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
    await saveGraph(graph, 'graph.json', project.projectPath);

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
    const dbPath = project.databasePath;

    // Ensure database directory exists
    const dbDir = path.dirname(dbPath);
    await fs.promises.mkdir(dbDir, { recursive: true });

    // Create database connection
    const db = new sqlite3.Database(dbPath);

    // Use factory to create fully initialized service
    const analysisStore = await createAnalysisStoreService(db);

    return analysisStore;
  }

  /**
   * Close analysis store service (cleanup database connections)
   */
  async closeAnalysisStore(analysisStore: AnalysisStoreService): Promise<void> {
    await analysisStore.close();
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
