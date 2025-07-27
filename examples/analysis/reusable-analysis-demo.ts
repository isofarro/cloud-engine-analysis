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
 * Example: Reusable Analysis Task
 * Demonstrates how the same PositionAnalysisTask instance can analyze multiple positions
 */
async function reusableAnalysisDemo() {
    // Load engine configuration from JSON file
    const configPath = path.join(__dirname, 'engine-config.json');
    const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    const engine = new LocalChessEngine(engineConfig);
    
    try {
        console.log('=== Reusable Analysis Task Demo ===');
        console.log('Demonstrating analysis of multiple positions with the same task instance\n');
        
        const config: AnalysisConfig = {
            depth: 8,
            multiPV: 1
        };
        
        // Create a single task instance
        const analysisTask = new PositionAnalysisTask(engine, config);
        
        // Test positions
        const positions = [
            {
                name: 'Starting Position',
                fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
            },
            {
                name: 'Sicilian Defense',
                fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2'
            },
            {
                name: 'French Defense',
                fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2'
            }
        ];
        
        // Analyze each position with the same task instance
        for (let i = 0; i < positions.length; i++) {
            const position = positions[i];
            console.log(`${i + 1}️⃣ Analyzing: ${position.name}`);
            
            const result = await analysisTask.analysePosition(position.fen);
            
            console.log(`   ✓ Depth: ${result.depth}`);
            console.log(`   ✓ Score: ${result.score.type} ${result.score.score}`);
            console.log(`   ✓ Best line: ${result.pvs[0]?.split(' ').slice(0, 4).join(' ')}...`);
            console.log('');
        }
        
        console.log('✅ Successfully analyzed multiple positions with the same task instance!');
        console.log('🔄 This demonstrates the reusable nature of the new interface.');
        
    } catch (error) {
        console.error('❌ Reusable analysis demo failed:', error);
    } finally {
        await engine.disconnect();
    }
}

reusableAnalysisDemo();