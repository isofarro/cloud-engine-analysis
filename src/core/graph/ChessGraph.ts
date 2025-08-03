import { FenString } from '../types';
import type { IChessGraph } from './iChessGraph';
import type { Move, PositionNodeMap } from './types';

export class ChessGraph implements IChessGraph {
  private _nodes: PositionNodeMap;
  private _rootPosition?: FenString;

  constructor(rootPosition?: FenString) {
    this._nodes = {};
    this._rootPosition = rootPosition;
  }

  get rootPosition(): FenString | undefined {
    return this._rootPosition;
  }

  set rootPosition(fen: FenString | undefined) {
    this._rootPosition = fen;
  }

  get nodes(): PositionNodeMap {
    return this._nodes;
  }

  addMove(fromFen: FenString, move: Move, isPrimaryMove: boolean = false) {
    if (fromFen in this._nodes) {
      const existingMoveIndex = this._nodes[fromFen].moves.findIndex(
        moveEdge => move.toFen === moveEdge.toFen
      );

      if (existingMoveIndex !== -1) {
        // Move already exists
        if (isPrimaryMove) {
          // Remove existing move and promote it to primary
          const existingMove = this._nodes[fromFen].moves.splice(
            existingMoveIndex,
            1
          )[0];

          // Reassign sequence numbers for all remaining moves
          this._nodes[fromFen].moves.forEach((moveEdge, index) => {
            moveEdge.seq = index + 2; // Start from 2 since promoted move will be 1
          });

          // Insert as first move with seq=1
          this._nodes[fromFen].moves.unshift({
            ...existingMove,
            seq: 1,
          });
        }
        // If not primary move and already exists, do nothing
      } else {
        // New move
        if (isPrimaryMove) {
          // Insert as first move with seq=1 and increment all other moves
          this._nodes[fromFen].moves.forEach(moveEdge => {
            moveEdge.seq += 1;
          });
          this._nodes[fromFen].moves.unshift({
            ...move,
            seq: 1,
          });
        } else {
          // Add as normal with next available seq
          this._nodes[fromFen].moves.push({
            ...move,
            seq: this._nodes[fromFen].moves.length + 1,
          });
        }
      }
    } else {
      this._nodes[fromFen] = {
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
    return this._nodes[fen];
  }
}
