import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ChessGraph } from '../graph/ChessGraph';
import {
  saveGraph,
  loadGraph,
  listGraphFiles,
  deleteGraph,
  printGraph,
} from './graph';

const TEST_DIR = './test-graphs';

describe('Graph Utils', () => {
  beforeEach(() => {
    // Clean up test directory before each test
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('saveGraph', () => {
    it('should save an empty graph', () => {
      const graph = new ChessGraph();
      const filePath = saveGraph(graph, 'empty-graph.json', TEST_DIR);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath).toBe(path.join(TEST_DIR, 'empty-graph.json'));

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content).toEqual({
        rootPosition: undefined,
        nodes: {},
      });
    });

    it('should save a graph with root position', () => {
      const rootFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const graph = new ChessGraph(rootFen);
      const filePath = saveGraph(graph, 'root-graph.json', TEST_DIR);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.rootPosition).toBe(rootFen);
    });

    it('should save a graph with moves', () => {
      const startFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const afterE4Fen =
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

      const graph = new ChessGraph(startFen);
      graph.addMove(startFen, { move: 'e2e4', toFen: afterE4Fen }, true);

      const filePath = saveGraph(graph, 'moves-graph.json', TEST_DIR);
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

      expect(content.nodes[startFen]).toEqual({
        moves: [
          {
            move: 'e2e4',
            toFen: afterE4Fen,
            seq: 1,
          },
        ],
      });
    });

    it('should generate filename when not provided', () => {
      const graph = new ChessGraph();
      const filePath = saveGraph(graph, undefined, TEST_DIR);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath).toMatch(new RegExp(`^${TEST_DIR.replace('./', '')}`));
      expect(path.basename(filePath)).toMatch(/^chess-graph-.*\.json$/);
    });

    it('should add .json extension if missing', () => {
      const graph = new ChessGraph();
      const filePath = saveGraph(graph, 'test-graph', TEST_DIR);

      expect(filePath).toBe(path.join(TEST_DIR, 'test-graph.json'));
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should create directory if it does not exist', () => {
      const graph = new ChessGraph();
      const newDir = './new-test-dir';

      try {
        const filePath = saveGraph(graph, 'test.json', newDir);
        expect(fs.existsSync(newDir)).toBe(true);
        expect(fs.existsSync(filePath)).toBe(true);
      } finally {
        if (fs.existsSync(newDir)) {
          fs.rmSync(newDir, { recursive: true, force: true });
        }
      }
    });
  });

  describe('loadGraph', () => {
    it('should load an empty graph', () => {
      const originalGraph = new ChessGraph();
      const filePath = saveGraph(originalGraph, 'empty.json', TEST_DIR);

      const loadedGraph = loadGraph(filePath);

      expect(loadedGraph.rootPosition).toBeUndefined();
      expect(loadedGraph.nodes).toEqual({});
    });

    it('should load a graph with root position', () => {
      const rootFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const originalGraph = new ChessGraph(rootFen);
      const filePath = saveGraph(originalGraph, 'root.json', TEST_DIR);

      const loadedGraph = loadGraph(filePath);

      expect(loadedGraph.rootPosition).toBe(rootFen);
    });

    it('should load a graph with moves and preserve structure', () => {
      const startFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const afterE4Fen =
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
      const afterE5Fen =
        'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

      const originalGraph = new ChessGraph(startFen);
      originalGraph.addMove(
        startFen,
        { move: 'e2e4', toFen: afterE4Fen },
        true
      );
      originalGraph.addMove(startFen, {
        move: 'd2d4',
        toFen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
      });
      originalGraph.addMove(afterE4Fen, { move: 'e7e5', toFen: afterE5Fen });

      const filePath = saveGraph(originalGraph, 'complex.json', TEST_DIR);
      const loadedGraph = loadGraph(filePath);

      // Check root position
      expect(loadedGraph.rootPosition).toBe(startFen);

      // Check moves from start position
      const startNode = loadedGraph.findPosition(startFen);
      expect(startNode?.moves).toHaveLength(2);
      expect(startNode?.moves[0].move).toBe('e2e4'); // Primary move should be first
      expect(startNode?.moves[0].seq).toBe(1);
      expect(startNode?.moves[1].move).toBe('d2d4');
      expect(startNode?.moves[1].seq).toBe(2);

      // Check moves from after e4 position
      const afterE4Node = loadedGraph.findPosition(afterE4Fen);
      expect(afterE4Node?.moves).toHaveLength(1);
      expect(afterE4Node?.moves[0].move).toBe('e7e5');
    });

    it('should throw error for non-existent file', () => {
      expect(() => loadGraph('./non-existent-file.json')).toThrow(
        'Graph file not found'
      );
    });

    it('should throw error for invalid JSON', () => {
      const invalidJsonFile = path.join(TEST_DIR, 'invalid.json');
      fs.mkdirSync(TEST_DIR, { recursive: true });
      fs.writeFileSync(invalidJsonFile, 'invalid json content', 'utf-8');

      expect(() => loadGraph(invalidJsonFile)).toThrow(
        'Invalid JSON in graph file'
      );
    });

    it('should throw error for invalid graph structure', () => {
      const invalidStructureFile = path.join(
        TEST_DIR,
        'invalid-structure.json'
      );
      fs.mkdirSync(TEST_DIR, { recursive: true });
      fs.writeFileSync(
        invalidStructureFile,
        JSON.stringify('not an object'),
        'utf-8'
      );

      expect(() => loadGraph(invalidStructureFile)).toThrow(
        'Invalid graph file: root must be an object'
      );
    });
  });

  describe('listGraphFiles', () => {
    it('should return empty array for non-existent directory', () => {
      const files = listGraphFiles('./non-existent-dir');
      expect(files).toEqual([]);
    });

    it('should list JSON files in directory', () => {
      fs.mkdirSync(TEST_DIR, { recursive: true });
      fs.writeFileSync(path.join(TEST_DIR, 'graph1.json'), '{}');
      fs.writeFileSync(path.join(TEST_DIR, 'graph2.json'), '{}');
      fs.writeFileSync(path.join(TEST_DIR, 'not-graph.txt'), 'text');

      const files = listGraphFiles(TEST_DIR);

      expect(files).toHaveLength(2);
      expect(files).toContain(path.join(TEST_DIR, 'graph1.json'));
      expect(files).toContain(path.join(TEST_DIR, 'graph2.json'));
      expect(files).not.toContain(path.join(TEST_DIR, 'not-graph.txt'));
    });
  });

  describe('deleteGraph', () => {
    it('should delete existing file and return true', () => {
      const graph = new ChessGraph();
      const filePath = saveGraph(graph, 'to-delete.json', TEST_DIR);

      expect(fs.existsSync(filePath)).toBe(true);

      const result = deleteGraph(filePath);

      expect(result).toBe(true);
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('should return false for non-existent file', () => {
      const result = deleteGraph('./non-existent-file.json');
      expect(result).toBe(false);
    });
  });

  describe('round-trip consistency', () => {
    it('should maintain graph integrity through save and load cycle', () => {
      const startFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const originalGraph = new ChessGraph(startFen);

      // Add multiple moves with different sequences
      originalGraph.addMove(startFen, { move: 'e2e4', toFen: 'fen1' }, true); // Primary
      originalGraph.addMove(startFen, { move: 'd2d4', toFen: 'fen2' }); // Secondary
      originalGraph.addMove(startFen, { move: 'Nf3', toFen: 'fen3' }); // Tertiary
      originalGraph.addMove('fen1', { move: 'e7e5', toFen: 'fen4' });

      // Save and load
      const filePath = saveGraph(originalGraph, 'round-trip.json', TEST_DIR);
      const loadedGraph = loadGraph(filePath);

      // Verify everything matches
      expect(loadedGraph.rootPosition).toBe(originalGraph.rootPosition);

      const originalStartNode = originalGraph.findPosition(startFen);
      const loadedStartNode = loadedGraph.findPosition(startFen);

      expect(loadedStartNode?.moves).toHaveLength(
        originalStartNode?.moves.length
      );

      // Check move order and sequences are preserved
      originalStartNode?.moves.forEach((originalMove, index) => {
        const loadedMove = loadedStartNode?.moves[index];
        expect(loadedMove?.move).toBe(originalMove.move);
        expect(loadedMove?.toFen).toBe(originalMove.toFen);
        expect(loadedMove?.seq).toBe(originalMove.seq);
      });
    });
  });
});

describe('printGraph', () => {
  let consoleSpy: any;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should handle empty graph', () => {
    const graph = new ChessGraph();
    printGraph(graph);

    expect(consoleSpy).toHaveBeenCalledWith(
      '📊 Empty graph (no root position)'
    );
  });

  it('should print simple linear graph', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const afterE5 =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';

    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });
    graph.addMove(afterE4, { move: 'e5', toFen: afterE5 });

    printGraph(graph);

    expect(consoleSpy).toHaveBeenCalledWith('📊 Chess Graph Structure:');
    expect(consoleSpy).toHaveBeenCalledWith(
      'Root: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('└─ e4 (main)')
    );
  });

  it('should print branching graph with multiple moves', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const afterD4 =
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';

    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });
    graph.addMove(startFen, { move: 'd4', toFen: afterD4 });

    printGraph(graph);

    // Should show both moves as branches
    const calls = consoleSpy.mock.calls.map((call: any) => call[0]);
    const hasE4Branch = calls.some(
      (call: string) => call.includes('├─ e4') || call.includes('└─ e4')
    );
    const hasD4Branch = calls.some(
      (call: string) => call.includes('├─ d4') || call.includes('└─ d4')
    );

    expect(hasE4Branch).toBe(true);
    expect(hasD4Branch).toBe(true);
  });

  it('should show statistics', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });

    printGraph(graph);

    expect(consoleSpy).toHaveBeenCalledWith('📈 Graph Statistics:');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Total positions:')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Total moves:')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Leaf positions:')
    );
  });

  it('should respect maxDepth parameter', () => {
    const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const afterE5 =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    const afterNf3 =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';

    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });
    graph.addMove(afterE4, { move: 'e5', toFen: afterE5 });
    graph.addMove(afterE5, { move: 'Nf3', toFen: afterNf3 });

    printGraph(graph, 0);

    const calls = consoleSpy.mock.calls.map((call: any) => call[0]);
    const hasMaxDepthMessage = calls.some((call: string) =>
      call.includes('[Max depth reached]')
    );

    expect(hasMaxDepthMessage).toBe(true);
  });
});
