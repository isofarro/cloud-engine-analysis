import { CLIDependencies } from './types';
import {
  ProjectManager,
  AnalysisStrategyRegistry,
} from '../core/project/types';
import { ChessGraph } from '../core/graph/ChessGraph';
import { IAnalysisRepo } from '../core/analysis-store/IAnalysisRepo';
import { AnalysisTaskExecutor } from '../core/project/services/AnalysisTaskExecutor';

/**
 * Create CLI dependencies with defaults
 */
export function createCLIDependencies(
  overrides?: Partial<CLIDependencies>
): CLIDependencies {
  // In a real implementation, these would be properly instantiated
  // with configuration, database connections, etc.

  const defaults: CLIDependencies = {
    projectManager: createDefaultProjectManager(),
    strategyRegistry: createDefaultStrategyRegistry(),
    taskExecutor: createDefaultTaskExecutor(),
    analysisRepo: createDefaultAnalysisRepo(),
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

function createDefaultAnalysisRepo(): IAnalysisRepo {
  // This would return a real IAnalysisRepo implementation
  throw new Error('IAnalysisRepo implementation not provided');
}
