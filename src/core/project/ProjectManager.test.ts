import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectManager } from './ProjectManager';
import { CreateProjectConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

// Use process PID and timestamp for better isolation
// Use persistent base directory for all ProjectManager tests
const TEST_BASE_DIR = './tmp/test-projects';

describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  let testDir: string;

  beforeEach(() => {
    // Create unique test directory for each test
    testDir = path.join(
      TEST_BASE_DIR,
      `${Date.now()}-${process.pid}-${Math.random().toString(36).substring(2)}`
    );

    // Ensure the test base directory exists
    if (!fs.existsSync(TEST_BASE_DIR)) {
      fs.mkdirSync(TEST_BASE_DIR, { recursive: true });
    }

    // Ensure the specific test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    projectManager = new ProjectManager(testDir);
  });

  afterEach(async () => {
    // Only clean up this specific test's directory, never the base
    await cleanupTestDirectory(testDir);
  });

  // Updated cleanup function - only removes specific test directory
  async function cleanupTestDirectory(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) return;

    // NEVER remove the base directory, only individual test directories
    if (dir === TEST_BASE_DIR) {
      console.warn(
        'Attempted to remove base test directory - skipping for safety'
      );
      return;
    }

    let retries = 0;
    const maxRetries = 5;

    while (retries < maxRetries) {
      try {
        // Force close any remaining database connections
        const dbFiles = findDatabaseFiles(dir);
        for (const dbFile of dbFiles) {
          try {
            const tempPath = dbFile + '.cleanup';
            if (fs.existsSync(dbFile)) {
              fs.renameSync(dbFile, tempPath);
              fs.unlinkSync(tempPath);
            }
          } catch (dbError) {
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Remove the entire test directory (but never the base)
        if (fs.existsSync(dir)) {
          fs.rmSync(dir, { recursive: true, force: true });
        }

        return; // Success
      } catch (error) {
        retries++;
        if (retries >= maxRetries) {
          console.warn(
            `Failed to cleanup test directory after ${maxRetries} attempts:`,
            error
          );
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 500 * retries));
      }
    }
  }

  function findDatabaseFiles(dir: string): string[] {
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

  describe('create', () => {
    it('should create a new project with default configuration', async () => {
      const projectPath = path.join(testDir, 'test-project');

      const config: CreateProjectConfig = {
        name: 'test-project',
        projectPath: projectPath,
      };

      const project = await projectManager.create(config);

      expect(project.name).toBe('test-project');
      expect(project.rootPosition).toBe(
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      );
      expect(fs.existsSync(project.projectPath)).toBe(true);
      expect(fs.existsSync(project.graphPath)).toBe(true);
      expect(fs.existsSync(project.databasePath)).toBe(true);
    });

    it('should throw error if project already exists', async () => {
      const projectPath = path.join(testDir, 'duplicate-project');

      // First, create the project directory and required files
      fs.mkdirSync(projectPath, { recursive: true });

      // Create the required files to make it a valid project
      const projectJsonPath = path.join(projectPath, 'project.json');
      const graphJsonPath = path.join(projectPath, 'graph.json');
      const analysisDbPath = path.join(projectPath, 'analysis.db');

      fs.writeFileSync(
        projectJsonPath,
        JSON.stringify({
          id: 'test-id',
          name: 'duplicate-project',
          rootPosition:
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          config: {},
        })
      );

      fs.writeFileSync(
        graphJsonPath,
        JSON.stringify({
          rootPosition:
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          positions: {},
          moves: {},
        })
      );
      fs.writeFileSync(analysisDbPath, ''); // Create empty file

      const config: CreateProjectConfig = {
        name: 'duplicate-project',
        projectPath: projectPath,
      };

      await expect(projectManager.create(config)).rejects.toThrow(
        `Project already exists at: ${projectPath}`
      );
    });

    it('should create project with custom root position', async () => {
      const customFen =
        'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
      const config: CreateProjectConfig = {
        name: 'custom-project',
        projectPath: path.join(testDir, 'custom-project'),
        rootPosition: customFen,
      };

      const project = await projectManager.create(config);
      expect(project.rootPosition).toBe(customFen);
    });

    it('should throw error if project already exists', async () => {
      const config: CreateProjectConfig = {
        name: 'duplicate-project',
        projectPath: path.join(testDir, 'duplicate-project'),
      };

      await projectManager.create(config);
      await expect(projectManager.create(config)).rejects.toThrow(
        'Project already exists'
      );
    });
  });

  describe('load', () => {
    it('should load existing project', async () => {
      const config: CreateProjectConfig = {
        name: 'load-test',
        projectPath: path.join(testDir, 'load-test'),
      };

      const originalProject = await projectManager.create(config);
      const loadedProject = await projectManager.load(
        originalProject.projectPath
      );

      expect(loadedProject.id).toBe(originalProject.id);
      expect(loadedProject.name).toBe(originalProject.name);
      expect(loadedProject.rootPosition).toBe(originalProject.rootPosition);
    });

    it('should throw error for non-existent project', async () => {
      const nonExistentPath = path.join(testDir, 'non-existent');
      await expect(projectManager.load(nonExistentPath)).rejects.toThrow(
        'Invalid project directory:'
      );
    });

    it('should list all projects in directory', async () => {
      await projectManager.create({
        name: 'project1',
        projectPath: path.join(testDir, 'project1'),
      });
      await projectManager.create({
        name: 'project2',
        projectPath: path.join(testDir, 'project2'),
      });

      const projects = await projectManager.list(testDir);
      expect(projects).toHaveLength(2);
      expect(projects).toContain(path.resolve(path.join(testDir, 'project1')));
      expect(projects).toContain(path.resolve(path.join(testDir, 'project2')));
    });
  });

  describe('isValidProject', () => {
    it('should return true for valid project', async () => {
      const config: CreateProjectConfig = {
        name: 'valid-project',
        projectPath: path.join(testDir, 'valid-project'),
      };

      const project = await projectManager.create(config);
      const isValid = await projectManager.isValidProject(project.projectPath);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid project', async () => {
      const invalidPath = path.join(testDir, 'invalid');
      fs.mkdirSync(invalidPath, { recursive: true });

      const isValid = await projectManager.isValidProject(invalidPath);
      expect(isValid).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all projects in directory', async () => {
      await projectManager.create({
        name: 'project1',
        projectPath: path.join(testDir, 'project1'),
      });
      await projectManager.create({
        name: 'project2',
        projectPath: path.join(testDir, 'project2'),
      });

      const projects = await projectManager.list(testDir);
      expect(projects).toHaveLength(2);
      expect(projects).toContain(path.resolve(path.join(testDir, 'project1')));
      expect(projects).toContain(path.resolve(path.join(testDir, 'project2')));
    });
  });

  describe('delete', () => {
    it('should delete existing project', async () => {
      const config: CreateProjectConfig = {
        name: 'delete-test',
        projectPath: path.join(testDir, 'delete-test'),
      };

      const project = await projectManager.create(config);
      expect(fs.existsSync(project.projectPath)).toBe(true);

      // Ensure database is fully written and closed
      await new Promise(resolve => setTimeout(resolve, 200));

      await projectManager.delete(project.projectPath);

      // Verify deletion with retries for file system consistency
      let deleted = false;
      for (let i = 0; i < 10; i++) {
        if (!fs.existsSync(project.projectPath)) {
          deleted = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      expect(deleted).toBe(true);
    });
  });
});
