import { join } from 'node:path';
import { GraphStore, type GraphNode } from '../kernel/storage/graph-store.js';
import {
  writeSnapshot,
  readSnapshot,
  type Storable,
} from '../cognitive-plane/persistence/persistence-engine.js';

export interface CycleSummary {
  cycleId: number;
  startedAt: number;
  completedAt: number;
  durationMs: number;
  successful: boolean;
  improvements: Record<string, Record<string, number>>;
  mutationsApplied: number;
  mutationsKept: number;
}

interface CycleCounters {
  cycles: number;
  successful: number;
  failed: number;
  mutationsKept: number;
}

export class WorkspaceEvolutionHistory implements Storable {
  private readonly graph: GraphStore;
  private readonly maxCycles: number;
  private counters: CycleCounters = { cycles: 0, successful: 0, failed: 0, mutationsKept: 0 };

  constructor(basePath: string, maxCycles = 10000) {
    this.graph = new GraphStore(join(basePath, 'evolution-history'));
    this.maxCycles = maxCycles;
  }

  recordCycle(summary: CycleSummary): void {
    if (this.counters.cycles >= this.maxCycles) return;
    this.graph.addNode(
      `cycle:${summary.cycleId}`,
      'cycle',
      `Cycle ${summary.cycleId}`,
      {
        startedAt: summary.startedAt,
        completedAt: summary.completedAt,
        durationMs: summary.durationMs,
        successful: summary.successful,
        improvements: summary.improvements,
        mutationsApplied: summary.mutationsApplied,
        mutationsKept: summary.mutationsKept,
      },
    );
    this.counters.cycles++;
    if (summary.successful) this.counters.successful++;
    else this.counters.failed++;
    this.counters.mutationsKept += summary.mutationsKept;
  }

  getCycles(): GraphNode[] {
    return this.graph.findNodesByType('cycle');
  }

  getCycle(cycleId: number): GraphNode | null {
    return this.graph.getNode(`cycle:${cycleId}`);
  }

  getCycleCount(): number {
    return this.counters.cycles;
  }

  getStats(): CycleCounters {
    return { ...this.counters };
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
      organ: 'evolution-history',
      graphPath: 'graphs/evolution-history/graph.sqlite',
      counters: { ...this.counters },
      nodeCount: this.graph.nodeCount(),
      edgeCount: this.graph.edgeCount(),
      savedAt: new Date(),
    });
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      counters?: {
        cycles?: number;
        successful?: number;
        failed?: number;
        mutationsKept?: number;
      };
    }>(filePath);
    if (!data) return 0;
    if (data.counters) {
      this.counters.cycles = data.counters.cycles ?? 0;
      this.counters.successful = data.counters.successful ?? 0;
      this.counters.failed = data.counters.failed ?? 0;
      this.counters.mutationsKept = data.counters.mutationsKept ?? 0;
    }
    return this.counters.cycles;
  }
}
