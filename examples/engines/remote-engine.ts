/**
 * Remote Engine Example
 * 
 * This example demonstrates how to connect to and use a remote chess engine
 * over SSH with connection testing and error handling.
 */

import { RemoteChessEngine } from '../../src/core/engine';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load engine configuration from JSON file
function loadRemoteEngineConfig() {
    const configPath = path.join(__dirname, '../../engine-config.json');
    
    if (!fs.existsSync(configPath)) {
        console.error('Engine configuration file not found!');
        console.error('Please copy engine-config.example.json to engine-config.json and configure your engines.');
        process.exit(1);
    }
    
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    const remoteEngine = config.engines.find((e: any) => e.type === 'remote');
    if (!remoteEngine) {
        console.error('No remote engine found in configuration!');
        console.error('Please add a remote engine configuration to engine-config.json');
        process.exit(1);
    }
    
    return remoteEngine.config;
}

export async function remoteEngineExample() {
    console.log('=== Remote Engine Example ===\n');
    
    const engineConfig = loadRemoteEngineConfig();
    
    try {
        const remoteEngine = new RemoteChessEngine(engineConfig);
        
        console.log(`Attempting to connect to: ${remoteEngine.getHost()}`);
        
        // Test connection first
        console.log('Testing SSH connection...');
        const canConnect = await remoteEngine.testConnection();
        if (!canConnect) {
            console.error('Cannot establish SSH connection to remote server');
            console.error('\nTroubleshooting tips:');
            console.error('1. Check if the host is reachable: ssh user@host');
            console.error('2. Verify SSH key authentication is set up');
            console.error('3. Ensure the remote engine path is correct');
            console.error('4. Check firewall settings');
            return;
        }
        console.log('SSH connection test successful!');

        // Configure reconnection settings for reliability
        remoteEngine.setMaxConnectionAttempts(5);
        remoteEngine.setReconnectDelay(3000);

        await remoteEngine.connect();
        console.log(`Connected to remote engine on ${remoteEngine.getHost()}`);
        
        const engineInfo = await remoteEngine.getEngineInfo();
        console.log(`Remote engine: ${engineInfo.name}`);
        console.log(`Author: ${engineInfo.author}`);

        // Analyze a complex middlegame position
        const complexPosition = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 4 4';
        console.log('\nAnalyzing complex middlegame position...');
        
        const analysis = await remoteEngine.analyzePosition(complexPosition, { 
            time: 5, // 5 seconds for thorough analysis
            multiPV: 5 // Get top 5 moves
        });

        console.log('\nRemote Analysis Results:');
        console.log(`Best move: ${analysis.bestMove}`);
        console.log(`Evaluation: ${analysis.evaluation} centipawns`);
        console.log(`Analysis time: ${analysis.engineInfo.time}ms`);
        console.log(`Nodes searched: ${analysis.engineInfo.nodes?.toLocaleString() || 'N/A'}`);
        
        console.log('\nTop variations:');
        analysis.lines.forEach((line, index) => {
            const moveSequence = line.moves.slice(0, 4).join(' ');
            console.log(`${index + 1}. ${moveSequence} (${line.evaluation}cp)`);
        });
        
        // Test engine health and performance
        console.log('\nTesting engine health...');
        const isHealthy = await remoteEngine.healthCheck();
        console.log(`Engine health: ${isHealthy ? 'OK' : 'FAILED'}`);
        
        // Quick tactical test
        const tacticalPosition = 'r1bqr1k1/ppp2ppp/2n2n2/2bpp3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 8';
        console.log('\nQuick tactical analysis...');
        
        const quickResult = await remoteEngine.getBestMove(tacticalPosition, 10);
        console.log(`Quick best move: ${quickResult}`);
        
        // Performance comparison
        console.log('\nPerformance test (depth 12):');
        const startTime = Date.now();
        const perfResult = await remoteEngine.analyzePosition(
            'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            { depth: 12 }
        );
        const endTime = Date.now();
        
        console.log(`Analysis completed in ${endTime - startTime}ms`);
        console.log(`Best move: ${perfResult.bestMove}`);
        console.log(`Nodes per second: ${perfResult.engineInfo.nps?.toLocaleString() || 'N/A'}`);
        
        await remoteEngine.disconnect();
        console.log('\nDisconnected from remote engine');

    } catch (error) {
        console.error('Error in remote engine example:', error);
        
        if (error.message.includes('Connection refused') || error.message.includes('ECONNREFUSED')) {
            console.error('\nConnection refused. Check:');
            console.error('1. Remote server is running and accessible');
            console.error('2. SSH service is running on the remote server');
            console.error('3. Firewall allows SSH connections');
        } else if (error.message.includes('Authentication failed')) {
            console.error('\nAuthentication failed. Check:');
            console.error('1. SSH key is properly configured');
            console.error('2. Username is correct');
            console.error('3. SSH agent is running with your key loaded');
        } else if (error.message.includes('Host key verification failed')) {
            console.error('\nHost key verification failed. Try:');
            console.error('1. ssh-keyscan -H hostname >> ~/.ssh/known_hosts');
            console.error('2. Or connect manually first: ssh user@hostname');
        }
    }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    remoteEngineExample().catch(console.error);
}