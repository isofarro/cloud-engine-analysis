#!/usr/bin/env npx tsx

/**
 * Chess Graph Examples Index
 *
 * Run all chess graph examples or select specific ones
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const examples = [
  {
    name: 'Basic Save/Load',
    file: 'basic-save-load.ts',
    description: 'Simple example showing basic save and load operations',
  },
  {
    name: 'Opening Tree',
    file: 'opening-tree.ts',
    description:
      'Creating and persisting an opening tree with multiple variations',
  },
  {
    name: 'Graph Management',
    file: 'graph-management.ts',
    description: 'Managing multiple graph files (list, delete, etc.)',
  },
  {
    name: 'Print Graph Demo',
    file: 'print-graph-demo.ts',
    description: 'Shows ASCII tree visualization of chess graphs in terminal',
  },
];

function runExample(exampleFile: string): void {
  const examplePath = path.join(__dirname, exampleFile);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${exampleFile}`);
  console.log('='.repeat(60));

  try {
    execSync(`npx tsx ${examplePath}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  } catch (error) {
    console.error(`❌ Error running ${exampleFile}:`, error);
  }
}

function showMenu(): void {
  console.log('🚀 Chess Graph Examples\n');
  console.log('Available examples:');

  examples.forEach((example, index) => {
    console.log(`  ${index + 1}. ${example.name}`);
    console.log(`     ${example.description}`);
    console.log('');
  });

  console.log('  0. Run all examples');
  console.log('\nUsage:');
  console.log('  npx tsx examples/chess-graph/index.ts [number]');
  console.log(
    '  npx tsx examples/chess-graph/index.ts        # Show this menu'
  );
  console.log('\nOr run individual examples directly:');
  examples.forEach(example => {
    console.log(`  npx tsx examples/chess-graph/${example.file}`);
  });
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    showMenu();
    return;
  }

  const choice = parseInt(args[0]);

  if (isNaN(choice)) {
    console.error('❌ Invalid choice. Please provide a number.');
    showMenu();
    return;
  }

  if (choice === 0) {
    console.log('🎯 Running all chess graph examples...\n');
    examples.forEach(example => {
      runExample(example.file);
    });
    console.log('\n🎉 All examples completed!');
  } else if (choice >= 1 && choice <= examples.length) {
    const example = examples[choice - 1];
    console.log(`🎯 Running: ${example.name}`);
    runExample(example.file);
  } else {
    console.error(`❌ Invalid choice. Please choose 0-${examples.length}.`);
    showMenu();
  }
}

// Run the main function
main();
