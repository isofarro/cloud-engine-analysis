import { UciClient } from './UciClient';
import { UciAnalysisOptions, UciInfoPV, EngineStatus, EngineConfig } from './types';

export interface AnalysisConfig {
    depth?: number;
    time?: number; // seconds
    multiPV?: number;
}

export interface AnalysisResult {
    position: string; // FEN
    bestMove: string;
    evaluation: number; // centipawns or mate score
    depth: number;
    lines: AnalysisLine[];
    engineInfo: {
        time: number;
        nodes: number;
        nps: number;
    };
}

export interface AnalysisLine {
    moves: string[];
    evaluation: number;
    depth: number;
    multiPV: number;
}

export interface EngineInfo {
    name?: string;
    author?: string;
    version?: string;
    options: string[];
}

export abstract class ChessEngine {
    protected client: UciClient;
    protected _engineInfo?: EngineInfo;

    constructor(client: UciClient) {
        this.client = client;
    }

    // Connection management
    async connect(): Promise<void> {
        await this.client.connect();
        await this._loadEngineInfo();
    }

    async disconnect(): Promise<void> {
        await this.client.quit();
    }

    isConnected(): boolean {
        return this.client.isRunning();
    }

    getStatus(): EngineStatus {
        return this.client.getStatus();
    }

    // Engine information
    async getEngineInfo(): Promise<EngineInfo> {
        if (!this._engineInfo) {
            await this._loadEngineInfo();
        }
        return this._engineInfo!;
    }

    protected async _loadEngineInfo(): Promise<void> {
        const uciOptions = await this.client.getUciOptions();
        
        let name: string | undefined;
        let author: string | undefined;
        
        for (const line of uciOptions) {
            if (line.startsWith('id name ')) {
                name = line.substring(8);
            } else if (line.startsWith('id author ')) {
                author = line.substring(10);
            }
        }

        this._engineInfo = {
            name,
            author,
            options: uciOptions
        };
    }

    // Configuration
    setOption(name: string, value: string): void {
        this.client.setUciOption(name, value);
    }

    async configure(config: Partial<EngineConfig>): Promise<void> {
        for (const [key, value] of Object.entries(config)) {
            if (value !== undefined) {
                this.setOption(key, value.toString());
            }
        }
    }

    // Analysis methods
    async analyzePosition(fen: string, config: AnalysisConfig): Promise<AnalysisResult> {
        const options: UciAnalysisOptions = {
            position: fen,
            depth: config.depth,
            time: config.time,
            multiPV: config.multiPV
        };

        const results = await this.client.analyze(options);
        return this._formatAnalysisResult(fen, results);
    }

    async getBestMove(fen: string, depth?: number, time?: number): Promise<string> {
        const result = await this.analyzePosition(fen, { depth, time, multiPV: 1 });
        return result.bestMove;
    }

    async getMultiPVAnalysis(fen: string, lines: number, config: AnalysisConfig): Promise<AnalysisResult> {
        return this.analyzePosition(fen, { ...config, multiPV: lines });
    }

    // Utility methods
    protected _formatAnalysisResult(fen: string, uciResults: UciInfoPV[]): AnalysisResult {
        if (uciResults.length === 0) {
            throw new Error('No analysis results received');
        }

        // Get the best result (highest depth, multiPV 1)
        const bestResult = uciResults
            .filter(r => r.multiPV === 1)
            .sort((a, b) => b.depth - a.depth)[0];

        if (!bestResult) {
            throw new Error('No best move found in analysis results');
        }

        // Get all lines at the highest depth
        const maxDepth = Math.max(...uciResults.map(r => r.depth));
        const finalResults = uciResults.filter(r => r.depth === maxDepth);

        const lines: AnalysisLine[] = finalResults.map(result => ({
            moves: result.pv,
            evaluation: result.score.type === 'cp' ? result.score.score : 
                       result.score.type === 'mate' ? (result.score.score > 0 ? 30000 : -30000) : 0,
            depth: result.depth,
            multiPV: result.multiPV
        }));

        return {
            position: fen,
            bestMove: bestResult.pv[0] || '',
            evaluation: bestResult.score.type === 'cp' ? bestResult.score.score :
                       bestResult.score.type === 'mate' ? (bestResult.score.score > 0 ? 30000 : -30000) : 0,
            depth: bestResult.depth,
            lines,
            engineInfo: {
                time: bestResult.time,
                nodes: bestResult.nodes,
                nps: bestResult.nps
            }
        };
    }

    // Event handling
    on(event: string, listener: (...args: any[]) => void): void {
        this.client.on(event as any, listener);
    }

    off(event: string, listener: (...args: any[]) => void): void {
        this.client.off(event, listener);
    }

    // Health check
    async healthCheck(): Promise<boolean> {
        try {
            if (!this.isConnected()) {
                return false;
            }
            
            // Try a simple UCI command
            this.client.execute('isready');
            await this.client.waitFor('readyok', 5000);
            return true;
        } catch {
            return false;
        }
    }
}