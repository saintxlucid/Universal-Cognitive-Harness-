// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Activation engine (ACT-R declarative memory, formal math)
//   B_i(t) = ln( Σ_k (t - t_k)^-d )            base-level, power-law decay
//   A_i(t) = B_i(t) + Σ_j W_j·S_ji + ε         total activation
//   S_ji   = S0 - ln(fan_j)                     associative strength, fan penalty
//   P(retrieve i) = 1 / (1 + e^-(A_i - τ)/s)    logistic retrieval probability
// ═══════════════════════════════════════════════════════════════════════════

import type { MemoryClass } from './types.js';

export interface DecaySchedule {
  episodic: number; // d = 0.7 — fast ("what happened" fades)
  working: number; // d = 1.2 — session-bound, very fast
  semantic: number; // d = 0.5 — standard
  preference: number; // d = 0.35 — slow, re-confirmed
  behavior: number; // d = 0.35 — slow
  procedure: number; // d = 0.3 — near-infinite half-life
}

export const DEFAULT_DECAY: DecaySchedule = {
  episodic: 0.7,
  working: 1.2,
  semantic: 0.5,
  preference: 0.35,
  behavior: 0.35,
  procedure: 0.3,
};

export const ASSOCIATIVE_S0 = 2.0; // max associative strength
export const RETRIEVAL_NOISE = 0.4; // s
export const RETRIEVAL_THRESHOLD = 0.0; // τ

function hoursBetween(from: Date, to: Date): number {
  return Math.max(0.0001, (to.getTime() - from.getTime()) / 3_600_000);
}

/**
 * Base-level activation: recency + frequency under power-law decay.
 * Access timestamps drive the sum; each access adds t^-d (testing effect).
 */
export function baseLevelActivation(accessTimes: Date[], now: Date, d: number): number {
  if (accessTimes.length === 0) return -Infinity;
  let sum = 0;
  for (const t of accessTimes) {
    sum += Math.pow(hoursBetween(t, now), -d);
  }
  return Math.log(sum);
}

export function decayFor(memoryClass: MemoryClass, schedule: DecaySchedule = DEFAULT_DECAY): number {
  return schedule[memoryClass] ?? 0.5;
}

/**
 * Associative strength between a context entity j and target memory i.
 * Fan-penalized: entities connected to many memories spread weaker activation
 * to each one (ACT-R fan effect).
 */
export function associativeStrength(fan: number, s0 = ASSOCIATIVE_S0): number {
  return Math.max(0, s0 - Math.log(Math.max(1, fan)));
}

export interface SpreadingContext {
  /** entityName -> fan (number of associations that entity holds) */
  entities: Map<string, number>;
  /** entityName -> Map(targetId -> linkStrength 0..1) */
  associations: Map<string, Map<string, number>>;
}

/**
 * Spreading activation: activation flows from currently-attended context
 * entities to associated memories, attenuated by fan and attentional weight.
 */
export function spreadingActivation(ctx: SpreadingContext): Map<string, number> {
  const spread = new Map<string, number>();
  const n = Math.max(1, ctx.entities.size);
  const w = 1 / n;
  for (const [entity, fan] of ctx.entities) {
    const assoc = ctx.associations.get(entity);
    if (!assoc) continue;
    const s = associativeStrength(fan);
    for (const [targetId, linkStrength] of assoc) {
      spread.set(targetId, (spread.get(targetId) ?? 0) + w * s * linkStrength);
    }
  }
  return spread;
}

/**
 * Total activation = base-level + spreading + noise.
 */
export function totalActivation(base: number, spread: number, noise = 0): number {
  return base + spread + noise;
}

/**
 * Logistic retrieval probability. At activation == threshold, P = 0.5.
 */
export function retrievalProbability(activation: number, threshold = RETRIEVAL_THRESHOLD, noise = RETRIEVAL_NOISE): number {
  return 1 / (1 + Math.exp(-(activation - threshold) / noise));
}

/**
 * Retrieval latency: highly activated memories are retrieved faster.
 * T = F·e^(-f·A)
 */
export function retrievalLatencyMs(activation: number, f = 0.5, F = 1000): number {
  return F * Math.exp(-f * activation);
}

/**
 * Spacing-aware access history appender: massed accesses are recorded as
 * separate events; the log-sum structure of base-level activation
 * naturally implements the spacing effect (diminishing returns per access).
 */
export function recordAccess(accessTimes: Date[], at: Date = new Date()): Date[] {
  const next = [...accessTimes, at];
  return next.length > 512 ? next.slice(next.length - 512) : next;
}
