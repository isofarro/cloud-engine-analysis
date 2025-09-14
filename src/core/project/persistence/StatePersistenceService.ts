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
    const serializableState: SerializableState = {
      sessionId,
      strategyName,
      projectName,
      rootPosition,
      state: this.serializeState(state),
      config,
      savedAt: new Date(), // Fix: Use Date object instead of string
      metadata: {
        version: '1.0',
        engineSlug: metadata.engineSlug,
        estimatedCompletion: metadata.estimatedCompletion,
        ...metadata, // Allow additional metadata properties
      },
    };

    const filename = this.getStateFilename(sessionId);
    // Add defensive check for undefined stateDirectory
    const stateDirectory = this.config.stateDirectory || './tmp/test-state';
    const filepath = path.join(stateDirectory, filename);

    try {
      const data = JSON.stringify(serializableState, null, 2);

      console.log('🔍 DEBUG: About to call fs.writeFile with:', {
        filepath,
        filepathType: typeof filepath,
        data: data ? 'data present' : 'data missing',
        dataType: typeof data,
      });

      try {
        await fs.writeFile(filepath, data, 'utf8');
        console.log('🔍 DEBUG: fs.writeFile completed successfully');
      } catch (writeError: any) {
        console.error('🔍 DEBUG: fs.writeFile failed:', writeError);
        console.error('🔍 DEBUG: fs.writeFile error details:', {
          message: writeError.message,
          code: writeError.code,
          stack: writeError.stack,
          filepath,
          filepathType: typeof filepath,
        });
        throw writeError;
      }

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
      console.log('🔍 DEBUG: loadState called with sessionId:', sessionId);
      console.log('🔍 DEBUG: loadState - Call stack:', new Error().stack);

      // Ensure directory exists before listing
      await this.ensureStateDirectory();

      // Add defensive check for undefined stateDirectory
      const stateDirectory = this.config.stateDirectory || './tmp/test-state';
      console.log(
        '🔍 DEBUG: loadState - About to call fs.readdir with directory:',
        stateDirectory
      );
      console.log(
        '🔍 DEBUG: loadState - stateDirectory type:',
        typeof stateDirectory
      );

      // Wrap fs.readdir with additional error catching
      let files;
      try {
        console.log('🔍 DEBUG: Calling fs.readdir with:', {
          stateDirectory,
          type: typeof stateDirectory,
        });
        files = await fs.readdir(stateDirectory);
        console.log('🔍 DEBUG: loadState - readdir result:', files);
        console.log(
          '🔍 DEBUG: loadState - readdir result type:',
          typeof files,
          'isArray:',
          Array.isArray(files)
        );
      } catch (readdirError: any) {
        console.error('🔍 DEBUG: loadState - fs.readdir failed:', readdirError);
        console.error('🔍 DEBUG: loadState - fs.readdir error details:', {
          message: readdirError.message,
          code: readdirError.code,
          stack: readdirError.stack,
          stateDirectory,
          stateDirectoryType: typeof stateDirectory,
        });
        throw readdirError;
      }

      // Add defensive check for files array
      if (!Array.isArray(files)) {
        console.error(
          '🔍 DEBUG: loadState - fs.readdir did not return an array:',
          files
        );
        return {
          success: false,
          error: `Failed to read state directory: ${stateDirectory}`,
        };
      }

      const stateFiles = files
        .filter(f => {
          console.log(
            '🔍 DEBUG: loadState - filtering file:',
            f,
            'type:',
            typeof f
          );
          return (
            f &&
            typeof f === 'string' &&
            f.startsWith(`${sessionId}-`) &&
            f.endsWith('.state.json')
          );
        })
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
      const filepath = path.join(stateDirectory, filename);

      console.log('🔍 DEBUG: About to call fs.readFile with:', {
        filepath,
        filepathType: typeof filepath,
        filename,
        filenameType: typeof filename,
      });

      try {
        const data = await fs.readFile(filepath, 'utf8');
        console.log('🔍 DEBUG: fs.readFile completed successfully');
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
      } catch (readFileError: any) {
        console.error('🔍 DEBUG: fs.readFile failed:', readFileError);
        console.error('🔍 DEBUG: fs.readFile error details:', {
          message: readFileError.message,
          code: readFileError.code,
          stack: readFileError.stack,
          filepath,
          filepathType: typeof filepath,
        });
        throw readFileError;
      }
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
      console.log('🔍 DEBUG: listSavedStates called');
      console.log('🔍 DEBUG: listSavedStates - Call stack:', new Error().stack);

      // Ensure directory exists before listing
      await this.ensureStateDirectory();

      // Add defensive check for undefined stateDirectory
      const stateDirectory = this.config.stateDirectory || './tmp/test-state';
      console.log(
        '🔍 DEBUG: listSavedStates - About to call fs.readdir with directory:',
        stateDirectory
      );
      console.log(
        '🔍 DEBUG: listSavedStates - stateDirectory type:',
        typeof stateDirectory
      );

      // Check if directory exists before reading
      try {
        console.log('🔍 DEBUG: About to call fs.stat with:', {
          stateDirectory,
          type: typeof stateDirectory,
        });
        const stats = await fs.stat(stateDirectory);
        console.log('🔍 DEBUG: Directory stats:', stats.isDirectory());
      } catch (statError: any) {
        console.error('🔍 DEBUG: Directory stat error:', statError);
        console.error('🔍 DEBUG: fs.stat error details:', {
          message: statError.message,
          code: statError.code,
          stack: statError.stack,
          stateDirectory,
          stateDirectoryType: typeof stateDirectory,
        });
      }

      // Wrap fs.readdir with additional error catching
      let files;
      try {
        console.log('🔍 DEBUG: Calling fs.readdir with:', {
          stateDirectory,
          type: typeof stateDirectory,
        });
        files = await fs.readdir(stateDirectory);
        console.log('🔍 DEBUG: listSavedStates - readdir result:', files);
        console.log(
          '🔍 DEBUG: listSavedStates - readdir result type:',
          typeof files,
          'isArray:',
          Array.isArray(files)
        );
      } catch (readdirError: any) {
        console.error(
          '🔍 DEBUG: listSavedStates - fs.readdir failed:',
          readdirError
        );
        console.error('🔍 DEBUG: listSavedStates - fs.readdir error details:', {
          message: readdirError.message,
          code: readdirError.code,
          stack: readdirError.stack,
          stateDirectory,
          stateDirectoryType: typeof stateDirectory,
        });
        throw readdirError;
      }

      // Add more defensive checks
      if (!Array.isArray(files)) {
        console.error(
          '🔍 DEBUG: listSavedStates - fs.readdir did not return an array:',
          files
        );
        return [];
      }

      const stateFiles = files.filter(f => {
        console.log(
          '🔍 DEBUG: listSavedStates - filtering file:',
          f,
          'type:',
          typeof f
        );
        return f && typeof f === 'string' && f.endsWith('.state.json');
      });
      console.log('🔍 DEBUG: filtered state files:', stateFiles);

      const states: {
        sessionId: string;
        projectName: string;
        strategyName: string;
        savedAt: Date;
        completionPercentage: number;
      }[] = [];

      for (const file of stateFiles) {
        try {
          // Add validation to ensure file is a valid string
          if (!file || typeof file !== 'string') {
            console.warn(`Skipping invalid file entry: ${file}`);
            continue;
          }
          console.log('DEBUG: processing file:', file);
          const filepath = path.join(stateDirectory, file);
          console.log('DEBUG: full filepath:', filepath);

          console.log('🔍 DEBUG: About to call fs.readFile with:', {
            filepath,
            filepathType: typeof filepath,
            file,
            fileType: typeof file,
          });

          try {
            const data = await fs.readFile(filepath, 'utf8');
            console.log(
              '🔍 DEBUG: fs.readFile completed successfully for file:',
              file
            );
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
          } catch (readFileError: any) {
            console.error(
              '🔍 DEBUG: fs.readFile failed for file:',
              file,
              readFileError
            );
            console.error('🔍 DEBUG: fs.readFile error details:', {
              message: readFileError.message,
              code: readFileError.code,
              stack: readFileError.stack,
              filepath,
              filepathType: typeof filepath,
            });
            console.warn(
              `Failed to parse state file ${file}: ${readFileError}`
            );
          }
        } catch (error: any) {
          console.warn(`Failed to parse state file ${file}: ${error}`);
        }
      }

      return states.sort((a, b) => b.savedAt.getTime() - a.savedAt.getTime());
    } catch (error: any) {
      console.error(`Failed to list saved states: ${error}`);
      console.error('🔍 DEBUG: Full error stack:', error.stack);
      return [];
    }
  }

  /**
   * Delete saved state
   */
  async deleteState(sessionId: string): Promise<void> {
    // Add validation for sessionId
    if (
      !sessionId ||
      typeof sessionId !== 'string' ||
      sessionId.trim() === ''
    ) {
      throw new Error('Invalid sessionId provided to deleteState');
    }

    const filename = this.getStateFilename(sessionId);
    // Add defensive check for undefined stateDirectory
    const stateDirectory = this.config.stateDirectory || './tmp/test-state';
    const filepath = path.join(stateDirectory, filename);

    // Add filepath validation
    if (!filepath || typeof filepath !== 'string' || filepath.trim() === '') {
      throw new Error(`Invalid filepath generated: ${filepath}`);
    }

    try {
      console.log('🔍 DEBUG: About to call fs.unlink with:', {
        filepath,
        filepathType: typeof filepath,
        filename,
        filenameType: typeof filename,
      });

      try {
        await fs.unlink(filepath);
        console.log('🔍 DEBUG: fs.unlink completed successfully');
        console.log(`✅ State deleted: ${filepath}`);
      } catch (unlinkError: any) {
        console.error('🔍 DEBUG: fs.unlink failed:', unlinkError);
        console.error('🔍 DEBUG: fs.unlink error details:', {
          message: unlinkError.message,
          code: unlinkError.code,
          stack: unlinkError.stack,
          filepath,
          filepathType: typeof filepath,
        });
        throw unlinkError;
      }
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
    // Add defensive check for undefined stateDirectory
    const stateDirectory = this.config.stateDirectory || './tmp/test-state';

    console.log('🔍 DEBUG: About to call fs.mkdir with:', {
      stateDirectory,
      stateDirectoryType: typeof stateDirectory,
    });

    try {
      try {
        await fs.mkdir(stateDirectory, { recursive: true });
        console.log('🔍 DEBUG: fs.mkdir completed successfully');
      } catch (mkdirError: any) {
        console.error('🔍 DEBUG: fs.mkdir failed:', mkdirError);
        console.error('🔍 DEBUG: fs.mkdir error details:', {
          message: mkdirError.message,
          code: mkdirError.code,
          stack: mkdirError.stack,
          stateDirectory,
          stateDirectoryType: typeof stateDirectory,
        });

        // Only throw if it's not a "directory already exists" error
        if (mkdirError.code !== 'EEXIST') {
          console.error(`Failed to create state directory: ${mkdirError}`);
          throw mkdirError;
        }
      }
    } catch (error: any) {
      // Only throw if it's not a "directory already exists" error
      if (error.code !== 'EEXIST') {
        console.error(`Failed to create state directory: ${error}`);
        throw error;
      }
    }
  }

  private getStateFilename(sessionId: string): string {
    // Add validation for sessionId
    if (
      !sessionId ||
      typeof sessionId !== 'string' ||
      sessionId.trim() === ''
    ) {
      throw new Error('Invalid sessionId provided to getStateFilename');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${sessionId.trim()}-${timestamp}.state.json`;
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
      console.log(
        '🔍 DEBUG: cleanupOldSnapshots called with sessionId:',
        sessionId
      );
      console.log(
        '🔍 DEBUG: cleanupOldSnapshots - Call stack:',
        new Error().stack
      );

      const stateDirectory = this.config.stateDirectory || './tmp/test-state';
      console.log(
        '🔍 DEBUG: cleanupOldSnapshots - About to call fs.readdir with directory:',
        stateDirectory
      );
      console.log(
        '🔍 DEBUG: cleanupOldSnapshots - stateDirectory type:',
        typeof stateDirectory
      );

      // Wrap fs.readdir with additional error catching
      let files;
      try {
        console.log('🔍 DEBUG: Calling fs.readdir with:', {
          stateDirectory,
          type: typeof stateDirectory,
        });
        files = await fs.readdir(stateDirectory);
        console.log('🔍 DEBUG: cleanupOldSnapshots - readdir result:', files);
        console.log(
          '🔍 DEBUG: cleanupOldSnapshots - readdir result type:',
          typeof files,
          'isArray:',
          Array.isArray(files)
        );
      } catch (readdirError: any) {
        console.error(
          '🔍 DEBUG: cleanupOldSnapshots - fs.readdir failed:',
          readdirError
        );
        console.error(
          '🔍 DEBUG: cleanupOldSnapshots - fs.readdir error details:',
          {
            message: readdirError.message,
            code: readdirError.code,
            stack: readdirError.stack,
            stateDirectory,
            stateDirectoryType: typeof stateDirectory,
          }
        );
        throw readdirError;
      }

      // Add defensive check for files array
      if (!Array.isArray(files)) {
        console.error(
          'DEBUG: cleanupOldSnapshots - fs.readdir did not return an array:',
          files
        );
        return;
      }

      const sessionFiles = files
        .filter(
          f =>
            f &&
            typeof f === 'string' &&
            f.startsWith(sessionId) &&
            f.endsWith('.state.json')
        )
        .sort()
        .reverse(); // newest first

      // Keep only the most recent snapshots
      const filesToDelete = sessionFiles.slice(this.config.maxSnapshots);

      for (const file of filesToDelete) {
        if (!file || typeof file !== 'string') {
          console.warn(`Skipping invalid file entry in cleanup: ${file}`);
          continue;
        }
        const filepath = path.join(stateDirectory, file);

        // Add robust filepath validation before fs.unlink
        if (
          !filepath ||
          typeof filepath !== 'string' ||
          filepath.trim() === ''
        ) {
          console.warn(`Skipping invalid filepath in cleanup: ${filepath}`);
          continue;
        }

        console.log('🔍 DEBUG: About to call fs.unlink in cleanup with:', {
          filepath,
          filepathType: typeof filepath,
          file,
          fileType: typeof file,
        });

        try {
          await fs.unlink(filepath);
          console.log('🔍 DEBUG: fs.unlink in cleanup completed successfully');
          console.log(`🗑️ Deleted old snapshot: ${filepath}`);
        } catch (unlinkError: any) {
          console.error('🔍 DEBUG: fs.unlink in cleanup failed:', unlinkError);
          console.error('🔍 DEBUG: fs.unlink cleanup error details:', {
            message: unlinkError.message,
            code: unlinkError.code,
            stack: unlinkError.stack,
            filepath,
            filepathType: typeof filepath,
          });
          console.warn(
            `Failed to delete file ${filepath}: ${unlinkError.message}`
          );
        }
      }
    } catch (error: any) {
      console.warn(`Failed to cleanup old snapshots: ${error}`);
    }
  }
}
