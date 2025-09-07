import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectCommands } from './ProjectCommands';
import { CLIDependencies } from '../types';

describe('ProjectCommands', () => {
  let projectCommands: ProjectCommands;
  let mockDependencies: CLIDependencies;

  beforeEach(() => {
    mockDependencies = {
      projectManager: {
        create: vi.fn(),
        load: vi.fn(),
        list: vi.fn(),
        delete: vi.fn(),
      } as any,
      strategyRegistry: {
        register: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
        findApplicable: vi.fn(),
      },
      taskExecutor: {} as any,
      analysisStore: {} as any,
      graph: {} as any,
    };

    projectCommands = new ProjectCommands(mockDependencies);
  });

  describe('create', () => {
    it('should create project with valid parameters', async () => {
      const mockProject = {
        id: 'test-id',
        name: 'test-project',
        projectPath: '/tmp/test-project',
        rootPosition:
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        graphPath: '/tmp/test-project/graph.json',
        databasePath: '/tmp/test-project/analysis.db',
        createdAt: new Date(),
        updatedAt: new Date(),
        config: {},
      };

      mockDependencies.projectManager.create = vi
        .fn()
        .mockResolvedValue(mockProject);

      const result = await projectCommands.create('test-project', {
        rootPosition:
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProject);
      expect(mockDependencies.projectManager.create).toHaveBeenCalledWith({
        name: 'test-project',
        projectPath: expect.stringContaining('test-project'),
        rootPosition:
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        config: {
          defaultEngine: undefined,
          analysisDepth: undefined,
        },
      });
    });
  });

  describe('list', () => {
    it('should list projects in directory', async () => {
      const mockProjects = ['/tmp/project1', '/tmp/project2'];
      mockDependencies.projectManager.list = vi
        .fn()
        .mockResolvedValue(mockProjects);

      const result = await projectCommands.list({ path: '/tmp' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProjects);
    });
  });
});
