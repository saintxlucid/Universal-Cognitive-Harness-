/**
 * RFC-0005 failure physics — held-out corpus tests.
 *
 * Validates that the bootstrap-calibrated θ = 0.5 generalizes to an
 * independently written corpus, that θ re-calibrates to a separable
 * range, and that the held-out θ cross-applies to the training corpus
 * without losing veto recall or negative pass rate.
 */

import { describe, expect, it } from 'vitest';
import { evaluateInstability, VETO_THRESHOLD } from '../failure-physics/instability.js';
import { FAILURE_PHYSICS_HELDOUT_CORPUS } from '../failure-physics/held-out.js';
import { runHeldOutCalibration } from '../failure-physics/heldout-calibration.js';

describe('held-out corpus integrity', () => {
  it('is independent: 16 cases across all three groups', () => {
    expect(FAILURE_PHYSICS_HELDOUT_CORPUS).toHaveLength(16);
    expect(FAILURE_PHYSICS_HELDOUT_CORPUS.filter((c) => c.group === 'veto')).toHaveLength(6);
    expect(FAILURE_PHYSICS_HELDOUT_CORPUS.filter((c) => c.group === 'negative')).toHaveLength(5);
    expect(FAILURE_PHYSICS_HELDOUT_CORPUS.filter((c) => c.group === 'advisory')).toHaveLength(5);
  });

  it('shares no case ids with the training corpus', () => {
    const ids = new Set(FAILURE_PHYSICS_HELDOUT_CORPUS.map((c) => c.id));
    expect(ids.has('spof-singular-database')).toBe(false);
    expect(ids.has('clean-design')).toBe(false);
  });
});

describe('θ = 0.5 generalizes to held-out data', () => {
  it('every held-out veto case exceeds the threshold', () => {
    for (const c of FAILURE_PHYSICS_HELDOUT_CORPUS.filter((c) => c.group === 'veto')) {
      expect(evaluateInstability(c.target).maxInstability).toBeGreaterThanOrEqual(VETO_THRESHOLD);
    }
  });

  it('no held-out negative or advisory case reaches the threshold', () => {
    for (const c of FAILURE_PHYSICS_HELDOUT_CORPUS.filter((c) => c.group !== 'veto')) {
      expect(evaluateInstability(c.target).maxInstability).toBeLessThan(VETO_THRESHOLD);
    }
  });

  it('held-out instability values are separable with margin', () => {
    const r = runHeldOutCalibration();
    const vetoMin = Math.min(
      ...r.cases.filter((c) => c.group === 'veto').map((c) => c.instability),
    );
    const nonVetoMax = Math.max(
      ...r.cases.filter((c) => c.group !== 'veto').map((c) => c.instability),
    );
    expect(vetoMin).toBeGreaterThan(nonVetoMax);
    expect(vetoMin).toBeGreaterThanOrEqual(0.5);
    expect(nonVetoMax).toBeLessThanOrEqual(0.5);
  });
});

describe('held-out calibration contract', () => {
  const r = runHeldOutCalibration();

  it('satisfies every contract clause', () => {
    expect(r.contract).toEqual({
      vetoRecallOk: true,
      negativePassOk: true,
      separable: true,
      crossOk: true,
    });
  });

  it('θ re-calibrates to a separable range on the held-out set', () => {
    expect(r.heldOutRange).not.toBeNull();
    expect(r.heldOutRange![0]).toBeLessThan(r.heldOutRange![1]);
  });

  it('θ_heldout cross-applies to the training corpus (veto recall ≥ 0.8)', () => {
    expect(r.crossVetoRecall).toBeGreaterThanOrEqual(0.8);
    expect(r.crossNegativePassRate).toBe(1);
  });

  it('reports per-case verdicts', () => {
    expect(r.cases).toHaveLength(16);
    expect(r.cases.find((c) => c.id === 'heldout-veto-single-writer')!.veto).toBe(true);
    expect(r.cases.find((c) => c.id === 'heldout-negative-replicated-writes')!.veto).toBe(false);
  });
});

describe('advisory handling on held-out data', () => {
  it('never vetoes advisory cases', () => {
    const r = runHeldOutCalibration();
    expect(r.heldOutAdvisoryNonVetoRate).toBe(1);
  });
});
