/**
 * Theory of Intelligence — unified decision law prototype (IDEA-0034).
 *
 * Every cognitive action carries Expected Utility (EU), Information Gain
 * (IG), Energy (E), Risk (R) and Latency (L); every decision maximizes
 *
 *   λu·EU(a) + λi·IG(a) − λe·E(a) − λr·R(a) − λl·L(a)
 *
 * This is a PROTOTYPE (SOP-08 Prototype stage): a new module, not wired
 * into any gate. Its value is DERIVATION — governance (reject/verify/
 * proceed), scheduling priority, verification value, and memory store/
 * evict all fall out of one scored objective instead of bespoke rules.
 *
 * The risk term R reuses the RFC-0005 failure-physics instability
 * prototype (I(b) = confidence − evidenceMass). With unit weights the
 * three gate action templates cross at R = 0.30 and R = 0.50, so the
 * decision regions are DERIVED from the objective, not hand-tuned:
 *
 *   R < 0.30      → proceed wins
 *   0.30 ≤ R < 0.50 → verify wins (advisory: surface, don't reject)
 *   R ≥ 0.50      → reject wins (the RFC-0005 veto threshold θ)
 *
 * Parity contract on the 17-case EI corpus: veto 5/5 → reject,
 * negative 5/5 → proceed, advisory 7/7 → never reject.
 *
 * G1 evidence: research/foundations/06-theory-of-intelligence.md
 * (computational rationality — Gershman/Horvitz/Tenenbaum 2015;
 * resource-rational analysis — Lieder & Griffiths 2020; rational
 * metareasoning — Russell & Wefald 1991; per-term sources in-register).
 */

import type { EvaluationTarget } from '../types.js';
import { ENGINEERING_BENCHMARK_CORPUS, type BenchmarkCase } from '../benchmark/corpus.js';
import { evaluateInstability } from '../failure-physics/instability.js';

/* ------------------------------------------------------------------ */
/* The objective                                                       */
/* ------------------------------------------------------------------ */

export interface DecisionLawConfig {
  lambdaU: number;
  lambdaI: number;
  lambdaE: number;
  lambdaR: number;
  lambdaL: number;
}

/** Unit weights — v0.1; term weights are context policy, not the law. */
export const DEFAULT_DECISION_LAW_CONFIG: DecisionLawConfig = {
  lambdaU: 1,
  lambdaI: 1,
  lambdaE: 1,
  lambdaR: 1,
  lambdaL: 1,
};

export interface ScoredAction {
  id: string;
  eu: number;
  ig: number;
  energy: number;
  risk: number;
  latency: number;
  score: number;
}

export function scoreAction(
  action: Omit<ScoredAction, 'score'>,
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): ScoredAction {
  const score =
    config.lambdaU * action.eu +
    config.lambdaI * action.ig -
    config.lambdaE * action.energy -
    config.lambdaR * action.risk -
    config.lambdaL * action.latency;
  return { ...action, score };
}

/** Rank actions by score, best first. */
export function rankActions(
  actions: Array<Omit<ScoredAction, 'score'>>,
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): ScoredAction[] {
  return actions.map((a) => scoreAction(a, config)).sort((a, b) => b.score - a.score);
}

/* ------------------------------------------------------------------ */
/* Derived policy 1 — governance gate (EI veto as a special case)      */
/* ------------------------------------------------------------------ */

export type GateAction = 'proceed' | 'verify' | 'reject';

/**
 * Affine action templates in R (risk). `proceed` decays fast with risk
 * (acting on an unstable belief loses utility); `verify` decays slowly
 * and costs energy+latency but resolves the instability; `reject` is
 * constant. The crossing points fall out of these shapes — they are
 * derived, not tuned.
 */
interface GateTemplate {
  id: GateAction;
  eu0: number;
  euDecay: number;
  energy: number;
  riskCoeff: number;
  latency: number;
}

const GATE_TEMPLATES: GateTemplate[] = [
  { id: 'proceed', eu0: 0.9, euDecay: 1.5, energy: 0, riskCoeff: 0.5, latency: 0 },
  { id: 'verify', eu0: 0.9, euDecay: 0.5, energy: 0.2, riskCoeff: 0.5, latency: 0.1 },
  { id: 'reject', eu0: 0.4, euDecay: 0, energy: 0.2, riskCoeff: 0, latency: 0.1 },
];

function gateScore(template: GateTemplate, risk: number, config: DecisionLawConfig): number {
  const eu = Math.max(0, template.eu0 - template.euDecay * risk);
  return (
    config.lambdaU * eu -
    config.lambdaE * template.energy -
    config.lambdaR * template.riskCoeff * risk -
    config.lambdaL * template.latency
  );
}

/** Risk value where two affine gate scores cross (derived, not tuned). */
export function gateCrossing(
  a: GateAction,
  b: GateAction,
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): number {
  const tA = GATE_TEMPLATES.find((t) => t.id === a)!;
  const tB = GATE_TEMPLATES.find((t) => t.id === b)!;
  const slopeA = -config.lambdaU * tA.euDecay - config.lambdaR * tA.riskCoeff;
  const slopeB = -config.lambdaU * tB.euDecay - config.lambdaR * tB.riskCoeff;
  const interceptA = config.lambdaU * tA.eu0 - config.lambdaE * tA.energy - config.lambdaL * tA.latency;
  const interceptB = config.lambdaU * tB.eu0 - config.lambdaE * tB.energy - config.lambdaL * tB.latency;
  if (slopeA === slopeB) return Number.POSITIVE_INFINITY;
  return (interceptB - interceptA) / (slopeA - slopeB);
}

export interface DecisionLawVerdict {
  action: GateAction;
  risk: number;
  scores: Record<GateAction, number>;
}

/**
 * Derive the governance decision from the objective. Risk comes from the
 * RFC-0005 instability prototype; the reject/verify/proceed regions fall
 * out of the action templates and the law's weights.
 */
export function decideGate(
  risk: number,
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): DecisionLawVerdict {
  const scores = {} as Record<GateAction, number>;
  for (const t of GATE_TEMPLATES) scores[t.id] = gateScore(t, risk, config);
  const entries = Object.entries(scores) as Array<[GateAction, number]>;
  const tieBreaker: Record<GateAction, number> = { reject: 0, verify: 1, proceed: 2 };
  const sorted = entries.sort((a, b) => b[1] - a[1] || tieBreaker[a[0]] - tieBreaker[b[0]]);
  const best = sorted[0]?.[0] ?? 'reject';
  return { action: best, risk, scores };
}

export function decideGateOnTarget(
  target: EvaluationTarget,
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): DecisionLawVerdict {
  const { maxInstability } = evaluateInstability(target);
  return decideGate(maxInstability, config);
}

/* ------------------------------------------------------------------ */
/* Derived policy 2 — scheduler priority                               */
/* ------------------------------------------------------------------ */

export interface Schedulable {
  id: string;
  eu: number;
  ig: number;
  latency: number;
  energy?: number;
}

/**
 * Priority = λu·EU + λi·IG − λe·E − λl·L. Within a dispatch the energy
 * term is constant, so this reduces to the ADR-004 cost/latency routing
 * while additionally rewarding information gain.
 */
export function schedulerPriority(
  action: Schedulable,
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): number {
  return (
    config.lambdaU * action.eu +
    config.lambdaI * action.ig -
    config.lambdaE * (action.energy ?? 0) -
    config.lambdaL * action.latency
  );
}

export function schedule(
  actions: Schedulable[],
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): string[] {
  return [...actions]
    .sort((a, b) => schedulerPriority(b, config) - schedulerPriority(a, config))
    .map((a) => a.id);
}

/* ------------------------------------------------------------------ */
/* Derived policy 3 — verification value                              */
/* ------------------------------------------------------------------ */

/**
 * Verify iff the information gained by verifying outweighs its energy and
 * latency cost (rational metareasoning: value of information > cost).
 */
export function shouldVerify(
  verification: { ig: number; energy: number; latency: number },
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): boolean {
  return (
    config.lambdaI * verification.ig >
    config.lambdaE * verification.energy + config.lambdaL * verification.latency
  );
}

/* ------------------------------------------------------------------ */
/* Derived policy 4 — memory store/evict                              */
/* ------------------------------------------------------------------ */

/**
 * Store iff future retrieval information gain exceeds the storage energy
 * cost; evict by recency·salience minus energy cost (the vmem paging
 * score is the same shape with paging-specific terms).
 */
export function shouldStore(
  entry: { ig: number; energy: number },
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): boolean {
  return config.lambdaI * entry.ig > config.lambdaE * entry.energy;
}

export function evictScore(
  entry: { recency: number; salience: number; energy: number },
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): number {
  return entry.recency * entry.salience - config.lambdaE * entry.energy;
}

/* ------------------------------------------------------------------ */
/* Parity benchmark — the objective reproduces the EI gate contract    */
/* ------------------------------------------------------------------ */

export interface DecisionLawReport {
  totalCases: number;
  /** Veto-group cases whose derived action is reject. */
  vetoRejectRecall: number;
  /** Negative-control cases whose derived action is proceed. */
  negativeProceedRate: number;
  /** Advisory cases that must never derive to reject. */
  advisoryNonRejectRate: number;
  /** Derived crossing points of the three gate templates. */
  crossings: { proceedVerify: number; proceedReject: number; verifyReject: number };
  cases: Array<{ id: string; group: BenchmarkCase['group']; risk: number; action: GateAction }>;
}

export function runDecisionLawBenchmark(
  corpus: BenchmarkCase[] = ENGINEERING_BENCHMARK_CORPUS,
  config: DecisionLawConfig = DEFAULT_DECISION_LAW_CONFIG,
): DecisionLawReport {
  const cases = corpus.map((c) => {
    const d = decideGateOnTarget(c.target, config);
    return { id: c.id, group: c.group, risk: Math.round(d.risk * 100) / 100, action: d.action };
  });
  const vetoes = cases.filter((c) => c.group === 'veto');
  const negatives = cases.filter((c) => c.group === 'negative');
  const advisories = cases.filter((c) => c.group === 'advisory');
  return {
    totalCases: cases.length,
    vetoRejectRecall:
      vetoes.length > 0 ? vetoes.filter((c) => c.action === 'reject').length / vetoes.length : 1,
    negativeProceedRate:
      negatives.length > 0
        ? negatives.filter((c) => c.action === 'proceed').length / negatives.length
        : 1,
    advisoryNonRejectRate:
      advisories.length > 0 ? advisories.filter((c) => c.action !== 'reject').length / advisories.length : 1,
    crossings: {
      proceedVerify: gateCrossing('proceed', 'verify', config),
      proceedReject: gateCrossing('proceed', 'reject', config),
      verifyReject: gateCrossing('verify', 'reject', config),
    },
    cases,
  };
}
