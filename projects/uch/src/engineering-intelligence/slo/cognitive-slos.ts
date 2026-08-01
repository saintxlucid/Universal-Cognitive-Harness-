/**
 * IDEA-0071 — Cognitive SLOs (prototype).
 *
 * A catalog of named cognitive observables (units, measurement points,
 * orientation), windowed compliance computation, error-budget
 * accounting with green/yellow/red bands, and escalation mapping to
 * health states (IDEA-0070). Deterministic: tick-based windows, no
 * randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type SloKind = 'ratio' | 'latency' | 'throughput' | 'roi';

export interface SloDefinition {
  readonly id: string;
  readonly name: string;
  readonly unit: string;
  readonly kind: SloKind;
  /** Where the quantity is measured (metering point in the corpus). */
  readonly measurementPoint: string;
  readonly higherIsBetter: boolean;
  /** Compliance target: fraction of observations that must be good. */
  readonly target: number;
  /** For latency-kind SLIs: the threshold below which an observation is good. */
  readonly thresholdMs?: number;
}

export const COGNITIVE_SLO_CATALOG: readonly SloDefinition[] = [
  { id: 'reasoning.latency.p95', name: 'Reasoning latency', unit: 'ms', kind: 'latency', measurementPoint: 'trace ledger span duration (ADR-002)', higherIsBetter: false, target: 0.95, thresholdMs: 2000 },
  { id: 'thoughts.per.second', name: 'Reasoning throughput', unit: 'thoughts/s', kind: 'throughput', measurementPoint: 'cognitive clock ticks (catalog.ts)', higherIsBetter: true, target: 0.9 },
  { id: 'memory.hit.rate', name: 'Memory hit rate', unit: 'ratio', kind: 'ratio', measurementPoint: 'retrieval fusion + vmem telemetry', higherIsBetter: true, target: 0.9 },
  { id: 'knowledge.freshness', name: 'Knowledge freshness', unit: 'ratio', kind: 'ratio', measurementPoint: 'evidence refresh pass (IDEA-0079)', higherIsBetter: true, target: 0.9 },
  { id: 'truth.accuracy', name: 'Truth accuracy', unit: 'ratio', kind: 'ratio', measurementPoint: 'calibration: confidence vs outcome (RFC-0005)', higherIsBetter: true, target: 0.95 },
  { id: 'hallucination.rate', name: 'Hallucination rate', unit: 'ratio', kind: 'ratio', measurementPoint: 'evidence failures / claims (IDEA-0074)', higherIsBetter: false, target: 0.05 },
  { id: 'contradiction.rate', name: 'Contradiction rate', unit: 'ratio', kind: 'ratio', measurementPoint: 'pairwise entailment checks on beliefs', higherIsBetter: false, target: 0.05 },
  { id: 'reflection.efficiency', name: 'Reflection efficiency', unit: 'ratio', kind: 'ratio', measurementPoint: 'info gain per energy (sleep cycle metrics)', higherIsBetter: true, target: 0.9 },
  { id: 'context.utilization', name: 'Context utilization', unit: 'ratio', kind: 'ratio', measurementPoint: 'compressor: used / budget tokens', higherIsBetter: true, target: 0.9 },
  { id: 'reasoning.reuse', name: 'Reasoning reuse', unit: 'ratio', kind: 'ratio', measurementPoint: 'reused plans / total (reflex fast path)', higherIsBetter: true, target: 0.8 },
  { id: 'learning.efficiency', name: 'Learning efficiency', unit: 'ratio', kind: 'ratio', measurementPoint: 'patterns learned per energy (sleep cycle)', higherIsBetter: true, target: 0.85 },
  { id: 'decision.quality', name: 'Decision quality', unit: 'ratio', kind: 'ratio', measurementPoint: 'decision-law outcomes vs success predicates', higherIsBetter: true, target: 0.9 },
  { id: 'signal.congestion', name: 'Signal congestion', unit: 'ratio', kind: 'ratio', measurementPoint: 'dropped/deferred signals (event bus)', higherIsBetter: false, target: 0.05 },
  { id: 'attention.saturation', name: 'Attention saturation', unit: 'ratio', kind: 'ratio', measurementPoint: 'attention budget consumed (IDEA-0063)', higherIsBetter: false, target: 0.8 },
  { id: 'token.roi', name: 'Token ROI', unit: 'ratio', kind: 'roi', measurementPoint: 'utility gained per token (decision law)', higherIsBetter: true, target: 0.85 },
];

export type SloBand = 'green' | 'yellow' | 'red';

export interface SloObservation {
  readonly atTick: number;
  readonly good: boolean;
}

export interface SloStatus {
  readonly sloId: string;
  readonly windowTicks: number;
  readonly observed: number;
  readonly good: number;
  readonly compliance: number;
  /** Error budget remaining as a fraction of the budget (1 = full, 0 = spent, <0 = over). */
  readonly budgetRemaining: number;
  readonly band: SloBand;
}

export class SloMonitor {
  private observations = new Map<string, SloObservation[]>();

  constructor(
    private readonly catalog: readonly SloDefinition[] = COGNITIVE_SLO_CATALOG,
    private readonly windowTicks = 100,
  ) {}

  /** Records an observation; latency-kind SLIs evaluate against the threshold. */
  observe(sloId: string, atTick: number, value?: number): void {
    const def = this.catalog.find((d) => d.id === sloId);
    if (!def) return;
    const good = def.kind === 'latency' && def.thresholdMs !== undefined
      ? (value ?? 0) <= def.thresholdMs
      : value !== undefined
        ? (def.higherIsBetter ? value >= def.target : value <= def.target)
        : true;
    const bucket = this.observations.get(sloId) ?? [];
    bucket.push({ atTick, good });
    this.observations.set(sloId, bucket);
  }

  /** Non-latency helpers: report a boolean outcome for ratio SLIs. */
  observeOutcome(sloId: string, atTick: number, good: boolean): void {
    const def = this.catalog.find((d) => d.id === sloId);
    if (!def || def.kind === 'latency') return;
    const bucket = this.observations.get(sloId) ?? [];
    bucket.push({ atTick, good });
    this.observations.set(sloId, bucket);
  }

  status(sloId: string): SloStatus | undefined {
    const def = this.catalog.find((d) => d.id === sloId);
    if (!def) return undefined;
    const kept = this.prune(sloId);
    const observed = kept.length;
    const good = kept.filter((o) => o.good).length;
    const compliance = observed === 0 ? 1 : good / observed;
    const budget = 1 - def.target;
    const spent = 1 - compliance;
    const budgetRemaining = budget === 0 ? (compliance >= def.target ? 1 : -1) : (budget - spent) / budget;
    const band: SloBand = budgetRemaining < 0 ? 'red' : budgetRemaining < 0.5 ? 'yellow' : 'green';
    return { sloId, windowTicks: this.windowTicks, observed, good, compliance, budgetRemaining, band };
  }

  /** Maps an SLO band to a health state for IDEA-0070 binding. */
  bandToHealth(band: SloBand): 'healthy' | 'degraded' | 'recovering' {
    if (band === 'green') return 'healthy';
    if (band === 'yellow') return 'degraded';
    return 'recovering';
  }

  private prune(sloId: string): SloObservation[] {
    const latest = this.latestTick(sloId);
    const bucket = this.observations.get(sloId) ?? [];
    const kept = bucket.filter((o) => latest - o.atTick < this.windowTicks);
    this.observations.set(sloId, kept);
    return kept;
  }

  private latestTick(sloId: string): number {
    const bucket = this.observations.get(sloId) ?? [];
    let max = 0;
    for (const o of bucket) if (o.atTick > max) max = o.atTick;
    return max;
  }
}
