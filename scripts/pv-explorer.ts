#!/usr/bin/env tsx

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, mkdirSync } from 'fs';
import { PrimaryVariationExplorerTask } from '../src/core/tasks/PrimaryVariationExplorerTask';
import { PVExplorerConfig } from '../src/core/tasks/types/pv-explorer';
import { EngineService } from '../src/core/engine/EngineService';
import { AnalysisConfig } from '../src/core/engine/ChessEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Slugify a string to make it safe for use as a filename
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Create a timestamped project directory
 */
function createProjectDirectory(projectName: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const slugifiedName = slugify(projectName);
  const projectDirName = `${timestamp}-${slugifiedName}`;
  const projectPath = join(__dirname, '../tmp/pv-projects', projectDirName);

  // Create the directory if it doesn't exist
  mkdirSync(projectPath, { recursive: true });

  return projectPath;
}

/**
 * Parse command line arguments
 */
function parseArgs(): { rootFen: string; projectName: string } {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: tsx scripts/pv-explorer.ts <rootFen> <projectName>');
    console.error('');
    console.error('Arguments:');
    console.error('  rootFen     - The starting FEN position (mandatory)');
    console.error('  projectName - Name for the project (used for filenames)');
    console.error('');
    console.error('Example:');
    console.error('  tsx scripts/pv-explorer.ts "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" "starting-position"');
    process.exit(1);
  }

  return {
    rootFen: args[0],
    projectName: args[1]
  };
}

/**
 * Main function to run the PV Explorer
 */
async function main() {
  try {
    const { rootFen, projectName } = parseArgs();
    const slugifiedName = slugify(projectName);

    console.log('=== Primary Variation Explorer ===');
    console.log(`Root Position: ${rootFen}`);
    console.log(`Project Name: ${projectName}`);
    console.log(`Slugified Name: ${slugifiedName}`);
    console.log('');

    // Load engine configuration
    const configPath = join(__dirname, '../engine-config.json');
    const engineConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

    // Initialize engine service
    const engineService = new EngineService(engineConfig.serviceConfig);

    // Register engines from config
    for (const engine of engineConfig.engines) {
      engineService.registerEngine(engine);
    }

    // Get an engine instance (use the first available engine)
    const firstEngineId = engineConfig.engines[0]?.id || 'stockfish-local';
    const engine = await engineService.getEngine(firstEngineId);

    console.log(`Using engine: ${firstEngineId}`);

    // Configure analysis parameters
    const analysisConfig: AnalysisConfig = {
      depth: 15,
      multiPV: 1
    };

    // Create project directory
    const projectPath = createProjectDirectory(projectName);

    // Configure PV Explorer
    const pvConfig: PVExplorerConfig = {
      rootPosition: rootFen,
      maxDepthRatio: 0.6,
      databasePath: join(projectPath, 'analysis.db'),
      graphPath: join(projectPath, 'graph.json')
    };

    console.log('Configuration:');
    console.log(`  Project Directory: ${projectPath}`);
    console.log(`  Analysis Depth: ${analysisConfig.depth}`);
    console.log(`  Max Depth Ratio: ${pvConfig.maxDepthRatio}`);
    console.log(`  Database: ${pvConfig.databasePath}`);
    console.log(`  Graph: ${pvConfig.graphPath}`);
    console.log('');

    // Create and run the explorer
    console.log('Starting exploration...');
    const explorer = new PrimaryVariationExplorerTask(
      engine,
      analysisConfig,
      pvConfig
    );

    await explorer.explore();

    console.log('');
    console.log('✅ Primary Variation exploration completed successfully!');
    console.log(`📊 Analysis database: ${pvConfig.databasePath}`);
    console.log(`🌳 Chess graph: ${pvConfig.graphPath}`);

    // Get final statistics
    const state = explorer.getExplorationState();
    console.log('');
    console.log('📈 Exploration Statistics:');
    console.log(`  Positions analyzed: ${state.analyzedPositions.size}`);
    console.log(`  Max exploration depth: ${state.maxExplorationDepth}`);
    console.log(`  Remaining positions: ${state.positionsToAnalyze.length}`);

    // // Clean up engine connection and service
    console.log('\n🔌 Disconnecting engine...');
    await engine.disconnect();
    console.log('✅ Engine disconnected successfully');

    console.log('🛑 Shutting down engine service...');
    await engineService.shutdown();
    console.log('✅ Engine service shutdown complete');

  } catch (error) {
    console.error('❌ Error during exploration:', error);
    process.exit(1);
  }
}

// Run the script
main();