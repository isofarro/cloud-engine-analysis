import { ProjectManager } from './ProjectManager';
import { ProjectManager as ProjectManagerType } from './types';

export * from './types';
export * from './strategies/types';

// Factory function for creating project manager
export function createProjectManager(baseDir?: string): ProjectManagerType {
  return new ProjectManager(baseDir);
}

// Default project manager instance
export const defaultProjectManager = createProjectManager();
