import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectManager } from './ProjectManager';
import { CreateProjectConfig, ChessProject } from './types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_BASE_DIR = './tmp/test-projects';

describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  let testId: string;
  let testDir: string;

  beforeEach(() => {
    // Generate unique test ID
    testId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    testDir = path.join(TEST_BASE_DIR, testId);

    projectManager = new ProjectManager();

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Add delay for database cleanup
    await new Promise(resolve => setTimeout(resolve, 100));

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('create', () => {
    it('should create a new project with default configuration', async () => {
      const testDir = path.join(TEST_BASE_DIR, testId);
      const config: CreateProjectConfig = {
        name: 'test-project',
        projectPath: path.join(testDir, 'test-project'),
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

    it('should create project with custom root position', async () => {
      const customFen =
        'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
      const config: CreateProjectConfig = {
        name: 'custom-project',
        projectPath: path.join(TEST_BASE_DIR, 'custom-project'),
        rootPosition: customFen,
      };

      const project = await projectManager.create(config);
      expect(project.rootPosition).toBe(customFen);
    });

    it('should throw error if project already exists', async () => {
      const config: CreateProjectConfig = {
        name: 'duplicate-project',
        projectPath: path.join(TEST_BASE_DIR, 'duplicate-project'),
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
        projectPath: path.join(TEST_BASE_DIR, 'load-test'),
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
      const nonExistentPath = path.join(TEST_BASE_DIR, 'non-existent');
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
        projectPath: path.join(TEST_BASE_DIR, 'valid-project'),
      };

      const project = await projectManager.create(config);
      const isValid = await projectManager.isValidProject(project.projectPath);
      expect(isValid).toBe(true);
    });

    it('should return false for invalid project', async () => {
      const invalidPath = path.join(TEST_BASE_DIR, 'invalid');
      fs.mkdirSync(invalidPath, { recursive: true });

      const isValid = await projectManager.isValidProject(invalidPath);
      expect(isValid).toBe(false);
    });
  });

  describe('list', () => {
    it('should list all projects in directory', async () => {
      const testDir = path.join(TEST_BASE_DIR, testId);

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
        projectPath: path.join(TEST_BASE_DIR, 'delete-test'),
      };

      const project = await projectManager.create(config);
      expect(fs.existsSync(project.projectPath)).toBe(true);

      // Ensure any database connections are properly closed
      // by waiting a bit for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      await projectManager.delete(project.projectPath);
      expect(fs.existsSync(project.projectPath)).toBe(false);
    });
  });
});
