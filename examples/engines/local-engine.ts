/**
 * Local Engine Example
 * 
 * This example demonstrates direct usage of a LocalChessEngine without the EngineService.
 * Useful for simple, single-engine scenarios.
 */

import { LocalChessEngine } from '../../src/core/engine';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load engine configuration from JSON file
function loadLocalEngineConfig() {
    const configPath = path.join(__dirname, '../../engine-config.json');
    
    if (!fs.existsSync(configPath)) {
        console.error('Engine configuration file not found!');
        console.error('Please copy engine-config.example.json to engine-config.json and configure your engines.');
        process.exit(1);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    const localEngine = config.engines.find((e: any) => e.type === 'local');
    if (!localEngine) {
        console.error('No local engine found in configuration!');
        console.error('Please add a local engine configuration to engine-config.json');
        process.exit(1);
    }
    
    return localEngine.config;
}

export async function localEngineExample() {
    console.log('=== Local Engine Example ===\n');
    
    const engineConfig = loadLocalEngineConfig();
    
    try {
        // Create a local engine directly with configuration from JSON
        const localEngine = new LocalChessEngine(engineConfig);

        await localEngine.connect();
        console.log('Connected to local engine');
        
        const engineInfo = await localEngine.getEngineInfo();
        console.log(`Engine: ${engineInfo.name}`);
        console.log(`Author: ${engineInfo.author}`);

        // Analyze a position after 1.e4
        const position = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
        console.log('\nAnalyzing position after 1.e4...');
        
        const result = await localEngine.analyzePosition(position, { 
            depth: 12,
            multiPV: 2
        });

        console.log('\nAnalysis Results:');
        console.log(`Best response to 1.e4: ${result.bestMove}`);
        console.log(`Evaluation: ${result.evaluation} centipawns`);
        console.log(`Depth reached: ${result.depth}`);
        
        if (result.lines.length > 1) {
            console.log('\nTop variations:');
            result.lines.forEach((line, index) => {
                console.log(`${index + 1}. ${line.moves.slice(0, 3).join(' ')} (${line.evaluation}cp)`);
            });
        }
        
        // Quick best move analysis
        console.log('\nQuick analysis (depth 8):');
        const quickMove = await localEngine.getBestMove(position, 8);
        console.log(`Quick best move: ${quickMove}`);
        
        // Test a tactical position
        const tacticalPosition = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4';
        console.log('\nAnalyzing tactical position (Italian Game):');
        
        const tacticalResult = await localEngine.analyzePosition(tacticalPosition, {
            time: 3, // 3 seconds
            multiPV: 3
        });
        
        console.log(`Best move: ${tacticalResult.bestMove}`);
        console.log(`Evaluation: ${tacticalResult.evaluation}cp`);
        
        await localEngine.disconnect();
        console.log('\nDisconnected from local engine');

    } catch (error) {
        console.error('Error in local engine example:', error);
        
        if (error.message.includes('ENOENT') || error.message.includes('not found')) {
            console.error('\nEngine binary not found. Common solutions:');
            console.error('1. Install Stockfish: brew install stockfish (macOS) or apt-get install stockfish (Ubuntu)');
            console.error('2. Update enginePath in engine-config.json to point to your engine binary');
            console.error('3. Use absolute path like "/usr/local/bin/stockfish"');
        }
    }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    localEngineExample().catch(console.error);
}