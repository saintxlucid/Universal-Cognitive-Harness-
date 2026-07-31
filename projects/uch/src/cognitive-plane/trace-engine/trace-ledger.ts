import type { CognitiveTrace, TraceEventType } from './cognitive-trace.js';

export interface TraceLedgerStats {
  total_traces: number;
  by_name: Record<string, number>;
  by_agent: Record<string, number>;
  time_range: { earliest: Date | null; latest: Date | null };
  bytes_approximate: number;
}

export class TraceLedger {
  private traces: Map<string, CognitiveTrace> = new Map();
  private spanToTrace: Map<string, string> = new Map();
  private childSpans: Map<string, string[]> = new Map();

  append(trace: CognitiveTrace): string {
    this.traces.set(trace.trace_id, { ...trace });
    this.spanToTrace.set(trace.span_id, trace.trace_id);

    if (trace.parent_span_id) {
      const siblings = this.childSpans.get(trace.parent_span_id) ?? [];
      siblings.push(trace.span_id);
      this.childSpans.set(trace.parent_span_id, siblings);
    }

    return trace.trace_id;
  }

  update(traceId: string, updates: Partial<CognitiveTrace>): boolean {
    const existing = this.traces.get(traceId);
    if (!existing) return false;
    this.traces.set(traceId, { ...existing, ...updates, trace_id: traceId });
    return true;
  }

  getByTraceId(traceId: string): CognitiveTrace | undefined {
    return this.traces.get(traceId);
  }

  getSpanByTraceId(spanId: string): CognitiveTrace | undefined {
    const traceId = this.spanToTrace.get(spanId);
    if (!traceId) return undefined;
    return this.traces.get(traceId);
  }

  getChildren(parentSpanId: string): CognitiveTrace[] {
    const childSpanIds = this.childSpans.get(parentSpanId) ?? [];
    const results: CognitiveTrace[] = [];
    for (const spanId of childSpanIds) {
      const traceId = this.spanToTrace.get(spanId);
      if (traceId) {
        const trace = this.traces.get(traceId);
        if (trace) results.push(trace);
      }
    }
    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  getTraceTree(traceId: string): CognitiveTrace[] {
    const root = this.traces.get(traceId);
    if (!root) return [];

    const all: CognitiveTrace[] = [root];
    const queue = [root.span_id];
    while (queue.length > 0) {
      const spanId = queue.shift()!;
      const children = this.getChildren(spanId);
      for (const child of children) {
        all.push(child);
        queue.push(child.span_id);
      }
    }
    return all;
  }

  getByTimeRange(start: Date, end: Date): CognitiveTrace[] {
    const results: CognitiveTrace[] = [];
    for (const [, trace] of this.traces) {
      if (trace.timestamp >= start && trace.timestamp <= end) {
        results.push(trace);
      }
    }
    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getRecent(limit = 50): CognitiveTrace[] {
    const sorted = [...this.traces.values()].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return sorted.slice(0, limit);
  }

  count(): number {
    return this.traces.size;
  }

  getStats(): TraceLedgerStats {
    const byName: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const [, trace] of this.traces) {
      byName[trace.name] = (byName[trace.name] ?? 0) + 1;
      const agentAttr = trace.attributes.find((a) => a.key === 'agent.id');
      if (agentAttr) {
        const agentId = String(agentAttr.value);
        byAgent[agentId] = (byAgent[agentId] ?? 0) + 1;
      }
      if (!earliest || trace.timestamp < earliest) earliest = trace.timestamp;
      if (!latest || trace.timestamp > latest) latest = trace.timestamp;
    }

    return {
      total_traces: this.traces.size,
      by_name: byName,
      by_agent: byAgent,
      time_range: { earliest, latest },
      bytes_approximate: JSON.stringify([...this.traces.values()]).length,
    };
  }

  async *stream(from?: Date): AsyncIterable<CognitiveTrace> {
    const sorted = [...this.traces.values()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    for (const trace of sorted) {
      if (from && trace.timestamp < from) continue;
      yield trace;
    }
  }
}
