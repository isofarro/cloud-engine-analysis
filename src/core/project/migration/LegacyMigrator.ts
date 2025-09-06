import { PVExplorerConfig } from '../../tasks/types/pv-explorer';
import { AnalysisConfig } from '../../engine/ChessEngine';
import { CreateProjectConfig, ChessProject, ProjectConfig } from '../types';
import { ProjectManager } from '../ProjectManager';
import { PVExplorationConfig } from '../strategies/types';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Migration utility for converting legacy PrimaryVariationExplorerTask
 * usage to the new project-based architecture
 */
export class LegacyMigrator {
  constructor(private projectManager: ProjectManager) {}

  /**
   * Migrate legacy PVExplorerConfig to new project structure
   */
  async migratePVExplorerConfig(
    legacyConfig: PVExplorerConfig,
    analysisConfig: AnalysisConfig,
    projectName: string,
    baseDir?: string
  ): Promise<ChessProject> {
    // Extract project path from legacy config or create new one
    const projectPath = baseDir
      ? path.join(baseDir, projectName)
      : path.dirname(legacyConfig.graphPath);

    // Convert legacy config to new project config
    const createConfig: CreateProjectConfig = {
      name: projectName,
      projectPath,
      rootPosition: legacyConfig.rootPosition,
      config: this.convertAnalysisConfig(analysisConfig, legacyConfig),
    };

    // Create new project
    const project = await this.projectManager.create(createConfig);

    // Migrate existing data if present
    await this.migrateExistingData(legacyConfig, project);

    return project;
  }

  /**
   * Convert legacy analysis config to new project config
   */
  private convertAnalysisConfig(
    analysisConfig: AnalysisConfig,
    pvConfig: PVExplorerConfig
  ): ProjectConfig {
    return {
      analysisDepth: analysisConfig.depth,
      timeLimit: analysisConfig.time,
      multiPv: analysisConfig.multiPV,
      pvExploration: {
        maxDepthRatio: pvConfig.maxDepthRatio,
        exploreAlternatives: false, // Default for backward compatibility
        alternativeThreshold: 50,
      },
    };
  }

  /**
   * Migrate existing graph and database files
   */
  private async migrateExistingData(
    legacyConfig: PVExplorerConfig,
    project: ChessProject
  ): Promise<void> {
    // Copy existing graph file if it exists
    if (fs.existsSync(legacyConfig.graphPath)) {
      const targetGraphPath = project.graphPath;
      if (legacyConfig.graphPath !== targetGraphPath) {
        fs.copyFileSync(legacyConfig.graphPath, targetGraphPath);
        console.log(
          `📁 Migrated graph: ${legacyConfig.graphPath} → ${targetGraphPath}`
        );
      }
    }

    // Copy existing database file if it exists
    if (fs.existsSync(legacyConfig.databasePath)) {
      const targetDbPath = project.databasePath;
      if (legacyConfig.databasePath !== targetDbPath) {
        fs.copyFileSync(legacyConfig.databasePath, targetDbPath);
        console.log(
          `🗄️  Migrated database: ${legacyConfig.databasePath} → ${targetDbPath}`
        );
      }
    }
  }

  /**
   * Generate migration script for existing usage
   */
  generateMigrationScript(
    legacyConfig: PVExplorerConfig,
    analysisConfig: AnalysisConfig,
    projectName: string
  ): string {
    return `
// Migration from legacy PrimaryVariationExplorerTask
import { ProjectManager } from '../core/project/ProjectManager';
import { AnalysisTaskExecutor } from '../core/project/services/AnalysisTaskExecutor';
import { PVExplorationStrategy } from '../core/project/strategies/PVExplorationStrategy';
import { LegacyMigrator } from '../core/project/migration/LegacyMigrator';

// Legacy configuration (BEFORE)
const legacyConfig = ${JSON.stringify(legacyConfig, null, 2)};
const analysisConfig = ${JSON.stringify(analysisConfig, null, 2)};

// New project-based approach (AFTER)
async function migratedAnalysis() {
  const projectManager = new ProjectManager();
  const migrator = new LegacyMigrator(projectManager);
  
  // Migrate to new project structure
  const project = await migrator.migratePVExplorerConfig(
    legacyConfig,
    analysisConfig,
    '${projectName}'
  );
  
  // Use new architecture
  const executor = new AnalysisTaskExecutor({
    projectManager,
    // ... other dependencies
  });
  
  const strategy = new PVExplorationStrategy(engine, analysisConfig, {
    maxDepthRatio: ${legacyConfig.maxDepthRatio},
    exploreAlternatives: false,
    alternativeThreshold: 50
  });
  
  await executor.executeStrategy(strategy, project);
}

migratedAnalysis().catch(console.error);
`;
  }
}
