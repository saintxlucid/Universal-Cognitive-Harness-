import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  created_at: number;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  properties: Record<string, unknown>;
  weight: number;
  valid_at: number;
  invalid_at: number | null;
  created_at: number;
}

export class GraphStore {
  private db: DatabaseSync;
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!existsSync(basePath)) mkdirSync(basePath, { recursive: true });
    const dbPath = join(basePath, 'graph.sqlite');
    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY, type TEXT NOT NULL, name TEXT NOT NULL,
        properties TEXT, created_at REAL NOT NULL
      )
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY, source TEXT NOT NULL, target TEXT NOT NULL,
        relationship TEXT NOT NULL, properties TEXT, weight REAL DEFAULT 1.0,
        valid_at REAL NOT NULL, invalid_at REAL, created_at REAL NOT NULL
      )
    `);
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_edges_rel ON edges(relationship)');
    this.db.exec('CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)');
  }

  addNode(id: string, type: string, name: string, properties: Record<string, unknown> = {}): void {
    this.db.prepare('INSERT OR REPLACE INTO nodes(id, type, name, properties, created_at) VALUES(?, ?, ?, ?, ?)')
      .run(id, type, name, JSON.stringify(properties), Date.now());
  }

  getNode(id: string): GraphNode | null {
    const row = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return { id: row.id as string, type: row.type as string, name: row.name as string, properties: JSON.parse(row.properties as string), created_at: row.created_at as number };
  }

  findNodesByType(type: string): GraphNode[] {
    const rows = this.db.prepare('SELECT * FROM nodes WHERE type = ?').all(type) as Record<string, unknown>[];
    return rows.map(r => ({ id: r.id as string, type: r.type as string, name: r.name as string, properties: JSON.parse(r.properties as string), created_at: r.created_at as number }));
  }

  searchNodes(query: string): GraphNode[] {
    const rows = this.db.prepare("SELECT * FROM nodes WHERE name LIKE ? OR properties LIKE ?").all(`%${query}%`, `%${query}%`) as Record<string, unknown>[];
    return rows.map(r => ({ id: r.id as string, type: r.type as string, name: r.name as string, properties: JSON.parse(r.properties as string), created_at: r.created_at as number }));
  }

  addEdge(id: string, source: string, target: string, relationship: string, properties: Record<string, unknown> = {}, weight = 1.0): void {
    const existing = this.getEdgesBetween(source, target);
    for (const e of existing) {
      if (e.relationship === relationship && e.invalid_at === null) {
        if (this.detectContradiction(e, { relationship, properties })) {
          this.db.prepare('UPDATE edges SET invalid_at = ? WHERE id = ?').run(Date.now(), e.id);
        }
      }
    }
    this.db.prepare('INSERT OR REPLACE INTO edges(id, source, target, relationship, properties, weight, valid_at, invalid_at, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, source, target, relationship, JSON.stringify(properties), weight, Date.now(), null, Date.now());
  }

  getEdge(id: string): GraphEdge | null {
    const row = this.db.prepare('SELECT * FROM edges WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.rowToEdge(row);
  }

  getEdgesBetween(source: string, target: string): GraphEdge[] {
    const rows = this.db.prepare('SELECT * FROM edges WHERE (source = ? AND target = ?) OR (source = ? AND target = ?)').all(source, target, target, source) as Record<string, unknown>[];
    return rows.map(r => this.rowToEdge(r));
  }

  getEdgesFrom(nodeId: string, onlyValid = true): GraphEdge[] {
    const rows = onlyValid
      ? this.db.prepare("SELECT * FROM edges WHERE (source = ? OR target = ?) AND invalid_at IS NULL").all(nodeId, nodeId) as Record<string, unknown>[]
      : this.db.prepare("SELECT * FROM edges WHERE source = ? OR target = ?").all(nodeId, nodeId) as Record<string, unknown>[];
    return rows.map(r => this.rowToEdge(r));
  }

  bfs(startId: string, maxDepth = 3): GraphNode[][] {
    const levels: GraphNode[][] = [];
    const visited = new Set<string>();
    let current: string[] = [startId];
    visited.add(startId);
    for (let depth = 0; depth <= maxDepth && current.length > 0; depth++) {
      const nodes = current.map(id => this.getNode(id)).filter((n): n is GraphNode => n !== null);
      if (nodes.length > 0) levels.push(nodes);
      const next: string[] = [];
      for (const c of current) {
        const edges = this.getEdgesFrom(c);
        for (const e of edges) {
          const neighbor = e.source === c ? e.target : e.source;
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            next.push(neighbor);
          }
        }
      }
      current = next;
    }
    return levels;
  }

  findPaths(from: string, to: string, maxDepth = 5): { nodes: GraphNode[]; edges: GraphEdge[] }[] {
    const paths: { nodes: GraphNode[]; edges: GraphEdge[] }[] = [];
    const visited = new Set<string>();
    const dfs = (current: string, path: GraphEdge[], depth: number) => {
      if (depth > maxDepth) return;
      if (current === to && path.length > 0) {
        const nodes: GraphNode[] = [];
        for (const e of path) {
          if (nodes.length === 0) { const n = this.getNode(e.source); if (n) nodes.push(n); }
          const n = this.getNode(e.target); if (n) nodes.push(n);
        }
        paths.push({ nodes, edges: [...path] });
        return;
      }
      visited.add(current);
      for (const edge of this.getEdgesFrom(current)) {
        const next = edge.source === current ? edge.target : edge.source;
        if (!visited.has(next)) {
          path.push(edge);
          dfs(next, path, depth + 1);
          path.pop();
        }
      }
      visited.delete(current);
    };
    dfs(from, [], 0);
    return paths;
  }

  detectContradictions(): { edge1: GraphEdge; edge2: GraphEdge }[] {
    const all = this.db.prepare("SELECT * FROM edges WHERE invalid_at IS NULL").all() as Record<string, unknown>[];
    const edges = all.map(r => this.rowToEdge(r));
    const contradictions: { edge1: GraphEdge; edge2: GraphEdge }[] = [];
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const e1 = edges[i]!;
        const e2 = edges[j]!;
        const samePair = (e1.source === e2.source && e1.target === e2.target) || (e1.source === e2.target && e1.target === e2.source);
        if (samePair && e1.relationship !== e2.relationship && this.detectContradiction(e1, e2)) {
          contradictions.push({ edge1: e1, edge2: e2 });
        }
      }
    }
    return contradictions;
  }

  private detectContradiction(a: GraphEdge, b: { relationship: string; properties: Record<string, unknown> }): boolean {
    return a.relationship === b.relationship;
  }

  private rowToEdge(r: Record<string, unknown>): GraphEdge {
    return {
      id: r.id as string, source: r.source as string, target: r.target as string,
      relationship: r.relationship as string, properties: JSON.parse(r.properties as string),
      weight: r.weight as number, valid_at: r.valid_at as number, invalid_at: r.invalid_at as number | null,
      created_at: r.created_at as number,
    };
  }

  nodeCount(): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM nodes').get() as { cnt: number }).cnt;
  }

  edgeCount(): number {
    return (this.db.prepare('SELECT COUNT(*) as cnt FROM edges').get() as { cnt: number }).cnt;
  }

  clear(): void {
    this.db.exec('DELETE FROM edges');
    this.db.exec('DELETE FROM nodes');
  }

  close(): void {
    this.db.close();
  }
}
