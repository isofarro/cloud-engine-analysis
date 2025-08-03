#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { AnalysisRepo, AnalysisStoreService } from '../src/core/analysis-store';
import { AnalysisResult } from '../src/core/engine/types';

/**
 * Parses an EPD (Extended Position Description) line and extracts analysis data.
 * EPD format: <position> <side-to-move> <castling> <en-passant> <operation1>; <operation2>; ...
 * Each operation has format: <opcode> <operand(s)>
 */
function parseEPDLine(line: string): AnalysisResult | null {
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
  const operationsStart = trimmed.indexOf(' ', trimmed.indexOf(' ', trimmed.indexOf(' ', trimmed.indexOf(' ') + 1) + 1) + 1);
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
      score: centipawns
    },
    pvs: pv ? [pv] : [],
    time,
    nodes,
    nps: time > 0 ? Math.round(nodes / (time / 1000)) : 0
  };
}

/**
 * Imports EPD file data into the Analysis Store database.
 */
async function importEPDFile(epdFilePath: string, dbFilePath: string, engineSlug: string = 'epd-import-1.0'): Promise<void> {
  console.log(`Importing EPD file: ${epdFilePath}`);
  console.log(`Target database: ${dbFilePath}`);
  console.log(`Engine slug: ${engineSlug}`);

  // Check if EPD file exists
  if (!fs.existsSync(epdFilePath)) {
    throw new Error(`EPD file not found: ${epdFilePath}`);
  }

  // Create database directory if it doesn't exist
  const dbDir = path.dirname(dbFilePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Initialize database and repository
  const db = new sqlite3.Database(dbFilePath);
  const repo = new AnalysisRepo(db);
  const storeService = new AnalysisStoreService(repo);

  try {
    console.log('✓ Database initialized');

    // Read and parse EPD file
    const epdContent = fs.readFileSync(epdFilePath, 'utf-8');
    const lines = epdContent.split('\n').filter(line => line.trim());

    console.log(`Found ${lines.length} EPD entries`);

    let imported = 0;
    let skipped = 0;

    // Process each EPD line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const analysisResult = parseEPDLine(line);

      if (analysisResult) {
        try {
          // Store the analysis result
          await storeService.storeAnalysisResult(analysisResult, engineSlug);
          imported++;

          if (imported % 100 === 0) {
            console.log(`Imported ${imported}/${lines.length} positions...`);
          }
        } catch (error) {
          console.warn(`Failed to store analysis for line ${i + 1}: ${error}`);
          skipped++;
        }
      } else {
        skipped++;
      }
    }

    console.log(`\n✓ Import completed:`);
    console.log(`  Imported: ${imported} positions`);
    console.log(`  Skipped: ${skipped} positions`);

    // Display database statistics
    const stats = await repo.getStats();
    console.log(`\n✓ Database statistics:`);
    console.log(`  Total positions: ${stats.totalPositions}`);
    console.log(`  Total engines: ${stats.totalEngines}`);
    console.log(`  Total analyses: ${stats.totalAnalyses}`);
    console.log(`  Average depth: ${stats.avgDepth.toFixed(1)}`);

  } finally {
    // Close database connection
    db.close();
  }
}

/**
 * Main function - handles command line arguments and runs the import.
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: tsx import-epd.ts <epd-file> <database-file> [engine-slug]');
    console.error('');
    console.error('Arguments:');
    console.error('  epd-file      Path to the EPD file to import');
    console.error('  database-file Path to the SQLite database file (created if not exists)');
    console.error('  engine-slug   Optional engine identifier (default: epd-import-1.0)');
    console.error('');
    console.error('Example:');
    console.error('  tsx import-epd.ts ./tmp/positions.epd ./data/analysis.db stockfish-17.0');
    process.exit(1);
  }

  const epdFilePath = path.resolve(args[0]);
  const dbFilePath = path.resolve(args[1]);
  const engineSlug = args[2] || 'epd-import-1.0';

  try {
    await importEPDFile(epdFilePath, dbFilePath, engineSlug);
    console.log('\n🎉 EPD import completed successfully!');
  } catch (error) {
    console.error('\n❌ EPD import failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { importEPDFile, parseEPDLine };