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
 * Comprehensive Analysis Example
 * Demonstrates all types of position analysis in sequence
 */
async function comprehensiveAnalysisExample() {
    console.log('🧪 Comprehensive Position Analysis Examples\n');
    
    // Load engine configuration from JSON file
    const configPath = path.join(__dirname, 'engine-config.json');
    const engineConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    let passedExamples = 0;
    let totalExamples = 0;
    
    // Example 1: Quick Analysis
    try {
        totalExamples++;
        console.log('1️⃣ Quick Analysis Example');
        console.log('   Position: Starting position');
        console.log('   Method: Fixed depth (10)\n');
        
        const engine1 = new LocalChessEngine(engineConfig);
        const startingPosition = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const quickConfig: AnalysisConfig = { depth: 10, multiPV: 1 };
        
        const quickTask = new PositionAnalysisTask(engine1, startingPosition, quickConfig);
        const quickResult = await quickTask.execute();
        
        await engine1.disconnect();
        
        console.log(`   ✓ Depth: ${quickResult.depth}`);
        console.log(`   ✓ Score: ${quickResult.score.type} ${quickResult.score.score}`);
        console.log(`   ✓ Best line: ${quickResult.pvs[0]?.join(' ')}`);
        console.log('   ✅ Quick Analysis completed\n');
        passedExamples++;
        
    } catch (error) {
        console.log('   ❌ Quick Analysis failed:', error);
    }
    
    // Example 2: Multi-PV Analysis
    try {
        totalExamples++;
        console.log('2️⃣ Multi-PV Analysis Example');
        console.log('   Position: Sicilian Defense');
        console.log('   Method: 3 principal variations\n');
        
        const engine2 = new LocalChessEngine(engineConfig);
        const sicilianPosition = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
        const multiPVConfig: AnalysisConfig = { depth: 12, multiPV: 3 };
        
        const multiPVTask = new PositionAnalysisTask(engine2, sicilianPosition, multiPVConfig);
        const multiPVResult = await multiPVTask.execute();
        
        await engine2.disconnect();
        
        console.log(`   ✓ Analyzed ${multiPVResult.multiPV} variations`);
        multiPVResult.pvs.forEach((pv, index) => {
            console.log(`   ✓ Line ${index + 1}: ${pv.slice(0, 5).join(' ')}...`);
        });
        console.log('   ✅ Multi-PV Analysis completed\n');
        passedExamples++;
        
    } catch (error) {
        console.log('   ❌ Multi-PV Analysis failed:', error);
    }
    
    // Example 3: Time-based Analysis
    try {
        totalExamples++;
        console.log('3️⃣ Time-based Analysis Example');
        console.log('   Position: Sicilian Defense');
        console.log('   Method: 3-second time limit\n');
        
        const engine3 = new LocalChessEngine(engineConfig);
        const sicilianPosition = 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq c6 0 2';
        const timeConfig: AnalysisConfig = { time: 3, multiPV: 2 };
        
        const startTime = Date.now();
        const timeTask = new PositionAnalysisTask(engine3, sicilianPosition, timeConfig);
        const timeResult = await timeTask.execute();
        const endTime = Date.now();
        
        await engine3.disconnect();
        
        const actualTime = (endTime - startTime) / 1000;
        console.log(`   ✓ Completed in ${actualTime.toFixed(1)} seconds`);
        console.log(`   ✓ Reached depth ${timeResult.depth}`);
        console.log(`   ✓ Found ${timeResult.pvs.length} variations`);
        console.log('   ✅ Time-based Analysis completed\n');
        passedExamples++;
        
    } catch (error) {
        console.log('   ❌ Time-based Analysis failed:', error);
    }
    
    // Example 4: Tactical Analysis
    try {
        totalExamples++;
        console.log('4️⃣ Tactical Analysis Example');
        console.log('   Position: Légal\'s Mate setup');
        console.log('   Method: Deep tactical search\n');
        
        const engine4 = new LocalChessEngine(engineConfig);
        const tacticalPosition = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
        const tacticalConfig: AnalysisConfig = { depth: 12, multiPV: 1 };
        
        const tacticalTask = new PositionAnalysisTask(engine4, tacticalPosition, tacticalConfig);
        const tacticalResult = await tacticalTask.execute();
        
        await engine4.disconnect();
        
        if (tacticalResult.score.type === 'mate') {
            console.log(`   ✓ Found mate in ${Math.abs(tacticalResult.score.score)} moves`);
        } else {
            console.log(`   ✓ Evaluation: ${tacticalResult.score.score} centipawns`);
        }
        console.log(`   ✓ Best move: ${tacticalResult.pvs[0]?.[0] || 'None'}`);
        console.log('   ✅ Tactical Analysis completed\n');
        passedExamples++;
        
    } catch (error) {
        console.log('   ❌ Tactical Analysis failed:', error);
    }
    
    // Summary
    console.log('📊 Analysis Summary:');
    console.log(`   Completed: ${passedExamples}/${totalExamples} examples`);
    
    if (passedExamples === totalExamples) {
        console.log('   🎉 All analysis examples completed successfully!');
    } else {
        console.log(`   ⚠️  ${totalExamples - passedExamples} example(s) failed.`);
    }
}

comprehensiveAnalysisExample();