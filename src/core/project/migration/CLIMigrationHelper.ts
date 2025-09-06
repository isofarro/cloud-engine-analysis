import { Command } from 'commander';
import { LegacyMigrator } from './LegacyMigrator';
import { ProjectManager } from '../ProjectManager';
import { PVExplorerConfig } from '../../tasks/types/pv-explorer';
import { AnalysisConfig } from '../../engine/ChessEngine';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CLI helper for migrating legacy scripts to new architecture
 */
export class CLIMigrationHelper {
  static createMigrationCommand(): Command {
    const command = new Command('migrate')
      .description(
        'Migrate legacy PV Explorer usage to new project architecture'
      )
      .argument('<legacy-script>', 'Path to legacy script file')
      .option('-o, --output <path>', 'Output directory for migrated project')
      .option('-n, --name <name>', 'Project name for migration')
      .action(async (legacyScript, options) => {
        await this.migrateLegacyScript(legacyScript, options);
      });

    return command;
  }

  private static async migrateLegacyScript(
    scriptPath: string,
    options: { output?: string; name?: string }
  ): Promise<void> {
    console.log(`🔄 Migrating legacy script: ${scriptPath}`);

    // Parse legacy script to extract configuration
    const config = await this.extractLegacyConfig(scriptPath);

    if (!config) {
      console.error('❌ Could not extract legacy configuration from script');
      return;
    }

    const projectName = options.name || path.basename(scriptPath, '.ts');
    const outputDir = options.output || path.dirname(scriptPath);

    // Perform migration
    const projectManager = new ProjectManager();
    const migrator = new LegacyMigrator(projectManager);

    try {
      const project = await migrator.migratePVExplorerConfig(
        config.pvConfig,
        config.analysisConfig,
        projectName,
        outputDir
      );

      // Generate new script
      const newScript = migrator.generateMigrationScript(
        config.pvConfig,
        config.analysisConfig,
        projectName
      );

      const newScriptPath = path.join(outputDir, `${projectName}-migrated.ts`);
      fs.writeFileSync(newScriptPath, newScript);

      console.log('✅ Migration completed successfully!');
      console.log(`📁 Project created: ${project.projectPath}`);
      console.log(`📝 New script: ${newScriptPath}`);
      console.log('\n📋 Next steps:');
      console.log('1. Review the generated script');
      console.log('2. Update your imports and dependencies');
      console.log('3. Test the new project-based workflow');
    } catch (error) {
      console.error('❌ Migration failed:', error);
    }
  }

  private static async extractLegacyConfig(scriptPath: string): Promise<{
    pvConfig: PVExplorerConfig;
    analysisConfig: AnalysisConfig;
  } | null> {
    // This would parse the script file to extract configuration
    // For now, return null to indicate manual configuration needed
    console.log('⚠️  Manual configuration extraction required');
    console.log('Please provide your legacy configuration manually');
    return null;
  }
}
