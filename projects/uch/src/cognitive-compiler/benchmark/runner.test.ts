// ─── CIR Benchmark Runner tests (RFC-0004 §14 contracts) ────────────────────

import { describe, expect, it } from 'vitest';
import { encodeStream, streamEnergy } from '../cir.js';
import { PASS_ORDER } from '../passes.js';
import { executePipeline, executeStream } from '../executor.js';
import {
  DETERMINISM_CASES,
  ENERGY_CASES,
  GATE_CASES,
  NEGATIVE_CONTROL_CASES,
  PASS_EFFECT_CASES,
  VERSION_GATE_CASES,
  corpusCaseCount,
} from './corpus.js';
import { runCIRBenchmark } from './runner.js';

describe('CIR benchmark runner (RFC-0004 §14)', () => {
  it('runs the full corpus green: every case passes and all six contracts hold', async () => {
    const report = await runCIRBenchmark();
    expect(report.totalCases).toBe(corpusCaseCount());
    expect(report.passedCases).toBe(report.totalCases);
    expect(report.contracts.determinism3x).toBe(true);
    expect(report.contracts.passEffects2Plus1).toBe(true);
    expect(report.contracts.energyAccounting).toBe(true);
    expect(report.contracts.gateEnforcement).toBe(true);
    expect(report.contracts.versionGateEnforcement).toBe(true);
    expect(report.contracts.negativeControlsClean).toBe(true);
    expect(report.contracts.allContracts).toBe(true);
  });

  it('covers every pass with at least 2 changing and 1 non-changing case', async () => {
    expect(await reportCoverage(PASS_ORDER)).toBe(true);
  });

  it('per-pass coverage counts match the corpus arrays', () => {
    for (const pass of PASS_ORDER) {
      const cases = PASS_EFFECT_CASES.filter((c) => c.pass === pass);
      expect(cases.filter((c) => c.changes).length).toBeGreaterThanOrEqual(2);
      expect(cases.filter((c) => !c.changes).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('asserts byte-identical trace records across 3 runs of every determinism case', async () => {
    for (const c of DETERMINISM_CASES) {
      const first = JSON.stringify((await executePipeline(c.stream, c.ctx, c.options)).verdict);
      for (let run = 1; run < 3; run += 1) {
        const snapshot = JSON.stringify((await executePipeline(c.stream, c.ctx, c.options)).verdict);
        expect(snapshot, `${c.id} run ${run + 1}`).toBe(first);
      }
    }
  });

  it('rejected determinism cases reject deterministically with structured verdicts', async () => {
    const rejected = DETERMINISM_CASES.filter((c) => c.id === 'DET-3');
    expect(rejected).toHaveLength(1);
    const verdict = await executePipeline(rejected[0]!.stream);
    expect(verdict.verdict.accepted).toBe(false);
    if (!verdict.verdict.accepted) {
      expect(verdict.verdict.rejection.code).toBe('GATE_FAILED');
      expect(verdict.verdict.rejection.reason.length).toBeGreaterThan(0);
      expect(verdict.verdict.rejection.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    }
  });

  it('energy accounting is exact: energySpent equals instruction costs and stream energy', async () => {
    for (const c of ENERGY_CASES) {
      const { verdict, optimizer } = await executePipeline(c.stream, c.ctx, c.options);
      expect(verdict.accepted, `${c.id} must be accepted`).toBe(true);
      if (!verdict.accepted) continue;
      const costSum = verdict.record.outcomes.reduce((sum, o) => sum + o.energy, 0);
      expect(verdict.record.energySpent, `${c.id} cost sum`).toBe(costSum);
      expect(verdict.record.energySpent, `${c.id} stream energy`).toBe(streamEnergy(optimizer!.stream));
    }
  });

  it('every executed energy case stays within its budget after P16', async () => {
    for (const c of ENERGY_CASES) {
      const { verdict, optimizer } = await executePipeline(c.stream, c.ctx, c.options);
      expect(verdict.accepted, `${c.id} must be accepted`).toBe(true);
      expect(optimizer!.energyAfter, `${c.id} energy after optimize`).toBeLessThanOrEqual(c.ctx!.energyBudget!);
    }
  });

  it('gate enforcement: constitutional rejections carry structured verdicts and codes', async () => {
    for (const c of GATE_CASES) {
      const verdict = await executeStream(c.stream, c.options);
      expect(verdict.accepted, `${c.id}`).toBe(!c.expectRejected);
      if (!c.expectRejected) continue;
      if (verdict.accepted) continue;
      const rejection = verdict.rejection;
      expect(rejection.code, `${c.id} code`).toBe(c.rejectionCode);
      expect(rejection.reason.length, `${c.id} reason`).toBeGreaterThan(0);
      expect(rejection.traceparent, `${c.id} traceparent`).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
      expect(rejection.events.some((e) => e.type === 'cir:rejected'), `${c.id} cir:rejected event`).toBe(true);
    }
  });

  it('gate enforcement: verify:none cases never hit gates (GT-4)', async () => {
    const gt4 = GATE_CASES.find((c) => c.id === 'GT-4');
    expect(gt4).toBeDefined();
    const verdict = await executeStream(gt4!.stream, gt4!.options);
    expect(verdict.accepted).toBe(true);
    if (verdict.accepted) {
      expect(verdict.record.events.filter((e) => e.type === 'cir:gate' && e.payload.pass === false)).toHaveLength(0);
    }
  });

  it('version gate (R5): unsatisfied requires_cp streams are rejected', async () => {
    for (const c of VERSION_GATE_CASES) {
      const stream = structuredClone(c.stream);
      if (c.requiresCp !== undefined) stream.header.requires_cp = c.requiresCp;
      const verdict = await executeStream(stream);
      expect(verdict.accepted, `${c.id}`).toBe(c.expectAccepted);
      if (!c.expectAccepted && !verdict.accepted) {
        expect(verdict.rejection.code).toBe('UNSUPPORTED_VERSION');
      }
    }
  });

  it('negative controls stay byte-identical through the full optimizer', async () => {
    for (const c of NEGATIVE_CONTROL_CASES) {
      const { runPasses } = await import('../passes.js');
      const optimized = runPasses(c.stream, c.ctx);
      expect(encodeStream(optimized.stream), `${c.id}`).toBe(encodeStream(c.stream));
      expect(optimized.reports.filter((r) => r.changed), `${c.id} changed reports`).toHaveLength(0);
    }
  });

  it('pass-effect cases with changes carry transformation assertions; unchanged cases stay byte-identical', () => {
    for (const c of PASS_EFFECT_CASES) {
      if (c.changes) expect(c.assert, `${c.id} must carry an assertion`).toBeDefined();
      else expect(c.assert, `${c.id} must not need an assertion`).toBeUndefined();
    }
  });
});

async function reportCoverage(passes: typeof PASS_ORDER): Promise<boolean> {
  const report = await runCIRBenchmark();
  const perPass = new Map(report.passCoverage.map((c) => [c.pass, c]));
  for (const pass of passes) {
    const coverage = perPass.get(pass);
    expect(coverage, `coverage for ${pass}`).toBeDefined();
    expect(coverage!.changing, `${pass} changing`).toBeGreaterThanOrEqual(2);
    expect(coverage!.nonChanging, `${pass} non-changing`).toBeGreaterThanOrEqual(1);
  }
  return true;
}
