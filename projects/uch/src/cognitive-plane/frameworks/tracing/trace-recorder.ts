/**
 * FrameworkTraceRecorder — makes every framework invocation a first-class
 * cognitive event (blueprint §5.1).
 *
 * Records structured traces of framework selection and completion, publishes
 * `framework:selected` / `framework:completed` / `framework:error` events on
 * the neural event bus (which the OTel trace engine mirrors into
 * `framework.*` internal spans per ADR-002), and aggregates usage stats so the
 * harness can learn *which frameworks it actually uses* for *which problem
 * types*.
 *
 * The recorder is a pure observability surface: engines stay deterministic
 * and bus-free; the recorder attaches at the wiring layer.
 */

import type { NeuralEventBus } from '../../../event-bus/neural-event-bus.js';
import type { FrameworkSelectionInput, FrameworkSelectionResult } from '../types.js';

/** A single recorded framework invocation. */
export interface FrameworkTraceRecord {
  id: string;
  kind: 'selection' | 'completion' | 'error';
  engine: string;
  family: string;
  problem: string;
  profile: Record<string, unknown>;
  selected: string | null;
  rationale: string | null;
  result: Record<string, unknown> | null;
  verdict: string | null;
  durationMs: number;
  mode: 'deterministic' | 'llm-assisted';
  timestamp: Date;
}

export interface FrameworkSelectionTraceInput {
  problem: string;
  profile: FrameworkSelectionInput;
  result: FrameworkSelectionResult;
  durationMs: number;
}

export interface FrameworkCompletionTraceInput {
  engine: string;
  family: string;
  problem: string;
  profile: Record<string, unknown>;
  result: Record<string, unknown>;
  verdict?: string | null;
  durationMs?: number;
  mode?: 'deterministic' | 'llm-assisted';
}

export interface FrameworkErrorTraceInput {
  engine: string;
  family: string;
  problem: string;
  message: string;
  profile?: Record<string, unknown>;
}

export interface FrameworkUsageStats {
  traceCount: number;
  selectionCount: number;
  completionCount: number;
  errorCount: number;
  usageByFramework: { engine: string; family: string; count: number }[];
  usageByFamily: { family: string; count: number }[];
  dominantPerProblemType: { problemType: string; engine: string; count: number }[];
  /** Latest invocation order — the recent window for drift detection. */
  recent: { engine: string; family: string; problemType: string; timestamp: Date }[];
  drift: { engine: string; previous: number; recent: number }[];
}

const DEFAULT_MAX_TRACES = 5000;

/** Classify a problem profile into a coarse problem type (also used by
 *  connectome auto-wiring and sleep-cycle consolidation). */
export function frameworkProblemTypeOf(profile: Record<string, unknown>): string {
  if (profile.rootCauseNeeded === true) return 'root-cause';
  if (profile.humanCentered === true) return 'human-centered';
  if (profile.continuousImprovement === true) return 'improvement';
  if (profile.speedAdaptability === true) return 'rapid';
  if (typeof profile.timePressure === 'number' && profile.timePressure >= 0.7) return 'time-critical';
  if (typeof profile.dataAvailability === 'number' && profile.dataAvailability >= 0.6) return 'data-rich';
  if (typeof profile.risk === 'number' && profile.risk >= 0.6) return 'uncertain';
  if (typeof profile.stakeholderInvolvement === 'number' && profile.stakeholderInvolvement >= 0.6) return 'group';
  if (typeof profile.clarity === 'number' && profile.clarity < 0.4) return 'unclear';
  return 'general';
}

export class FrameworkTraceRecorder {
  private traces: FrameworkTraceRecord[] = [];
  private maxTraces: number;
  private bus: NeuralEventBus | null;

  constructor(bus?: NeuralEventBus | null, maxTraces = DEFAULT_MAX_TRACES) {
    this.bus = bus ?? null;
    this.maxTraces = maxTraces;
  }

  attachBus(bus: NeuralEventBus): void {
    this.bus = bus;
  }

  getTraces(): FrameworkTraceRecord[] {
    return [...this.traces];
  }

  /**
   * Records a model selection (registry.select) and emits
   * `framework:selected` on the bus.
   */
  recordSelection(input: FrameworkSelectionTraceInput): FrameworkTraceRecord {
    const record: FrameworkTraceRecord = {
      id: crypto.randomUUID(),
      kind: 'selection',
      engine: input.result.selected.id,
      family: input.result.selected.family,
      problem: input.problem,
      profile: this.profileToRecord(input.profile),
      selected: input.result.selected.id,
      rationale: input.result.rationale,
      result: {
        runnerUp: input.result.runnerUp?.id ?? null,
        alternatives: input.result.alternatives,
      },
      verdict: null,
      durationMs: input.durationMs,
      mode: 'deterministic',
      timestamp: new Date(),
    };
    this.append(record);
    this.bus?.publish({
      type: 'framework:selected',
      source: 'framework-registry',
      payload: {
        engine: record.engine,
        family: record.family,
        problem: record.problem,
        selected: record.selected,
        runnerUp: input.result.runnerUp?.id ?? null,
        rationale: record.rationale,
        profile: record.profile,
        durationMs: record.durationMs,
      },
      metadata: { importance: 0.7, provenance: { source: 'registry.select' } },
    });
    return record;
  }

  /**
   * Records a framework engine completion and emits `framework:completed`.
   */
  recordCompletion(input: FrameworkCompletionTraceInput): FrameworkTraceRecord {
    const record: FrameworkTraceRecord = {
      id: crypto.randomUUID(),
      kind: 'completion',
      engine: input.engine,
      family: input.family,
      problem: input.problem,
      profile: input.profile,
      selected: null,
      rationale: null,
      result: input.result,
      verdict: input.verdict ?? null,
      durationMs: input.durationMs ?? 0,
      mode: input.mode ?? 'deterministic',
      timestamp: new Date(),
    };
    this.append(record);
    this.bus?.publish({
      type: 'framework:completed',
      source: `framework:${input.engine}`,
      payload: {
        engine: record.engine,
        family: record.family,
        problem: record.problem,
        problemType: frameworkProblemTypeOf(input.profile),
        profile: input.profile,
        verdict: record.verdict,
        mode: record.mode,
        durationMs: record.durationMs,
        trace_id: record.id,
      },
      metadata: { importance: 0.6, provenance: { source: 'framework-tracing' } },
    });
    return record;
  }

  /** Records a framework engine failure and emits `framework:error`. */
  recordError(input: FrameworkErrorTraceInput): FrameworkTraceRecord {
    const record: FrameworkTraceRecord = {
      id: crypto.randomUUID(),
      kind: 'error',
      engine: input.engine,
      family: input.family,
      problem: input.problem,
      profile: input.profile ?? {},
      selected: null,
      rationale: null,
      result: { message: input.message },
      verdict: 'error',
      durationMs: 0,
      mode: 'deterministic',
      timestamp: new Date(),
    };
    this.append(record);
    this.bus?.publish({
      type: 'framework:error',
      source: `framework:${input.engine}`,
      payload: {
        engine: record.engine,
        family: record.family,
        problem: record.problem,
        message: input.message,
      },
      metadata: { importance: 0.9, provenance: { source: 'framework-tracing' } },
    });
    return record;
  }

  getStats(): FrameworkUsageStats {
    const byFramework = new Map<string, { engine: string; family: string; count: number }>();
    const byFamily = new Map<string, number>();
    const byProblemType = new Map<string, Map<string, number>>();
    const recent: FrameworkUsageStats['recent'] = [];

    for (const trace of this.traces) {
      const engine = trace.selected ?? trace.engine;
      const fam = trace.family;
      const entry = byFramework.get(engine) ?? { engine, family: fam, count: 0 };
      entry.count++;
      byFramework.set(engine, entry);
      byFamily.set(fam, (byFamily.get(fam) ?? 0) + 1);

      const type = frameworkProblemTypeOf(trace.profile);
      const perType = byProblemType.get(type) ?? new Map<string, number>();
      perType.set(engine, (perType.get(engine) ?? 0) + 1);
      byProblemType.set(type, perType);

      recent.push({ engine, family: fam, problemType: type, timestamp: trace.timestamp });
    }

    const dominantPerProblemType = [...byProblemType.entries()].map(([problemType, perEngine]) => {
      let best: { engine: string; count: number } | null = null;
      for (const [engine, count] of perEngine) {
        if (best === null || count > best.count) best = { engine, count };
      }
      return { problemType, engine: best?.engine ?? '', count: best?.count ?? 0 };
    });

    const recentWindow = recent.slice(-20);
    const previousWindow = recent.slice(-40, -20);
    const drift = recentWindow.map((r) => {
      const previousCount = previousWindow.filter((p) => p.engine === r.engine).length;
      const recentCount = recentWindow.filter((p) => p.engine === r.engine).length;
      return { engine: r.engine, previous: previousCount, recent: recentCount };
    }).filter((d, i, arr) => arr.findIndex((x) => x.engine === d.engine) === i);

    return {
      traceCount: this.traces.length,
      selectionCount: this.traces.filter((t) => t.kind === 'selection').length,
      completionCount: this.traces.filter((t) => t.kind === 'completion').length,
      errorCount: this.traces.filter((t) => t.kind === 'error').length,
      usageByFramework: [...byFramework.values()].sort((a, b) => b.count - a.count),
      usageByFamily: [...byFamily.entries()]
        .map(([family, count]) => ({ family, count }))
        .sort((a, b) => b.count - a.count),
      dominantPerProblemType,
      recent,
      drift,
    };
  }

  private append(record: FrameworkTraceRecord): void {
    this.traces.push(record);
    if (this.traces.length > this.maxTraces) {
      this.traces = this.traces.slice(-this.maxTraces);
    }
  }

  private profileToRecord(profile: FrameworkSelectionInput): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(profile)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
}
