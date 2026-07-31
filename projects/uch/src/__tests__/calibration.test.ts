import { describe, it, expect } from 'vitest';
import { TakeFence } from '../cognitive-plane/calibration/takes.js';
import { computeCalibrationProfile, brierForTake } from '../cognitive-plane/calibration/calibration.js';
import { gateVoice, gateWithFallback, fallbackTemplate } from '../cognitive-plane/calibration/voice-gate.js';

function resolvedFence(
  entries: Array<[conviction: number, quality: 'correct' | 'incorrect' | 'partial' | 'unresolvable', domain?: string]>,
): TakeFence {
  const fence = new TakeFence();
  for (const [conviction, quality, domain] of entries) {
    const take = fence.add({ claim: `claim about ${domain ?? 'general'} ${Math.random().toString(36).slice(2)}`, conviction, domain: domain ?? 'general' });
    fence.resolve(take.id, { quality, resolvedBy: 'test' });
  }
  return fence;
}

describe('TakeFence', () => {
  it('adds and resolves takes', () => {
    const fence = new TakeFence();
    const take = fence.add({ claim: 'the release ships this week', conviction: 0.8 });
    expect(fence.open).toHaveLength(1);
    const resolved = fence.resolve(take.id, { quality: 'correct', evidence: 'shipped on time' });
    expect(resolved.status).toBe('resolved');
    expect(resolved.outcome).toBe(true);
    expect(fence.resolved).toHaveLength(1);
  });

  it('rejects invalid qualities and double resolution', () => {
    const fence = new TakeFence();
    const take = fence.add({ claim: 'x', conviction: 0.5 });
    expect(() => fence.resolve(take.id, { quality: 'maybe' as never })).toThrow(/Invalid quality/);
    fence.resolve(take.id, { quality: 'partial' });
    expect(() => fence.resolve(take.id, { quality: 'correct' })).toThrow(/already resolved/);
  });

  it('clamps conviction to [0, 1] and rejects empty claims', () => {
    const fence = new TakeFence();
    expect(fence.add({ claim: 'x', conviction: 3 }).conviction).toBe(1);
    expect(fence.add({ claim: 'x', conviction: -1 }).conviction).toBe(0);
    expect(() => fence.add({ claim: '   ', conviction: 0.5 })).toThrow(/must not be empty/);
  });
});

describe('computeCalibrationProfile', () => {
  it('cold-starts below the minimum resolved count', () => {
    const fence = resolvedFence([[0.8, 'correct'], [0.6, 'incorrect']]);
    const profile = computeCalibrationProfile(fence.all);
    expect(profile.coldStart).toBe(true);
    expect(profile.narratives[0]).toContain('Not enough resolved takes');
  });

  it('computes Brier, accuracy and scorecards past the threshold', () => {
    const fence = resolvedFence([
      [0.9, 'correct', 'markets'], [0.8, 'correct', 'markets'], [0.8, 'incorrect', 'markets'],
      [0.7, 'correct', 'code'], [0.6, 'incorrect', 'code'], [0.9, 'incorrect', 'code'],
    ]);
    const profile = computeCalibrationProfile(fence.all);
    expect(profile.coldStart).toBe(false);
    expect(profile.resolvedCount).toBe(6);
    expect(profile.accuracy).toBeCloseTo(3 / 6);
    expect(profile.brier).toBeGreaterThan(0);
    const markets = profile.scorecards.find((s) => s.domain === 'markets');
    expect(markets?.n).toBe(3);
    expect(profile.buckets.length).toBe(5);
  });

  it('surfaces unresolvable rate as a first-class signal', () => {
    const fence = resolvedFence([[0.8, 'correct'], [0.7, 'unresolvable'], [0.7, 'unresolvable']]);
    const profile = computeCalibrationProfile(fence.all);
    expect(profile.unresolvableRate).toBeCloseTo(2 / 3);
  });

  it('emits bias tags for weak domains and overconfidence', () => {
    const fence = resolvedFence([
      [0.9, 'incorrect', 'geo'], [0.85, 'incorrect', 'geo'], [0.8, 'incorrect', 'geo'],
      [0.6, 'correct', 'code'], [0.55, 'correct', 'code'], [0.5, 'correct', 'code'],
    ]);
    const profile = computeCalibrationProfile(fence.all);
    expect(profile.biasTags).toContain('domain:geo');
    expect(profile.biasTags).toContain('overconfidence:high-conviction-misses');
    expect(profile.biasTags).toContain('underconfidence:low-conviction-hits');
  });

  it('brierForTake maps partial to 0.5 outcome', () => {
    const fence = new TakeFence();
    const partial = fence.add({ claim: 'x', conviction: 0.6 });
    fence.resolve(partial.id, { quality: 'partial' });
    expect(brierForTake(fence.find(partial.id)!)).toBeCloseTo((0.6 - 0.5) ** 2);
  });
});

describe('voice-gate', () => {
  it('passes conversational narratives', () => {
    const result = gateVoice('You call markets well — 8 of 10 held up.');
    expect(result.passed).toBe(true);
  });

  it('rejects jargon-heavy and boilerplate text', () => {
    const jargon = gateVoice('The brier score calibration regression cohort metric aggregated 0.82 p-value significance level across the scorecard bucket distribution for the calibration profile.');
    expect(jargon.passed).toBe(false);
    expect(jargon.violations.some((v) => v.startsWith('JARGON'))).toBe(true);
    const boiler = gateVoice('It is important to note that the profile shows strong results in this domain.');
    expect(boiler.passed).toBe(false);
    expect(boiler.violations.some((v) => v.startsWith('BOILERPLATE'))).toBe(true);
  });

  it('rejects overly long sentences', () => {
    const long = gateVoice('This sentence is deliberately extremely long and it keeps going with many additional words added one after another without any meaningful pause so that it clearly crosses the configured maximum sentence length threshold and therefore triggers a long sentence violation in the voice gate heuristics here with even more words.');
    expect(long.passed).toBe(false);
    expect(long.violations.some((v) => v.startsWith('LONG_SENTENCE'))).toBe(true);
  });

  it('falls back to a template on violations', () => {
    const result = gateWithFallback('The brier score calibration regression cohort metric aggregated across the scorecard bucket distribution for the calibration profile.');
    expect(result.passed).toBe(true);
    expect(result.finalText).toBe(fallbackTemplate());
  });
});
