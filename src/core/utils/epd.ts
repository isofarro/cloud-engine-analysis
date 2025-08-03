import { AnalysisResult } from '../engine/types';

/**
 * Parses an EPD (Extended Position Description) line and extracts analysis data.
 * EPD format: <position> <side-to-move> <castling> <en-passant> <operation1>; <operation2>; ...
 * Each operation has format: <opcode> <operand(s)>
 */
export function parseEPDLine(line: string): AnalysisResult | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Split the line into parts
  const parts = trimmed.split(/\s+/);
  if (parts.length < 4) {
    console.warn(`Invalid EPD line (insufficient FEN parts): ${line}`);
    return null;
  }

  // Extract the first 4 parts as FEN position data
  const position = parts[0];
  const sideToMove = parts[1];
  const castling = parts[2];
  const enPassant = parts[3];

  // Construct normalized FEN (add halfmove and fullmove counters)
  const fen = `${position} ${sideToMove} ${castling} ${enPassant} 0 1`;

  // Extract operations part (everything after the 4th space)
  const operationsStart = trimmed.indexOf(
    ' ',
    trimmed.indexOf(' ', trimmed.indexOf(' ', trimmed.indexOf(' ') + 1) + 1) + 1
  );
  if (operationsStart === -1 || operationsStart >= trimmed.length) {
    console.warn(`No operations found in EPD line: ${line}`);
    return null;
  }

  const operationsString = trimmed.substring(operationsStart);

  // Parse semicolon-separated operations into an object
  const operations: Record<string, string> = {};
  const operationParts = operationsString.split(';');

  for (const opPart of operationParts) {
    const trimmedOp = opPart.trim();
    if (!trimmedOp) continue;

    const opWords = trimmedOp.split(/\s+/);
    if (opWords.length < 1) continue;

    const opcode = opWords[0];
    const operand = opWords.slice(1).join(' ');
    operations[opcode] = operand;
  }

  // Extract required analysis data from operations
  if (!operations.ce || !operations.acd) {
    console.warn(`Missing required operations (ce, acd) in EPD line: ${line}`);
    return null;
  }

  const centipawns = parseInt(operations.ce);
  const depth = parseInt(operations.acd);
  const time = operations.acs ? parseInt(operations.acs) : 0;
  const nodes = operations.acn ? parseInt(operations.acn) : 0;
  const pv = operations.pv || '';

  if (isNaN(centipawns) || isNaN(depth)) {
    console.warn(`Invalid numeric values in EPD line: ${line}`);
    return null;
  }

  return {
    fen,
    depth,
    selDepth: depth, // Use same as depth since EPD doesn't specify selective depth
    multiPV: 1,
    score: {
      type: 'cp' as const,
      score: centipawns,
    },
    pvs: pv ? [pv] : [],
    time,
    nodes,
    nps: time > 0 ? Math.round(nodes / (time / 1000)) : 0,
  };
}
