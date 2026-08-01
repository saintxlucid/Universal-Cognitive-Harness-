import { describe, expect, it } from 'vitest';
import {
  UX_CHARTER,
  charterStatus,
  shouldPreempt,
  isExplainable,
  isCalm,
  type UxObservation,
} from '../ux/ux-charter.js';

describe('UX Charter', () => {
  it('defines all six felt properties', () => {
    expect(UX_CHARTER.map((q) => q.quality).sort()).toEqual(
      ['predictability', 'interruptibility', 'explainability', 'trustworthiness', 'calm', 'transparency'].sort(),
    );
  });

  it('binds every quality to a corpus mechanism', () => {
    for (const def of UX_CHARTER) {
      expect(def.measuredBy.length).toBeGreaterThan(0);
      expect(def.minimum).toBeGreaterThan(0);
    }
  });

  it('reports compliant status when guarantees hold', () => {
    const observations: UxObservation[] = [
      { quality: 'calm', satisfied: true, atTick: 1 },
      { quality: 'calm', satisfied: true, atTick: 2 },
    ];
    const status = charterStatus(observations);
    const calm = status.find((s) => s.quality === 'calm')!;
    expect(calm.compliant).toBe(true);
    expect(calm.compliance).toBe(1);
  });

  it('flags violations of the minimum guarantee', () => {
    const observations: UxObservation[] = [
      { quality: 'calm', satisfied: false, atTick: 1 },
      { quality: 'calm', satisfied: true, atTick: 2 },
      { quality: 'calm', satisfied: false, atTick: 3 },
    ];
    const status = charterStatus(observations);
    const calm = status.find((s) => s.quality === 'calm')!;
    expect(calm.compliance).toBeCloseTo(1 / 3);
    expect(calm.compliant).toBe(false);
  });

  it('treats empty windows as compliant (no evidence of failure)', () => {
    const status = charterStatus([]);
    for (const s of status) expect(s.compliant).toBe(true);
  });

  it('respects the window', () => {
    const observations: UxObservation[] = [
      { quality: 'calm', satisfied: false, atTick: 1 },
      { quality: 'calm', satisfied: true, atTick: 200 },
    ];
    const status = charterStatus(observations, 100, 200);
    const calm = status.find((s) => s.quality === 'calm')!;
    expect(calm.observed).toBe(1);
  });
});

describe('interruptibility', () => {
  it('user interrupts preempt internal work (priority inversion)', () => {
    expect(shouldPreempt('user', 'internal')).toBe(true);
    expect(shouldPreempt('internal', 'user')).toBe(false);
    expect(shouldPreempt('internal', 'internal')).toBe(false);
  });
});

describe('explainability + calm', () => {
  it('requires a ledger path for explainability', () => {
    expect(isExplainable(['evt-1', 'evt-2'])).toBe(true);
    expect(isExplainable([])).toBe(false);
  });

  it('calm is an SLO miss-rate bound', () => {
    expect(isCalm(0.02)).toBe(true);
    expect(isCalm(0.3)).toBe(false);
  });
});
