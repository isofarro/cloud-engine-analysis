import { PositionAnalysisTask } from '../../src/core/tasks/PositionAnalysisTask';
import { LocalChessEngine } from '../../src/core/engine/LocalChessEngine';
import { AnalysisConfig } from '../../src/core/engine/ChessEngine';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Example: Multi-PV Analysis
 * Demonstrates analyzing multiple principal variations simultaneously
 */
async function multiPVAnalysisExample() {
  // Load engine configuration from JSON file
  const configPath = path.join(__dirname, 'engine-config.json');
  const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const engine = new LocalChessEngine(engineConfig);
  // Sicilian Defense position - rich in tactical possibilities
  const sicilianPosition =
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';

  try {
    console.log('=== Multi-PV Analysis Example (3 variations) ===');
    console.log('Position: Sicilian Defense (1.e4 c5)');
    console.log('Configuration: Multiple principal variations\n');

    const multiPVConfig: AnalysisConfig = {
      depth: 15,
      multiPV: 3,
    };

    const multiPVTask = new PositionAnalysisTask(engine, multiPVConfig);
    const multiPVResult = await multiPVTask.analysePosition(sicilianPosition);

    console.log(`✓ Analysis completed`);
    console.log(`✓ Analyzed ${multiPVResult.multiPV} variations:`);
    console.log(`✓ Depth reached: ${multiPVResult.depth}\n`);

    multiPVResult.pvs.forEach((pv, index) => {
      console.log(`Variation ${index + 1}: ${pv}`);
    });

    console.log('\n✅ Multi-PV analysis example completed successfully!');
  } catch (error) {
    console.error('❌ Multi-PV analysis example failed:', error);
  } finally {
    await engine.disconnect();
  }
}

multiPVAnalysisExample();
