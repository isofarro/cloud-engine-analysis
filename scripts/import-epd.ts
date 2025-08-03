#!/usr/bin/env tsx

import * as fs from 'fs';
import * as path from 'path';
import sqlite3 from 'sqlite3';
import { Command } from 'commander';
import { AnalysisRepo, AnalysisStoreService } from '../src/core/analysis-store';
import { parseEPDLine } from '../src/core/utils/epd';



/**
 * Imports EPD file data into the Analysis Store database.
 */
async function importEPDFile(epdFilePath: string, dbFilePath: string, engineSlug: string = 'epd-import-1.0', verbose: boolean = false): Promise<void> {
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

          if (verbose && imported % 50 === 0) {
            console.log(`Imported ${imported}/${lines.length} positions...`);
          } else if (!verbose && imported % 100 === 0) {
            console.log(`Imported ${imported}/${lines.length} positions...`);
          }
        } catch (error) {
          if (verbose) {
            console.warn(`Failed to store analysis for line ${i + 1}: ${error}`);
          }
          skipped++;
        }
      } else {
        if (verbose) {
          console.warn(`Skipped invalid EPD line ${i + 1}: ${line.substring(0, 50)}...`);
        }
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
  const program = new Command();

  program
    .name('import-epd')
    .description('Import EPD file data into the Analysis Store database\n\nExamples:\n  tsx import-epd.ts ./tmp/positions.epd ./data/analysis.db --engine stockfish-17.0\n  tsx import-epd.ts ./tmp/positions.epd ./data/analysis.db --engine stockfish-17.0 --verbose')
    .version('1.0.0')
    .argument('<epd-file>', 'Path to the EPD file to import')
    .argument('<database-file>', 'Path to the SQLite database file (created if not exists)')
    .option('--engine <slug>', 'Engine identifier', 'epd-import-1.0')
    .option('--verbose', 'Enable verbose output', false)
    .parse();

  const args = program.args;
  const options = program.opts();

  const epdFilePath = path.resolve(args[0]);
  const dbFilePath = path.resolve(args[1]);
  const engineSlug = options.engine;
  const verbose = options.verbose;

  if (verbose) {
    console.log('Running with options:', {
      epdFilePath,
      dbFilePath,
      engineSlug,
      verbose
    });
  }

  try {
    await importEPDFile(epdFilePath, dbFilePath, engineSlug, verbose);
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