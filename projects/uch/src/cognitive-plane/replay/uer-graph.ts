/**
 * Universal Engineering Replay — causal graph prototype (IDEA-0047).
 *
 * One causal engineering graph across hosts, tools, and stores, built on
 * the ADR-002 W3C traceparent spine. Nodes are engineering entities
 * (host/session/artifact/commit/decision/trace); edges are causality
 * (parent_of / touches / ancestor_of / informed_by / references).
 *
 * This is a PROTOTYPE (SOP-08 Prototype stage): in-memory, deterministic,
 * not wired into any pipeline. Public surface:
 *
 *   influencePath(from, to) — why-lineage between two entities
 *   ancestry(commitId)      — versioned causal history (commit DAG)
 *   changePoints(artifact)  — regime shifts in artifact change behavior
 *
 * G1 evidence: research/foundations/07-universal-engineering-replay.md.
 * Design: design/UNIVERSAL-ENGINEERING-REPLAY.md.
 */

import { parseTraceparent } from '../trace-engine/traceparent.js';

export type UerNodeKind = 'host' | 'session' | 'artifact' | 'commit' | 'decision' | 'trace';

export type UerEdgeKind = 'parent_of' | 'touches' | 'ancestor_of' | 'informed_by' | 'references';

/** Edges that propagate influence (why-lineage). */
const INFLUENCE_EDGES: readonly UerEdgeKind[] = [
  'parent_of',
  'informed_by',
  'ancestor_of',
  'references',
];

export interface UerNode {
  id: string;
  kind: UerNodeKind;
  label: string;
  ts: number;
}

export interface UerEdge {
  from: string;
  to: string;
  kind: UerEdgeKind;
  ts: number;
}

export interface UerTraceInput {
  /** W3C traceparent header of the parent ("" when this is a root). */
  traceparent: string;
  /** Node id for this trace. */
  traceId: string;
  label?: string;
  ts?: number;
}

export interface UerChangePoint {
  nodeId: string;
  ts: number;
  changePoint: boolean;
}

export class UerGraph {
  private nodes = new Map<string, UerNode>();
  private edges = new Map<string, UerEdge>();
  /** spanId → nodeId: links incoming traceparent headers to parents. */
  private spanIndex = new Map<string, string>();

  /* ---------------- ingestion ---------------- */

  addNode(id: string, kind: UerNodeKind, label = id, ts = Date.now()): void {
    if (!this.nodes.has(id)) this.nodes.set(id, { id, kind, label, ts });
  }

  addEdge(from: string, to: string, kind: UerEdgeKind, ts = Date.now()): boolean {
    if (from === to) return false;
    if (!this.nodes.has(from) || !this.nodes.has(to)) return false;
    const key = `${kind}:${from}->${to}`;
    if (!this.edges.has(key)) this.edges.set(key, { from, to, kind, ts });
    return true;
  }

  /** Register a span id so later traceparent headers link to it. */
  registerSpan(spanId: string, nodeId: string): void {
    this.spanIndex.set(spanId, nodeId);
  }

  /**
   * Ingest a trace node; if its traceparent references a registered span,
   * create the causal parent_of edge — the cross-host causal spine.
   */
  ingestTrace(input: UerTraceInput): void {
    this.addNode(input.traceId, 'trace', input.label ?? input.traceId, input.ts);
    const parsed = parseTraceparent(input.traceparent || null);
    if (parsed) {
      const parent = this.spanIndex.get(parsed.span_id);
      if (parent) this.addEdge(parent, input.traceId, 'parent_of', input.ts);
    }
    this.spanIndex.set(input.traceId, input.traceId);
  }

  /* ---------------- queries ---------------- */

  /** Shortest causal chain between two entities; null when disconnected. */
  influencePath(from: string, to: string): string[] | null {
    if (from === to) return [from];
    const adjacency = new Map<string, string[]>();
    for (const e of this.edges.values()) {
      if (!INFLUENCE_EDGES.includes(e.kind)) continue;
      adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]);
      adjacency.set(e.to, [...(adjacency.get(e.to) ?? []), e.from]);
    }
    const queue: string[] = [from];
    const prev = new Map<string, string>();
    const seen = new Set<string>([from]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        prev.set(next, current);
        if (next === to) {
          const path: string[] = [to];
          let cursor: string | undefined = to;
          while (cursor !== from && cursor !== undefined) {
            cursor = prev.get(cursor);
            if (cursor !== undefined) path.unshift(cursor);
          }
          return path;
        }
        queue.push(next);
      }
    }
    return null;
  }

  /** Versioned causal history: walk ancestor_of edges (descendant → ancestor). */
  ancestry(commitId: string): string[] {
    const chain: string[] = [];
    const seen = new Set<string>();
    let cursor: string | undefined = commitId;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const parents = [...this.edges.values()]
        .filter((e) => e.kind === 'ancestor_of' && e.from === cursor)
        .map((e) => e.to);
      const parent = parents[0];
      if (!parent) break;
      cursor = parent;
      chain.push(cursor);
    }
    return chain;
  }

  /**
   * Regime shifts in artifact change behavior. A touch is a change point
   * when its gap to the previous touch exceeds twice the mean gap
   * (deterministic first cut; Bayesian detection is the upgrade path).
   */
  changePoints(artifactId: string): UerChangePoint[] {
    const touches = [...this.edges.values()]
      .filter((e) => e.kind === 'touches' && (e.to === artifactId || e.from === artifactId))
      .sort((a, b) => a.ts - b.ts);
    if (touches.length < 2) return touches.map((e) => ({ nodeId: e.from, ts: e.ts, changePoint: false }));
    const gaps: number[] = [];
    for (let i = 1; i < touches.length; i++) {
      const prev = touches[i - 1]!;
      gaps.push(touches[i]!.ts - prev.ts);
    }
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const result: UerChangePoint[] = [];
    for (const [i, t] of touches.entries()) {
      const prev = i > 0 ? touches[i - 1]! : undefined;
      const gap = prev ? t.ts - prev.ts : 0;
      result.push({ nodeId: t.from, ts: t.ts, changePoint: i > 0 && gap > 2 * meanGap });
    }
    return result;
  }

  /* ---------------- introspection ---------------- */

  stats(): { nodes: Record<UerNodeKind, number>; edges: Record<UerEdgeKind, number> } {
    const nodes: Record<UerNodeKind, number> = {
      host: 0, session: 0, artifact: 0, commit: 0, decision: 0, trace: 0,
    };
    for (const n of this.nodes.values()) nodes[n.kind]++;
    const edges: Record<UerEdgeKind, number> = {
      parent_of: 0, touches: 0, ancestor_of: 0, informed_by: 0, references: 0,
    };
    for (const e of this.edges.values()) edges[e.kind]++;
    return { nodes, edges };
  }
}
