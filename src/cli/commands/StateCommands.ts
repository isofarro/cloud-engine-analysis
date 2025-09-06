import { CLIDependencies } from '../types';
import { StatePersistenceService } from '../../core/project/persistence/StatePersistenceService';
import { StatePersistenceConfig } from '../../core/project/persistence/types';
import * as path from 'path';

/**
 * CLI commands for managing analysis state
 */
export class StateCommands {
  private deps: CLIDependencies;
  private persistenceService: StatePersistenceService;

  constructor(deps: CLIDependencies) {
    this.deps = deps;

    const config: StatePersistenceConfig = {
      stateDirectory: path.join(process.cwd(), '.chess-analysis', 'states'),
      autoSaveIntervalMs: 30000, // 30 seconds
      maxSnapshots: 5,
      compress: false,
    };

    this.persistenceService = new StatePersistenceService(config);
  }

  /**
   * List all saved analysis states
   */
  async list(): Promise<void> {
    console.log('📋 Saved Analysis States:');
    console.log('='.repeat(50));

    const states = await this.persistenceService.listSavedStates();

    if (states.length === 0) {
      console.log('No saved states found.');
      return;
    }

    states.forEach((state, index) => {
      console.log(`${index + 1}. ${state.sessionId}`);
      console.log(`   Project: ${state.projectName}`);
      console.log(`   Strategy: ${state.strategyName}`);
      console.log(`   Progress: ${state.completionPercentage}%`);
      console.log(`   Saved: ${state.savedAt.toLocaleString()}`);
      console.log('');
    });
  }

  /**
   * Resume analysis from saved state
   */
  async resume(sessionId: string): Promise<void> {
    console.log(`🔄 Resuming analysis session: ${sessionId}`);

    const result = await this.persistenceService.loadState(sessionId);

    if (!result.success || !result.state) {
      console.error(`❌ Failed to load state: ${result.error}`);
      return;
    }

    const state = result.state;
    console.log(`📊 State loaded:`);
    console.log(`   Project: ${state.projectName}`);
    console.log(`   Strategy: ${state.strategyName}`);
    console.log(`   Progress: ${result.metadata?.completionPercentage}%`);

    if (result.metadata?.estimatedRemainingTime) {
      const remainingMinutes = Math.round(
        result.metadata.estimatedRemainingTime / 60000
      );
      console.log(`   Estimated remaining: ${remainingMinutes} minutes`);
    }

    // TODO: Integrate with AnalysisCommands to resume the actual analysis
    console.log('\n🚀 Resuming analysis...');
  }

  /**
   * Delete saved state
   */
  async delete(sessionId: string): Promise<void> {
    console.log(`🗑️  Deleting analysis state: ${sessionId}`);

    try {
      await this.persistenceService.deleteState(sessionId);
      console.log('✅ State deleted successfully.');
    } catch (error) {
      console.error(`❌ Failed to delete state: ${error}`);
    }
  }

  /**
   * Clean up old states
   */
  async cleanup(olderThanDays: number = 7): Promise<void> {
    console.log(`🧹 Cleaning up states older than ${olderThanDays} days...`);

    const states = await this.persistenceService.listSavedStates();
    const cutoffDate = new Date(
      Date.now() - olderThanDays * 24 * 60 * 60 * 1000
    );

    const oldStates = states.filter(s => s.savedAt < cutoffDate);

    if (oldStates.length === 0) {
      console.log('No old states to clean up.');
      return;
    }

    for (const state of oldStates) {
      try {
        await this.persistenceService.deleteState(state.sessionId);
        console.log(`✅ Deleted: ${state.sessionId}`);
      } catch (error) {
        console.error(`❌ Failed to delete ${state.sessionId}: ${error}`);
      }
    }

    console.log(`🎉 Cleanup complete. Deleted ${oldStates.length} old states.`);
  }
}
