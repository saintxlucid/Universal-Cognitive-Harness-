import { TraceLedger } from '../trace-engine/trace-ledger.js';
import { DecisionLog, type DecisionEntry } from '../decisions/decision-log.js';
import { SignalStore, type CognitiveSignal } from '../signals/signal-store.js';
import type { CognitiveTrace } from '../trace-engine/cognitive-trace.js';

export interface DiffResult {
  traces: TraceDiff;
  decisions: DecisionDiff;
  signals: SignalDiff;
  summary: DiffSummary;
}

export interface DiffSummary {
  tracesAdded: number;
  tracesRemoved: number;
  tracesChanged: number;
  decisionsAdded: number;
  signalsAdded: number;
  timeRange: { from: Date; to: Date };
}

export interface TraceDiff {
  added: CognitiveTrace[];
  removed: CognitiveTrace[];
  changed: Array<{ traceId: string; before: CognitiveTrace; after: CognitiveTrace; changes: string[] }>;
}

export interface DecisionDiff {
  added: DecisionEntry[];
}

export interface SignalDiff {
  added: CognitiveSignal[];
}

export interface StateSnapshot {
  traces: CognitiveTrace[];
  decisions: DecisionEntry[];
  timestamp: Date;
}

export class CognitiveDiff {
  private ledger: TraceLedger;
  private decisionLog: DecisionLog;
  private signalStore: SignalStore;

  constructor(ledger: TraceLedger, decisionLog: DecisionLog, signalStore: SignalStore) {
    this.ledger = ledger;
    this.decisionLog = decisionLog;
    this.signalStore = signalStore;
  }

  snapshot(): StateSnapshot {
    return {
      traces: [...this.ledger['traces'].values()],
      decisions: this.decisionLog.getAll(10000),
      timestamp: new Date(),
    };
  }

  diff(before: StateSnapshot, after: StateSnapshot): DiffResult {
    const tracesDiff = this.diffTraces(before.traces, after.traces);
    const decisionsDiff = this.diffDecisions(before.decisions, after.decisions);
    const signalsDiff = this.diffSignals(before, after);

    return {
      traces: tracesDiff,
      decisions: decisionsDiff,
      signals: signalsDiff,
      summary: {
        tracesAdded: tracesDiff.added.length,
        tracesRemoved: tracesDiff.removed.length,
        tracesChanged: tracesDiff.changed.length,
        decisionsAdded: decisionsDiff.added.length,
        signalsAdded: signalsDiff.added.length,
        timeRange: { from: before.timestamp, to: after.timestamp },
      },
    };
  }

  diffByTimeRange(from: Date, to: Date): DiffResult {
    const before: StateSnapshot = { traces: [], decisions: [], timestamp: from };
    const after: StateSnapshot = {
      traces: this.ledger.getByTimeRange(from, to),
      decisions: this.decisionLog.getByTimeRange(from, to),
      timestamp: to,
    };
    return this.diff(before, after);
  }

  diffByTraceCount(threshold: number): DiffResult | null {
    const all = [...this.ledger['traces'].values()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    if (all.length <= threshold) return null;

    const mid = all[threshold]!;
    const before: StateSnapshot = {
      traces: all.slice(0, threshold),
      decisions: this.decisionLog.getByTimeRange(all[0]!.timestamp, mid.timestamp),
      timestamp: mid.timestamp,
    };
    const after: StateSnapshot = {
      traces: all.slice(threshold),
      decisions: this.decisionLog.getByTimeRange(mid.timestamp, new Date()),
      timestamp: new Date(),
    };
    return this.diff(before, after);
  }

  private computeDurationMs(t: { timestamp: Date; end_timestamp: Date | null }): number | null {
    if (!t.end_timestamp) return null;
    return t.end_timestamp.getTime() - t.timestamp.getTime();
  }

  private diffTraces(before: CognitiveTrace[], after: CognitiveTrace[]): TraceDiff {
    const beforeMap = new Map(before.map((t) => [t.trace_id, t]));
    const afterMap = new Map(after.map((t) => [t.trace_id, t]));

    const added: CognitiveTrace[] = [];
    const removed: CognitiveTrace[] = [];
    const changed: TraceDiff['changed'] = [];

    for (const [id, trace] of afterMap) {
      if (!beforeMap.has(id)) {
        added.push(trace);
      } else {
        const beforeTrace = beforeMap.get(id)!;
        const changes = this.detectChanges(beforeTrace, trace);
        if (changes.length > 0) {
          changed.push({ traceId: id, before: beforeTrace, after: trace, changes });
        }
      }
    }

    for (const [id, trace] of beforeMap) {
      if (!afterMap.has(id)) {
        removed.push(trace);
      }
    }

    return { added, removed, changed };
  }

  private diffDecisions(before: DecisionEntry[], after: DecisionEntry[]): DecisionDiff {
    const beforeIds = new Set(before.map((d) => d.id));
    const added = after.filter((d) => !beforeIds.has(d.id));
    return { added };
  }

  private diffSignals(before: StateSnapshot, after: StateSnapshot): SignalDiff {
    const beforeTraces = before.traces.length + before.decisions.length;
    const afterTraces = after.traces.length + after.decisions.length;
    const added: CognitiveSignal[] = [];

    if (afterTraces > beforeTraces) {
      added.push({
        id: crypto.randomUUID(),
        type: 'trace:completed',
        timestamp: after.timestamp,
        source: 'cognitive-diff',
        payload: { newTraces: afterTraces - beforeTraces },
        importance: 0.3,
        acknowledged: false,
      });
    }

    return { added };
  }

  private detectChanges(before: CognitiveTrace, after: CognitiveTrace): string[] {
    const changes: string[] = [];
    if (before.status !== after.status) {
      changes.push(`status: ${before.status} → ${after.status}`);
    }
    if (before.name !== after.name) {
      changes.push(`name: "${before.name}" → "${after.name}"`);
    }
    const beforeDur = this.computeDurationMs(before);
    const afterDur = this.computeDurationMs(after);
    if (beforeDur !== afterDur) {
      const b = beforeDur !== null ? `${beforeDur}ms` : '?';
      const a = afterDur !== null ? `${afterDur}ms` : '?';
      changes.push(`duration: ${b} → ${a}`);
    }
    if (before.events.length !== after.events.length) {
      changes.push(`events: ${before.events.length} → ${after.events.length}`);
    }
    if (before.attributes.length !== after.attributes.length) {
      changes.push(`attributes: ${before.attributes.length} → ${after.attributes.length}`);
    }
    return changes;
  }
}
