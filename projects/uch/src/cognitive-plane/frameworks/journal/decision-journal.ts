/**
 * FrameworkDecisionJournal — every framework verdict is a gradeable claim
 * (blueprint §5.4): "model X, profile Y → verdict Z".
 *
 * The journal records each completed framework invocation as an open claim
 * that can be resolved against reality (correct / incorrect / partial /
 * unresolvable), feeds the calibration takes fence via `syncTakesWithJournal`
 * (so `uch calibration` gains a `framework` domain scorecard), and computes
 * per-model accuracy, dominant framework per problem type, and drift — the
 * harness becoming calibrated about its own reasoning tools.
 *
 * Persistence follows the Storable convention (`persist`/`load`); analytics
 * persist to `.uccp/persist/framework-journal.json` (Phase 4, item 4).
 */

import type { NeuralEventBus } from '../../../event-bus/neural-event-bus.js';
import type { EventType } from '../../../event-bus/neural-event-bus.js';
import type { Take, TakeQuality } from '../../calibration/takes.js';
import {
  FrameworkTraceRecord,
  frameworkProblemTypeOf,
} from '../tracing/trace-recorder.js';
import { readSnapshot, writeSnapshot } from '../../persistence/persistence-engine.js';

export interface FrameworkJournalEntry {
  id: string;
  engine: string;
  family: string;
  problem: string;
  problemType: string;
  profile: Record<string, unknown>;
  verdict: string | null;
  mode: 'deterministic' | 'llm-assisted';
  status: 'open' | 'resolved';
  quality?: TakeQuality;
  evidence?: string;
  /** Original framework trace id when recorded from a trace record. */
  traceId?: string;
  createdAt: Date;
  resolvedAt?: Date | null;
}

export interface FrameworkJournalInput {
  engine: string;
  family: string;
  problem: string;
  profile?: Record<string, unknown>;
  verdict?: string | null;
  mode?: 'deterministic' | 'llm-assisted';
  traceId?: string;
}

export interface JournalModelAccuracy {
  engine: string;
  family: string;
  resolved: number;
  correct: number;
  accuracy: number;
}

export interface FrameworkJournalStats {
  total: number;
  open: number;
  resolved: number;
  usageByModel: { engine: string; family: string; count: number }[];
  accuracyByModel: JournalModelAccuracy[];
  dominantPerProblemType: { problemType: string; engine: string; count: number }[];
  /** Verdicts resolved incorrect — the models that got reversed. */
  reversed: { engine: string; verdict: string }[];
  drift: { engine: string; previous: number; recent: number }[];
}

const DEFAULT_MAX_ENTRIES = 5000;

/**
 * Deterministic conviction mapping for a verdict: definitive verdicts assert
 * ~0.8, hedged ones ~0.6, absent verdicts a neutral 0.6.
 */
export function convictionFor(verdict: string | null): number {
  if (!verdict) return 0.6;
  const v = verdict.toLowerCase();
  if (
    ['adopt', 'reject', 'pass', 'fail', 'ready', 'consistent', 'verified', 'recommend', 'proceed'].includes(v)
  ) {
    return 0.8;
  }
  if (['balanced', 'consider', 'review', 'partial', 'uncertain'].includes(v)) return 0.6;
  return 0.7;
}

function claimFor(engine: string, verdict: string | null, problem: string): string {
  const claim = `framework '${engine}' → ${verdict ?? 'no verdict'} for: ${problem}`;
  return claim.length > 140 ? `${claim.slice(0, 137)}...` : claim;
}

export class FrameworkDecisionJournal {
  private entries: FrameworkJournalEntry[] = [];
  private maxEntries: number;
  private bus: NeuralEventBus | null = null;
  private seenEventIds = new Set<string>();
  private seenEventOrder: string[] = [];

  constructor(bus?: NeuralEventBus | null, maxEntries = DEFAULT_MAX_ENTRIES) {
    this.bus = bus ?? null;
    this.maxEntries = maxEntries;
    if (this.bus) this.attachBus(this.bus);
  }

  /**
   * Subscribes to framework completion/error events so every engine
   * invocation lands in the journal. Replay hydrations are deduped via
   * `metadata.replay_of` (the original trace id) so re-publishing traces
   * never double-records.
   */
  attachBus(bus: NeuralEventBus): void {
    this.bus = bus;
    bus.subscribe(
      ['framework:completed', 'framework:error'] as EventType[],
      async (event) => {
        const dedupeKey = String(event.metadata?.replay_of ?? event.id);
        if (this.seenEventIds.has(dedupeKey)) return;
        this.rememberEvent(dedupeKey);
        const payload = event.payload as Record<string, unknown>;
        const engine = typeof payload.engine === 'string' ? payload.engine : null;
        if (!engine) return;
        this.record({
          engine,
          family: typeof payload.family === 'string' ? payload.family : 'unknown',
          problem: typeof payload.problem === 'string' ? payload.problem : '',
          profile: typeof payload.profile === 'object' && payload.profile !== null
            ? payload.profile as Record<string, unknown>
            : {},
          verdict: typeof payload.verdict === 'string' ? payload.verdict : null,
          mode: payload.mode === 'llm-assisted' ? 'llm-assisted' : 'deterministic',
          traceId: typeof payload.trace_id === 'string' ? payload.trace_id : undefined,
        });
      },
      undefined,
      'framework-journal',
    );
  }

  private rememberEvent(key: string): void {
    if (this.seenEventIds.size >= 1000) {
      const oldest = this.seenEventOrder.shift();
      if (oldest !== undefined) this.seenEventIds.delete(oldest);
    }
    this.seenEventIds.add(key);
    this.seenEventOrder.push(key);
  }

  record(input: FrameworkJournalInput): FrameworkJournalEntry {
    const entry: FrameworkJournalEntry = {
      id: crypto.randomUUID(),
      engine: input.engine,
      family: input.family,
      problem: input.problem,
      problemType: frameworkProblemTypeOf(input.profile ?? {}),
      profile: input.profile ?? {},
      verdict: input.verdict ?? null,
      mode: input.mode ?? 'deterministic',
      status: 'open',
      ...(input.traceId !== undefined ? { traceId: input.traceId } : {}),
      createdAt: new Date(),
      resolvedAt: null,
    };
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }
    return entry;
  }

  /** Maps a recorded trace into a journal entry (completions + errors only). */
  recordFromTrace(trace: FrameworkTraceRecord): FrameworkJournalEntry | null {
    if (trace.kind === 'selection') return null;
    return this.record({
      engine: trace.engine,
      family: trace.family,
      problem: trace.problem,
      profile: trace.profile,
      verdict: trace.kind === 'error' ? 'error' : trace.verdict,
      mode: trace.mode,
      traceId: trace.id,
    });
  }

  resolve(id: string, quality: TakeQuality, evidence?: string): FrameworkJournalEntry | null {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry || entry.status === 'resolved') return null;
    entry.status = 'resolved';
    entry.quality = quality;
    entry.evidence = evidence;
    entry.resolvedAt = new Date();
    return entry;
  }

  getEntries(): FrameworkJournalEntry[] {
    return [...this.entries];
  }

  get open(): FrameworkJournalEntry[] {
    return this.entries.filter((e) => e.status === 'open');
  }

  get resolved(): FrameworkJournalEntry[] {
    return this.entries.filter((e) => e.status === 'resolved');
  }

  count(): number {
    return this.entries.length;
  }

  /** Open entries as gradeable calibration takes (domain 'framework'). */
  toTakes(): Take[] {
    return this.open.map((entry) => ({
      id: crypto.randomUUID(),
      claim: claimFor(entry.engine, entry.verdict, entry.problem),
      conviction: convictionFor(entry.verdict),
      domain: 'framework',
      status: 'open',
      sourceId: entry.id,
      createdAt: entry.createdAt,
    }));
  }

  getStats(): FrameworkJournalStats {
    const resolved = this.entries.filter((e) => e.status === 'resolved');
    const scoreable = resolved.filter((e) => e.quality !== 'unresolvable');

    const usage = new Map<string, { engine: string; family: string; count: number }>();
    for (const entry of this.entries) {
      const row = usage.get(entry.engine) ?? { engine: entry.engine, family: entry.family, count: 0 };
      row.count++;
      usage.set(entry.engine, row);
    }

    const accuracyByModel: JournalModelAccuracy[] = [];
    for (const [engine, group] of this.groupBy(scoreable, (e) => e.engine)) {
      const correct = group.filter((e) => e.quality === 'correct').length;
      accuracyByModel.push({
        engine,
        family: group[0]?.family ?? 'unknown',
        resolved: group.length,
        correct,
        accuracy: group.length > 0 ? correct / group.length : 0,
      });
    }
    accuracyByModel.sort((a, b) => a.accuracy - b.accuracy);

    const perType = new Map<string, Map<string, number>>();
    for (const entry of this.entries) {
      const perEngine = perType.get(entry.problemType) ?? new Map<string, number>();
      perEngine.set(entry.engine, (perEngine.get(entry.engine) ?? 0) + 1);
      perType.set(entry.problemType, perEngine);
    }
    const dominantPerProblemType = [...perType.entries()].map(([problemType, perEngine]) => {
      let best: { engine: string; count: number } | null = null;
      for (const [engine, count] of perEngine) {
        if (best === null || count > best.count) best = { engine, count };
      }
      return { problemType, engine: best?.engine ?? '', count: best?.count ?? 0 };
    });

    const reversed = resolved
      .filter((e) => e.quality === 'incorrect')
      .map((e) => ({ engine: e.engine, verdict: e.verdict ?? 'no-verdict' }));

    const recent = this.entries.slice(-20);
    const previous = this.entries.slice(-40, -20);
    const drift = recent.map((r) => ({
      engine: r.engine,
      previous: previous.filter((p) => p.engine === r.engine).length,
      recent: recent.filter((p) => p.engine === r.engine).length,
    })).filter((d, i, arr) => arr.findIndex((x) => x.engine === d.engine) === i);

    return {
      total: this.entries.length,
      open: this.entries.filter((e) => e.status === 'open').length,
      resolved: resolved.length,
      usageByModel: [...usage.values()].sort((a, b) => b.count - a.count),
      accuracyByModel,
      dominantPerProblemType,
      reversed,
      drift,
    };
  }

  async persist(filePath: string): Promise<void> {
    writeSnapshot(filePath, { entries: this.entries });
  }

  async load(filePath: string): Promise<number> {
    const raw = readSnapshot<{ entries?: FrameworkJournalEntry[] }>(filePath);
    if (!raw || !Array.isArray(raw.entries)) return 0;
    this.entries = raw.entries
      .map((e) => ({ ...e, createdAt: new Date(e.createdAt), resolvedAt: e.resolvedAt ? new Date(e.resolvedAt) : null }))
      .slice(-this.maxEntries);
    return this.entries.length;
  }

  private groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const key = keyOf(item);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    return groups;
  }
}

/**
 * Merges journal entries into a takes list for the calibration fence:
 * open entries become open 'framework' takes (linked by sourceId), and
 * resolved entries resolve their linked takes. Pure and idempotent.
 */
export function syncTakesWithJournal(takes: Take[], journal: FrameworkDecisionJournal): Take[] {
  const out = [...takes];
  const bySource = new Map<string, number>();
  for (let i = 0; i < out.length; i++) {
    const sourceId = out[i]?.sourceId ?? '';
    if (sourceId) bySource.set(sourceId, i);
  }
  for (const entry of journal.getEntries()) {
    const existingIdx = bySource.get(entry.id);
    if (existingIdx === undefined) {
      const resolvedNow = entry.status === 'resolved';
      const take: Take = resolvedNow
        ? {
            id: crypto.randomUUID(),
            claim: claimFor(entry.engine, entry.verdict, entry.problem),
            conviction: convictionFor(entry.verdict),
            domain: 'framework',
            status: 'resolved',
            quality: entry.quality,
            outcome: entry.quality === 'correct' ? true : entry.quality === 'incorrect' ? false : null,
            evidence: entry.evidence,
            resolvedBy: 'framework-journal',
            resolvedAt: entry.resolvedAt ?? new Date(),
            sourceId: entry.id,
            createdAt: entry.createdAt,
          }
        : {
            id: crypto.randomUUID(),
            claim: claimFor(entry.engine, entry.verdict, entry.problem),
            conviction: convictionFor(entry.verdict),
            domain: 'framework',
            status: 'open',
            sourceId: entry.id,
            createdAt: entry.createdAt,
          };
      bySource.set(entry.id, out.length);
      out.push(take);
    } else {
      const existing = out[existingIdx]!;
      if (entry.status === 'resolved' && existing.status === 'open') {
        out[existingIdx] = {
          ...existing,
          status: 'resolved',
          quality: entry.quality,
          outcome: entry.quality === 'correct' ? true : entry.quality === 'incorrect' ? false : null,
          evidence: entry.evidence,
          resolvedBy: 'framework-journal',
          resolvedAt: entry.resolvedAt ?? new Date(),
        };
      }
    }
  }
  return out;
}
