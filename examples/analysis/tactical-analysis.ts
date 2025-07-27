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
 * Example: Tactical Position Analysis
 * Demonstrates analysis of a tactical position with forced sequences
 */
async function tacticalAnalysisExample() {
    // Load engine configuration from JSON file
    const configPath = path.join(__dirname, 'engine-config.json');
    const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const engine = new LocalChessEngine(engineConfig);
    // Famous tactical position: "Légal's Mate" setup
    const tacticalPosition = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

    try {
        console.log('=== Tactical Analysis Example ===');
        console.log('Position: Légal\'s Mate setup');
        console.log('FEN: r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
        console.log('Configuration: Deep tactical search\n');
        
        const tacticalConfig: AnalysisConfig = {
            depth: 15,
            multiPV: 1
        };
        
        const tacticalTask = new PositionAnalysisTask(engine, tacticalPosition, tacticalConfig);
        const result = await tacticalTask.execute();
        
        console.log(`✓ Analysis completed`);
        console.log(`✓ Depth reached: ${result.depth}`);
        console.log(`✓ Selective depth: ${result.selDepth}`);
        
        if (result.score.type === 'mate') {
            console.log(`✓ Result: Mate in ${Math.abs(result.score.score)} moves`);
        } else {
            console.log(`✓ Evaluation: ${result.score.score} centipawns`);
        }
        
        console.log(`✓ Best continuation: ${result.pvs[0]?.join(' ') || 'No moves'}`);
        
        if (result.score.type === 'mate') {
            console.log('\n🎯 This position demonstrates a forced mate sequence!');
        }
        
        console.log('\n✅ Tactical analysis example completed successfully!');
        
    } catch (error) {
        console.error('❌ Tactical analysis example failed:', error);
    } finally {
        await engine.disconnect();
    }
}

tacticalAnalysisExample();