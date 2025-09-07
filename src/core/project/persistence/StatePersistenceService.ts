import * as fs from 'fs/promises';
import * as path from 'path';
import {
  SerializableState,
  SerializablePVExplorationState,
  StatePersistenceConfig,
  StateRestorationResult,
} from './types';
import { PVExplorationState } from '../strategies/types';
import { FenString } from '../../types';

/**
 * Service for persisting and restoring analysis state
 */
export class StatePersistenceService {
  private config: StatePersistenceConfig;
  private autoSaveTimer?: NodeJS.Timeout;
  private currentSessionId?: string;

  constructor(config: StatePersistenceConfig) {
    this.config = config;
    this.ensureStateDirectory();
  }

  /**
   * Save analysis state to disk
   */
  async saveState(
    sessionId: string,
    strategyName: string,
    projectName: string,
    rootPosition: FenString,
    state: PVExplorationState,
    config: any,
    metadata: any = {}
  ): Promise<void> {
    // Ensure directory exists before saving
    await this.ensureStateDirectory();

    const serializableState: SerializableState = {
      sessionId,
      strategyName,
      projectName,
      rootPosition,
      state: this.serializeState(state),
      savedAt: new Date(),
      config,
      metadata: {
        version: '1.0.0',
        ...metadata,
      },
    };

    const filename = this.getStateFilename(sessionId);
    const filepath = path.join(this.config.stateDirectory, filename);

    try {
      const data = JSON.stringify(serializableState, null, 2);
      await fs.writeFile(filepath, data, 'utf8');

      // Cleanup old snapshots
      await this.cleanupOldSnapshots(sessionId);

      console.log(`✅ State saved: ${filepath}`);
    } catch (error) {
      console.error(`❌ Failed to save state: ${error}`);
      throw error;
    }
  }

  /**
   * Load analysis state from disk
   */
  async loadState(sessionId: string): Promise<StateRestorationResult> {
    try {
      // Find the most recent state file for this sessionId
      const files = await fs.readdir(this.config.stateDirectory);
      const stateFiles = files
        .filter(f => f.startsWith(`${sessionId}-`) && f.endsWith('.state.json'))
        .sort((a, b) => {
          // Sort by timestamp in filename (most recent first)
          const timestampA = a.substring(
            sessionId.length + 1,
            a.length - '.state.json'.length
          );
          const timestampB = b.substring(
            sessionId.length + 1,
            b.length - '.state.json'.length
          );
          return timestampB.localeCompare(timestampA);
        });

      if (stateFiles.length === 0) {
        return {
          success: false,
          error: `No saved state found for session: ${sessionId}`,
        };
      }

      const filename = stateFiles[0]; // Most recent file
      const filepath = path.join(this.config.stateDirectory, filename);

      const data = await fs.readFile(filepath, 'utf8');
      const state: SerializableState = JSON.parse(data);

      const age = Date.now() - new Date(state.savedAt).getTime();
      const completionPercentage = this.calculateCompletionPercentage(
        state.state
      );

      return {
        success: true,
        state,
        metadata: {
          age,
          completionPercentage,
          estimatedRemainingTime: this.estimateRemainingTime(state.state),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to load state: ${error}`,
      };
    }
  }

  /**
   * List all available saved states
   */
  async listSavedStates(): Promise<
    {
      sessionId: string;
      projectName: string;
      strategyName: string;
      savedAt: Date;
      completionPercentage: number;
    }[]
  > {
    try {
      const files = await fs.readdir(this.config.stateDirectory);
      const stateFiles = files.filter(f => f.endsWith('.state.json'));

      const states = [];
      for (const file of stateFiles) {
        try {
          const filepath = path.join(this.config.stateDirectory, file);
          const data = await fs.readFile(filepath, 'utf8');
          const state: SerializableState = JSON.parse(data);

          states.push({
            sessionId: state.sessionId,
            projectName: state.projectName,
            strategyName: state.strategyName,
            savedAt: new Date(state.savedAt),
            completionPercentage: this.calculateCompletionPercentage(
              state.state
            ),
          });
        } catch (error) {
          console.warn(`Failed to parse state file ${file}: ${error}`);
        }
      }

      return states.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
    } catch (error) {
      console.error(`Failed to list saved states: ${error}`);
      return [];
    }
  }

  /**
   * Delete saved state
   */
  async deleteState(sessionId: string): Promise<void> {
    const filename = this.getStateFilename(sessionId);
    const filepath = path.join(this.config.stateDirectory, filename);

    try {
      await fs.unlink(filepath);
      console.log(`✅ State deleted: ${filepath}`);
    } catch (error) {
      console.error(`❌ Failed to delete state: ${error}`);
      throw error;
    }
  }

  /**
   * Start auto-save for current session
   */
  startAutoSave(
    sessionId: string,
    getStateCallback: () => {
      strategyName: string;
      projectName: string;
      rootPosition: FenString;
      state: PVExplorationState;
      config: any;
      metadata?: any;
    }
  ): void {
    this.currentSessionId = sessionId;

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }

    this.autoSaveTimer = setInterval(async () => {
      try {
        const stateData = getStateCallback();
        await this.saveState(
          sessionId,
          stateData.strategyName,
          stateData.projectName,
          stateData.rootPosition,
          stateData.state,
          stateData.config,
          stateData.metadata
        );
      } catch (error) {
        console.error(`Auto-save failed: ${error}`);
      }
    }, this.config.autoSaveIntervalMs);

    console.log(`🔄 Auto-save started for session ${sessionId}`);
  }

  /**
   * Stop auto-save
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = undefined;
      console.log(`⏹️  Auto-save stopped`);
    }
  }

  /**
   * Restore PVExplorationState from serializable format
   */
  deserializeState(
    serializable: SerializablePVExplorationState
  ): PVExplorationState {
    return {
      positionsToAnalyze: serializable.positionsToAnalyze,
      analyzedPositions: new Set(serializable.analyzedPositions),
      currentDepth: serializable.currentDepth,
      maxDepth: serializable.maxDepth,
      positionDepths: new Map(serializable.positionDepths),
      stats: serializable.stats,
    };
  }

  /**
   * Convert PVExplorationState to serializable format
   */
  private serializeState(
    state: PVExplorationState
  ): SerializablePVExplorationState {
    return {
      positionsToAnalyze: state.positionsToAnalyze,
      analyzedPositions: Array.from(state.analyzedPositions),
      currentDepth: state.currentDepth,
      maxDepth: state.maxDepth,
      positionDepths: Array.from(state.positionDepths.entries()),
      stats: state.stats,
    };
  }

  private async ensureStateDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.stateDirectory, { recursive: true });
    } catch (error) {
      console.error(`Failed to create state directory: ${error}`);
      throw error;
    }
  }

  private getStateFilename(sessionId: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${sessionId}-${timestamp}.state.json`;
  }

  private calculateCompletionPercentage(
    state: SerializablePVExplorationState
  ): number {
    const total = state.stats.totalDiscovered || 1;
    const analyzed = state.stats.totalAnalyzed || 0;
    return Math.round((analyzed / total) * 100);
  }

  private estimateRemainingTime(
    state: SerializablePVExplorationState
  ): number | undefined {
    const remaining = state.positionsToAnalyze.length;
    const avgTime = state.stats.avgTimePerPosition;

    if (avgTime > 0 && remaining > 0) {
      return remaining * avgTime;
    }

    return undefined;
  }

  private async cleanupOldSnapshots(sessionId: string): Promise<void> {
    try {
      const files = await fs.readdir(this.config.stateDirectory);
      const sessionFiles = files
        .filter(f => f.startsWith(sessionId) && f.endsWith('.state.json'))
        .sort()
        .reverse(); // newest first

      // Keep only the most recent snapshots
      const filesToDelete = sessionFiles.slice(this.config.maxSnapshots);

      for (const file of filesToDelete) {
        const filepath = path.join(this.config.stateDirectory, file);
        await fs.unlink(filepath);
      }
    } catch (error) {
      console.warn(`Failed to cleanup old snapshots: ${error}`);
    }
  }
}
