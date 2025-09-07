export * from './types';
export * from './IAnalysisRepo';
export * from './AnalysisRepo';
export * from './AnalysisUtils';
export * from './AnalysisManager';
export * from './AnalysisStoreService';

import { AnalysisRepo } from './AnalysisRepo';
import { IAnalysisRepo } from './IAnalysisRepo';
import { AnalysisStoreService } from './AnalysisStoreService';
import sqlite3 from 'sqlite3';

/**
 * Factory method to create an AnalysisRepo instance with initialized schema
 * @param db SQLite database instance
 * @returns Promise<IAnalysisRepo> - AnalysisRepo instance with schema initialized
 */
export async function createAnalysisRepo(
  db: sqlite3.Database
): Promise<IAnalysisRepo> {
  const repo = new AnalysisRepo(db);
  await repo.initializeSchema();
  return repo;
}

/**
 * Factory function to create a fully initialized AnalysisStoreService
 * @param db SQLite database instance
 * @returns Promise<AnalysisStoreService> - Fully initialized service
 */
export async function createAnalysisStoreService(
  db: sqlite3.Database
): Promise<AnalysisStoreService> {
  const repo = await createAnalysisRepo(db);
  return new AnalysisStoreService(repo);
}

/**
 * Factory function to create an in-memory AnalysisStoreService for testing
 * @returns Promise<AnalysisStoreService> - In-memory service instance
 */
export async function createInMemoryAnalysisStoreService(): Promise<AnalysisStoreService> {
  const db = new sqlite3.Database(':memory:');
  return createAnalysisStoreService(db);
}
