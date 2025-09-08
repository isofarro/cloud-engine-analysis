#!/usr/bin/env node

import { ChessProjectCLI } from './index';

async function createCli(): Promise<ChessProjectCLI> {
  const cli = new ChessProjectCLI();
  await cli.init();
  return cli;
}

/**
 * CLI entry point
 */
async function main() {
  let cli: ChessProjectCLI | undefined;
  try {
    cli = await createCli();
    await cli.run();
  } catch (error) {
    console.error(
      'Fatal error:',
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  } finally {
    // Cleanup resources
    if (cli) {
      await cli.cleanup();
    }
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
