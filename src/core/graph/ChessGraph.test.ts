import { describe, it, expect, beforeEach } from 'vitest';
import { ChessGraph } from './ChessGraph';
import type { Move } from './types';

describe('ChessGraph', () => {
  let graph: ChessGraph;
  const startingFen =
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const afterE4Fen =
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  const afterE4E5Fen =
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

  beforeEach(() => {
    graph = new ChessGraph();
  });

  describe('addMove', () => {
    it('should add a move to a new position', () => {
      const move: Move = {
        move: 'e2e4',
        toFen: afterE4Fen,
      };

      graph.addMove(startingFen, move);

      const position = graph.findPosition(startingFen);
      expect(position).toBeDefined();
      expect(position!.moves).toHaveLength(1);
      expect(position!.moves[0].move).toBe('e2e4');
      expect(position!.moves[0].toFen).toBe(afterE4Fen);
      expect(position!.moves[0].seq).toBe(1);
    });

    it('should add multiple moves to the same position', () => {
      const move1: Move = {
        move: 'e2e4',
        toFen: afterE4Fen,
      };
      const move2: Move = {
        move: 'd2d4',
        toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      };
      const move3: Move = {
        move: 'g1f3',
        toFen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
      };

      graph.addMove(startingFen, move1);
      graph.addMove(startingFen, move2);
      graph.addMove(startingFen, move3);

      const position = graph.findPosition(startingFen);
      expect(position).toBeDefined();
      expect(position!.moves).toHaveLength(3);

      // Check sequence numbers
      expect(position!.moves[0].seq).toBe(1);
      expect(position!.moves[1].seq).toBe(2);
      expect(position!.moves[2].seq).toBe(3);

      // Check moves are in order added
      expect(position!.moves[0].move).toBe('e2e4');
      expect(position!.moves[1].move).toBe('d2d4');
      expect(position!.moves[2].move).toBe('g1f3');
    });

    it('should not add duplicate moves to the same position', () => {
      const move: Move = {
        move: 'e2e4',
        toFen: afterE4Fen,
      };

      graph.addMove(startingFen, move);
      graph.addMove(startingFen, move); // Add same move again

      const position = graph.findPosition(startingFen);
      expect(position).toBeDefined();
      expect(position!.moves).toHaveLength(1);
    });

    it('should return the graph instance for method chaining', () => {
      const move: Move = {
        move: 'e2e4',
        toFen: afterE4Fen,
      };

      const result = graph.addMove(startingFen, move);
      expect(result).toBe(graph);
    });
  });

  describe('isPrimaryMove functionality', () => {
    it('should add move normally when isPrimaryMove is false (default)', () => {
      const move1: Move = {
        move: 'e2e4',
        toFen: afterE4Fen,
      };
      const move2: Move = {
        move: 'd2d4',
        toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      };

      graph.addMove(startingFen, move1, false);
      graph.addMove(startingFen, move2, false);

      const position = graph.findPosition(startingFen);
      expect(position!.moves).toHaveLength(2);
      expect(position!.moves[0].move).toBe('e2e4');
      expect(position!.moves[0].seq).toBe(1);
      expect(position!.moves[1].move).toBe('d2d4');
      expect(position!.moves[1].seq).toBe(2);
    });

    it('should insert move as first when isPrimaryMove is true', () => {
      const move1: Move = {
        move: 'e2e4',
        toFen: afterE4Fen,
      };
      const move2: Move = {
        move: 'd2d4',
        toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      };
      const primaryMove: Move = {
        move: 'g1f3',
        toFen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
      };

      // Add two normal moves first
      graph.addMove(startingFen, move1);
      graph.addMove(startingFen, move2);

      // Add primary move - should become first
      graph.addMove(startingFen, primaryMove, true);

      const position = graph.findPosition(startingFen);
      expect(position!.moves).toHaveLength(3);

      // Primary move should be first with seq=1
      expect(position!.moves[0].move).toBe('g1f3');
      expect(position!.moves[0].seq).toBe(1);

      // Other moves should have incremented sequences
      expect(position!.moves[1].move).toBe('e2e4');
      expect(position!.moves[1].seq).toBe(2);
      expect(position!.moves[2].move).toBe('d2d4');
      expect(position!.moves[2].seq).toBe(3);
    });

    it('should handle multiple primary move promotions correctly', () => {
      const move1: Move = {
        move: 'e2e4',
        toFen: afterE4Fen,
      };
      const move2: Move = {
        move: 'd2d4',
        toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      };
      const primaryMove1: Move = {
        move: 'g1f3',
        toFen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
      };
      const primaryMove2: Move = {
        move: 'c2c4',
        toFen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 1',
      };

      // Add normal moves
      graph.addMove(startingFen, move1);
      graph.addMove(startingFen, move2);

      // Add first primary move
      graph.addMove(startingFen, primaryMove1, true);

      // Add second primary move - should become new first
      graph.addMove(startingFen, primaryMove2, true);

      const position = graph.findPosition(startingFen);
      expect(position!.moves).toHaveLength(4);

      // Latest primary move should be first
      expect(position!.moves[0].move).toBe('c2c4');
      expect(position!.moves[0].seq).toBe(1);

      // Previous primary move should be second
      expect(position!.moves[1].move).toBe('g1f3');
      expect(position!.moves[1].seq).toBe(2);

      // Original moves should be pushed further back
      expect(position!.moves[2].move).toBe('e2e4');
      expect(position!.moves[2].seq).toBe(3);
      expect(position!.moves[3].move).toBe('d2d4');
      expect(position!.moves[3].seq).toBe(4);
    });

    it('should not affect other positions when promoting moves', () => {
      const move1: Move = {
        move: 'e7e5',
        toFen: afterE4E5Fen,
      };
      const move2: Move = {
        move: 'd7d6',
        toFen: 'rnbqkbnr/ppp1pppp/3p4/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      };
      const primaryMove: Move = {
        move: 'g1f3',
        toFen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
      };

      // Add moves to different positions
      graph.addMove(afterE4Fen, move1);
      graph.addMove(afterE4Fen, move2);
      graph.addMove(startingFen, primaryMove, true);

      // Check that afterE4Fen position is unaffected
      const afterE4Position = graph.findPosition(afterE4Fen);
      expect(afterE4Position!.moves).toHaveLength(2);
      expect(afterE4Position!.moves[0].move).toBe('e7e5');
      expect(afterE4Position!.moves[0].seq).toBe(1);
      expect(afterE4Position!.moves[1].move).toBe('d7d6');
      expect(afterE4Position!.moves[1].seq).toBe(2);

      // Check that startingFen position has the primary move
      const startingPosition = graph.findPosition(startingFen);
      expect(startingPosition!.moves).toHaveLength(1);
      expect(startingPosition!.moves[0].move).toBe('g1f3');
      expect(startingPosition!.moves[0].seq).toBe(1);
    });
  });

  describe('findPosition', () => {
    it('should return undefined for non-existent position', () => {
      const position = graph.findPosition(startingFen);
      expect(position).toBeUndefined();
    });

    it('should return position after adding moves', () => {
      const move: Move = {
        move: 'e2e4',
        toFen: afterE4Fen,
      };

      graph.addMove(startingFen, move);
      const position = graph.findPosition(startingFen);

      expect(position).toBeDefined();
      expect(position!.moves).toHaveLength(1);
      expect(position!.moves[0].move).toBe('e2e4');
    });

    it('should return correct position with multiple moves', () => {
      const moves: Move[] = [
        { move: 'e2e4', toFen: afterE4Fen },
        {
          move: 'd2d4',
          toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
        },
        {
          move: 'g1f3',
          toFen: 'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R b KQkq - 1 1',
        },
      ];

      moves.forEach(move => graph.addMove(startingFen, move));

      const position = graph.findPosition(startingFen);
      expect(position).toBeDefined();
      expect(position!.moves).toHaveLength(3);

      // Verify all moves are present and in correct order
      moves.forEach((expectedMove, index) => {
        expect(position!.moves[index].move).toBe(expectedMove.move);
        expect(position!.moves[index].toFen).toBe(expectedMove.toFen);
        expect(position!.moves[index].seq).toBe(index + 1);
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complex move sequences with primary move promotions', () => {
      // Simulate a real chess analysis scenario
      const moves = [
        { move: 'e2e4', toFen: afterE4Fen },
        {
          move: 'd2d4',
          toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
        },
        {
          move: 'c2c4',
          toFen: 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq c3 0 1',
        },
      ];

      // Add moves normally
      moves.forEach(move => graph.addMove(startingFen, move));

      // Promote d2d4 to primary (engine found it's best)
      graph.addMove(startingFen, moves[1], true);

      const position = graph.findPosition(startingFen);
      expect(position!.moves).toHaveLength(3);

      // d2d4 should now be first (main line)
      expect(position!.moves[0].move).toBe('d2d4');
      expect(position!.moves[0].seq).toBe(1);

      // Other moves should follow
      expect(position!.moves[1].move).toBe('e2e4');
      expect(position!.moves[1].seq).toBe(2);
      expect(position!.moves[2].move).toBe('c2c4');
      expect(position!.moves[2].seq).toBe(3);
    });

    it('should maintain separate move lists for different positions', () => {
      const startingMoves = [
        { move: 'e2e4', toFen: afterE4Fen },
        {
          move: 'd2d4',
          toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
        },
      ];

      const afterE4Moves = [
        { move: 'e7e5', toFen: afterE4E5Fen },
        {
          move: 'd7d6',
          toFen:
            'rnbqkbnr/ppp1pppp/3p4/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        },
      ];

      // Add moves to starting position
      startingMoves.forEach(move => graph.addMove(startingFen, move));

      // Add moves to position after e4
      afterE4Moves.forEach(move => graph.addMove(afterE4Fen, move));

      // Promote moves in different positions
      graph.addMove(startingFen, startingMoves[1], true); // d2d4 becomes primary
      graph.addMove(afterE4Fen, afterE4Moves[1], true); // d7d6 becomes primary

      // Check starting position
      const startingPosition = graph.findPosition(startingFen);
      expect(startingPosition!.moves).toHaveLength(2);
      expect(startingPosition!.moves[0].move).toBe('d2d4'); // Primary
      expect(startingPosition!.moves[1].move).toBe('e2e4');

      // Check after e4 position
      const afterE4Position = graph.findPosition(afterE4Fen);
      expect(afterE4Position!.moves).toHaveLength(2);
      expect(afterE4Position!.moves[0].move).toBe('d7d6'); // Primary
      expect(afterE4Position!.moves[1].move).toBe('e7e5');
    });
  });
});
