#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { AnalysisRepo, AnalysisStoreService } from '../src/core/analysis-store';
import { AnalysisResult } from '../src/core/engine/types';
import { parseEPDLine } from '../src/core/utils/epd';



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

export { importEPDFile };