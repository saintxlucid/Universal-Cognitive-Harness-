/**
 * Engineering Intelligence Layer — benchmark runner.
 *
 * Executes the labeled corpus against the deterministic EngineeringEvaluator
 * and reports: recall (fired expected concepts / planted violations),
 * vetoRecall (veto-group cases fully satisfied), negative-control pass rate
 * (clean targets with no veto), and latency per target (contract: < 1 s).
 *
 * Zero LLM calls; the whole pipeline is regex/line scanning + gates.
 */

import { EngineeringEvaluator, createEngineeringJudgment } from '../index.js';
import {
  ENGINEERING_BENCHMARK_CORPUS,
  type BenchmarkCase,
  type BenchmarkGroup,
} from './corpus.js';

export interface BenchmarkCaseResult {
  id: string;
  group: BenchmarkGroup;
  passed: boolean;
  /** Expected concepts that did not fire. */
  missing: string[];
  /** Forbidden concepts that fired (false positives). */
  unexpected: string[];
  latencyMs: number;
}

export interface BenchmarkReport {
  totalCases: number;
  passedCases: number;
  /** Positive cases (veto + advisory) with all expected concepts fired. */
  recall: number;
  /** Veto-group cases fully satisfied. */
  vetoRecall: number;
  /** Negative controls with no veto finding and no forbidden concept. */
  negativeControlPassRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  cases: BenchmarkCaseResult[];
}

const VETO_GATE_CONCEPTS = new Set([
  'sys.spof',
  'failure.network-loss',
  'failure.db-stall',
  'cs.complexity.time',
]);

function evaluateCase(
  evaluator: EngineeringEvaluator,
  c: BenchmarkCase,
): BenchmarkCaseResult {
  const start = performance.now();
  const review = evaluator.evaluate(c.target);
  const latencyMs = performance.now() - start;

  const fired = new Set(review.findings.map((f) => f.conceptId));
  const missing = c.expected.filter((id) => !fired.has(id));
  const unexpected = (c.forbidden ?? []).filter((id) => fired.has(id));

  // Negative controls must not produce any veto-gate finding at all.
  const vetoLeak = c.group === 'negative'
    ? review.findings
        .filter((f) => f.gate === 'veto' || VETO_GATE_CONCEPTS.has(f.conceptId))
        .map((f) => f.conceptId)
    : [];

  return {
    id: c.id,
    group: c.group,
    passed: missing.length === 0 && unexpected.length === 0 && vetoLeak.length === 0,
    missing,
    unexpected: [...new Set([...unexpected, ...vetoLeak])],
    latencyMs: Math.round(latencyMs * 10) / 10,
  };
}

export function runEngineeringBenchmark(
  evaluator: EngineeringEvaluator = createEngineeringJudgment().evaluator,
  corpus: BenchmarkCase[] = ENGINEERING_BENCHMARK_CORPUS,
): BenchmarkReport {
  const cases = corpus.map((c) => evaluateCase(evaluator, c));

  const positive = cases.filter((c) => c.group !== 'negative');
  const vetoes = cases.filter((c) => c.group === 'veto');
  const negatives = cases.filter((c) => c.group === 'negative');
  const passed = (c: BenchmarkCaseResult): boolean => c.passed;

  const latencies = cases.map((c) => c.latencyMs).sort((a, b) => a - b);
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round((latencies.reduce((s, x) => s + x, 0) / latencies.length) * 10) / 10
      : 0;
  const p95LatencyMs =
    latencies.length > 0
      ? latencies[Math.min(latencies.length - 1, Math.ceil(0.95 * latencies.length) - 1)]!
      : 0;

  return {
    totalCases: cases.length,
    passedCases: cases.filter(passed).length,
    recall: positive.length > 0 ? positive.filter(passed).length / positive.length : 1,
    vetoRecall: vetoes.length > 0 ? vetoes.filter(passed).length / vetoes.length : 1,
    negativeControlPassRate:
      negatives.length > 0 ? negatives.filter(passed).length / negatives.length : 1,
    avgLatencyMs,
    p95LatencyMs,
    maxLatencyMs: latencies.length > 0 ? latencies[latencies.length - 1]! : 0,
    cases,
  };
}
