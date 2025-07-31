import { AnalysisResult } from '../engine/types';
import { ChessGraph } from '../graph/ChessGraph';
import { Chess } from 'chess.ts';

/**
 * In-memory analysis store for demonstration and testing purposes.
 * Provides a simple interface for storing position and move analysis data.
 */
export interface AnalysisStore {
  positions: Record<string, any>;
  moves: Record<string, any>;
}

/**
 * Creates a new empty analysis store.
 */
export function createAnalysisStore(): AnalysisStore {
  return {
    positions: {},
    moves: {},
  };
}
