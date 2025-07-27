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
 * Example: Time-based Analysis
 * Demonstrates analysis with a time limit instead of depth limit
 */
async function timeBasedAnalysisExample() {
    // Load engine configuration from JSON file
    const configPath = path.join(__dirname, 'engine-config.json');
    const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const engine = new LocalChessEngine(engineConfig);
    // Sicilian Defense position
    const sicilianPosition = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';

    try {
        console.log('=== Time-based Analysis Example (5 seconds) ===');
        console.log('Position: Sicilian Defense (1.e4 c5)');
        console.log('Configuration: Time-limited analysis with 2 variations\n');
        
        const startTime = Date.now();
        
        const timeConfig: AnalysisConfig = {
            time: 5, // 5 seconds
            multiPV: 2
        };
        
        const timeTask = new PositionAnalysisTask(engine, sicilianPosition, timeConfig);
        const timeResult = await timeTask.execute();
        
        const endTime = Date.now();
        const actualTime = (endTime - startTime) / 1000;
        
        console.log(`✓ Analysis completed in ${actualTime.toFixed(1)} seconds`);
        console.log(`✓ Final depth reached: ${timeResult.depth}`);
        console.log(`✓ Selective depth: ${timeResult.selDepth}`);
        console.log(`✓ Evaluation: ${timeResult.score.type} ${timeResult.score.score}\n`);
        
        timeResult.pvs.forEach((pv, index) => {
            console.log(`Variation ${index + 1}: ${pv.join(' ')}`);
        });
        
        console.log('\n✅ Time-based analysis example completed successfully!');
        
    } catch (error) {
        console.error('❌ Time-based analysis example failed:', error);
    } finally {
        await engine.disconnect();
    }
}

timeBasedAnalysisExample();