/**
 * Failure Physics — instability-based veto prototype (RFC-0005 Part 3,
 * IDEA-0004).
 *
 * Implements the narrow slice of the failure-physics hypothesis:
 * a single scalar instability per failure family,
 *
 *   I(b) = confidence(b) − evidenceMass(b)
 *
 * where `confidence` is the signal strength of a failure claim in the
 * target text and `evidenceMass` is the verified defense/verification
 * mass (mitigations, guards, alternatives). A veto fires iff
 * `max I(b) >= VETO_THRESHOLD`.
 *
 * This is a PROTOTYPE (SOP-08 Prototype stage): a new module, not wired
 * into any gate. Parity contract against the existing rule-based vetoes
 * (EngineeringEvaluator) on the 17-case EI benchmark corpus:
 * veto recall 5/5, negative controls 5/5 clean, advisory 7/7 never vetoed.
 * Threshold θ = 0.5 is bootstrap-calibrated on that corpus (min veto
 * instability 0.7, max non-veto 0.25) — an independent held-out set is
 * required before RFC-0005 Acceptance.
 */

import type { EvaluationTarget } from '../types.js';
import { ENGINEERING_BENCHMARK_CORPUS, type BenchmarkCase } from '../benchmark/corpus.js';
import { runEngineeringBenchmark } from '../benchmark/runner.js';

export type FailureFamily = 'spof' | 'network' | 'db' | 'complexity';

export interface InstabilityBelief {
  family: FailureFamily;
  /** Signal strength of the failure claim, 0..1. */
  confidence: number;
  /** Verified defense/verification mass, 0..1 (0 when no claim). */
  evidenceMass: number;
  /** confidence − evidenceMass (may be negative). */
  instability: number;
  /** Markers that fired for the claim. */
  signals: string[];
}

export interface InstabilityVerdict {
  beliefs: InstabilityBelief[];
  maxInstability: number;
  /** maxInstability >= VETO_THRESHOLD. */
  veto: boolean;
  vetoFamily?: FailureFamily;
}

/* ------------------------------------------------------------------ */
/* Markers and weights (deterministic, exported for calibration).      */
/* ------------------------------------------------------------------ */

const SPOF_MARKERS = [
  'single database', 'single server', 'single point', 'depends on a single',
  'no failover', 'no standby', 'only one instance', 'if it dies',
  'the pipeline stops',
];
const NETWORK_MARKERS = ['fetch(', 'r.json()', 'axios.get', 'http.get', 'https://'];
const DB_MARKERS = [
  'pool.query', 'db.query', 'connection.query', 'database call', 'prisma.', 'knex(',
];
const COMPLEXITY_WEIGHT_PER_LEVEL = 0.25;

const DEFENSE_MARKERS_HIGH = [
  'replica', 'standby', 'failover', 'fallback', 'circuit breaker', 'retry',
  'backoff', 'timeout', 'try {', 'catch', 'parameterized',
];
const DEFENSE_MARKERS_MEDIUM = ['new set(', 'hashset', 'hash ', 'cache'];

const FAMILY_WEIGHTS: Record<FailureFamily, number> = {
  spof: 0.6,
  network: 0.7,
  db: 0.7,
  complexity: COMPLEXITY_WEIGHT_PER_LEVEL,
};

/** Bootstrap-calibrated on the 17-case corpus: (0.25, 0.7] is valid. */
export const VETO_THRESHOLD = 0.5;

/* ------------------------------------------------------------------ */
/* Core                                                                */
/* ------------------------------------------------------------------ */

/** Max consecutive `for`/`while` nesting depth across `+` diff lines. */
export function nestingDepth(text: string): number {
  let depth = 0;
  let max = 0;
  let prevIndent = -1;
  for (const raw of text.split('\n')) {
    const trimmed = raw.trimStart();
    if (!trimmed.startsWith('+')) {
      depth = 0;
      prevIndent = -1;
      continue;
    }
    const body = trimmed.slice(1);
    if (!/(for|while)\s*\(/.test(body)) continue;
    const indent = body.length - body.trimStart().length;
    if (prevIndent >= 0 && indent > prevIndent) depth++;
    else depth = 1;
    prevIndent = indent;
    max = Math.max(max, depth);
  }
  return max;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function matchCount(text: string, markers: string[]): number {
  return markers.filter((m) => text.includes(m)).length;
}

/**
 * Defense markers whose occurrences are negated ("no standby",
 * "without fallback") must not count as evidence mass — a stated absence
 * of a mitigation is evidence FOR the failure claim, not against it.
 */
function negatedDefenseCount(text: string, markers: string[]): number {
  let t = text;
  for (const m of markers) {
    t = t.replaceAll(`no ${m}`, '');
    t = t.replaceAll(`without ${m}`, '');
  }
  return matchCount(t, markers);
}

export function evaluateInstability(target: EvaluationTarget): InstabilityVerdict {
  const text =
    target.kind === 'code'
      ? `${target.diff}\n${target.paths.join('\n')}`
      : target.text;
  const lower = text.toLowerCase();

  const depth = nestingDepth(text);
  const families: Array<{ family: FailureFamily; confidence: number; signals: string[] }> = [
    {
      family: 'spof',
      confidence: clamp01(matchCount(lower, SPOF_MARKERS) * FAMILY_WEIGHTS.spof),
      signals: SPOF_MARKERS.filter((m) => lower.includes(m)),
    },
    {
      family: 'network',
      confidence: clamp01(matchCount(lower, NETWORK_MARKERS) * FAMILY_WEIGHTS.network),
      signals: NETWORK_MARKERS.filter((m) => lower.includes(m)),
    },
    {
      family: 'db',
      confidence: clamp01(matchCount(lower, DB_MARKERS) * FAMILY_WEIGHTS.db),
      signals: DB_MARKERS.filter((m) => lower.includes(m)),
    },
    {
      family: 'complexity',
      confidence: clamp01(depth * FAMILY_WEIGHTS.complexity),
      signals: depth > 0 ? [`nesting-depth:${depth}`] : [],
    },
  ];

  const defenseMass = clamp01(
    negatedDefenseCount(lower, DEFENSE_MARKERS_HIGH) +
      negatedDefenseCount(lower, DEFENSE_MARKERS_MEDIUM) * 0.5,
  );

  const beliefs: InstabilityBelief[] = families
    .filter((f) => f.confidence > 0)
    .map((f) => ({
      family: f.family,
      confidence: f.confidence,
      evidenceMass: defenseMass,
      instability: f.confidence - defenseMass,
      signals: f.signals,
    }));

  const maxInstability =
    beliefs.length > 0 ? Math.max(...beliefs.map((b) => b.instability)) : 0;
  const maxBelief =
    beliefs.length > 0
      ? beliefs.find((b) => b.instability === maxInstability)
      : undefined;
  const veto = maxInstability >= VETO_THRESHOLD;

  return {
    beliefs,
    maxInstability,
    veto,
    ...(maxBelief ? { vetoFamily: maxBelief.family } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Calibration + parity benchmark                                       */
/* ------------------------------------------------------------------ */

export interface InstabilityParityCase {
  id: string;
  group: BenchmarkCase['group'];
  instability: number;
  veto: boolean;
  family?: FailureFamily;
}

export interface InstabilityParityReport {
  totalCases: number;
  /** Rule-based veto recall (existing EngineeringEvaluator). */
  ruleVetoRecall: number;
  /** Instability-based veto recall (prototype). */
  instabilityVetoRecall: number;
  negativeControlPassRate: number;
  /** Advisory cases that must never veto. */
  advisoryNonVetoRate: number;
  /** True iff min veto instability > max non-veto instability. */
  separable: boolean;
  thresholdRange: [number, number] | null;
  recommendedThreshold: number;
  cases: InstabilityParityCase[];
}

/** θ range that achieves exact parity; null when not separable. */
export function calibrateThreshold(
  corpus: BenchmarkCase[] = ENGINEERING_BENCHMARK_CORPUS,
): { thresholdRange: [number, number] | null; recommended: number } {
  let minVeto = Infinity;
  let maxNonVeto = -Infinity;
  for (const c of corpus) {
    const { maxInstability } = evaluateInstability(c.target);
    if (c.group === 'veto') minVeto = Math.min(minVeto, maxInstability);
    else maxNonVeto = Math.max(maxNonVeto, maxInstability);
  }
  if (minVeto <= maxNonVeto) return { thresholdRange: null, recommended: VETO_THRESHOLD };
  const mid = Math.round(((minVeto + maxNonVeto) / 2) * 100) / 100;
  return { thresholdRange: [maxNonVeto, minVeto], recommended: mid };
}

export function runInstabilityParityBenchmark(
  corpus: BenchmarkCase[] = ENGINEERING_BENCHMARK_CORPUS,
): InstabilityParityReport {
  const rule = runEngineeringBenchmark(undefined, corpus);
  const { thresholdRange } = calibrateThreshold(corpus);

  const cases: InstabilityParityCase[] = corpus.map((c) => {
    const v = evaluateInstability(c.target);
    return {
      id: c.id,
      group: c.group,
      instability: Math.round(v.maxInstability * 100) / 100,
      veto: v.veto,
      ...(v.vetoFamily ? { family: v.vetoFamily } : {}),
    };
  });

  const vetoes = cases.filter((c) => c.group === 'veto');
  const negatives = cases.filter((c) => c.group === 'negative');
  const advisories = cases.filter((c) => c.group === 'advisory');

  return {
    totalCases: cases.length,
    ruleVetoRecall: rule.vetoRecall,
    instabilityVetoRecall:
      vetoes.length > 0 ? vetoes.filter((c) => c.veto).length / vetoes.length : 1,
    negativeControlPassRate:
      negatives.length > 0 ? negatives.filter((c) => !c.veto).length / negatives.length : 1,
    advisoryNonVetoRate:
      advisories.length > 0 ? advisories.filter((c) => !c.veto).length / advisories.length : 1,
    separable: thresholdRange !== null,
    thresholdRange,
    recommendedThreshold: VETO_THRESHOLD,
    cases,
  };
}
