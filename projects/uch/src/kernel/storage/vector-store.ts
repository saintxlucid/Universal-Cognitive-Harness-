import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_DIMENSION = 1536;

export interface VectorRecord {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
  timestamp: number;
}

export interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

export class VectorStore {
  private db: DatabaseSync;
  private dimension: number;
  private indexPath: string;

  constructor(basePath: string, dimension = DEFAULT_DIMENSION) {
    this.dimension = dimension;
    this.indexPath = basePath;
    if (!existsSync(basePath)) mkdirSync(basePath, { recursive: true });
    const dbPath = join(basePath, 'vectors.sqlite');
    this.db = new DatabaseSync(dbPath);
    this.db.exec('CREATE TABLE IF NOT EXISTS vectors (id TEXT PRIMARY KEY, vector BLOB, metadata TEXT, timestamp REAL)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_vectors_ts ON vectors(timestamp)');
  }

  insert(id: string, vector: number[], metadata: Record<string, unknown> = {}): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO vectors(id, vector, metadata, timestamp) VALUES(?, ?, ?, ?)');
    stmt.run(id, JSON.stringify(vector), JSON.stringify(metadata), Date.now());
  }

  batchInsert(records: { id: string; vector: number[]; metadata?: Record<string, unknown> }[]): void {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO vectors(id, vector, metadata, timestamp) VALUES(?, ?, ?, ?)');
    for (const r of records) {
      stmt.run(r.id, JSON.stringify(r.vector), JSON.stringify(r.metadata ?? {}), Date.now());
    }
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM vectors WHERE id = ?').run(id);
  }

  get(id: string): VectorRecord | null {
    const row = this.db.prepare('SELECT * FROM vectors WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      vector: JSON.parse(row.vector as string),
      metadata: JSON.parse(row.metadata as string),
      timestamp: row.timestamp as number,
    };
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as cnt FROM vectors').get() as { cnt: number };
    return row.cnt;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!;
      magA += a[i]! * a[i]!;
      magB += b[i]! * b[i]!;
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    return denom === 0 ? 0 : dot / denom;
  }

  search(query: number[], topK = 10, filter?: (meta: Record<string, unknown>) => boolean): SearchResult[] {
    const rows = this.db.prepare('SELECT * FROM vectors').all() as { id: string; vector: string; metadata: string; timestamp: number }[];
    const scored: { id: string; score: number; metadata: Record<string, unknown> }[] = [];
    for (const row of rows) {
      const metadata = JSON.parse(row.metadata);
      if (filter && !filter(metadata)) continue;
      const vec = JSON.parse(row.vector) as number[];
      if (vec.length !== query.length) continue;
      const score = this.cosineSimilarity(query, vec);
      scored.push({ id: row.id, score, metadata });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  clear(): void {
    this.db.exec('DELETE FROM vectors');
  }

  close(): void {
    this.db.close();
  }

  getAll(): VectorRecord[] {
    const rows = this.db.prepare('SELECT * FROM vectors ORDER BY timestamp DESC').all() as { id: string; vector: string; metadata: string; timestamp: number }[];
    return rows.map(r => ({
      id: r.id,
      vector: JSON.parse(r.vector),
      metadata: JSON.parse(r.metadata),
      timestamp: r.timestamp,
    }));
  }
}
