import { TraceLedger } from '../trace-engine/trace-ledger.js';
import { DecisionLog } from '../decisions/decision-log.js';
import { SignalStore } from '../signals/signal-store.js';

export interface AnalyticsReport {
  generatedAt: Date;
  traces: TraceAnalytics;
  decisions: DecisionAnalytics;
  signals: SignalAnalytics;
  activity: ActivityAnalytics;
}

export interface TraceAnalytics {
  totalTraces: number;
  byName: Record<string, number>;
  byKind: Record<string, number>;
  byAgent: Record<string, number>;
  byHour: Record<string, number>;
  avgDurationMs: number;
  errorRate: number;
}

export interface DecisionAnalytics {
  total: number;
  byOutcome: Record<string, number>;
  topTags: Array<{ tag: string; count: number }>;
  byDay: Record<string, number>;
}

export interface SignalAnalytics {
  total: number;
  byType: Record<string, number>;
  bySource: Record<string, number>;
  avgImportance: number;
  unacknowledged: number;
}

export interface ActivityAnalytics {
  totalActions: number;
  byHour: Record<string, number>;
  byDay: Record<string, number>;
  peakHour: string;
  peakDay: string;
  avgActionsPerDay: number;
  mostActiveDays: Array<{ date: string; count: number }>;
}

export interface TimeseriesPoint {
  label: string;
  value: number;
}

export class WorkspaceAnalytics {
  private ledger: TraceLedger;
  private decisionLog: DecisionLog;
  private signalStore: SignalStore;

  constructor(ledger: TraceLedger, decisionLog: DecisionLog, signalStore: SignalStore) {
    this.ledger = ledger;
    this.decisionLog = decisionLog;
    this.signalStore = signalStore;
  }

  generateReport(): AnalyticsReport {
    return {
      generatedAt: new Date(),
      traces: this.analyzeTraces(),
      decisions: this.analyzeDecisions(),
      signals: this.analyzeSignals(),
      activity: this.analyzeActivity(),
    };
  }

  activityTimeseries(days = 30, granularity: 'hour' | 'day' = 'day'): TimeseriesPoint[] {
    const points = new Map<string, number>();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    for (const trace of this.ledger.getRecent(10000)) {
      if (trace.timestamp < cutoff) continue;
      const label = granularity === 'hour'
        ? `${trace.timestamp.getFullYear()}-${String(trace.timestamp.getMonth() + 1).padStart(2, '0')}-${String(trace.timestamp.getDate()).padStart(2, '0')} ${String(trace.timestamp.getHours()).padStart(2, '0')}:00`
        : `${trace.timestamp.getFullYear()}-${String(trace.timestamp.getMonth() + 1).padStart(2, '0')}-${String(trace.timestamp.getDate()).padStart(2, '0')}`;
      points.set(label, (points.get(label) ?? 0) + 1);
    }

    return [...points.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  traceBreakdown(field: 'name' | 'kind' | 'agent'): TimeseriesPoint[] {
    const counts = new Map<string, number>();

    for (const trace of this.ledger.getRecent(10000)) {
      let key: string;
      if (field === 'name') {
        key = trace.name;
      } else if (field === 'kind') {
        key = trace.kind;
      } else {
        const a = trace.attributes.find((x) => x.key === 'agent.id');
        key = a ? String(a.value) : 'unknown';
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  private computeDurationMs(t: { timestamp: Date; end_timestamp: Date | null }): number | null {
    if (!t.end_timestamp) return null;
    return t.end_timestamp.getTime() - t.timestamp.getTime();
  }

  private analyzeTraces(): TraceAnalytics {
    const traces = this.ledger.getRecent(10000);
    const byName: Record<string, number> = {};
    const byKind: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const byHour: Record<string, number> = {};
    let totalDuration = 0;
    let durationCount = 0;
    let errorCount = 0;

    for (const t of traces) {
      byName[t.name] = (byName[t.name] ?? 0) + 1;
      byKind[t.kind] = (byKind[t.kind] ?? 0) + 1;
      const agentAttr = t.attributes.find((a) => a.key === 'agent.id');
      if (agentAttr) byAgent[String(agentAttr.value)] = (byAgent[String(agentAttr.value)] ?? 0) + 1;

      const hour = `${String(t.timestamp.getHours()).padStart(2, '0')}:00`;
      byHour[hour] = (byHour[hour] ?? 0) + 1;

      if (t.status === 'error') errorCount++;
      const dur = this.computeDurationMs(t);
      if (dur !== null) { totalDuration += dur; durationCount++; }
    }

    return {
      totalTraces: traces.length,
      byName,
      byKind,
      byAgent,
      byHour,
      avgDurationMs: durationCount > 0 ? totalDuration / durationCount : 0,
      errorRate: traces.length > 0 ? errorCount / traces.length : 0,
    };
  }

  private analyzeDecisions(): DecisionAnalytics {
    const decisions = this.decisionLog.getAll(10000);
    const byOutcome: Record<string, number> = {};
    const tagCounts: Record<string, number> = {};
    const byDay: Record<string, number> = {};

    for (const d of decisions) {
      byOutcome[d.outcome] = (byOutcome[d.outcome] ?? 0) + 1;
      for (const tag of d.tags) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
      const day = d.timestamp.toISOString().split('T')[0]!;
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const topTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { total: decisions.length, byOutcome, topTags, byDay };
  }

  private analyzeSignals(): SignalAnalytics {
    const signals = this.signalStore.getRecent(10000);
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    let totalImportance = 0;

    for (const s of signals) {
      byType[s.type] = (byType[s.type] ?? 0) + 1;
      bySource[s.source] = (bySource[s.source] ?? 0) + 1;
      totalImportance += s.importance;
    }

    return {
      total: signals.length,
      byType,
      bySource,
      avgImportance: signals.length > 0 ? totalImportance / signals.length : 0,
      unacknowledged: this.signalStore.getUnacknowledged().length,
    };
  }

  private analyzeActivity(): ActivityAnalytics {
    const traces = this.ledger.getRecent(10000);
    const byHour: Record<string, number> = {};
    const byDay: Record<string, number> = {};
    let totalDays = 0;

    for (const t of traces) {
      const hour = `${String(t.timestamp.getHours()).padStart(2, '0')}:00`;
      byHour[hour] = (byHour[hour] ?? 0) + 1;
      const day = t.timestamp.toISOString().split('T')[0]!;
      if (!byDay[day]) totalDays++;
      byDay[day] = (byDay[day] ?? 0) + 1;
    }

    const [peakHour] = Object.entries(byHour).sort((a, b) => b[1] - a[1])[0] ?? ['00:00', 0];
    const [peakDay] = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0] ?? ['unknown', 0];

    const mostActiveDays = Object.entries(byDay)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalActions: traces.length,
      byHour,
      byDay,
      peakHour: String(peakHour),
      peakDay: String(peakDay),
      avgActionsPerDay: totalDays > 0 ? traces.length / totalDays : 0,
      mostActiveDays,
    };
  }
}
