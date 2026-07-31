import { join, basename } from 'node:path';
import { GraphStore, type GraphNode, type GraphEdge } from '../kernel/storage/graph-store.js';
import {
  writeSnapshot,
  readSnapshot,
  type Storable,
} from '../cognitive-plane/persistence/persistence-engine.js';
import type { TaskStatus } from '../cognitive-plane/scheduler/task-scheduler.js';

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

export class WorkspaceTaskGraph implements Storable {
  private readonly graph: GraphStore;
  private readonly maxNodes: number;

  constructor(basePath: string, maxNodes = 10000) {
    this.graph = new GraphStore(join(basePath, 'task-graph'));
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

  recordTask(taskId: string, name: string): void {
    const id = `task:${taskId}`;
    if (this.capGuard(id)) return;
    this.graph.addNode(id, 'task', name, {});
  }

  recordDependency(taskId: string, dependsOnId: string): void {
    this.graph.addEdge(
      `dep:${taskId}:${dependsOnId}`,
      `task:${taskId}`,
      `task:${dependsOnId}`,
      'depends_on',
      this.provenanceProperties(`${taskId}:${dependsOnId}`),
      1.0,
    );
  }

  recordStatusChange(taskId: string, from: TaskStatus, to: TaskStatus): void {
    this.graph.addEdge(
      `status:${taskId}:${from}:${to}`,
      `task:${taskId}`,
      `task:${taskId}`,
      'status_changed',
      { ...this.provenanceProperties(taskId), from, to },
      1.0,
    );
  }

  recordTaskFile(taskId: string, filePath: string): void {
    const fileId = `file:${filePath}`;
    if (this.capGuard(fileId)) {
      const existing = this.graph.getNode(fileId);
      if (!existing) return;
    }
    this.graph.addNode(fileId, 'artifact', basename(filePath), { path: filePath });
    this.graph.addEdge(
      `touches:${taskId}:${filePath}`,
      `task:${taskId}`,
      fileId,
      'touches',
      this.provenanceProperties(filePath),
      1.0,
    );
  }

  recordTaskDecision(taskId: string, decisionId: string): void {
    this.graph.addEdge(
      `informed_by:${taskId}:${decisionId}`,
      `task:${taskId}`,
      `decision:${decisionId}`,
      'informed_by',
      this.provenanceProperties(`${taskId}:${decisionId}`),
      1.0,
    );
  }

  getTask(taskId: string): GraphNode | null {
    return this.graph.getNode(`task:${taskId}`);
  }

  getDependencies(taskId: string): GraphEdge[] {
    return this.graph
      .getEdgesFrom(`task:${taskId}`)
      .filter((e) => e.relationship === 'depends_on');
  }

  getStatusTransitions(taskId: string): GraphEdge[] {
    return this.graph
      .getEdgesFrom(`task:${taskId}`)
      .filter((e) => e.relationship === 'status_changed');
  }

  getEdgesFrom(nodeId: string): GraphEdge[] {
    return this.graph.getEdgesFrom(nodeId);
  }

  getNode(nodeId: string): GraphNode | null {
    return this.graph.getNode(nodeId);
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
      organ: 'task-graph',
      graphPath: 'graphs/task-graph/graph.sqlite',
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
