#!/usr/bin/env tsx

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, mkdirSync } from 'fs';
import { Command } from 'commander';
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
 * Create a project directory
 */
function initProjectDirectory(projectName: string): string {
  const projectPath = join(__dirname, '../tmp/pv-projects', projectName);

  // Create the directory if it doesn't exist
  mkdirSync(projectPath, { recursive: true });

  return projectPath;
}

/**
 * Setup command line interface using commander
 */
function setupCLI(): Command {
  const program = new Command();

  program
    .name('pv-explorer')
    .description('Primary Variation Explorer - Analyze chess positions and explore principal variations')
    .version('1.0.0')
    .argument('<rootFen>', 'The starting FEN position')
    .argument('<projectName>', 'Name for the project (used for filenames)')
    .option('-d, --depth <number>', 'Analysis depth')
    .option('-m, --multipv <number>', 'Number of principal variations', '1')
    .option('-r, --max-depth-ratio <number>', 'Maximum depth ratio for exploration', '0.6')
    .option('-t, --secs-per-move <number>', 'Seconds to analyze each move')
    .option('-e, --engine <engineId>', 'Engine ID to use for analysis')
    .option('--config <path>', 'Path to engine configuration file', '../engine-config.json')
    .addHelpText('after', `
Examples:
  $ tsx scripts/pv-explorer.ts "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" "depth-analysis" --depth 15
  $ tsx scripts/pv-explorer.ts "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" "time-analysis" --secs-per-move 10
  $ tsx scripts/pv-explorer.ts "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3" "combined" --depth 20 --secs-per-move 5 --multipv 3

Note: Either --depth or --secs-per-move (or both) must be specified.`);

  return program;
}

/**
 * Main function to run the PV Explorer
 */
async function main() {
  try {
    const program = setupCLI();
    program.parse();

    const rootFen = program.args[0];
    const projectName = program.args[1];
    const options = program.opts();
    const slugifiedName = slugify(projectName);

    console.log('=== Primary Variation Explorer ===');
    console.log(`Root Position: ${rootFen}`);
    console.log(`Project Name: ${projectName}`);
    console.log(`Slugified Name: ${slugifiedName}`);
    console.log('');

    // Load engine configuration
    const configPath = join(__dirname, options.config);
    const engineConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

    // Initialize engine service
    const engineService = new EngineService(engineConfig.serviceConfig);

    // Register engines from config
    for (const engine of engineConfig.engines) {
      engineService.registerEngine(engine);
    }

    // Get an engine instance (use specified engine or first available)
    const engineId = options.engine || engineConfig.engines[0]?.id || 'stockfish-local';
    const engine = await engineService.getEngine(engineId);

    console.log(`Using engine: ${engineId}`);

    // Configure analysis parameters
    const analysisConfig: AnalysisConfig = {
      multiPV: parseInt(options.multipv)
    };

    // Add depth constraint if specified
    if (options.depth) {
      analysisConfig.depth = parseInt(options.depth);
    }

    // Add time constraint if specified
    if (options.secsPerMove) {
      analysisConfig.time = parseInt(options.secsPerMove);
    }

    // Validate that at least one analysis constraint is specified
    if (!analysisConfig.depth && !analysisConfig.time) {
      throw new Error('Analysis configuration must include either depth or secsPerMove constraint');
    }

    // Initialise project directory
    const projectPath = initProjectDirectory(projectName);

    // Configure PV Explorer
    const pvConfig: PVExplorerConfig = {
      rootPosition: rootFen,
      maxDepthRatio: parseFloat(options.maxDepthRatio),
      databasePath: join(projectPath, 'analysis.db'),
      graphPath: join(projectPath, 'graph.json')
    };

    console.log('Configuration:');
    console.log(`  Project Directory: ${projectPath}`);
    console.log(`  Analysis Depth: ${analysisConfig.depth}`);
    console.log(`  Multi-PV: ${analysisConfig.multiPV}`);
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