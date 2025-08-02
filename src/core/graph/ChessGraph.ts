import { FenString } from '../types';
import type { IChessGraph } from './iChessGraph';
import type { Move, PositionNodeMap } from './types';

export class ChessGraph implements IChessGraph {
  nodes: PositionNodeMap;

  constructor() {
    this.nodes = {};
  }

  addMove(fromFen: FenString, move: Move, isPrimaryMove: boolean = false) {
    if (fromFen in this.nodes) {
      const existingMoveIndex = this.nodes[fromFen].moves.findIndex(
        moveEdge => move.toFen === moveEdge.toFen
      );

      if (existingMoveIndex !== -1) {
        // Move already exists
        if (isPrimaryMove) {
          // Remove existing move and promote it to primary
          const existingMove = this.nodes[fromFen].moves.splice(
            existingMoveIndex,
            1
          )[0];

          // Reassign sequence numbers for all remaining moves
          this.nodes[fromFen].moves.forEach((moveEdge, index) => {
            moveEdge.seq = index + 2; // Start from 2 since promoted move will be 1
          });

          // Insert as first move with seq=1
          this.nodes[fromFen].moves.unshift({
            ...existingMove,
            seq: 1,
          });
        }
        // If not primary move and already exists, do nothing
      } else {
        // New move
        if (isPrimaryMove) {
          // Insert as first move with seq=1 and increment all other moves
          this.nodes[fromFen].moves.forEach(moveEdge => {
            moveEdge.seq += 1;
          });
          this.nodes[fromFen].moves.unshift({
            ...move,
            seq: 1,
          });
        } else {
          // Add as normal with next available seq
          this.nodes[fromFen].moves.push({
            ...move,
            seq: this.nodes[fromFen].moves.length + 1,
          });
        }
      }
    } else {
      this.nodes[fromFen] = {
        moves: [
          {
            ...move,
            seq: 1,
          },
        ],
      };
    }
    return this;
  }

  findPosition(fen: FenString) {
    return this.nodes[fen];
  }
}
