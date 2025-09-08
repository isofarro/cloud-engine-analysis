#!/usr/bin/env tsx

import { CLIMigrationHelper } from '../src/core/project/migration/CLIMigrationHelper';
import { Command } from 'commander';

const program = new Command();

program
  .name('migrate')
  .description('Migration tools for legacy PV Explorer usage')
  .version('1.0.0');

// Add migration command
program.addCommand(CLIMigrationHelper.createMigrationCommand());

// Parse command line arguments
program.parse();