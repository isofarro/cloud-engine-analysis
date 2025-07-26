export type UciScore = {
    type: 'cp' | 'mate';
    score: number;
};

export type UciMove = string;

export type UciOutputType = {
    type: 'pv' | 'currmove' | 'bestmove' | 'string';
};

export type UciInfoEngine = {
    time: number;
    nodes: number;
    nps: number;
    tbhits: number;
    hashfull: number;
};

export type UciInfoPV = UciOutputType & UciInfoEngine & {
    depth: number;
    selDepth: number;
    multiPV: number;
    score: UciScore;
    pv: UciMove[];
};

export type UciInfoCurrMove = UciOutputType & {
    depth: number;
    currMove: UciMove;
    currMoveNumber: number;
};

export type UciInfo = UciInfoPV | UciInfoCurrMove;

export type UciBestMove = UciOutputType & {
    bestMove: UciMove;
    ponder?: UciMove;
};

export type UciInfoString = UciOutputType & {
    text: string;
};

export type UciOutput = UciInfo | UciBestMove | UciInfoString;

export type EngineConfig = {
    threads: number;
    hash: number;
    [key: string]: string | number;
};

export type UciCommand = string;
export type UciCommandOptions = string[];

export type UciAnalysisOptions = {
    position: string; // FEN string
    time?: number; // seconds
    depth?: number;
    multiPV?: number;
};

export type RemoteEngineConfig = {
    host: string;
    enginePath: string;
    config?: Partial<EngineConfig>;
};

export type LocalEngineConfig = {
    enginePath: string;
    config?: Partial<EngineConfig>;
};

export type EngineStatus = 'idle' | 'analyzing' | 'error' | 'disconnected';

export interface EngineEvents {
    'line': (line: string) => void;
    'info': (info: UciInfo) => void;
    'bestmove': (bestmove: UciBestMove) => void;
    'ready': () => void;
    'error': (error: Error) => void;
    'disconnect': () => void;
}