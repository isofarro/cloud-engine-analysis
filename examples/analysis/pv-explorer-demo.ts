import { EngineService } from '../../src/core/engine/EngineService';
import { PrimaryVariationExplorerTask } from '../../src/core/tasks';
import { PVExplorerConfig } from '../../src/core/tasks/types/pv-explorer';
import { AnalysisConfig } from '../../src/core/engine/ChessEngine';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Primary Variation Explorer Demo
 *
 * Demonstrates how to use the PrimaryVariationExplorerTask to explore
 * chess positions by analyzing principal variations in depth.
 *
 * This example follows the architectural approach documented in
 * docs/08-explore-primary-variation.md
 */
async function primaryVariationExplorerDemo(): Promise<EngineService> {
  console.log('🚀 Primary Variation Explorer Demo\n');

  // Step 1: Load engine configuration and get engine instance
  console.log('📋 Loading engine configuration...');

  const configPath = path.join(__dirname, '../../engine-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Engine config not found at ${configPath}. Please copy engine-config.example.json to engine-config.json`
    );
  }

  const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const engineService = new EngineService(engineConfig.serviceConfig);

  // Register engines from config
  for (const engine of engineConfig.engines) {
    engineService.registerEngine(engine);
  }

  const engine = await engineService.getEngine('stockfish-local');
  console.log('✅ Engine connected successfully\n');

  // Step 2: Configure analysis parameters
  const analysisConfig: AnalysisConfig = {
    depth: 20, // Deep analysis for comprehensive exploration
    multiPV: 1, // Single principal variation
  };

  // Step 3: Configure exploration parameters
  const pvConfig: PVExplorerConfig = {
    rootPosition: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', // Starting position
    maxPlyDistance: 5,
    databasePath: './tmp/pv-exploration.db',
    graphPath: './tmp/graphs/pv-exploration.json',
  };

  console.log('⚙️  Configuration:');
  console.log(`   Analysis depth: ${analysisConfig.depth}`);
  console.log(`   Max ply distance: ${pvConfig.maxPlyDistance}`);
  console.log(`   Root position: ${pvConfig.rootPosition}`);
  console.log(`   Database: ${pvConfig.databasePath}`);
  console.log(`   Graph output: ${pvConfig.graphPath}\n`);

  // Step 4: Create and run the explorer
  console.log('🔍 Creating Primary Variation Explorer...');
  const explorer = new PrimaryVariationExplorerTask(
    engine,
    analysisConfig,
    pvConfig,
    {
      id: 'pv-explorer-demo',
      name: 'pv-explorer-demo',
      projectPath: './tmp',
      rootPosition: pvConfig.rootPosition,
      graphPath: pvConfig.graphPath,
      databasePath: pvConfig.databasePath,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );

  console.log('🚀 Starting exploration...\n');
  const startTime = Date.now();

  await explorer.explore();

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  // Step 5: Display results
  console.log('\n📊 Exploration Results:');
  console.log('========================');

  const state = explorer.getExplorationState();
  console.log(`⏱️  Total time: ${duration.toFixed(2)} seconds`);
  console.log(`📍 Positions analyzed: ${state.analyzedPositions.size}`);
  console.log(`📏 Max exploration depth: ${state.maxExplorationDepth}`);
  console.log(`🎯 Positions in queue: ${state.positionsToAnalyze.length}`);

  const graph = explorer.getGraph();
  console.log(`🌳 Graph nodes: ${Object.keys(graph.nodes).length}`);

  // Display some sample positions from the graph
  console.log('\n🔍 Sample positions in graph:');
  let count = 0;
  for (const [fen, node] of Object.entries(graph.nodes)) {
    if (count >= 3) break;
    console.log(`   ${fen.substring(0, 50)}... (${node.moves.length} moves)`);
    count++;
  }

  console.log('\n✅ Demo completed successfully!');
  console.log(`📁 Check the results:`);
  console.log(`   - ChessGraph: ${pvConfig.graphPath}`);
  console.log(`   - Analysis DB: ${pvConfig.databasePath}`);

  return engineService;
}

/**
 * Alternative demo with a more interesting starting position
 */
async function sicilianDefenseExplorerDemo(): Promise<EngineService> {
  console.log('\n🎯 Sicilian Defense Explorer Demo\n');

  // Load engine configuration and get engine instance
  const configPath = path.join(__dirname, '../../engine-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(
      `Engine config not found at ${configPath}. Please copy engine-config.example.json to engine-config.json`
    );
  }

  const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const engineService = new EngineService(engineConfig.serviceConfig);

  // Register engines from config
  for (const engine of engineConfig.engines) {
    engineService.registerEngine(engine);
  }

  const engine = await engineService.getEngine('stockfish-local');

  // Sicilian Defense starting position: 1.e4 c5
  const sicilianPosition =
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';

  const analysisConfig: AnalysisConfig = {
    depth: 18,
    multiPV: 1,
  };

  const pvConfig: PVExplorerConfig = {
    rootPosition: sicilianPosition,
    maxPlyDistance: 5, // Slightly shallower for this demo
    databasePath: './tmp/sicilian-exploration.db',
    graphPath: './tmp/graphs/sicilian-exploration.json',
  };

  console.log('🏁 Starting Sicilian Defense exploration...');
  console.log(`📍 Position: ${sicilianPosition}\n`);

  const explorer = new PrimaryVariationExplorerTask(
    engine,
    analysisConfig,
    pvConfig,
    {
      id: 'sicilian-defense-explorer-demo',
      name: 'sicilian-defense-explorer-demo',
      projectPath: './tmp',
      rootPosition: pvConfig.rootPosition,
      graphPath: pvConfig.graphPath,
      databasePath: pvConfig.databasePath,
      config: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );

  await explorer.explore();

  console.log('\n🎉 Sicilian Defense exploration completed!');

  return engineService;
}

// Run the demos
(async () => {
  const engineServices: EngineService[] = [];

  try {
    const engineService1 = await primaryVariationExplorerDemo();
    engineServices.push(engineService1);

    console.log('\n' + '='.repeat(80) + '\n');

    const engineService2 = await sicilianDefenseExplorerDemo();
    engineServices.push(engineService2);
  } catch (error) {
    console.error('Demo failed:', error);
  } finally {
    // Clean shutdown of all engine services
    console.log('\n🔌 Shutting down engines...');
    try {
      for (const engineService of engineServices) {
        await engineService.shutdown();
      }
      console.log('✅ All engines shut down successfully');
    } catch (shutdownError) {
      console.error('Error during shutdown:', shutdownError);
    }
  }
})();

export { primaryVariationExplorerDemo, sicilianDefenseExplorerDemo };
