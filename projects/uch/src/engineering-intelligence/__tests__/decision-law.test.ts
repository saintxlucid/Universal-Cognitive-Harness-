/**
 * Theory of Intelligence — unified decision law tests (IDEA-0034).
 *
 * Unit coverage of the objective, the four derived policies, and the
 * parity contract: the derived governance regions reproduce the EI gate
 * contract on the 17-case corpus (veto → reject, negative → proceed,
 * advisory → never reject) without a bespoke veto rule.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DECISION_LAW_CONFIG,
  decideGate,
  decideGateOnTarget,
  evictScore,
  gateCrossing,
  rankActions,
  runDecisionLawBenchmark,
  schedule,
  schedulerPriority,
  scoreAction,
  shouldStore,
  shouldVerify,
} from '../decision-law/decision-law.js';
import { ENGINEERING_BENCHMARK_CORPUS } from '../benchmark/corpus.js';

describe('the objective', () => {
  it('scores an action per the law: EU and IG add, E/R/L subtract', () => {
    const base = { id: 'a', eu: 0.8, ig: 0.2, energy: 0.1, risk: 0.1, latency: 0.1 };
    const s = scoreAction(base);
    expect(s.score).toBeCloseTo(0.8 + 0.2 - 0.1 - 0.1 - 0.1, 10);
    expect(scoreAction({ ...base, eu: 1.0 }).score).toBeGreaterThan(s.score);
    expect(scoreAction({ ...base, risk: 0.9 }).score).toBeLessThan(s.score);
  });

  it('rankActions orders by score, best first', () => {
    const ranked = rankActions([
      { id: 'low', eu: 0.2, ig: 0.1, energy: 0.5, risk: 0.5, latency: 0.5 },
      { id: 'high', eu: 0.9, ig: 0.5, energy: 0.1, risk: 0.1, latency: 0.1 },
    ]);
    expect(ranked.map((a) => a.id)).toEqual(['high', 'low']);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

describe('governance gate derivation', () => {
  it('derives the crossing points from the templates (unit weights)', () => {
    const { proceedVerify, proceedReject, verifyReject } = runDecisionLawBenchmark().crossings;
    expect(proceedVerify).toBeCloseTo(0.3, 10);
    expect(proceedReject).toBeCloseTo(0.4, 10);
    expect(verifyReject).toBeCloseTo(0.5, 10);
    expect(gateCrossing('proceed', 'verify')).toBeCloseTo(0.3, 10);
    expect(gateCrossing('verify', 'reject')).toBeCloseTo(0.5, 10);
  });

  it('proceed wins below 0.30 risk', () => {
    expect(decideGate(0).action).toBe('proceed');
    expect(decideGate(0.25).action).toBe('proceed');
  });

  it('verify wins in the middle band (0.30..0.50)', () => {
    expect(decideGate(0.35).action).toBe('verify');
    expect(decideGate(0.49).action).toBe('verify');
  });

  it('reject wins at the RFC-0005 veto threshold (0.50)', () => {
    expect(decideGate(0.5).action).toBe('reject');
    expect(decideGate(0.7).action).toBe('reject');
    expect(decideGate(1).action).toBe('reject');
  });

  it('weight tilt flips the regions (risk-averse config rejects earlier)', () => {
    const riskAverse = { ...DEFAULT_DECISION_LAW_CONFIG, lambdaR: 3 };
    expect(decideGate(0.35, riskAverse).action).toBe('reject');
  });

  it('derives reject/verify/proceed from an evaluation target via instability', () => {
    expect(decideGateOnTarget(ENGINEERING_BENCHMARK_CORPUS[0].target).action).toBe('reject');
    expect(
      decideGateOnTarget(
        ENGINEERING_BENCHMARK_CORPUS.find((c) => c.id === 'in-loop-array-scan')!.target,
      ).action,
    ).not.toBe('reject');
  });
});

describe('scheduler policy derivation', () => {
  it('ranks by EU + IG minus energy and latency', () => {
    expect(schedulerPriority({ id: 'a', eu: 0.8, ig: 0.2, latency: 0.1 })).toBeCloseTo(0.9, 10);
    expect(
      schedulerPriority({ id: 'b', eu: 0.8, ig: 0.2, latency: 0.1, energy: 0.6 }),
    ).toBeCloseTo(0.3, 10);
  });

  it('information gain can outrank plain utility (unified objective)', () => {
    const order = schedule([
      { id: 'high-eu', eu: 0.9, ig: 0, latency: 0.1 },
      { id: 'high-ig', eu: 0.5, ig: 0.6, latency: 0.1 },
    ]);
    expect(order[0]).toBe('high-ig');
  });

  it('latency penalty reorders same-utility actions', () => {
    const order = schedule([
      { id: 'slow', eu: 0.9, ig: 0.2, latency: 0.9 },
      { id: 'fast', eu: 0.9, ig: 0.2, latency: 0.1 },
    ]);
    expect(order).toEqual(['fast', 'slow']);
  });
});

describe('verification policy derivation', () => {
  it('verifies iff value of information exceeds energy+latency cost', () => {
    expect(shouldVerify({ ig: 0.4, energy: 0.2, latency: 0.1 })).toBe(true);
    expect(shouldVerify({ ig: 0.1, energy: 0.2, latency: 0.1 })).toBe(false);
  });
});

describe('memory policy derivation', () => {
  it('stores iff retrieval IG exceeds storage energy cost', () => {
    expect(shouldStore({ ig: 0.8, energy: 0.1 })).toBe(true);
    expect(shouldStore({ ig: 0.1, energy: 0.8 })).toBe(false);
  });

  it('evicts by recency·salience minus energy cost', () => {
    expect(evictScore({ recency: 1, salience: 0.8, energy: 0.2 })).toBeCloseTo(0.6, 10);
    expect(evictScore({ recency: 0.1, salience: 0.2, energy: 0.5 })).toBeCloseTo(-0.48, 10);
  });
});

describe('parity contract on the EI corpus', () => {
  const report = runDecisionLawBenchmark();

  it('all 17 cases are decided', () => {
    expect(report.totalCases).toBe(17);
  });

  it('veto recall 1.0 — every veto case derives to reject', () => {
    expect(report.vetoRejectRecall).toBe(1);
  });

  it('negative controls all derive to proceed', () => {
    expect(report.negativeProceedRate).toBe(1);
  });

  it('advisory cases never derive to reject', () => {
    expect(report.advisoryNonRejectRate).toBe(1);
  });

  it('reported risk per case matches the instability prototype', () => {
    const vetoCase = report.cases.find((c) => c.id === 'spof-singular-database')!;
    expect(vetoCase.risk).toBeGreaterThanOrEqual(0.5);
    const cleanCase = report.cases.find((c) => c.id === 'clean-design')!;
    expect(cleanCase.risk).toBeLessThanOrEqual(0.25);
  });
});
