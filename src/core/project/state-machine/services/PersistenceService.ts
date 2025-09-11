import {
  IPersistenceService,
  PersistenceRequest,
  RecoveryQuery,
} from './types';
import { SerializableState } from '../../persistence/types';
import { StatePersistenceService } from '../../persistence/StatePersistenceService';

export class PersistenceService implements IPersistenceService {
  private persistenceService: StatePersistenceService;

  constructor(persistenceService: StatePersistenceService) {
    this.persistenceService = persistenceService;
  }

  async saveState(request: PersistenceRequest): Promise<void> {
    // Extract strategy and project info from metadata or use defaults
    const strategyName = request.metadata?.strategyName || 'unknown';
    const projectName = request.metadata?.projectName || 'default';
    const rootPosition =
      request.metadata?.rootPosition ||
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const config = request.metadata?.config || {};

    // Convert SerializableState to PVExplorationState format expected by StatePersistenceService
    const pvState = {
      positionsToAnalyze: request.state.state.positionsToAnalyze || [],
      analyzedPositions: new Set(request.state.state.analyzedPositions || []),
      currentDepth: request.state.state.currentDepth || 0,
      maxDepth: request.state.state.maxDepth || 0,
      positionDepths: new Map(request.state.state.positionDepths || []),
      stats: request.state.state.stats || {
        totalAnalyzed: 0,
        totalDiscovered: 0,
        startTime: new Date(),
        lastUpdate: new Date(),
        avgTimePerPosition: 0,
      },
    };

    await this.persistenceService.saveState(
      request.sessionId,
      strategyName,
      projectName,
      rootPosition,
      pvState,
      config,
      request.metadata
    );
  }

  async loadState(sessionId: string): Promise<SerializableState | null> {
    try {
      const result = await this.persistenceService.loadState(sessionId);
      if (!result.success || !result.state) {
        return null;
      }

      // Convert back to SerializableState format
      const deserializedState = this.persistenceService.deserializeState(
        result.state.state
      );

      return {
        sessionId: result.state.sessionId,
        strategyName: result.state.strategyName,
        projectName: result.state.projectName,
        rootPosition: result.state.rootPosition,
        savedAt: result.state.savedAt,
        config: result.state.config,
        metadata: result.state.metadata,
        state: {
          positionsToAnalyze: Array.from(
            deserializedState.positionsToAnalyze || []
          ),
          analyzedPositions: Array.from(
            deserializedState.analyzedPositions || []
          ),
          currentDepth: deserializedState.currentDepth || 0,
          maxDepth: deserializedState.maxDepth || 0,
          positionDepths: Array.from(
            deserializedState.positionDepths?.entries() || []
          ),
          stats: deserializedState.stats,
        },
      };
    } catch (error) {
      console.error(`Failed to load state ${sessionId}:`, error);
      return null;
    }
  }

  async findResumableStates(
    query: RecoveryQuery
  ): Promise<SerializableState[]> {
    try {
      const savedStates = await this.persistenceService.listSavedStates();

      let filteredStates = savedStates;

      // Apply filters
      if (query.sessionId) {
        filteredStates = filteredStates.filter(
          state => state.sessionId === query.sessionId
        );
      }

      if (query.strategyName) {
        filteredStates = filteredStates.filter(
          state => state.strategyName === query.strategyName
        );
      }

      if (query.maxAge) {
        const cutoffDate = new Date(Date.now() - query.maxAge);
        filteredStates = filteredStates.filter(
          state => state.savedAt > cutoffDate
        );
      }

      // Load full state data for each filtered state
      const resumableStates: SerializableState[] = [];

      for (const stateInfo of filteredStates) {
        const fullState = await this.loadState(stateInfo.sessionId);
        if (fullState) {
          resumableStates.push(fullState);
        }
      }

      return resumableStates;
    } catch (error) {
      console.error('Failed to find resumable states:', error);
      return [];
    }
  }

  async deleteState(sessionId: string): Promise<void> {
    try {
      await this.persistenceService.deleteState(sessionId);
    } catch (error) {
      console.error(`Failed to delete state ${sessionId}:`, error);
      throw error;
    }
  }

  async cleanup(maxAge: number): Promise<void> {
    try {
      const savedStates = await this.persistenceService.listSavedStates();
      const cutoffDate = new Date(Date.now() - maxAge);

      const statesToDelete = savedStates.filter(
        state => state.savedAt < cutoffDate
      );

      for (const state of statesToDelete) {
        await this.deleteState(state.sessionId);
      }

      console.log(`Cleaned up ${statesToDelete.length} old states`);
    } catch (error) {
      console.error('Failed to cleanup old states:', error);
      throw error;
    }
  }

  // Legacy methods for backward compatibility
  async saveStateOld<T>(key: string, state: T, options?: any): Promise<void> {
    const request: PersistenceRequest = {
      sessionId: key,
      state: state as SerializableState,
      metadata: {
        ...options?.metadata,
        timestamp: Date.now(),
        version: options?.version || '1.0.0',
      },
    };

    await this.saveState(request);
  }

  async loadStateOld<T>(key: string): Promise<T | null> {
    const state = await this.loadState(key);
    return state as T | null;
  }

  async deleteStateOld(key: string): Promise<boolean> {
    try {
      await this.deleteState(key);
      return true;
    } catch (error) {
      console.error(`Failed to delete state ${key}:`, error);
      return false;
    }
  }

  async listStates(prefix?: string): Promise<string[]> {
    const savedStates = await this.persistenceService.listSavedStates();
    let sessionIds = savedStates.map(state => state.sessionId);

    if (prefix) {
      sessionIds = sessionIds.filter(id => id.startsWith(prefix));
    }

    return sessionIds;
  }

  async stateExists(key: string): Promise<boolean> {
    const state = await this.loadState(key);
    return state !== null;
  }

  async getStateMetadata(key: string): Promise<Record<string, any> | null> {
    const state = await this.loadState(key);
    return state?.metadata || null;
  }

  async clearStates(prefix?: string): Promise<number> {
    const states = await this.listStates(prefix);
    let cleared = 0;

    for (const stateKey of states) {
      const success = await this.deleteStateOld(stateKey);
      if (success) cleared++;
    }

    return cleared;
  }

  async backupState(key: string, backupKey?: string): Promise<string> {
    const state = await this.loadState(key);
    if (!state) {
      throw new Error(`State ${key} not found`);
    }

    const backup = backupKey || `${key}_backup_${Date.now()}`;
    await this.saveState({
      sessionId: backup,
      state,
      metadata: {
        originalKey: key,
        backupTimestamp: Date.now(),
        type: 'backup',
      },
    });

    return backup;
  }

  async restoreState(backupKey: string, targetKey?: string): Promise<string> {
    const state = await this.loadState(backupKey);
    if (!state) {
      throw new Error(`Backup state ${backupKey} not found`);
    }

    const metadata = await this.getStateMetadata(backupKey);
    const target =
      targetKey ||
      metadata?.originalKey ||
      backupKey.replace('_backup_', '_restored_');

    await this.saveState({
      sessionId: target,
      state,
      metadata: {
        restoredFrom: backupKey,
        restoreTimestamp: Date.now(),
        type: 'restored',
      },
    });

    return target;
  }
}
