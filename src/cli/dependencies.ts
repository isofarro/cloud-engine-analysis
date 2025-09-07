import { CLIDependencies } from './types';
import {
  ProjectManager,
  AnalysisStrategyRegistry,
} from '../core/project/types';
import { ChessGraph } from '../core/graph/ChessGraph';
import { AnalysisStoreService } from '../core/analysis-store/AnalysisStoreService';
import { AnalysisTaskExecutor } from '../core/project/services/AnalysisTaskExecutor';
import { createInMemoryAnalysisStoreService } from '../core/analysis-store';

/**
 * Creates CLI dependencies with optional overrides.
 */
export async function createCLIDependencies(
  overrides?: Partial<CLIDependencies>
): Promise<CLIDependencies> {
  // In a real implementation, these would be properly instantiated
  // with configuration, database connections, etc.

  const defaults: CLIDependencies = {
    projectManager: createDefaultProjectManager(),
    strategyRegistry: createDefaultStrategyRegistry(),
    taskExecutor: createDefaultTaskExecutor(),
    analysisStore: await createDefaultAnalysisStore(),
    graph: new ChessGraph(),
  };

  return { ...defaults, ...overrides };
}

// Placeholder implementations - these would be replaced with real implementations
function createDefaultProjectManager(): ProjectManager {
  // This would return a real ProjectManager implementation
  throw new Error('ProjectManager implementation not provided');
}

function createDefaultStrategyRegistry(): AnalysisStrategyRegistry {
  // This would return a real AnalysisStrategyRegistry implementation
  throw new Error('AnalysisStrategyRegistry implementation not provided');
}

function createDefaultTaskExecutor(): AnalysisTaskExecutor {
  // This would return a real AnalysisTaskExecutor implementation
  throw new Error('AnalysisTaskExecutor implementation not provided');
}

async function createDefaultAnalysisStore(): Promise<AnalysisStoreService> {
  // Use the factory function that creates an in-memory database
  return createInMemoryAnalysisStoreService();
}
