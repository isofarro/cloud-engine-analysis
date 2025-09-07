export * from './types';
export * from './IAnalysisRepo';
export * from './AnalysisRepo';
export * from './AnalysisUtils';
export * from './AnalysisManager';
export * from './AnalysisStoreService';

import { AnalysisRepo } from './AnalysisRepo';
import sqlite3 from 'sqlite3';

/**
 * Factory method to create an AnalysisRepo instance with initialized schema
 * @param db SQLite database instance
 * @returns Promise<AnalysisRepo> - AnalysisRepo instance with schema initialized
 */
export async function createAnalysisRepo(
  db: sqlite3.Database
): Promise<AnalysisRepo> {
  const repo = new AnalysisRepo(db);
  await repo.initializeSchema();
  return repo;
}
