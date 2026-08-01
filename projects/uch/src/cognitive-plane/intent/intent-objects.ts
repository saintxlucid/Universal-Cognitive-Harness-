/**
 * IDEA-0075 — Intent Objects (prototype).
 *
 * The structured request envelope: goal, constraints, success, failure,
 * priority, deadline, stakeholders, risk, evidence — every field
 * defaultable so an under-specified intent degrades gracefully to a
 * prompt-shaped intent. Compile path: the envelope's fields feed the
 * decision-law parameters (risk appetite → risk term, deadline →
 * latency pressure, success predicate → verification gate).
 * Deterministic: no randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type Priority = 'low' | 'normal' | 'high' | 'critical';

export type RiskAppetite = 'conservative' | 'balanced' | 'aggressive';

export interface IntentEnvelope {
  readonly id: string;
  readonly goal: string;
  readonly constraints?: readonly string[];
  /** Success predicate: expression verified before the intent is complete. */
  readonly success?: string;
  /** Failure predicate: what "gave up" looks like. */
  readonly failure?: string;
  readonly priority?: Priority;
  /** Cognitive tick deadline (scheduler consumes this). */
  readonly deadlineTick?: number;
  readonly stakeholders?: readonly string[];
  readonly risk?: RiskAppetite;
  /** Evidence requirements: what provenance the result must carry. */
  readonly evidence?: readonly string[];
}

export const DEFAULT_INTENT: Required<Omit<IntentEnvelope, 'id' | 'goal' | 'deadlineTick'>> = {
  constraints: [],
  success: 'as specified',
  failure: 'request cannot be satisfied',
  priority: 'normal',
  stakeholders: [],
  risk: 'balanced',
  evidence: [],
};

/** Normalizes an envelope, filling every defaultable field. */
export function normalizeIntent(envelope: IntentEnvelope): Required<Omit<IntentEnvelope, 'id' | 'goal'>> & {
  id: string;
  goal: string;
} {
  return {
    id: envelope.id,
    goal: envelope.goal,
    constraints: envelope.constraints ?? DEFAULT_INTENT.constraints,
    success: envelope.success ?? DEFAULT_INTENT.success,
    failure: envelope.failure ?? DEFAULT_INTENT.failure,
    priority: envelope.priority ?? DEFAULT_INTENT.priority,
    deadlineTick: envelope.deadlineTick ?? 0,
    stakeholders: envelope.stakeholders ?? DEFAULT_INTENT.stakeholders,
    risk: envelope.risk ?? DEFAULT_INTENT.risk,
    evidence: envelope.evidence ?? DEFAULT_INTENT.evidence,
  };
}

export interface CompiledIntent {
  readonly id: string;
  /** Success predicate → verification gate input. */
  readonly successPredicate: string;
  /** Deadline pressure: 0..1 (missing deadline → 0 = no pressure). */
  readonly latencyPressure: number;
  /** Risk term weight for the decision law (0.1..1.0). */
  readonly riskWeight: number;
  /** Utility priority weight (low=0.25 normal=0.5 high=0.75 critical=1.0). */
  readonly priorityWeight: number;
  readonly evidenceRequirements: readonly string[];
  readonly hasDeadline: boolean;
}

const PRIORITY_WEIGHT: Record<Priority, number> = { low: 0.25, normal: 0.5, high: 0.75, critical: 1.0 };
const RISK_WEIGHT: Record<RiskAppetite, number> = { conservative: 1.0, balanced: 0.6, aggressive: 0.2 };

/**
 * Compiles an intent into decision-law consumable parameters
 * (IDEA-0034): the success predicate is the verification gate, the
 * deadline feeds latency pressure, risk appetite seeds the risk term.
 */
export function compileIntent(envelope: IntentEnvelope, currentTick = 0, slackTicks = 100): CompiledIntent {
  const normalized = normalizeIntent(envelope);
  const hasDeadline = normalized.deadlineTick !== undefined && normalized.deadlineTick > currentTick;
  const latencyPressure = hasDeadline
    ? Math.min(1, Math.max(0, (normalized.deadlineTick! - currentTick) / slackTicks))
    : 0;
  return {
    id: normalized.id,
    successPredicate: normalized.success,
    latencyPressure,
    riskWeight: RISK_WEIGHT[normalized.risk],
    priorityWeight: PRIORITY_WEIGHT[normalized.priority],
    evidenceRequirements: normalized.evidence,
    hasDeadline,
  };
}

/** Verifies whether an intent's success predicate is satisfied. */
export function isSuccess(normalized: ReturnType<typeof normalizeIntent>, observed: string): boolean {
  if (normalized.success === 'as specified') return observed.length > 0;
  return observed.includes(normalized.success);
}
