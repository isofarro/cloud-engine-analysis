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
 * Example: Quick Analysis with depth limit
 * Demonstrates basic position analysis with a fixed depth
 */
async function quickAnalysisExample() {
    // Load engine configuration from JSON file
    const configPath = path.join(__dirname, 'engine-config.json');
    const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const engine = new LocalChessEngine(engineConfig);
    const startingPosition = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    try {
        console.log('=== Quick Analysis Example (Depth 10) ===');
        console.log('Position: Starting position');
        console.log('Configuration: Fixed depth analysis\n');
        
        const quickConfig: AnalysisConfig = {
            depth: 10,
            multiPV: 1
        };
        
        const quickTask = new PositionAnalysisTask(engine, quickConfig);
        const quickResult = await quickTask.analysePosition(startingPosition);
        
        console.log(`✓ Analysis completed`);
        console.log(`✓ Position (FEN): ${quickResult.fen}`);
        console.log(`✓ Depth reached: ${quickResult.depth}`);
        console.log(`✓ Selective depth: ${quickResult.selDepth}`);
        console.log(`✓ Evaluation: ${quickResult.score.type} ${quickResult.score.score}`);
        console.log(`✓ Best line: ${quickResult.pvs[0] || 'No moves'}`);
        console.log('\n✅ Quick analysis example completed successfully!');
        
    } catch (error) {
        console.error('❌ Quick analysis example failed:', error);
    } finally {
        await engine.disconnect();
    }
}

quickAnalysisExample();