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
  if (!fs.existsSync(filePath)) {
    return false;
  }

  fs.unlinkSync(filePath);
  return true;
}
