#!/usr/bin/env node

import { ChessProjectCLI } from './index';

/**
 * CLI entry point
 */
async function main() {
  try {
    const cli = new ChessProjectCLI();
    await cli.run();
  } catch (error) {
    console.error(
      'Fatal error:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
