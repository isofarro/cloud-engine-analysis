/**
 * Chess Engine Examples Index
 * 
 * This file provides easy access to all engine examples.
 * Run individual examples or all of them together.
 */

import { engineServiceExample } from './engine-service';
import { localEngineExample } from './local-engine';
import { remoteEngineExample } from './remote-engine';

/**
 * Run all examples in sequence
 */
export async function runAllExamples() {
    console.log('🚀 Running all Chess Engine examples...\n');
    
    try {
        // Run Engine Service example
        await engineServiceExample();
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Run Local Engine example
        await localEngineExample();
        console.log('\n' + '='.repeat(50) + '\n');
        
        // Run Remote Engine example (if configured)
        console.log('Note: Remote engine example requires proper SSH configuration');
        console.log('Skipping remote engine example. Run it separately if needed.\n');
        // await remoteEngineExample();
        
        console.log('✅ All examples completed successfully!');
        
    } catch (error) {
        console.error('❌ Error running examples:', error);
        process.exit(1);
    }
}

/**
 * Run a specific example by name
 */
export async function runExample(exampleName: string) {
    switch (exampleName.toLowerCase()) {
        case 'service':
        case 'engine-service':
            await engineServiceExample();
            break;
            
        case 'local':
        case 'local-engine':
            await localEngineExample();
            break;
            
        case 'remote':
        case 'remote-engine':
            await remoteEngineExample();
            break;
            
        default:
            console.error(`Unknown example: ${exampleName}`);
            console.log('Available examples: service, local, remote');
            process.exit(1);
    }
}

// Export individual examples
export {
    engineServiceExample,
    localEngineExample,
    remoteEngineExample
};

// CLI interface when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Chess Engine Examples');
        console.log('Usage:');
        console.log('  npm run examples              # Run safe examples (service + local)');
        console.log('  npm run examples all          # Run all examples');
        console.log('  npm run examples service      # Run engine service example');
        console.log('  npm run examples local        # Run local engine example');
        console.log('  npm run examples remote       # Run remote engine example');
        console.log('');
        console.log('Make sure to configure engine-config.json before running examples.');
        process.exit(0);
    }
    
    const command = args[0].toLowerCase();
    
    if (command === 'all') {
        runAllExamples().catch(console.error);
    } else {
        runExample(command).catch(console.error);
    }
}