import {
  PVExplorationContext,
  PVExplorationHookContext,
  PVExplorationHooks,
} from './types';

// Export the PVExplorationHooks interface
export { PVExplorationHooks } from './types';

/**
 * Default hooks for PV exploration
 */
export const createDefaultPVHooks = (): PVExplorationHooks => ({
  // Progress reporting hook
  onProgressUpdate: async (data: PVExplorationHookContext) => {
    const { progress } = data;
    console.log(
      `Progress: ${progress?.current}/${progress?.total} - ${progress?.operation}`
    );
  },

  // Error logging hook
  onExplorationError: async (data: PVExplorationHookContext) => {
    const { error } = data;
    console.error(`❌ Analysis error:`, error?.message);
  },

  // Completion logging hook
  onExplorationComplete: async (data: PVExplorationHookContext) => {
    const { stats } = data;
    console.log(
      `🎉 Exploration completed with ${stats?.totalAnalyzed} positions analyzed`
    );
  },
});

/**
 * Hook for opening book integration
 */
export const createOpeningBookHook = (): Partial<PVExplorationHooks> => ({
  beforeRootAnalysis: async (context: PVExplorationContext) => {
    // Check if position is in opening book
    // Skip analysis if book move exists
    // This is an example of how hooks can modify behavior
  },
});

/**
 * Hook for tablebase integration
 */
export const createTablebaseHook = (): Partial<PVExplorationHooks> => ({
  beforeRootAnalysis: async (context: PVExplorationContext) => {
    // Check tablebase for endgame positions
    // Skip engine analysis if tablebase result available
  },
});
