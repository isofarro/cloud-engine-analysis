import { FenString } from '../../../types';
import { ChessGraph } from '../../../graph/ChessGraph';
import { Move, PositionNode } from '../../../graph/types';
import { IGraphService, GraphMove, AddMoveOptions, GraphPath } from './types';

export class GraphService implements IGraphService {
  private graph: ChessGraph;

  constructor(rootPosition?: FenString) {
    this.graph = new ChessGraph(rootPosition);
  }

  async addMove(
    fromPosition: FenString,
    move: GraphMove,
    options?: AddMoveOptions
  ): Promise<void> {
    const graphMove: Move = {
      move: move.move,
      toFen: move.toFen,
    };

    this.graph.addMove(fromPosition, graphMove, options?.isPrimary || false);
  }

  async getMoves(position: FenString): Promise<GraphMove[]> {
    const node = this.graph.nodes[position];
    if (!node) {
      return [];
    }

    return node.moves.map(moveEdge => ({
      move: moveEdge.move,
      toFen: moveEdge.toFen,
      metadata: {},
    }));
  }

  async getPrimaryVariation(
    position: FenString,
    maxDepth?: number
  ): Promise<GraphPath> {
    const positions: FenString[] = [position];
    const moves: GraphMove[] = [];
    let currentPosition = position;
    let depth = 0;

    while (currentPosition && (!maxDepth || depth < maxDepth)) {
      const node = this.graph.nodes[currentPosition];
      if (!node || node.moves.length === 0) {
        break;
      }

      // Get primary move (first move with seq=1, or first move if none)
      const primaryMove = node.moves.find(m => m.seq === 1) || node.moves[0];

      moves.push({
        move: primaryMove.move,
        toFen: primaryMove.toFen,
        metadata: {},
      });

      positions.push(primaryMove.toFen);
      currentPosition = primaryMove.toFen;
      depth++;
    }

    return {
      positions,
      moves,
      length: moves.length,
    };
  }

  async hasPosition(position: FenString): Promise<boolean> {
    return position in this.graph.nodes;
  }

  async save(): Promise<void> {
    // Implementation depends on persistence strategy
    // For now, this is a no-op as ChessGraph is in-memory
  }

  async getStats(): Promise<{
    totalPositions: number;
    totalMoves: number;
    maxDepth: number;
  }> {
    const nodes = this.graph.nodes;
    const totalPositions = Object.keys(nodes).length;
    let totalMoves = 0;
    let maxDepth = 0;

    // Calculate total moves and estimate max depth
    for (const [position, node] of Object.entries(nodes)) {
      totalMoves += node.moves.length;

      // Simple depth estimation based on position distance from root
      if (this.graph.rootPosition) {
        // This is a simplified depth calculation
        // In a real implementation, you'd traverse the graph properly
        const depth = this.estimateDepth(position);
        maxDepth = Math.max(maxDepth, depth);
      }
    }

    return {
      totalPositions,
      totalMoves,
      maxDepth,
    };
  }

  private estimateDepth(position: FenString): number {
    // Simplified depth estimation
    // In a real implementation, you'd traverse from root to this position
    return 0;
  }

  // Legacy methods for compatibility
  addNode(position: FenString, data?: any): void {
    if (!(position in this.graph.nodes)) {
      this.graph.nodes[position] = { moves: [] };
    }
  }

  addEdge(from: FenString, to: FenString, move: string): void {
    this.addMove(from, { move, toFen: to }).catch(console.error);
  }
}
