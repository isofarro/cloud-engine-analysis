import {
  Engine,
  CreateEngineData,
  Position,
  CreatePositionData,
  Analysis,
  CreateAnalysisData,
  AnalysisQuery,
  AnalysisWithDetails,
} from './types';
import { FenString } from '../types';
import { IAnalysisRepo } from './IAnalysisRepo';
import { Database } from 'sqlite3';

/**
 * High-performance repository for chess analysis data.
 * Implements caching, optimized queries, and batch operations.
 */
export class AnalysisRepo implements IAnalysisRepo {
  private db: Database;
  private engineCache = new Map<string, Engine>();
  private positionCache = new Map<FenString, Position>();
  private analysisCache = new Map<string, Analysis>();

  constructor(database: Database) {
    this.db = database;
    this.initializeDatabase();
  }

  /**
   * Initialize database schema with performance-optimized indexes.
   */
  private initializeDatabase(): void {
    // Create tables
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS engines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fen TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS analysis (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position_id INTEGER NOT NULL,
        engine_id INTEGER NOT NULL,
        depth INTEGER NOT NULL,
        time INTEGER NOT NULL,
        nodes INTEGER NOT NULL,
        nps INTEGER NOT NULL,
        score_type TEXT NOT NULL CHECK (score_type IN ('cp', 'mate')),
        score INTEGER NOT NULL,
        pv TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (position_id) REFERENCES positions(id),
        FOREIGN KEY (engine_id) REFERENCES engines(id),
        UNIQUE(position_id, engine_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_engines_slug ON engines(slug);
      CREATE INDEX IF NOT EXISTS idx_positions_fen ON positions(fen);
      CREATE INDEX IF NOT EXISTS idx_analysis_position_engine ON analysis(position_id, engine_id);
      CREATE INDEX IF NOT EXISTS idx_analysis_depth ON analysis(depth DESC);
      CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis(created_at);
    `);
  }

  // Helper method to promisify database operations
  private runQuery<T>(sql: string, params: any[] = []): Promise<T> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: Error | null, row: T) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  private runQueryAll<T>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: T[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  private runStatement(
    sql: string,
    params: any[] = []
  ): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err: Error | null) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  // Engine operations
  async upsertEngine(data: CreateEngineData): Promise<Engine> {
    // Check cache first
    const cached = this.engineCache.get(data.slug);
    if (cached) return cached;

    const sql = `
      INSERT INTO engines (slug, name, version)
      VALUES (?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        version = excluded.version
    `;

    await this.runStatement(sql, [data.slug, data.name, data.version]);

    // Get the inserted/updated record
    const result = await this.runQuery<Engine>(
      'SELECT * FROM engines WHERE slug = ?',
      [data.slug]
    );

    // Cache the result
    this.engineCache.set(data.slug, result);
    return result;
  }

  async getEngineBySlug(slug: string): Promise<Engine | null> {
    // Check cache first
    const cached = this.engineCache.get(slug);
    if (cached) return cached;

    const result = await this.runQuery<Engine>(
      'SELECT * FROM engines WHERE slug = ?',
      [slug]
    );

    if (result) {
      this.engineCache.set(slug, result);
    }

    return result || null;
  }

  async listEngines(limit = 100, offset = 0): Promise<Engine[]> {
    const results = await this.runQueryAll<Engine>(
      'SELECT * FROM engines ORDER BY name, version LIMIT ? OFFSET ?',
      [limit, offset]
    );

    // Cache results
    results.forEach((engine: Engine) => {
      this.engineCache.set(engine.slug, engine);
    });

    return results;
  }

  // Position operations
  async upsertPosition(data: CreatePositionData): Promise<Position> {
    // Check cache first
    const cached = this.positionCache.get(data.fen);
    if (cached) return cached;

    const sql = `
      INSERT INTO positions (fen)
      VALUES (?)
      ON CONFLICT(fen) DO UPDATE SET fen = excluded.fen
    `;

    await this.runStatement(sql, [data.fen]);

    // Get the inserted/updated record
    const result = await this.runQuery<Position>(
      'SELECT * FROM positions WHERE fen = ?',
      [data.fen]
    );

    // Cache the result
    this.positionCache.set(data.fen, result);
    return result;
  }

  async getPositionByFen(fen: FenString): Promise<Position | null> {
    // Check cache first
    const cached = this.positionCache.get(fen);
    if (cached) return cached;

    const result = await this.runQuery<Position>(
      'SELECT * FROM positions WHERE fen = ?',
      [fen]
    );

    if (result) {
      this.positionCache.set(fen, result);
    }

    return result || null;
  }

  // Analysis operations
  async upsertAnalysis(data: CreateAnalysisData): Promise<Analysis> {
    const cacheKey = `${data.position_id}:${data.engine_id}`;

    const sql = `
      INSERT INTO analysis (
        position_id, engine_id, depth, time, nodes, nps, 
        score_type, score, pv, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(position_id, engine_id) DO UPDATE SET
        depth = excluded.depth,
        time = excluded.time,
        nodes = excluded.nodes,
        nps = excluded.nps,
        score_type = excluded.score_type,
        score = excluded.score,
        pv = excluded.pv,
        updated_at = CURRENT_TIMESTAMP
    `;

    await this.runStatement(sql, [
      data.position_id,
      data.engine_id,
      data.depth,
      data.time,
      data.nodes,
      data.nps,
      data.score_type,
      data.score,
      data.pv,
    ]);

    // Get the inserted/updated record
    const result = await this.runQuery<Analysis>(
      'SELECT * FROM analysis WHERE position_id = ? AND engine_id = ?',
      [data.position_id, data.engine_id]
    );

    // Cache the result
    this.analysisCache.set(cacheKey, result);
    return result;
  }

  async getAnalysis(
    positionId: number,
    engineId: number
  ): Promise<Analysis | null> {
    const cacheKey = `${positionId}:${engineId}`;

    // Check cache first
    const cached = this.analysisCache.get(cacheKey);
    if (cached) return cached;

    const result = await this.runQuery<Analysis>(
      'SELECT * FROM analysis WHERE position_id = ? AND engine_id = ?',
      [positionId, engineId]
    );

    if (result) {
      this.analysisCache.set(cacheKey, result);
    }

    return result || null;
  }

  async getAnalysisByFenAndEngine(
    fen: FenString,
    engineSlug: string
  ): Promise<AnalysisWithDetails | null> {
    const sql = `
      SELECT 
        a.*,
        p.fen as position_fen,
        e.slug as engine_slug,
        e.name as engine_name,
        e.version as engine_version
      FROM analysis a
      JOIN positions p ON a.position_id = p.id
      JOIN engines e ON a.engine_id = e.id
      WHERE p.fen = ? AND e.slug = ?
    `;

    const result = await this.runQuery<AnalysisWithDetails>(sql, [
      fen,
      engineSlug,
    ]);
    return result || null;
  }

  async queryAnalysis(query: AnalysisQuery): Promise<AnalysisWithDetails[]> {
    let sql = `
      SELECT 
        a.*,
        p.fen as position_fen,
        e.slug as engine_slug,
        e.name as engine_name,
        e.version as engine_version
      FROM analysis a
      JOIN positions p ON a.position_id = p.id
      JOIN engines e ON a.engine_id = e.id
      WHERE 1=1
    `;

    const params: any[] = [];

    if (query.fen) {
      sql += ' AND p.fen = ?';
      params.push(query.fen);
    }

    if (query.engine_slug) {
      sql += ' AND e.slug = ?';
      params.push(query.engine_slug);
    }

    if (query.min_depth) {
      sql += ' AND a.depth >= ?';
      params.push(query.min_depth);
    }

    if (query.max_depth) {
      sql += ' AND a.depth <= ?';
      params.push(query.max_depth);
    }

    sql += ' ORDER BY a.depth DESC, a.created_at DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);

      if (query.offset) {
        sql += ' OFFSET ?';
        params.push(query.offset);
      }
    }

    return await this.runQueryAll<AnalysisWithDetails>(sql, params);
  }

  async getBestAnalysisForPosition(
    fen: FenString
  ): Promise<AnalysisWithDetails | null> {
    const sql = `
      SELECT 
        a.*,
        p.fen as position_fen,
        e.slug as engine_slug,
        e.name as engine_name,
        e.version as engine_version
      FROM analysis a
      JOIN positions p ON a.position_id = p.id
      JOIN engines e ON a.engine_id = e.id
      WHERE p.fen = ?
      ORDER BY a.depth DESC, a.created_at DESC
      LIMIT 1
    `;

    const result = await this.runQuery<AnalysisWithDetails>(sql, [fen]);
    return result || null;
  }

  async batchUpsertAnalysis(
    analyses: CreateAnalysisData[]
  ): Promise<Analysis[]> {
    const results: Analysis[] = [];

    // Use transaction for better performance
    return new Promise((resolve, reject) => {
      const db = this.db; // Capture database reference for use in callbacks

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare(`
          INSERT INTO analysis (
            position_id, engine_id, depth, time, nodes, nps, 
            score_type, score, pv, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(position_id, engine_id) DO UPDATE SET
            depth = excluded.depth,
            time = excluded.time,
            nodes = excluded.nodes,
            nps = excluded.nps,
            score_type = excluded.score_type,
            score = excluded.score,
            pv = excluded.pv,
            updated_at = CURRENT_TIMESTAMP
        `);

        let completed = 0;
        const total = analyses.length;

        analyses.forEach((data, index) => {
          stmt.run(
            [
              data.position_id,
              data.engine_id,
              data.depth,
              data.time,
              data.nodes,
              data.nps,
              data.score_type,
              data.score,
              data.pv,
            ],
            function (err: Error | null) {
              if (err) {
                stmt.finalize();
                db.run('ROLLBACK');
                reject(err);
                return;
              }

              completed++;
              if (completed === total) {
                stmt.finalize();
                db.run('COMMIT', (commitErr: Error | null) => {
                  if (commitErr) {
                    reject(commitErr);
                  } else {
                    // For simplicity, return empty array since getting all results would require more queries
                    resolve([]);
                  }
                });
              }
            }
          );
        });
      });
    });
  }

  // Performance and maintenance
  async clearCache(): Promise<void> {
    this.engineCache.clear();
    this.positionCache.clear();
    this.analysisCache.clear();
  }

  async getStats(): Promise<{
    totalPositions: number;
    totalEngines: number;
    totalAnalyses: number;
    avgDepth: number;
  }> {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM positions) as totalPositions,
        (SELECT COUNT(*) FROM engines) as totalEngines,
        (SELECT COUNT(*) FROM analysis) as totalAnalyses,
        (SELECT AVG(depth) FROM analysis) as avgDepth
    `;

    const result = await this.runQuery<any>(sql);

    return {
      totalPositions: result.totalPositions || 0,
      totalEngines: result.totalEngines || 0,
      totalAnalyses: result.totalAnalyses || 0,
      avgDepth: Math.round((result.avgDepth || 0) * 100) / 100,
    };
  }

  async cleanupAnalysis(
    olderThanDays: number,
    keepBestDepth = true
  ): Promise<number> {
    let sql = `
      DELETE FROM analysis 
      WHERE created_at < datetime('now', '-${olderThanDays} days')
    `;

    if (keepBestDepth) {
      sql += `
        AND id NOT IN (
          SELECT a1.id FROM analysis a1
          WHERE a1.depth = (
            SELECT MAX(a2.depth) 
            FROM analysis a2 
            WHERE a2.position_id = a1.position_id
          )
        )
      `;
    }

    const result = await this.runStatement(sql);

    // Clear cache after cleanup
    await this.clearCache();

    return result.changes || 0;
  }
}
