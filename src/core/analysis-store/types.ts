import { FenString } from '../types';

// Engine types
export interface Engine {
  id: number;
  slug: string;
  name: string;
  version: string;
}

export interface CreateEngineData {
  slug: string;
  name: string;
  version: string;
}

// Position types
export interface Position {
  id: number;
  fen: FenString;
}

export interface CreatePositionData {
  fen: FenString;
}

// Analysis types
export type ScoreType = 'cp' | 'mate';

export interface Analysis {
  id: number;
  position_id: number;
  engine_id: number;
  depth: number;
  time: number;
  nodes: number;
  nps: number;
  score_type: ScoreType;
  score: number;
  pv: string;
}

export interface CreateAnalysisData {
  position_id: number;
  engine_id: number;
  depth: number;
  time: number;
  nodes: number;
  nps: number;
  score_type: ScoreType;
  score: number;
  pv: string;
}

// Query types for performance
export interface AnalysisQuery {
  fen?: FenString;
  engine_slug?: string;
  min_depth?: number;
  max_depth?: number;
  limit?: number;
  offset?: number;
}

export interface AnalysisWithDetails extends Analysis {
  position_fen: FenString;
  engine_slug: string;
  engine_name: string;
  engine_version: string;
  created_at: string;
  updated_at: string;
}
