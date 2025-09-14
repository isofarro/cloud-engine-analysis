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
import { DEFAULT_STARTING_POSITION } from '../constants';

// Use persistent base directory for all graph tests
const TEST_BASE_DIR = './tmp/test-graphs';

describe('Graph Utils', () => {
  let testDir: string;

  beforeEach(async () => {
    // Create unique test directory for each test
    testDir = path.join(
      TEST_BASE_DIR,
      `${Date.now()}-${process.pid}-${Math.random().toString(36).substring(2)}`
    );

    // Ensure the test base directory exists
    await fs.promises.mkdir(TEST_BASE_DIR, { recursive: true });

    // Ensure the specific test directory exists
    await fs.promises.mkdir(testDir, { recursive: true });

    // Wait for filesystem to stabilize
    await new Promise(resolve => setTimeout(resolve, 10));
  });

  afterEach(async () => {
    // Only clean up this specific test's directory
    await cleanupTestDirectory(testDir);
  });

  // Cleanup function - only removes specific test directory
  async function cleanupTestDirectory(dir: string): Promise<void> {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors to prevent test failures
        console.warn(`Failed to cleanup test directory ${dir}:`, error);
      }
    }
  }

  describe('saveGraph', () => {
    it('should save an empty graph', async () => {
      const graph = new ChessGraph();
      const filePath = await saveGraph(graph, 'empty-graph.json', testDir);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath).toBe(path.join(testDir, 'empty-graph.json'));

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content).toEqual({
        rootPosition: undefined,
        nodes: {},
      });
    });

    it('should save a graph with root position', async () => {
      const rootFen = DEFAULT_STARTING_POSITION;
      const graph = new ChessGraph(rootFen);
      const filePath = await saveGraph(graph, 'root-graph.json', testDir);

      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      expect(content.rootPosition).toBe(rootFen);
    });

    it('should save a graph with moves', async () => {
      const startFen = DEFAULT_STARTING_POSITION;
      const afterE4Fen =
        'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

      const graph = new ChessGraph(startFen);
      graph.addMove(startFen, { move: 'e2e4', toFen: afterE4Fen }, true);

      const filePath = await saveGraph(graph, 'moves-graph.json', testDir);
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

    it('should generate filename when not provided', async () => {
      const graph = new ChessGraph();
      const filePath = await saveGraph(graph, undefined, testDir);

      expect(fs.existsSync(filePath)).toBe(true);
      expect(filePath).toMatch(new RegExp(`^${testDir.replace('./', '')}`));
      expect(path.basename(filePath)).toMatch(/^chess-graph-.*\.json$/);
    });

    it('should add .json extension if missing', async () => {
      const graph = new ChessGraph();
      const filePath = await saveGraph(graph, 'test-graph', testDir);

      expect(filePath).toBe(path.join(testDir, 'test-graph.json'));
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it('should create directory if it does not exist', async () => {
      const graph = new ChessGraph();
      const newDir = './new-test-dir';

      try {
        const filePath = await saveGraph(graph, 'test.json', newDir);
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
    it('should load an empty graph', async () => {
      const originalGraph = new ChessGraph();
      const filePath = await saveGraph(originalGraph, 'empty.json', testDir);

      const loadedGraph = loadGraph(filePath);

      expect(loadedGraph.rootPosition).toBeUndefined();
      expect(loadedGraph.nodes).toEqual({});
    });

    it('should load a graph with root position', async () => {
      const rootFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const originalGraph = new ChessGraph(rootFen);
      const filePath = await saveGraph(originalGraph, 'root.json', testDir);

      const loadedGraph = loadGraph(filePath);

      expect(loadedGraph.rootPosition).toBe(rootFen);
    });

    it('should load a graph with moves and preserve structure', async () => {
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

      const filePath = await saveGraph(originalGraph, 'complex.json', testDir);
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
      const invalidJsonFile = path.join(testDir, 'invalid.json');
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(invalidJsonFile, 'invalid json content', 'utf-8');

      expect(() => loadGraph(invalidJsonFile)).toThrow(
        'Invalid JSON in graph file'
      );
    });

    it('should throw error for invalid graph structure', () => {
      const invalidStructureFile = path.join(testDir, 'invalid-structure.json');
      fs.mkdirSync(testDir, { recursive: true });
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
      fs.mkdirSync(testDir, { recursive: true });
      fs.writeFileSync(path.join(testDir, 'graph1.json'), '{}');
      fs.writeFileSync(path.join(testDir, 'graph2.json'), '{}');
      fs.writeFileSync(path.join(testDir, 'not-graph.txt'), 'text');

      const files = listGraphFiles(testDir);

      expect(files).toHaveLength(2);
      expect(files).toContain(path.join(testDir, 'graph1.json'));
      expect(files).toContain(path.join(testDir, 'graph2.json'));
      expect(files).not.toContain(path.join(testDir, 'not-graph.txt'));
    });
  });

  describe('deleteGraph', () => {
    it('should delete existing file and return true', async () => {
      const graph = new ChessGraph();
      const filePath = await saveGraph(graph, 'to-delete.json', testDir);

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
    it('should maintain graph integrity through save and load cycle', async () => {
      const startFen =
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const originalGraph = new ChessGraph(startFen);

      // Add multiple moves with different sequences
      originalGraph.addMove(startFen, { move: 'e2e4', toFen: 'fen1' }, true); // Primary
      originalGraph.addMove(startFen, { move: 'd2d4', toFen: 'fen2' }); // Secondary
      originalGraph.addMove(startFen, { move: 'Nf3', toFen: 'fen3' }); // Tertiary
      originalGraph.addMove('fen1', { move: 'e7e5', toFen: 'fen4' });

      // Save and load
      const filePath = await saveGraph(
        originalGraph,
        'round-trip.json',
        testDir
      );
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
      '📊 Empty graph (no start position)'
    );
  });

  it('should print compact mode by default', () => {
    const startFen = DEFAULT_STARTING_POSITION;
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });

    printGraph(graph);

    // Fix: Filter out undefined calls and safely access call arguments
    const calls = consoleSpy.mock.calls
      .filter((call: any) => call && call[0])
      .map((call: any) => call[0]);

    // Should print the board position first
    expect(
      calls.some(
        (call: string) => call && (call.includes('♜') || call.includes('r'))
      )
    ).toBe(true);
    // Should show just the move without sequence indicators in compact mode
    expect(
      calls.some(
        (call: string) =>
          call && call.includes('└─ e4') && !call.includes('(main)')
      )
    ).toBe(true);
    // Should NOT show statistics in compact mode
    expect(
      calls.some(
        (call: string) => call && call.includes('📈 Graph Statistics:')
      )
    ).toBe(false);
  });

  it('should print verbose mode when requested', () => {
    const startFen = DEFAULT_STARTING_POSITION;
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });

    printGraph(graph, 10, true);

    // Fix: Filter out undefined calls and safely access call arguments
    const calls = consoleSpy.mock.calls
      .filter((call: any) => call && call[0])
      .map((call: any) => call[0]);

    // Should print the board position first
    expect(
      calls.some(
        (call: string) => call && (call.includes('♜') || call.includes('r'))
      )
    ).toBe(true);
    // Should show move with sequence indicator in verbose mode
    expect(
      calls.some((call: string) => call && call.includes('e4 (main)'))
    ).toBe(true);
    // Should show statistics in verbose mode
    expect(
      calls.some(
        (call: string) => call && call.includes('📈 Graph Statistics:')
      )
    ).toBe(true);
  });

  it('should print branching graph in compact mode', () => {
    const startFen = DEFAULT_STARTING_POSITION;
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const afterD4 =
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';

    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });
    graph.addMove(startFen, { move: 'd4', toFen: afterD4 });

    printGraph(graph);

    // Fix: Filter out undefined calls and safely access call arguments
    const calls = consoleSpy.mock.calls
      .filter((call: any) => call && call[0])
      .map((call: any) => call[0]);

    // Should print the board position first
    expect(
      calls.some(
        (call: string) => call && (call.includes('♜') || call.includes('r'))
      )
    ).toBe(true);
    // Should show both moves with proper connectors
    expect(
      calls.some(
        (call: string) =>
          call && (call.includes('├─ e4') || call.includes('├─ d4'))
      )
    ).toBe(true);
    expect(
      calls.some(
        (call: string) =>
          call && (call.includes('└─ e4') || call.includes('└─ d4'))
      )
    ).toBe(true);
  });

  it('should print branching graph in verbose mode', () => {
    const startFen = DEFAULT_STARTING_POSITION;
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const afterD4 =
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1';

    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });
    graph.addMove(startFen, { move: 'd4', toFen: afterD4 });

    printGraph(graph, 10, true);

    // Fix: Filter out undefined calls and safely access call arguments
    const calls = consoleSpy.mock.calls
      .filter((call: any) => call && call[0])
      .map((call: any) => call[0]);

    // Should print the board position first
    expect(
      calls.some(
        (call: string) => call && (call.includes('♜') || call.includes('r'))
      )
    ).toBe(true);
    // Should show both moves with sequence indicators in verbose mode
    expect(
      calls.some(
        (call: string) =>
          call && (call.includes('e4 (main)') || call.includes('d4 (main)'))
      )
    ).toBe(true);
    // Should show statistics in verbose mode
    expect(
      calls.some(
        (call: string) => call && call.includes('📈 Graph Statistics:')
      )
    ).toBe(true);
  });

  it('should respect maxDepth parameter in compact mode', () => {
    const startFen = DEFAULT_STARTING_POSITION;
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

    printGraph(graph, 1); // Max depth of 1

    // Fix: Filter out undefined calls and safely access call arguments
    const calls = consoleSpy.mock.calls
      .filter((call: any) => call && call[0])
      .map((call: any) => call[0]);

    // Should print the board position first
    expect(
      calls.some(
        (call: string) => call && (call.includes('♜') || call.includes('r'))
      )
    ).toBe(true);
    // Should show ellipsis when max depth is reached
    expect(calls.some((call: string) => call && call.includes('…'))).toBe(true);
  });

  it('should show transposition indicator', () => {
    const startFen = DEFAULT_STARTING_POSITION;
    const graph = new ChessGraph(startFen);
    const afterE4 =
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    const afterE5 =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2';
    const afterNf3 =
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
    const afterBc4 =
      'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2';
    const afterNc6 =
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

    // Create main line: start -> e4 -> e5 -> Nf3 -> Nc6
    graph.addMove(startFen, { move: 'e4', toFen: afterE4 });
    graph.addMove(afterE4, { move: 'e5', toFen: afterE5 });
    graph.addMove(afterE5, { move: 'Nf3', toFen: afterNf3 });
    graph.addMove(afterNf3, { move: 'Nc6', toFen: afterNc6 });

    // Create alternative path: start -> e4 -> e5 -> Bc4 -> Nc6 (same final position)
    graph.addMove(afterE5, { move: 'Bc4', toFen: afterBc4 });
    graph.addMove(afterBc4, { move: 'Nc6', toFen: afterNc6 }); // Transposition!

    // Add one more move from Nc6 to ensure it gets visited during traversal
    const afterBb5 =
      'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
    graph.addMove(afterNc6, { move: 'Bb5', toFen: afterBb5 });

    // Use verbose mode to ensure transposition detection works properly
    printGraph(graph, 10, true);

    const calls = consoleSpy.mock.calls
      .filter((call: any) => call && call[0])
      .map((call: any) => call[0]);

    // Should print the board position first
    expect(
      calls.some(
        (call: string) => call && (call.includes('♜') || call.includes('r'))
      )
    ).toBe(true);
    // Should show transposition indicator when visiting already shown position
    expect(calls.some((call: string) => call && call.includes('↻'))).toBe(true);
  });
});
