import { writeSnapshot, readSnapshot } from '../persistence/persistence-engine.js';
import { TraceLedger } from '../trace-engine/trace-ledger.js';
import { DecisionLog } from '../decisions/decision-log.js';
import { PatternLibrary } from '../patterns/pattern-library.js';
import type { CognitiveTrace } from '../trace-engine/cognitive-trace.js';

export interface Suggestion {
  id: string;
  type: 'action' | 'review' | 'consolidation' | 'investigation' | 'optimization';
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high';
  confidence: number;
  context: Record<string, unknown>;
  traceIds: string[];
  createdAt: Date;
  dismissed: boolean;
}

export interface SuggestionConfig {
  maxSuggestions: number;
  minConfidence: number;
  enableAutoConsolidation: boolean;
}

export class SuggestionEngine {
  private ledger: TraceLedger;
  private decisionLog: DecisionLog;
  private patternLibrary: PatternLibrary;
  private suggestions: Suggestion[] = [];
  private config: Required<SuggestionConfig>;

  constructor(
    ledger: TraceLedger,
    decisionLog: DecisionLog,
    patternLibrary: PatternLibrary,
    config?: Partial<SuggestionConfig>,
  ) {
    this.ledger = ledger;
    this.decisionLog = decisionLog;
    this.patternLibrary = patternLibrary;
    this.config = {
      maxSuggestions: config?.maxSuggestions ?? 100,
      minConfidence: config?.minConfidence ?? 0.3,
      enableAutoConsolidation: config?.enableAutoConsolidation ?? true,
    };
  }

  generate(): Suggestion[] {
    this.suggestions = [];

    this.suggestions.push(...this.suggestReviews());
    this.suggestions.push(...this.suggestConsolidations());
    this.suggestions.push(...this.suggestInvestigations());
    this.suggestions.push(...this.suggestOptimizations());

    this.suggestions.sort((a, b) => {
      const rank = { high: 0, normal: 1, low: 2 };
      return (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || b.confidence - a.confidence;
    });

    if (this.suggestions.length > this.config.maxSuggestions) {
      this.suggestions = this.suggestions.slice(0, this.config.maxSuggestions);
    }

    return this.suggestions;
  }

  getActive(): Suggestion[] {
    return this.suggestions.filter((s) => !s.dismissed);
  }

  dismiss(id: string): boolean {
    const sug = this.suggestions.find((s) => s.id === id);
    if (!sug) return false;
    sug.dismissed = true;
    return true;
  }

  getStats(): { total: number; active: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const s of this.suggestions) {
      byType[s.type] = (byType[s.type] ?? 0) + 1;
    }
    return {
      total: this.suggestions.length,
      active: this.suggestions.filter((s) => !s.dismissed).length,
      byType,
    };
  }

  private computeDurationMs(t: { timestamp: Date; end_timestamp: Date | null }): number | null {
    if (!t.end_timestamp) return null;
    return t.end_timestamp.getTime() - t.timestamp.getTime();
  }

  private suggestReviews(): Suggestion[] {
    const results: Suggestion[] = [];
    const recent = this.ledger.getRecent(50);
    const errorTraces = recent.filter((t) => t.status === 'error');

    if (errorTraces.length >= 3) {
      results.push({
        id: crypto.randomUUID(),
        type: 'review',
        title: 'Multiple errors detected',
        description: `${errorTraces.length} traces with errors in the last 50 operations. Review error patterns.`,
        priority: 'high',
        confidence: Math.min(0.5 + errorTraces.length * 0.05, 0.95),
        context: { errorCount: errorTraces.length },
        traceIds: errorTraces.map((t) => t.trace_id),
        createdAt: new Date(),
        dismissed: false,
      });
    }

    const unacknowledgedCount = recent.filter((t) => t.status === 'unset').length;
    if (unacknowledgedCount > 10) {
      results.push({
        id: crypto.randomUUID(),
        type: 'review',
        title: 'Unacknowledged operations',
        description: `${unacknowledgedCount} operations with unset status. Consider reviewing outcomes.`,
        priority: 'normal',
        confidence: 0.4,
        context: { count: unacknowledgedCount },
        traceIds: [],
        createdAt: new Date(),
        dismissed: false,
      });
    }

    return results;
  }

  private suggestConsolidations(): Suggestion[] {
    if (!this.config.enableAutoConsolidation) return [];
    const results: Suggestion[] = [];
    const all = this.ledger.getRecent(100);
    const byName = new Map<string, CognitiveTrace[]>();

    for (const t of all) {
      const existing = byName.get(t.name) ?? [];
      existing.push(t);
      byName.set(t.name, existing);
    }

    for (const [name, traces] of byName) {
      if (traces.length >= 5) {
        results.push({
          id: crypto.randomUUID(),
          type: 'consolidation',
          title: `Consolidate "${name}" patterns`,
          description: `${traces.length} similar operations detected. Consolidate into a reusable pattern.`,
          priority: 'normal',
          confidence: Math.min(0.3 + traces.length * 0.02, 0.85),
          context: { operationName: name, count: traces.length },
          traceIds: traces.map((t) => t.trace_id),
          createdAt: new Date(),
          dismissed: false,
        });
      }
    }

    return results;
  }

  private suggestInvestigations(): Suggestion[] {
    const results: Suggestion[] = [];
    const recent = this.ledger.getRecent(100);

    const longRunning = recent.filter((t) => {
      const dur = this.computeDurationMs(t);
      return dur !== null && dur > 10000;
    });

    if (longRunning.length > 0) {
      results.push({
        id: crypto.randomUUID(),
        type: 'investigation',
        title: 'Investigate slow operations',
        description: `${longRunning.length} operations exceeding 10s duration. Investigate performance.`,
        priority: 'high',
        confidence: Math.min(longRunning.length * 0.15, 0.9),
        context: { longRunningCount: longRunning.length, thresholdMs: 10000 },
        traceIds: longRunning.map((t) => t.trace_id),
        createdAt: new Date(),
        dismissed: false,
      });
    }

    const patternMatches = this.patternLibrary.getRecentMatches(20);
    const highConfidence = patternMatches.filter((m) => m.confidence > 0.8);
    if (highConfidence.length >= 3) {
      results.push({
        id: crypto.randomUUID(),
        type: 'investigation',
        title: 'High-confidence pattern matches',
        description: `${highConfidence.length} strong pattern matches found. Investigate detected patterns.`,
        priority: 'normal',
        confidence: 0.6,
        context: { matchCount: highConfidence.length },
        traceIds: highConfidence.flatMap((m) => m.traceIds),
        createdAt: new Date(),
        dismissed: false,
      });
    }

    return results;
  }

  private suggestOptimizations(): Suggestion[] {
    const results: Suggestion[] = [];
    const recent = this.ledger.getRecent(200);

    const errorCount = recent.filter((t) => t.status === 'error').length;
    const errorRate = recent.length > 0 ? errorCount / recent.length : 0;
    if (errorRate > 0.2) {
      results.push({
        id: crypto.randomUUID(),
        type: 'optimization',
        title: `High error rate (${(errorRate * 100).toFixed(1)}%)`,
        description: 'Error rate exceeds 20%. Consider improving error handling and retry logic.',
        priority: 'high',
        confidence: Math.min(errorRate, 0.95),
        context: { errorRate, errorCount, totalTraces: recent.length },
        traceIds: recent.filter((t) => t.status === 'error').map((t) => t.trace_id),
        createdAt: new Date(),
        dismissed: false,
      });
    }

    const repeatFailures = this.detectRepeatFailures(recent);
    if (repeatFailures.length > 0) {
      for (const rf of repeatFailures) {
        results.push({
          id: crypto.randomUUID(),
          type: 'optimization',
          title: `Repeated failure: "${rf.name}"`,
          description: `Operation "${rf.name}" failed ${rf.count} times. Consider fixing or adding recovery.`,
          priority: 'high',
          confidence: Math.min(0.4 + rf.count * 0.1, 0.95),
          context: { operationName: rf.name, failureCount: rf.count },
          traceIds: rf.traceIds,
          createdAt: new Date(),
          dismissed: false,
        });
      }
    }

    return results;
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      suggestions: this.suggestions,
      config: this.config,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      suggestions: Suggestion[];
      config: Required<SuggestionConfig> | null;
    }>(filePath);
    if (!data) return 0;

    this.suggestions = data.suggestions ?? [];
    if (data.config) this.config = data.config;
    return this.suggestions.length;
  }

  private detectRepeatFailures(traces: CognitiveTrace[]): Array<{ name: string; count: number; traceIds: string[] }> {
    const failures = new Map<string, { count: number; traceIds: string[] }>();
    for (const t of traces) {
      if (t.status === 'error') {
        const existing = failures.get(t.name) ?? { count: 0, traceIds: [] };
        existing.count++;
        existing.traceIds.push(t.trace_id);
        failures.set(t.name, existing);
      }
    }
    return [...failures.entries()]
      .filter(([, v]) => v.count >= 2)
      .map(([name, v]) => ({ name, count: v.count, traceIds: v.traceIds }));
  }
}
