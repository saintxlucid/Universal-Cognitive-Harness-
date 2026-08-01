/**
 * Attention Algebra — prototype tests (IDEA-0093).
 *
 * Invariant coverage: conservation (Σ allocations ≤ budget under any
 * operator sequence), merge subadditivity (Attention + Attention ≠
 * Double Attention), focus+split round-trip, attenuate releasing to
 * the pool, amplify bounded by max and pool, and the derived
 * attention-window shape (saturation — the SLO's metric).
 */

import { describe, expect, it } from 'vitest';
import { AttentionAlgebra, attentionWindow } from '../attention-algebra.js';

describe('conservation axiom', () => {
  it('sum of allocations never exceeds the budget', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    algebra.focus(1, 'error:occurred', 0.4);
    algebra.focus(1, 'test:failed', 0.4);
    algebra.split(1, ['a', 'b'], [1, 1]);
    algebra.diffuse(1, 4);
    expect(algebra.conservationHolds(1)).toBe(true);
    expect(algebra.summary(1).totalAllocated).toBeLessThanOrEqual(10);
  });

  it('focus beyond the budget stalls (capped, not invented)', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 1);
    const a = algebra.focus(1, 's1', 0.8);
    const b = algebra.focus(1, 's2', 0.8);
    expect(a.amount + b.amount).toBeLessThanOrEqual(1);
    expect(algebra.available(1)).toBeCloseTo(0, 5);
  });

  it('rejects a non-positive budget (the grant source decides)', () => {
    const algebra = new AttentionAlgebra();
    expect(() => algebra.beginTick(1, 0)).toThrow(/positive/);
  });

  it('throws when operating without a budget for the tick', () => {
    const algebra = new AttentionAlgebra();
    expect(() => algebra.focus(9, 's', 0.5)).toThrow(/beginTick/);
  });
});

describe('merge is subadditive (Attention + Attention ≠ Double Attention)', () => {
  it('fused attention is strictly less than the sum', () => {
    const algebra = new AttentionAlgebra({ mergeFactor: 0.8 });
    algebra.beginTick(1, 10);
    const a = algebra.focus(1, 'w1', 0.2);
    const b = algebra.focus(1, 'w2', 0.2);
    const merged = algebra.merge(1, 'fused', [a, b]);
    expect(merged.amount).toBeCloseTo((a.amount + b.amount) * 0.8, 5);
    expect(merged.amount).toBeLessThan(a.amount + b.amount);
    expect(algebra.conservationHolds(1)).toBe(true);
  });

  it('records the fused origin sources in the ledger', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    const a = algebra.focus(1, 'w1', 0.1);
    const b = algebra.focus(1, 'w2', 0.1);
    algebra.merge(1, 'fused', [a, b]);
    const mergeRecord = algebra.recordsFor(1).find((r) => r.operator === 'merge');
    expect(mergeRecord?.origin).toEqual(['w1', 'w2']);
  });
});

describe('focus + split round-trip', () => {
  it('split of a single focused source returns exactly the focus', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    algebra.focus(1, 'critical', 0.5);
    const split = algebra.split(1, ['critical'], [1]);
    expect(split[0]?.amount).toBeCloseTo(5, 5);
    expect(split).toHaveLength(1);
    expect(algebra.conservationHolds(1)).toBe(true);
  });
});

describe('attenuate releases to the pool', () => {
  it('released attention is available for reallocation in the same tick', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    algebra.focus(1, 'noisy', 0.6);
    algebra.attenuate(1, 'noisy', 0.5);
    expect(algebra.allocatedTo('noisy')).toBeCloseTo(3, 5);
    const before = algebra.available(1);
    const reallocated = algebra.focus(1, 'signal', 0.2);
    expect(reallocated.amount).toBeGreaterThan(0);
    expect(algebra.available(1)).toBeCloseTo(before - reallocated.amount, 5);
    expect(algebra.conservationHolds(1)).toBe(true);
  });

  it('records the released amount', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    algebra.focus(1, 'noisy', 0.6);
    algebra.attenuate(1, 'noisy', 0.5);
    const record = algebra.recordsFor(1).find((r) => r.operator === 'attenuate');
    expect(record?.released).toBeCloseTo(3, 5);
  });
});

describe('amplify is bounded', () => {
  it('cannot exceed the per-source max', () => {
    const algebra = new AttentionAlgebra({ amplifyMax: 0.5 });
    algebra.beginTick(1, 10);
    algebra.focus(1, 's', 0.3);
    const boosted = algebra.amplify(1, 's', 10, 5);
    expect(boosted.amount).toBeLessThanOrEqual(5);
    expect(algebra.conservationHolds(1)).toBe(true);
  });

  it('cannot exceed the available pool (conservation)', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    algebra.focus(1, 's', 0.9);
    const boosted = algebra.amplify(1, 's', 100);
    expect(boosted.amount).toBeLessThanOrEqual(10);
    expect(algebra.conservationHolds(1)).toBe(true);
  });
});

describe('diffuse vigilance', () => {
  it('spreads thinly and respects the ceiling', () => {
    const algebra = new AttentionAlgebra({ diffuseCeiling: 0.25 });
    algebra.beginTick(1, 10);
    const shares = algebra.diffuse(1, 8);
    expect(shares).toHaveLength(8);
    for (const share of shares) expect(share.amount).toBeLessThanOrEqual(2.5);
    expect(algebra.conservationHolds(1)).toBe(true);
  });
});

describe('ledger observability', () => {
  it('records every decision with tick, operator, and budget', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    algebra.focus(1, 'a', 0.1);
    algebra.diffuse(1, 2);
    const records = algebra.recordsFor(1);
    expect(records.length).toBe(3);
    expect(records.every((r) => r.tick === 1 && r.budgetAtTick === 10)).toBe(true);
    expect(algebra.fullLedger().length).toBe(3);
  });

  it('tick budgets are isolated (no cross-tick leakage)', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    algebra.focus(1, 'a', 0.9);
    algebra.beginTick(2, 2);
    expect(algebra.available(2)).toBe(2);
    algebra.focus(2, 'b', 1.0);
    expect(algebra.conservationHolds(2)).toBe(true);
    expect(algebra.summary(1).totalAllocated).toBeCloseTo(9, 5);
  });
});

describe('derived attention window (SLO shape)', () => {
  it('reports saturation = allocated / budget', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    algebra.focus(1, 'a', 0.25);
    algebra.focus(1, 'b', 0.25);
    const window = attentionWindow(algebra, 1);
    expect(window.tick).toBe(1);
    expect(window.budget).toBe(10);
    expect(window.saturation).toBeCloseTo(0.5, 5);
    expect(window.window.length).toBe(2);
  });

  it('reports zero saturation on an empty tick', () => {
    const algebra = new AttentionAlgebra();
    algebra.beginTick(1, 10);
    expect(attentionWindow(algebra, 1).saturation).toBe(0);
  });
});
