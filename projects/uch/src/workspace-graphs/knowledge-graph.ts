import { join, basename } from 'node:path';
import { GraphStore, type GraphEdge } from '../kernel/storage/graph-store.js';
import {
  writeSnapshot,
  readSnapshot,
  type Storable,
} from '../cognitive-plane/persistence/persistence-engine.js';

interface ProvenanceProperties {
  provenance: {
    source: string;
    source_id: string;
    timestamp: number;
    reliability: number;
  };
  confidence: {
    value: number;
    method: 'process_reliability';
    calibration_history: unknown[];
  };
  [key: string]: unknown;
}

export class WorkspaceKnowledgeGraph implements Storable {
  private readonly graph: GraphStore;
  private readonly maxNodes: number;

  constructor(basePath: string, maxNodes = 10000) {
    this.graph = new GraphStore(join(basePath, 'knowledge-graph'));
    this.maxNodes = maxNodes;
  }

  private capGuard(id: string): boolean {
    return this.graph.nodeCount() >= this.maxNodes && !this.graph.getNode(id);
  }

  private provenanceProperties(sourceId: string): ProvenanceProperties {
    return {
      provenance: {
        source: 'system_log',
        source_id: sourceId,
        timestamp: Date.now(),
        reliability: 1.0,
      },
      confidence: {
        value: 1.0,
        method: 'process_reliability',
        calibration_history: [],
      },
    };
  }

  recordArtifact(path: string, meta?: { language?: string; lines?: number }): void {
    const id = `file:${path}`;
    if (this.capGuard(id)) return;
    const properties: Record<string, unknown> = { path };
    if (meta?.language) properties.language = meta.language;
    if (typeof meta?.lines === 'number') properties.lines = meta.lines;
    this.graph.addNode(id, 'artifact', basename(path), properties);
  }

  recordCommit(hash: string, message: string, files: string[] = []): void {
    const id = `commit:${hash}`;
    if (this.capGuard(id)) return;
    this.graph.addNode(id, 'commit', message.split('\n')[0] ?? message, { hash, message });
    for (const file of files) {
      this.recordArtifact(file);
      this.graph.addEdge(
        `commit:${hash}:touches:${file}`,
        `commit:${hash}`,
        `file:${file}`,
        'touches',
        this.provenanceProperties(hash),
        1.0,
      );
    }
  }

  recordBuild(id: string): void {
    const nodeId = `build:${id}`;
    if (this.capGuard(nodeId)) return;
    this.graph.addNode(nodeId, 'build', 'build', { id });
  }

  recordFailure(id: string, message: string, kind: 'test' | 'build' | 'error'): void {
    const nodeId = `failure:${id}`;
    if (this.capGuard(nodeId)) return;
    this.graph.addNode(nodeId, 'failure', 'failure', { message, kind });
  }

  recordPr(id: string, title: string, url: string): void {
    const nodeId = `pr:${id}`;
    if (this.capGuard(nodeId)) return;
    this.graph.addNode(nodeId, 'pr', title, { title, url });
  }

  recordReview(id: string, prId: string): void {
    const nodeId = `review:${id}`;
    if (this.capGuard(nodeId)) return;
    this.graph.addNode(nodeId, 'review', 'review', { prId });
  }

  findArtifacts(): ReturnType<GraphStore['findNodesByType']> {
    return this.graph.findNodesByType('artifact');
  }

  findCommits(): ReturnType<GraphStore['findNodesByType']> {
    return this.graph.findNodesByType('commit');
  }

  findFailures(): ReturnType<GraphStore['findNodesByType']> {
    return this.graph.findNodesByType('failure');
  }

  search(query: string): ReturnType<GraphStore['searchNodes']> {
    return this.graph.searchNodes(query);
  }

  bfs(startId: string, maxDepth = 3): ReturnType<GraphStore['bfs']> {
    return this.graph.bfs(startId, maxDepth);
  }

  findPaths(
    from: string,
    to: string,
    maxDepth = 5,
  ): ReturnType<GraphStore['findPaths']> {
    return this.graph.findPaths(from, to, maxDepth);
  }

  getEdgesFrom(nodeId: string): GraphEdge[] {
    return this.graph.getEdgesFrom(nodeId);
  }

  nodeCount(): number {
    return this.graph.nodeCount();
  }

  edgeCount(): number {
    return this.graph.edgeCount();
  }

  close(): void {
    this.graph.close();
  }

  async persist(filePath: string): Promise<void> {
    writeSnapshot(filePath, {
      version: 1,
      organ: 'knowledge-graph',
      graphPath: 'graphs/knowledge-graph/graph.sqlite',
      nodeCount: this.graph.nodeCount(),
      edgeCount: this.graph.edgeCount(),
      savedAt: new Date(),
    });
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{ version?: number }>(filePath);
    if (!data) return 0;
    return this.graph.nodeCount();
  }
}
