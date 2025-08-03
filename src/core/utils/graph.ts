import * as fs from 'fs';
import * as path from 'path';
import { ChessGraph } from '../graph/ChessGraph';
import { FenString } from '../types';
import { PositionNodeMap } from '../graph/types';

/**
 * Serializable representation of a ChessGraph
 */
export interface SerializedChessGraph {
  rootPosition?: FenString;
  nodes: PositionNodeMap;
}

/**
 * Saves a ChessGraph instance to a JSON file on the filesystem.
 *
 * @param graph - The ChessGraph instance to save
 * @param filename - Optional filename. If not provided, generates one based on timestamp
 * @param directory - Optional directory path. Defaults to './graphs'
 * @returns The full path of the saved file
 */
export function saveGraph(
  graph: ChessGraph,
  filename?: string,
  directory: string = './graphs'
): string {
  // Ensure directory exists
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  // Generate filename if not provided
  if (!filename) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    filename = `chess-graph-${timestamp}.json`;
  }

  // Ensure filename has .json extension
  if (!filename.endsWith('.json')) {
    filename += '.json';
  }

  const filePath = path.join(directory, filename);

  // Serialize the graph
  const serializedGraph: SerializedChessGraph = {
    rootPosition: graph.rootPosition,
    nodes: graph.nodes,
  };

  // Write to file
  fs.writeFileSync(filePath, JSON.stringify(serializedGraph, null, 2), 'utf-8');

  return filePath;
}

/**
 * Loads a ChessGraph instance from a JSON file on the filesystem.
 *
 * @param filePath - The path to the JSON file containing the serialized graph
 * @returns A fully instantiated ChessGraph object
 * @throws Error if file doesn't exist or contains invalid data
 */
export function loadGraph(filePath: string): ChessGraph {
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`Graph file not found: ${filePath}`);
  }

  try {
    // Read and parse the file
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const serializedGraph: SerializedChessGraph = JSON.parse(fileContent);

    // Validate the structure
    if (typeof serializedGraph !== 'object' || serializedGraph === null) {
      throw new Error('Invalid graph file: root must be an object');
    }

    if (serializedGraph.nodes && typeof serializedGraph.nodes !== 'object') {
      throw new Error('Invalid graph file: nodes must be an object');
    }

    // Create new ChessGraph instance
    const graph = new ChessGraph(serializedGraph.rootPosition);

    // Restore nodes by directly setting the private property
    // Since we need to access private members, we'll use the public interface
    if (serializedGraph.nodes) {
      Object.entries(serializedGraph.nodes).forEach(([fen, node]) => {
        // Add each move to rebuild the graph structure
        node.moves.forEach(moveEdge => {
          graph.addMove(
            fen,
            {
              move: moveEdge.move,
              toFen: moveEdge.toFen,
            },
            moveEdge.seq === 1
          ); // Primary move if seq is 1
        });
      });
    }

    return graph;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in graph file: ${filePath}`);
    }
    throw error;
  }
}

/**
 * Lists all graph files in a directory.
 *
 * @param directory - Directory to search for graph files. Defaults to './graphs'
 * @returns Array of graph file paths
 */
export function listGraphFiles(directory: string = './graphs'): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(directory, file));
}

/**
 * Deletes a graph file from the filesystem.
 *
 * @param filePath - Path to the graph file to delete
 * @returns true if file was deleted, false if file didn't exist
 */
export function deleteGraph(filePath: string): boolean {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Prints a chess graph as an ASCII tree structure in the terminal
 * Uses pipe characters to show branching when positions have multiple moves
 *
 * @param graph - The ChessGraph to print
 * @param maxDepth - Maximum depth to traverse (default: 10)
 * @param verbose - If true, shows detailed info (FEN, move counts). If false, shows compact view (default: false)
 */
export function printGraph(
  graph: ChessGraph,
  maxDepth: number = 10,
  verbose: boolean = false
): void {
  if (!graph.rootPosition) {
    console.log('📊 Empty graph (no root position)');
    return;
  }

  if (verbose) {
    console.log('📊 Chess Graph Structure (Verbose):');
    console.log(`Root: ${graph.rootPosition}`);
  } else {
    console.log('📊 Chess Graph Structure:');
    console.log(`Root: ${graph.rootPosition.split(' ')[0]}`);
  }
  console.log('');

  const visited = new Set<string>();

  function printNode(
    fen: string,
    prefix: string = '',
    depth: number = 0
  ): void {
    if (depth >= maxDepth || visited.has(fen)) {
      if (visited.has(fen)) {
        console.log(`${prefix}└─ [↻ ${fen.split(' ')[0]}]`);
      } else {
        console.log(`${prefix}└─ [Max depth reached]`);
      }
      return;
    }

    visited.add(fen);
    const node = graph.findPosition(fen);

    if (!node || node.moves.length === 0) {
      return;
    }

    const moves = [...node.moves].sort((a, b) => a.seq - b.seq);

    moves.forEach((move, index) => {
      const isLast = index === moves.length - 1;
      const connector = isLast ? '└─' : '├─';
      const nextPrefix = prefix + (isLast ? '   ' : '│  ');

      if (verbose) {
        // Verbose mode: show move with sequence indicator
        const seqIndicator = move.seq === 1 ? ' (main)' : ` (${move.seq})`;
        console.log(`${prefix}${connector} ${move.move}${seqIndicator}`);

        // Show target position info
        const targetFen = move.toFen;
        const targetNode = graph.findPosition(targetFen);
        const targetMoveCount = targetNode?.moves.length || 0;

        if (targetMoveCount > 0) {
          console.log(`${nextPrefix}│`);
          console.log(`${nextPrefix}├─ Position: ${targetFen.split(' ')[0]}`);
          console.log(`${nextPrefix}├─ Moves: ${targetMoveCount}`);
          console.log(`${nextPrefix}│`);

          // Recursively print child moves
          printNode(targetFen, nextPrefix, depth + 1);
        } else {
          console.log(
            `${nextPrefix}└─ Position: ${targetFen.split(' ')[0]} (leaf)`
          );
        }
      } else {
        // Compact mode: just show the move
        const targetFen = move.toFen;
        const targetNode = graph.findPosition(targetFen);
        const targetMoveCount = targetNode?.moves.length || 0;

        if (targetMoveCount > 0) {
          console.log(`${prefix}${connector} ${move.move}`);
          // Recursively print child moves
          printNode(targetFen, nextPrefix, depth + 1);
        } else {
          // Leaf node: just the move
          console.log(`${prefix}${connector} ${move.move}`);
        }
      }
    });
  }

  printNode(graph.rootPosition);

  // Print summary statistics only in verbose mode
  if (verbose) {
    console.log('');
    console.log('📈 Graph Statistics:');
    console.log(`├─ Total positions: ${Object.keys(graph.nodes).length}`);

    let totalMoves = 0;
    let leafPositions = 0;
    let branchingPositions = 0;

    Object.values(graph.nodes).forEach(node => {
      totalMoves += node.moves.length;
      if (node.moves.length === 0) {
        leafPositions++;
      } else if (node.moves.length > 1) {
        branchingPositions++;
      }
    });

    console.log(`├─ Total moves: ${totalMoves}`);
    console.log(`├─ Leaf positions: ${leafPositions}`);
    console.log(`├─ Branching positions: ${branchingPositions}`);
    console.log(`└─ Max depth shown: ${Math.min(maxDepth, visited.size)}`);
  }
}
