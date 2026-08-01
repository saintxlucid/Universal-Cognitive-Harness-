// ─── CIR Benchmark Runner (RFC-0004 §14) ────────────────────────────────────
// Executes the deterministic corpus and asserts the six contract requirements:
// (1) determinism — identical trace records across 3 runs of every case;
// (2) pass effects — per pass ≥ 2 changing + ≥ 1 non-changing cases with
//     transformation assertions; (3) energy accounting — executed streams
//     report energy ≤ budget when P16 runs, totals equal instruction costs;
// (4) gate enforcement — constitutional cases reject with structured verdicts,
//     verify:none never hits gates; (5) version gate (R5); (6) negative
//     controls stay byte-identical. Zero model calls.
//
// Conformance hook: RFC-0004 §13 — the reference implementation MUST pass this
// corpus at its claimed CIR level; `runCIRBenchmark` is that assertion.

import { encodeStream, streamEnergy } from '../cir.js';
import { PASSES, PASS_ORDER, runPasses, type PassId } from '../passes.js';
import { executePipeline, executeStream, type ExecutionVerdict } from '../executor.js';
import {
  BENCHMARK_CORPUS,
  CORPUS_VERSION,
  PASS_EFFECT_CASES,
  type CorpusCase,
  type DeterminismCase,
  type EnergyCase,
  type GateCase,
  type NegativeControlCase,
  type PassEffectCase,
  type VersionGateCase,
} from './corpus.js';

export interface CIRBenchmarkCaseResult {
  id: string;
  kind: CorpusCase['kind'];
  passed: boolean;
  failures: string[];
  latencyMs: number;
}

export interface PassEffectCoverage {
  pass: PassId;
  changing: number;
  nonChanging: number;
  covered: boolean;
}

export interface CIRBenchmarkContracts {
  /** Every determinism case produced identical trace records across 3 runs. */
  determinism3x: boolean;
  /** Every pass has ≥ 2 changing + ≥ 1 non-changing cases, all passing. */
  passEffects2Plus1: boolean;
  /** Energy cases: budget respected when P16 runs, totals exact. */
  energyAccounting: boolean;
  /** Gate cases: structured rejections + verify:none never gated. */
  gateEnforcement: boolean;
  /** Version-gate cases (R5) per expectations. */
  versionGateEnforcement: boolean;
  /** Negative controls stayed byte-identical through the full optimizer. */
  negativeControlsClean: boolean;
  allContracts: boolean;
}

export interface CIRBenchmarkReport {
  corpusVersion: string;
  totalCases: number;
  passedCases: number;
  contracts: CIRBenchmarkContracts;
  passCoverage: PassEffectCoverage[];
  determinismPassed: number;
  passEffectPassed: number;
  energyPassed: number;
  gatePassed: number;
  versionGatePassed: number;
  negativeControlPassed: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  maxLatencyMs: number;
  cases: CIRBenchmarkCaseResult[];
}

const DETERMINISM_RUNS = 3;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function snapshotOf(verdict: ExecutionVerdict): string {
  return JSON.stringify(verdict);
}

function latencyOf(start: number): number {
  return Math.round((performance.now() - start) * 10) / 10;
}

function resultFor(
  id: string,
  kind: CorpusCase['kind'],
  failures: string[],
  latencyMs: number,
): CIRBenchmarkCaseResult {
  return { id, kind, passed: failures.length === 0, failures, latencyMs };
}

async function runDeterminism(c: DeterminismCase): Promise<CIRBenchmarkCaseResult> {
  const start = performance.now();
  const failures: string[] = [];
  let first: string | undefined;
  for (let run = 0; run < DETERMINISM_RUNS; run += 1) {
    const result = await executePipeline(c.stream, c.ctx, c.options);
    const snapshot = snapshotOf(result.verdict);
    if (run === 0) first = snapshot;
    else if (snapshot !== first) failures.push(`run ${run + 1} trace record differs from run 1`);
  }
  return resultFor(c.id, c.kind, failures, latencyOf(start));
}

function runPassEffect(c: PassEffectCase): CIRBenchmarkCaseResult {
  const start = performance.now();
  const failures: string[] = [];
  const spec = PASSES.find((p) => p.id === c.pass);
  if (!spec) {
    failures.push(`unknown pass: ${c.pass}`);
    return resultFor(c.id, c.kind, failures, latencyOf(start));
  }
  const before = encodeStream(c.stream);
  const { stream: after, report } = spec.run(c.stream, c.ctx ?? {});
  const afterBytes = encodeStream(after);

  if (report.changed !== c.changes) {
    failures.push(`report.changed=${String(report.changed)} but case expects ${String(c.changes)}`);
  }
  if (c.changes && afterBytes === before) failures.push('case expects a change but the stream is byte-identical');
  if (!c.changes && afterBytes !== before) failures.push('case expects byte-identity but the stream changed');
  if (c.assert && !c.assert(after)) failures.push('transformation assertion failed');

  const result = resultFor(c.id, c.kind, failures, latencyOf(start));
  if (c.changes && !c.assert) {
    result.failures.push('changing pass-effect case must carry a transformation assertion');
    result.passed = false;
  }
  return result;
}

async function runEnergy(c: EnergyCase): Promise<CIRBenchmarkCaseResult> {
  const start = performance.now();
  const failures: string[] = [];
  const { verdict, optimizer } = await executePipeline(c.stream, c.ctx, c.options);
  if (!verdict.accepted) {
    failures.push(`stream rejected: ${verdict.rejection.code} ${verdict.rejection.reason}`);
    return resultFor(c.id, c.kind, failures, latencyOf(start));
  }
  const record = verdict.record;
  const budget = c.ctx?.energyBudget;
  if (budget !== undefined) {
    const p16 = optimizer?.reports.some((r) => r.pass === 'energy-optimization') ?? false;
    if (!p16) failures.push('energy-optimization (P16) report missing from the pipeline');
    if (optimizer && optimizer.energyAfter > budget) {
      failures.push(`energy after optimize ${optimizer.energyAfter} exceeds budget ${budget}`);
    }
  }
  const costSum = record.outcomes.reduce((sum, o) => sum + o.energy, 0);
  if (record.energySpent !== costSum) {
    failures.push(`energySpent ${record.energySpent} != sum of instruction costs ${costSum}`);
  }
  if (optimizer && record.energySpent !== streamEnergy(optimizer.stream)) {
    failures.push(`energySpent ${record.energySpent} != streamEnergy(optimized stream) ${streamEnergy(optimizer.stream)}`);
  }
  return resultFor(c.id, c.kind, failures, latencyOf(start));
}

async function runGate(c: GateCase): Promise<CIRBenchmarkCaseResult> {
  const start = performance.now();
  const failures: string[] = [];
  const verdict = await executeStream(c.stream, c.options);
  if (c.expectRejected) {
    if (verdict.accepted) {
      failures.push('expected a structured rejection but the stream was accepted');
    } else {
      const rejection = verdict.rejection;
      if (c.rejectionCode && rejection.code !== c.rejectionCode) {
        failures.push(`rejection code ${rejection.code} but case expects ${c.rejectionCode}`);
      }
      if (!rejection.reason) failures.push('rejection lacks a reason');
      if (!rejection.traceparent) failures.push('rejection lacks a traceparent');
    }
  } else {
    if (!verdict.accepted) {
      failures.push(`expected acceptance but rejected: ${verdict.rejection.code}`);
    } else {
      const gateEvents = verdict.record.events.filter((e) => e.type === 'cir:gate');
      if (gateEvents.some((e) => e.payload.pass === false)) failures.push('a cir:gate event with pass=false was recorded');
    }
  }
  return resultFor(c.id, c.kind, failures, latencyOf(start));
}

async function runVersionGate(c: VersionGateCase): Promise<CIRBenchmarkCaseResult> {
  const start = performance.now();
  const failures: string[] = [];
  const stream = clone(c.stream);
  if (c.requiresCp !== undefined) stream.header.requires_cp = c.requiresCp;
  const verdict = await executeStream(stream);
  if (verdict.accepted !== c.expectAccepted) {
    failures.push(
      verdict.accepted
        ? 'expected rejection for unsatisfied requires_cp but the stream was accepted'
        : `expected acceptance but rejected: ${verdict.rejection.code}`,
    );
  }
  return resultFor(c.id, c.kind, failures, latencyOf(start));
}

function runNegativeControl(c: NegativeControlCase): CIRBenchmarkCaseResult {
  const start = performance.now();
  const failures: string[] = [];
  const before = encodeStream(c.stream);
  const optimized = runPasses(c.stream, c.ctx);
  if (encodeStream(optimized.stream) !== before) failures.push('optimizer changed a negative control');
  return resultFor(c.id, c.kind, failures, latencyOf(start));
}

function computeCoverage(): PassEffectCoverage[] {
  return PASS_ORDER.map((pass) => {
    const cases = PASS_EFFECT_CASES.filter((c) => c.pass === pass);
    const changing = cases.filter((c) => c.changes).length;
    const nonChanging = cases.filter((c) => !c.changes).length;
    return { pass, changing, nonChanging, covered: changing >= 2 && nonChanging >= 1 };
  });
}

function p95(latencies: number[]): number {
  if (latencies.length === 0) return 0;
  const sorted = [...latencies].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)]!;
}

/** Run the corpus and assert RFC-0004 §14. Deterministic, zero model calls. */
export async function runCIRBenchmark(corpus: readonly CorpusCase[] = BENCHMARK_CORPUS): Promise<CIRBenchmarkReport> {
  const cases: CIRBenchmarkCaseResult[] = [];

  for (const c of corpus) {
    switch (c.kind) {
      case 'determinism':
        cases.push(await runDeterminism(c));
        break;
      case 'pass-effect':
        cases.push(runPassEffect(c));
        break;
      case 'energy':
        cases.push(await runEnergy(c));
        break;
      case 'gate':
        cases.push(await runGate(c));
        break;
      case 'version-gate':
        cases.push(await runVersionGate(c));
        break;
      case 'negative-control':
        cases.push(runNegativeControl(c));
        break;
    }
  }

  const byKind = (kind: CorpusCase['kind']): CIRBenchmarkCaseResult[] => cases.filter((c) => c.kind === kind);
  const passedCount = (list: CIRBenchmarkCaseResult[]): number => list.filter((c) => c.passed).length;

  const determinism = byKind('determinism');
  const passEffect = byKind('pass-effect');
  const energy = byKind('energy');
  const gate = byKind('gate');
  const versionGate = byKind('version-gate');
  const negativeControl = byKind('negative-control');

  const determinismPassed = passedCount(determinism);
  const passEffectPassed = passedCount(passEffect);
  const energyPassed = passedCount(energy);
  const gatePassed = passedCount(gate);
  const versionGatePassed = passedCount(versionGate);
  const negativeControlPassed = passedCount(negativeControl);

  const coverage = computeCoverage();

  const contracts: CIRBenchmarkContracts = {
    determinism3x: determinism.length > 0 && determinismPassed === determinism.length,
    passEffects2Plus1: coverage.every((c) => c.covered) && passEffectPassed === passEffect.length,
    energyAccounting: energy.length > 0 && energyPassed === energy.length,
    gateEnforcement: gate.length > 0 && gatePassed === gate.length,
    versionGateEnforcement: versionGate.length > 0 && versionGatePassed === versionGate.length,
    negativeControlsClean: negativeControl.length > 0 && negativeControlPassed === negativeControl.length,
    allContracts: false,
  };
  const contractKeys: Array<keyof Omit<CIRBenchmarkContracts, 'allContracts'>> = [
    'determinism3x',
    'passEffects2Plus1',
    'energyAccounting',
    'gateEnforcement',
    'versionGateEnforcement',
    'negativeControlsClean',
  ];
  contracts.allContracts = contractKeys.every((k) => contracts[k]);

  const latencies = cases.map((c) => c.latencyMs);
  const totalLatency = latencies.reduce((sum, x) => sum + x, 0);

  return {
    corpusVersion: CORPUS_VERSION,
    totalCases: cases.length,
    passedCases: cases.filter((c) => c.passed).length,
    contracts,
    passCoverage: coverage,
    determinismPassed,
    passEffectPassed,
    energyPassed,
    gatePassed,
    versionGatePassed,
    negativeControlPassed,
    avgLatencyMs: latencies.length > 0 ? Math.round((totalLatency / latencies.length) * 10) / 10 : 0,
    p95LatencyMs: p95(latencies),
    maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
    cases,
  };
}
