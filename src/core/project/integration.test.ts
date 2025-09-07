import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { ProjectManager } from './ProjectManager';
import { AnalysisTaskExecutor } from './services/AnalysisTaskExecutor';
import { AnalysisChecker } from './services/AnalysisChecker';
import { StatePersistenceService } from './persistence/StatePersistenceService';
import { ChessGraph } from '../graph/ChessGraph';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { createAnalysisStoreService } from '../analysis-store';

const TEST_INTEGRATION_BASE_DIR = './tmp/test-integration';

// Add this import

describe('Project Architecture Integration', () => {
  let testId: string;
  let TEST_INTEGRATION_DIR: string;
  let projectManager: ProjectManager;
  let taskExecutor: AnalysisTaskExecutor;
  let analysisChecker: AnalysisChecker;
  let persistenceService: StatePersistenceService;
  let db: sqlite3.Database;
  let createdProjects: any[] = [];
  let createdAnalysisStores: any[] = [];

  beforeEach(async () => {
    // Generate unique test ID for isolation
    testId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    TEST_INTEGRATION_DIR = path.join(TEST_INTEGRATION_BASE_DIR, testId);

    // Ensure test directory exists with proper permissions BEFORE creating services
    if (!fs.existsSync(TEST_INTEGRATION_DIR)) {
      fs.mkdirSync(TEST_INTEGRATION_DIR, { recursive: true, mode: 0o755 });
    }

    // Initialize components
    projectManager = new ProjectManager();
    const graph = new ChessGraph();

    // Use unique database path with process isolation
    const testDbPath = path.join(
      TEST_INTEGRATION_DIR,
      `test-analysis-${testId}.db`
    );

    // Ensure the database file can be created with write permissions
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    db = new sqlite3.Database(
      testDbPath,
      sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
    );

    // Use factory function to create AnalysisStoreService directly
    const analysisStore = await createAnalysisStoreService(db);

    analysisChecker = new AnalysisChecker(analysisStore);

    const dependencies = {
      graph,
      analysisStore,
      strategyRegistry: {
        register: () => {},
        get: () => undefined,
        list: () => [],
        findApplicable: () => [],
      },
      projectManager,
    };

    taskExecutor = new AnalysisTaskExecutor(dependencies);

    // Create StatePersistenceService AFTER ensuring directory exists
    persistenceService = new StatePersistenceService({
      stateDirectory: TEST_INTEGRATION_DIR,
      autoSaveIntervalMs: 5000,
      maxSnapshots: 5,
      compress: false,
    });
  });

  afterEach(async () => {
    // Close database connections
    if (db) {
      await new Promise<void>(resolve => {
        db.close(err => {
          if (err) console.warn('Database close error:', err);
          resolve();
        });
      });
    }

    // Clean up created analysis stores
    for (const store of createdAnalysisStores) {
      if (store && typeof store.close === 'function') {
        await store
          .close()
          .catch((err: any) =>
            console.warn('Analysis store cleanup error:', err)
          );
      }
    }

    // Clean up this specific test's directory
    await cleanupIntegrationDirectory(TEST_INTEGRATION_DIR);

    // Reset arrays
    createdProjects.length = 0;
    createdAnalysisStores.length = 0;
  });

  afterAll(async () => {
    // Clean up the entire test-integration base directory
    if (fs.existsSync(TEST_INTEGRATION_BASE_DIR)) {
      try {
        const contents = fs.readdirSync(TEST_INTEGRATION_BASE_DIR);
        for (const item of contents) {
          const itemPath = path.join(TEST_INTEGRATION_BASE_DIR, item);
          try {
            fs.rmSync(itemPath, { recursive: true, force: true });
          } catch (error) {
            console.warn(
              `Failed to clean up integration test directory ${itemPath}:`,
              error
            );
          }
        }
      } catch (error) {
        console.warn(`Failed to read integration test base directory:`, error);
      }
    }
  });

  async function cleanupIntegrationDirectory(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) return;

    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      try {
        // Find and handle database files
        const dbFiles = findAllDatabaseFiles(dir);
        for (const dbFile of dbFiles) {
          try {
            if (fs.existsSync(dbFile)) {
              // Try to rename first to detect locks
              const tempPath = dbFile + '.cleanup';
              fs.renameSync(dbFile, tempPath);
              fs.unlinkSync(tempPath);
            }
          } catch (dbError) {
            // Database might be locked, wait and retry
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        // Only remove contents of the test directory, not the ./tmp parent
        if (fs.existsSync(dir)) {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const itemPath = path.join(dir, item);
            fs.rmSync(itemPath, { recursive: true, force: true });
          }
          // DON'T remove the directory itself - just leave it empty
          // This prevents ENOENT race conditions
        }

        // Verify cleanup success by checking if directory is empty
        if (fs.existsSync(dir)) {
          const remainingItems = fs.readdirSync(dir);
          if (remainingItems.length === 0) {
            return; // Success - directory exists but is empty
          }
        }

        return; // Success
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          console.warn(
            `Failed to cleanup integration directory after ${maxRetries} attempts:`,
            error
          );
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 150 * retries));
      }
    }
  }

  function findAllDatabaseFiles(dir: string): string[] {
    const dbFiles: string[] = [];

    if (!fs.existsSync(dir)) return dbFiles;

    try {
      const walk = (currentDir: string) => {
        const files = fs.readdirSync(currentDir);
        for (const file of files) {
          const filePath = path.join(currentDir, file);
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            walk(filePath);
          } else if (file.endsWith('.db')) {
            dbFiles.push(filePath);
          }
        }
      };

      walk(dir);
    } catch (error) {
      // Ignore errors during file discovery
    }

    return dbFiles;
  }

  it('should have basic integration test setup', () => {
    expect(projectManager).toBeDefined();
    expect(taskExecutor).toBeDefined();
    expect(analysisChecker).toBeDefined();
    expect(persistenceService).toBeDefined();
  });
});
