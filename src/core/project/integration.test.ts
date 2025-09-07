import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjectManager } from './ProjectManager';
import { PVExplorationStrategy } from './strategies/PVExplorationStrategy';
import { AnalysisTaskExecutor } from './services/AnalysisTaskExecutor';
import { AnalysisChecker } from './services/AnalysisChecker';
import { StatePersistenceService } from './persistence/StatePersistenceService';
import { ChessGraph } from '../graph/ChessGraph';
import { AnalysisRepo } from '../analysis-store/AnalysisRepo';
import sqlite3 from 'sqlite3';
import * as fs from 'fs';
import * as path from 'path';

const TEST_INTEGRATION_BASE_DIR = './tmp/test-integration';

describe('Project Architecture Integration', () => {
  let projectManager: ProjectManager;
  let taskExecutor: AnalysisTaskExecutor;
  let analysisChecker: AnalysisChecker;
  let persistenceService: StatePersistenceService;
  let db: sqlite3.Database;
  let createdProjects: any[] = [];
  let createdAnalysisStores: any[] = [];
  let testId: string;
  let TEST_INTEGRATION_DIR: string;

  beforeEach(async () => {
    // Generate unique test ID to avoid conflicts between tests
    testId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    TEST_INTEGRATION_DIR = path.join(TEST_INTEGRATION_BASE_DIR, testId);

    // Clean up test directory
    if (fs.existsSync(TEST_INTEGRATION_DIR)) {
      fs.rmSync(TEST_INTEGRATION_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_INTEGRATION_DIR, { recursive: true });

    projectManager = new ProjectManager();

    const graph = new ChessGraph();

    // Use unique database path with test ID
    const testDbPath = path.join(
      TEST_INTEGRATION_DIR,
      `test-analysis-${testId}.db`
    );
    db = new sqlite3.Database(testDbPath);
    const analysisRepo = new AnalysisRepo(db);

    analysisChecker = new AnalysisChecker(analysisRepo);

    const dependencies = {
      graph,
      analysisRepo,
      strategyRegistry: {
        register: () => {},
        get: () => undefined,
        list: () => [],
        findApplicable: () => [],
      },
      projectManager,
    };

    taskExecutor = new AnalysisTaskExecutor(dependencies);

    persistenceService = new StatePersistenceService({
      stateDirectory: path.join(TEST_INTEGRATION_DIR, 'state'),
      autoSaveIntervalMs: 5000,
      maxSnapshots: 5,
      compress: false,
    });
    createdProjects = [];
  });

  afterEach(async () => {
    // Close tracked analysis stores first
    for (const store of createdAnalysisStores) {
      try {
        await projectManager.closeAnalysisStore(store);
      } catch (error) {
        console.warn('Error closing tracked analysis store:', error);
      }
    }

    // Clear analysis store tracking
    createdAnalysisStores.length = 0;

    // Close analysis stores for existing projects only
    for (const project of createdProjects) {
      try {
        // Check if project still exists before trying to access its analysis store
        if (fs.existsSync(project.projectPath)) {
          const analysisStore = await projectManager.getAnalysisStore(project);
          await projectManager.closeAnalysisStore(analysisStore);
        }
      } catch (error) {
        console.warn('Error closing project analysis store:', error);
      }
    }

    // Clear the tracking array
    createdProjects.length = 0;

    // Close main database connection if it exists
    if (db) {
      try {
        // Properly await the database close operation
        await new Promise<void>((resolve, reject) => {
          db.close(err => {
            if (err) {
              console.warn('Error closing database:', err);
              // Don't reject on close errors, just resolve
              resolve();
            } else {
              resolve();
            }
          });
        });
      } catch (error) {
        console.warn('Error during database cleanup:', error);
      }
    }

    // Add delay to ensure database connections are fully closed
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clean up test directory
    try {
      if (fs.existsSync(TEST_INTEGRATION_DIR)) {
        fs.rmSync(TEST_INTEGRATION_DIR, { recursive: true, force: true });
      }
    } catch (error) {
      console.warn('Error cleaning up test directory:', error);
    }
  }, 15000);

  // In the test where analysis stores are created, add tracking:
  it('should create project and execute analysis end-to-end', async () => {
    // Create project
    const project = await projectManager.create({
      name: 'integration-test',
      projectPath: path.join(TEST_INTEGRATION_DIR, 'integration-test'),
      rootPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    });

    createdProjects.push(project); // Track for cleanup

    expect(project).toBeDefined();
    expect(fs.existsSync(project.projectPath)).toBe(true);
    expect(fs.existsSync(project.graphPath)).toBe(true);
    expect(fs.existsSync(project.databasePath)).toBe(true);

    // Load project
    const loadedProject = await projectManager.load(project.projectPath);
    expect(loadedProject.id).toBe(project.id);

    // Check analysis status
    const checkResult = await analysisChecker.checkPosition(
      project.rootPosition // Removed second parameter (depth)
    );
    expect(checkResult.hasAnalysis).toBe(false); // Changed from needsAnalysis

    // Save and restore state
    const testState = {
      positionsToAnalyze: [],
      analyzedPositions: new Set<string>(),
      currentDepth: 0,
      maxDepth: 5,
      positionDepths: new Map<string, number>(),
      stats: {
        totalAnalyzed: 0,
        totalDiscovered: 1,
        startTime: new Date(),
        lastUpdate: new Date(),
        avgTimePerPosition: 0,
      },
    };

    await persistenceService.saveState(
      'integration-test',
      'pv-exploration',
      'test-project',
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      testState,
      { maxDepth: 5 }
    );

    const restored = await persistenceService.loadState('integration-test');

    expect(restored.success).toBe(true);
    expect(restored.state?.config?.maxDepth).toBe(5); // Fixed: config is at the top level, not nested under state
    expect(restored.state?.strategyName).toBe('pv-exploration');
    expect(restored.state?.projectName).toBe('test-project');
  });

  it('should handle project lifecycle operations', async () => {
    // Create multiple projects
    const project1 = await projectManager.create({
      name: 'project1',
      projectPath: path.join(TEST_INTEGRATION_DIR, 'project1'),
    });

    const project2 = await projectManager.create({
      name: 'project2',
      projectPath: path.join(TEST_INTEGRATION_DIR, 'project2'),
    });

    createdProjects.push(project1, project2); // Track for cleanup

    // List projects
    const projects = await projectManager.list(TEST_INTEGRATION_DIR);
    expect(projects).toHaveLength(2);

    // Validate projects
    const isValid1 = await projectManager.isValidProject(project1.projectPath);
    const isValid2 = await projectManager.isValidProject(project2.projectPath);
    expect(isValid1).toBe(true);
    expect(isValid2).toBe(true);

    // Delete project
    await projectManager.delete(project1.projectPath);
    const remainingProjects = await projectManager.list(TEST_INTEGRATION_DIR);
    expect(remainingProjects).toHaveLength(1);
  });
});
