import { join, basename } from 'node:path';
import { GraphStore, type GraphNode, type GraphEdge } from '../kernel/storage/graph-store.js';
import {
  writeSnapshot,
  readSnapshot,
  type Storable,
} from '../cognitive-plane/persistence/persistence-engine.js';

export type DecisionRelation = 'causes' | 'alternative_to' | 'supersedes' | 'references';

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

export class WorkspaceDecisionGraph implements Storable {
  private readonly graph: GraphStore;
  private readonly maxNodes: number;

  constructor(basePath: string, maxNodes = 10000) {
    this.graph = new GraphStore(join(basePath, 'decision-graph'));
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

  recordDecision(decisionId: string, title: string): void {
    const id = `decision:${decisionId}`;
    if (this.capGuard(id)) return;
    this.graph.addNode(id, 'decision', title, {});
  }

  recordRelation(
    fromDecisionId: string,
    toDecisionId: string,
    relation: DecisionRelation,
  ): void {
    this.graph.addEdge(
      `${relation}:${fromDecisionId}:${toDecisionId}`,
      `decision:${fromDecisionId}`,
      `decision:${toDecisionId}`,
      relation,
      this.provenanceProperties(`${fromDecisionId}:${toDecisionId}`),
      1.0,
    );
  }

  recordDecisionFile(decisionId: string, filePath: string): void {
    const fileId = `file:${filePath}`;
    if (this.capGuard(fileId)) {
      const existing = this.graph.getNode(fileId);
      if (!existing) return;
    }
    this.graph.addNode(fileId, 'artifact', basename(filePath), { path: filePath });
    this.graph.addEdge(
      `references:${decisionId}:${filePath}`,
      `decision:${decisionId}`,
      fileId,
      'references',
      this.provenanceProperties(filePath),
      1.0,
    );
  }

  getDecision(decisionId: string): GraphNode | null {
    return this.graph.getNode(`decision:${decisionId}`);
  }

  search(query: string): GraphNode[] {
    return this.graph.searchNodes(query);
  }

  getRelations(decisionId: string): GraphEdge[] {
    return this.graph.getEdgesFrom(`decision:${decisionId}`);
  }

  findPaths(
    from: string,
    to: string,
    maxDepth = 5,
  ): ReturnType<GraphStore['findPaths']> {
    return this.graph.findPaths(from, to, maxDepth);
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
      organ: 'decision-graph',
      graphPath: 'graphs/decision-graph/graph.sqlite',
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
