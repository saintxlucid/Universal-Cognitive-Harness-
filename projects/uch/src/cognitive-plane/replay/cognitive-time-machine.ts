import type { TraceLedger } from '../trace-engine/trace-ledger.js';
import type { CognitiveTrace, TraceAttribute, TraceEvent } from '../trace-engine/cognitive-trace.js';

export type BeliefKind = 'decision' | 'hypothesis' | 'verification' | 'error' | 'lesson';

export interface BeliefEntry {
  kind: BeliefKind;
  statement: string;
  at: Date;
  span_id: string;
  trace_id: string;
}

export interface BeliefSnapshot {
  at: Date;
  decisions: BeliefEntry[];
  hypotheses: BeliefEntry[];
  verifications: BeliefEntry[];
  errors: BeliefEntry[];
  lessons: BeliefEntry[];
  files_touched: string[];
  tools_used: string[];
  open_plan_steps: string[];
  summary: string[];
}

export interface ClaimSource {
  claimsAt(timestamp: Date): Array<{ statement: string; confidence: number; first_observed: Date }>;
}

const BELIEF_KIND_BY_EVENT: Record<string, BeliefKind> = {
  decision: 'decision',
  hypothesis: 'hypothesis',
  plan_step: 'hypothesis',
  verification: 'verification',
  test_pass: 'verification',
  diagnostic: 'error',
  build_failure: 'error',
  test_fail: 'error',
  reflection: 'lesson',
};

function attr(attributes: TraceAttribute[], key: string): string | number | boolean | string[] | number[] | undefined {
  return attributes.find((a) => a.key === key)?.value;
}

function stringAttr(attributes: TraceAttribute[], key: string): string | undefined {
  const value = attr(attributes, key);
  return typeof value === 'string' ? value : undefined;
}

function firstString(attributes: TraceAttribute[], keys: string[]): string | undefined {
  for (const key of keys) {
    const value = stringAttr(attributes, key);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * The Cognitive Time Machine: point-in-time queries over the trace ledger.
 *
 * "What did the organism believe on March 18th before we discovered the cache
 * bug?" is answered by reconstructing the belief snapshot as of that moment —
 * decisions, hypotheses, verifications, errors, and lessons recorded at or
 * before the query time. No new recording mechanism: this is a read model over
 * the immutable ledger (Law 12 — Reversibility).
 */
export class CognitiveTimeMachine {
  private ledger: TraceLedger;
  private claims?: ClaimSource;

  constructor(ledger: TraceLedger, claims?: ClaimSource) {
    this.ledger = ledger;
    this.claims = claims;
  }

  /** Reconstruct the belief snapshot exactly as of `at`. */
  beliefsAt(at: Date): BeliefSnapshot {
    const spans = this.ledger.getByTimeRange(new Date(0), at);
    const snapshot: BeliefSnapshot = {
      at,
      decisions: [],
      hypotheses: [],
      verifications: [],
      errors: [],
      lessons: [],
      files_touched: [],
      tools_used: [],
      open_plan_steps: [],
      summary: [],
    };

    const files = new Set<string>();
    const tools = new Set<string>();

    for (const span of spans) {
      for (const entry of this.entriesFrom(span, at)) {
        this.pushInto(snapshot, entry);
      }
      const file = firstString(span.attributes, ['payload.path', 'payload.file', 'file.path']);
      if (file) files.add(file);
      const tool = firstString(span.attributes, ['payload.tool', 'tool.name']);
      if (tool) tools.add(tool);
    }

    const claimed = this.claims?.claimsAt(at) ?? [];
    for (const claim of claimed) {
      if (claim.first_observed > at) continue;
      snapshot.summary.push(`${claim.statement} [${Math.round(claim.confidence * 100)}%]`);
    }

    snapshot.files_touched = [...files];
    snapshot.tools_used = [...tools];
    snapshot.summary.sort();
    return snapshot;
  }

  private pushInto(snapshot: BeliefSnapshot, entry: BeliefEntry): void {
    if (entry.kind === 'decision') snapshot.decisions.push(entry);
    else if (entry.kind === 'hypothesis') snapshot.hypotheses.push(entry);
    else if (entry.kind === 'verification') snapshot.verifications.push(entry);
    else if (entry.kind === 'error') snapshot.errors.push(entry);
    else if (entry.kind === 'lesson') snapshot.lessons.push(entry);
  }

  /** Chronological index of every belief the organism ever held. */
  beliefTimeline(): BeliefEntry[] {
    const all = this.ledger.getRecent(Number.MAX_SAFE_INTEGER);
    const entries: BeliefEntry[] = [];
    for (const span of all) {
      entries.push(...this.entriesFrom(span, new Date(8640000000000000)));
    }
    return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
  }

  /** What changed between two moments: statements gained and lost. */
  diffBeliefs(from: Date, to: Date): { gained: BeliefEntry[]; removed: BeliefEntry[] } {
    const at = (t: Date): Map<string, BeliefEntry> => {
      const map = new Map<string, BeliefEntry>();
      for (const entry of this.beliefTimeline()) {
        if (entry.at > t) continue;
        map.set(`${entry.kind}:${entry.statement}`, entry);
      }
      return map;
    };

    const before = at(from);
    const after = at(to);
    const gained: BeliefEntry[] = [];
    const removed: BeliefEntry[] = [];

    for (const [key, entry] of after) {
      if (!before.has(key)) gained.push(entry);
    }
    for (const [key, entry] of before) {
      if (!after.has(key)) removed.push(entry);
    }

    return { gained: gained.sort((a, b) => a.at.getTime() - b.at.getTime()), removed };
  }

  private entriesFrom(span: CognitiveTrace, at: Date): BeliefEntry[] {
    const entries: BeliefEntry[] = [];
    for (const event of span.events) {
      if (event.timestamp > at) continue;
      const kind = BELIEF_KIND_BY_EVENT[event.type];
      if (!kind) continue;
      const statement = this.statementOf(kind, span, event);
      if (!statement) continue;
      entries.push({ kind, statement, at: event.timestamp, span_id: span.span_id, trace_id: span.trace_id });
      if (kind === 'error' && span.status_message && span.status_message !== statement) {
        entries.push({ kind: 'error', statement: span.status_message, at: event.timestamp, span_id: span.span_id, trace_id: span.trace_id });
      }
    }
    return entries;
  }

  private statementOf(kind: BeliefKind, span: CognitiveTrace, event: TraceEvent): string | undefined {
    const eventKeys: Record<BeliefKind, string[]> = {
      decision: ['payload.title', 'payload.choice', 'payload.decision', 'payload.question'],
      hypothesis: ['payload.hypothesis', 'payload.statement', 'payload.step', 'payload.question'],
      verification: ['payload.finding', 'payload.result', 'payload.test'],
      error: ['payload.error', 'payload.message', 'payload.test'],
      lesson: ['payload.lesson', 'payload.reflection'],
    };
    const fromEvent = firstString(event.attributes, eventKeys[kind]);
    if (fromEvent !== undefined) return fromEvent;
    return firstString(span.attributes, eventKeys[kind]);
  }
}
