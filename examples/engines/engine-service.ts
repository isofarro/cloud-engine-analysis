/**
 * Engine Service Example
 *
 * This example demonstrates how to use the EngineService to manage multiple engines,
 * perform analysis, and monitor engine health.
 */

import { EngineService, EngineDefinition } from '../../src/core/engine';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load engine configuration from JSON file
function loadEngineConfig(): {
  engines: EngineDefinition[];
  serviceConfig: any;
} {
  const configPath = path.join(__dirname, '../../engine-config.json');

  if (!fs.existsSync(configPath)) {
    console.error('Engine configuration file not found!');
    console.error(
      'Please copy engine-config.example.json to engine-config.json and configure your engines.'
    );
    process.exit(1);
  }

  const configData = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(configData);
}

export async function engineServiceExample() {
  console.log('=== Engine Service Example ===\n');

  const { engines, serviceConfig } = loadEngineConfig();

  // Create engine service with configuration from JSON
  const engineService = new EngineService(serviceConfig);

  try {
    // Register engines from configuration
    engines.forEach(engineDef => {
      engineService.registerEngine(engineDef);
    });

    console.log(
      'Registered engines:',
      engineService.getRegisteredEngines().map(e => e.name)
    );

    // Get a local engine instance (assuming first engine is local)
    const localEngine = engines.find(e => e.type === 'local');
    if (!localEngine) {
      console.error(
        'No local engine configured. Please add a local engine to engine-config.json'
      );
      return;
    }

    const engine = await engineService.getEngine(localEngine.id);
    console.log('Connected to engine:', (await engine.getEngineInfo()).name);

    // Analyze the starting position
    const startingPosition =
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    console.log('\nAnalyzing starting position...');
    const analysis = await engine.analyzePosition(startingPosition, {
      depth: 15,
      multiPV: 3,
    });

    console.log('\nAnalysis result:');
    console.log(`Best move: ${analysis.bestMove}`);
    console.log(`Evaluation: ${analysis.evaluation} centipawns`);
    console.log(`Depth: ${analysis.depth}`);
    console.log(`Lines analyzed: ${analysis.lines.length}`);

    analysis.lines.forEach((line, index) => {
      console.log(
        `Line ${index + 1}: ${line.moves.slice(0, 5).join(' ')} (${line.evaluation}cp)`
      );
    });

    // Get just the best move quickly
    const bestMove = await engine.getBestMove(startingPosition, 10);
    console.log(`\nQuick best move (depth 10): ${bestMove}`);

    // Check engine health
    const isHealthy = await engine.healthCheck();
    console.log(`Engine health: ${isHealthy ? 'OK' : 'FAILED'}`);

    // Get active engines status
    console.log('\nActive engines:', engineService.getActiveEngines());
  } catch (error) {
    console.error('Error in engine service example:', error);

    if (
      error.message.includes('ENOENT') ||
      error.message.includes('not found')
    ) {
      console.error(
        '\nEngine binary not found. Please check your engine-config.json file.'
      );
      console.error(
        'Make sure the enginePath points to a valid chess engine binary.'
      );
    }
  } finally {
    // Clean up
    await engineService.shutdown();
    console.log('\nEngine service shut down');
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  engineServiceExample().catch(console.error);
}
