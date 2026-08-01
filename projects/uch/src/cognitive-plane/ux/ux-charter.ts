/**
 * IDEA-0078 — Cognitive UX Charter (prototype).
 *
 * Six felt properties (predictability, interruptibility,
 * explainability, trustworthiness, calm, transparency), each with a
 * definition, a measurement, and a minimum guarantee — bound to
 * existing mechanisms (ledger, bus, scheduler, SLOs, health) so the
 * charter is contractible, not aesthetic. Deterministic: no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type UxQuality =
  | 'predictability'
  | 'interruptibility'
  | 'explainability'
  | 'trustworthiness'
  | 'calm'
  | 'transparency';

export interface UxQualityDefinition {
  readonly quality: UxQuality;
  readonly definition: string;
  /** The mechanism that measures it (corpus binding). */
  readonly measuredBy: string;
  /** Minimum guarantee: 0..1 fraction of observations must pass. */
  readonly minimum: number;
}

export const UX_CHARTER: readonly UxQualityDefinition[] = [
  { quality: 'predictability', definition: 'consistent behavior across similar inputs', measuredBy: 'deterministic dialect/flag outcomes (IDEA-0068/0069)', minimum: 0.95 },
  { quality: 'interruptibility', definition: 'the user can stop a running action', measuredBy: 'user interrupt op on signal bus (priority inversion)', minimum: 1.0 },
  { quality: 'explainability', definition: 'every decision has a ledger path and a why-answer', measuredBy: 'trace ledger + replay (ADR-002), CQL answers', minimum: 1.0 },
  { quality: 'trustworthiness', definition: 'honest health states and uncertainty disclosure', measuredBy: 'health registry states (IDEA-0070), decision-law confidence', minimum: 0.9 },
  { quality: 'calm', definition: 'no panic, no nagging, no SLO misses', measuredBy: 'SLO miss rate (IDEA-0071), alarm hygiene', minimum: 0.95 },
  { quality: 'transparency', definition: 'shows its work; state is observable', measuredBy: 'observatory surface (IDEA-0014), lineage service (IDEA-0076)', minimum: 1.0 },
];

export interface UxObservation {
  readonly quality: UxQuality;
  /** True when the quality guarantee held for this observation. */
  readonly satisfied: boolean;
  readonly atTick: number;
}

export interface UxQualityStatus {
  readonly quality: UxQuality;
  readonly observed: number;
  readonly satisfied: number;
  readonly compliance: number;
  readonly compliant: boolean;
}

/** Charter compliance: the minimum guarantee must hold over the window. */
export function charterStatus(
  observations: readonly UxObservation[],
  windowTicks = 100,
  atTick?: number,
): UxQualityStatus[] {
  const latest = atTick ?? Math.max(0, ...observations.map((o) => o.atTick));
  return UX_CHARTER.map((def) => {
    const window = observations.filter((o) => o.quality === def.quality && latest - o.atTick < windowTicks);
    const satisfied = window.filter((o) => o.satisfied).length;
    const compliance = window.length === 0 ? 1 : satisfied / window.length;
    return { quality: def.quality, observed: window.length, satisfied, compliance, compliant: compliance >= def.minimum };
  });
}

/** User interrupt: outranks internal signals (priority inversion). */
export type InterruptPriority = 'user' | 'internal';

/** An interrupt request: user interrupts always take precedence. */
export function shouldPreempt(incoming: InterruptPriority, current: InterruptPriority): boolean {
  return incoming === 'user' && current !== 'user';
}

/**
 * Explainability guarantee: a decision is explainable when a ledger
 * path exists — simulated here as a non-empty path of event ids.
 */
export function isExplainable(ledgerPath: readonly string[]): boolean {
  return ledgerPath.length > 0;
}

/** Calm: SLO miss rate within the acceptable band. */
export function isCalm(sloMissRate: number, acceptable = 0.05): boolean {
  return sloMissRate <= acceptable;
}
