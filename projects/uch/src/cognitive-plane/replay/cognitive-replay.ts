import { TraceLedger } from '../trace-engine/trace-ledger.js';
import type { CognitiveTrace, TraceAttribute } from '../trace-engine/cognitive-trace.js';
import { generateSpanId } from '../trace-engine/cognitive-trace.js';
import { serializeTraceparent } from '../trace-engine/traceparent.js';
import type { NeuralEventBus, EventType } from '../../event-bus/neural-event-bus.js';

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

export interface ReplayEventEntry {
  trace_id: string;
  span_id: string;
  span_name: string;
  span_status: string;
  event_id: string;
  timestamp: Date;
  type: string;
  attributes: TraceAttribute[];
  depth: number;
}

export interface ResumeContext {
  trace_id: string;
  root_span_id: string;
  root_name: string;
  started_at: Date;
  ended_at: Date | null;
  span_count: number;
  files_touched: string[];
  decisions: ReplayEventEntry[];
  pending_plan_steps: ReplayEventEntry[];
  errors: ReplayEventEntry[];
  tool_calls: ReplayEventEntry[];
  status_summary: Record<string, Record<string, number>>;
  continuation: {
    trace_id: string;
    parent_span_id: string;
    traceparent: string;
  };
}

function attr(attributes: TraceAttribute[], key: string): string | number | boolean | string[] | number[] | undefined {
  return attributes.find((a) => a.key === key)?.value;
}

function stringAttr(attributes: TraceAttribute[], key: string): string | undefined {
  const value = attr(attributes, key);
  return typeof value === 'string' ? value : undefined;
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

  /**
   * Flatten every trace event across a trace tree into one chronological
   * stream — the flight-recorder view of what actually happened.
   */
  replayEvents(traceId: string): ReplayEventEntry[] {
    const tree = this.getTraceTree(traceId);
    if (!tree) return [];

    const entries: ReplayEventEntry[] = [];
    const walk = (node: ReplaySnapshot, depth: number): void => {
      const span = this.ledger.getSpanByTraceId(node.span_id);
      for (const evt of span?.events ?? []) {
        entries.push({
          trace_id: node.trace_id,
          span_id: node.span_id,
          span_name: node.name,
          span_status: node.status,
          event_id: evt.id,
          timestamp: evt.timestamp,
          type: evt.type,
          attributes: evt.attributes,
          depth,
        });
      }
      for (const child of node.children) walk(child, depth + 1);
    };
    walk(tree, 0);

    return entries.sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.depth - b.depth,
    );
  }

  /**
   * Build a machine-readable continuation packet: what the trace touched,
   * decided, failed on, and the traceparent that lets an incoming agent
   * continue the same cognitive trace.
   */
  resumeContext(traceId: string): ResumeContext | null {
    const tree = this.getTraceTree(traceId);
    if (!tree) return null;

    const events = this.replayEvents(traceId);
    const files = new Set<string>();
    const decisions: ReplayEventEntry[] = [];
    const pending: ReplayEventEntry[] = [];
    const errors: ReplayEventEntry[] = [];
    const toolCalls: ReplayEventEntry[] = [];
    const statusSummary: Record<string, Record<string, number>> = {};

    for (const snap of this.replay(traceId)) {
      statusSummary[snap.name] ??= {};
      statusSummary[snap.name]![snap.status] = (statusSummary[snap.name]![snap.status] ?? 0) + 1;
    }

    for (const entry of events) {
      if (entry.type === 'decision') decisions.push(entry);
      if (entry.type === 'tool_call') toolCalls.push(entry);
      if (entry.type === 'plan_step' && entry.span_status !== 'ok') pending.push(entry);
      if (entry.span_status === 'error' || entry.type === 'diagnostic') errors.push(entry);
    }

    const allSpans = this.ledger.getTraceTree(traceId);
    for (const span of allSpans) {
      const candidates = [
        ...span.attributes,
        ...span.events.flatMap((e) => e.attributes),
      ];
      const path = stringAttr(candidates, 'payload.path')
        ?? stringAttr(candidates, 'payload.file')
        ?? stringAttr(candidates, 'file.path');
      if (path) files.add(path);
    }

    const rootSpan = this.ledger.getByTraceId(traceId);
    const continuationSpanId = generateSpanId();

    return {
      trace_id: tree.trace_id,
      root_span_id: tree.span_id,
      root_name: tree.name,
      started_at: tree.timestamp,
      ended_at: rootSpan?.end_timestamp ?? null,
      span_count: this.replay(traceId).length,
      files_touched: [...files],
      decisions,
      pending_plan_steps: pending,
      errors,
      tool_calls: toolCalls,
      status_summary: statusSummary,
      continuation: {
        trace_id: tree.trace_id,
        parent_span_id: continuationSpanId,
        traceparent: serializeTraceparent(tree.trace_id, continuationSpanId),
      },
    };
  }

  /**
   * Re-publish a recorded trace tree as NeuralEvents on the event bus so
   * memory, learning, and reflection engines re-consume past cognition.
   * Events carry the original trace lineage in metadata (replay_of,
   * traceparent). Returns the number of events published.
   */
  async hydrate(eventBus: NeuralEventBus, traceId: string): Promise<number> {
    const spans = this.ledger.getTraceTree(traceId);
    if (spans.length === 0) return 0;

    let published = 0;
    for (const span of spans) {
      let eventType = stringAttr(span.attributes, 'event.type');
      if (!eventType) {
        for (const evt of span.events) {
          const t = stringAttr(evt.attributes, 'event.type');
          if (t) {
            eventType = t;
            break;
          }
        }
      }
      if (!eventType) continue;

      const payload: Record<string, unknown> = {};
      for (const a of span.attributes) {
        if (a.key.startsWith('payload.')) {
          payload[a.key.slice('payload.'.length)] = a.value;
        }
      }
      for (const evt of span.events) {
        for (const a of evt.attributes) {
          if (a.key.startsWith('payload.')) {
            payload[a.key.slice('payload.'.length)] = a.value;
          }
        }
      }

      const agentId = stringAttr(span.attributes, 'agent.id');
      const sessionId = stringAttr(span.attributes, 'session.id');
      const workspaceId = stringAttr(span.attributes, 'workspace.id');

      await eventBus.publish({
        type: eventType as EventType,
        source: stringAttr(span.attributes, 'event.source') ?? 'replay',
        payload,
        metadata: {
          session_id: sessionId,
          agent_id: agentId,
          workspace_id: workspaceId,
          replay_of: traceId,
          traceparent: serializeTraceparent(span.trace_id, span.span_id),
        },
      });
      published++;
    }

    return published;
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
