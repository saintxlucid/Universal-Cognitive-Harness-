import { TraceLedger } from '../trace-engine/trace-ledger.js';
import type { CognitiveTrace } from '../trace-engine/cognitive-trace.js';

export interface ReplaySnapshot {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  timestamp: Date;
  status: string;
  depth: number;
  attributes: Array<{ key: string; value: string | number | boolean | string[] | number[] }>;
  children: ReplaySnapshot[];
}

export interface ReplayOptions {
  includeAttributes?: boolean;
  filterByStatus?: string;
  fromTimestamp?: Date;
  toTimestamp?: Date;
}

export class CognitiveReplay {
  private ledger: TraceLedger;

  constructor(ledger: TraceLedger) {
    this.ledger = ledger;
  }

  getTraceTree(traceId: string): ReplaySnapshot | null {
    const root = this.ledger.getByTraceId(traceId);
    if (!root) return null;
    return this.buildSnapshot(root);
  }

  replay(traceId: string, options?: ReplayOptions): ReplaySnapshot[] {
    const tree = this.getTraceTree(traceId);
    if (!tree) return [];

    const flat: ReplaySnapshot[] = [];
    const flatten = (node: ReplaySnapshot, depth: number): void => {
      if (options?.filterByStatus && node.status !== options.filterByStatus) {
        for (const child of node.children) flatten(child, depth + 1);
        return;
      }
      if (options?.fromTimestamp && node.timestamp < options.fromTimestamp) {
        for (const child of node.children) flatten(child, depth + 1);
        return;
      }
      if (options?.toTimestamp && node.timestamp > options.toTimestamp) {
        for (const child of node.children) flatten(child, depth + 1);
        return;
      }
      flat.push(node);
      for (const child of node.children) flatten(child, depth + 1);
    };
    flatten(tree, 0);

    return flat;
  }

  replayRecent(limit = 10): ReplaySnapshot[][] {
    const recent = this.ledger.getRecent(limit * 2);
    const roots = recent.filter((t) => !t.parent_span_id);
    const trees: ReplaySnapshot[][] = [];

    for (const root of roots.slice(0, limit)) {
      const snap = this.getTraceTree(root.trace_id);
      if (snap) {
        trees.push(this.replay(root.trace_id));
      }
    }

    return trees;
  }

  getProjectTimeline(): Array<{ timestamp: Date; name: string; trace_id: string; duration_ms: number | null }> {
    const all = [...this.ledger.getRecent(1000)];
    return all
      .filter((t) => !t.parent_span_id)
      .map((t) => ({
        timestamp: t.timestamp,
        name: t.name,
        trace_id: t.trace_id,
        duration_ms: t.end_timestamp ? t.end_timestamp.getTime() - t.timestamp.getTime() : null,
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getWorkspaceState(atTimestamp?: Date): {
    last_session: CognitiveTrace | null;
    recent_operations: string[];
    total_traces: number;
  } {
    const all = [...this.ledger.getRecent(100)];
    const filtered = atTimestamp
      ? all.filter((t) => t.timestamp <= atTimestamp)
      : all;

    const lastSession = filtered.find((t) => t.name === 'session.start' || t.name === 'session.end');

    const operations = new Set<string>();
    for (const t of filtered) {
      operations.add(t.name);
    }

    return {
      last_session: lastSession ?? null,
      recent_operations: [...operations].slice(0, 20),
      total_traces: this.ledger.count(),
    };
  }

  private buildSnapshot(trace: CognitiveTrace): ReplaySnapshot {
    const children = this.ledger.getChildren(trace.span_id);
    return {
      trace_id: trace.trace_id,
      span_id: trace.span_id,
      parent_span_id: trace.parent_span_id,
      name: trace.name,
      timestamp: trace.timestamp,
      status: trace.status,
      depth: 0,
      attributes: trace.attributes,
      children: children.map((c) => this.buildSnapshot(c)),
    };
  }
}
