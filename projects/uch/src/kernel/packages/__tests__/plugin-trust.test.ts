import { describe, expect, it } from 'vitest';
import {
  overallScore,
  decide,
  TrustRegistry,
  DEFAULT_TRUST_POLICY,
  type AxisScore,
  type PluginScorecard,
} from '../trust/plugin-trust.js';

const axes = (scores: Record<string, number>): AxisScore[] =>
  (Object.keys(scores) as (keyof typeof scores)[]).map((axis) => ({
    axis: axis as AxisScore['axis'],
    score: scores[axis],
    evidence: `run-${axis}`,
  }));

const card = (pluginId: string, version: string, scores: Record<string, number>): Omit<PluginScorecard, 'overall' | 'decision'> => ({
  pluginId,
  version,
  axes: axes(scores),
});

describe('overallScore', () => {
  it('averages axes equally', () => {
    expect(overallScore(axes({ trust: 1, quality: 0.5 }))).toBe(0.75);
  });

  it('returns 0 for an empty axis set', () => {
    expect(overallScore([])).toBe(0);
  });
});

describe('decide', () => {
  it('allows high-scoring plugins', () => {
    const result = decide(card('p1', '1.0.0', { trust: 0.9, quality: 0.9, security: 0.9, performance: 0.9, compatibility: 0.9, maintenance: 0.9 }));
    expect(result.decision).toBe('allow');
    expect(result.overall).toBeGreaterThan(0.8);
  });

  it('monitors medium plugins', () => {
    const result = decide(card('p2', '1.0.0', { trust: 0.6, quality: 0.6, security: 0.9, performance: 0.6, compatibility: 0.6, maintenance: 0.6 }));
    expect(result.decision).toBe('allow-with-monitoring');
  });

  it('sandboxes low-scoring but non-veto plugins', () => {
    const result = decide(card('p3', '1.0.0', { trust: 0.4, quality: 0.4, security: 0.6, performance: 0.4, compatibility: 0.4, maintenance: 0.4 }));
    expect(result.decision).toBe('allow-in-sandbox');
  });

  it('denies below the floor', () => {
    const result = decide(card('p4', '1.0.0', { trust: 0.1, quality: 0.1, security: 0.2, performance: 0.1, compatibility: 0.1, maintenance: 0.1 }));
    expect(result.decision).toBe('deny');
  });

  it('vetoes low security even with a high aggregate (no score gaming)', () => {
    const result = decide(card('p5', '1.0.0', { trust: 0.9, quality: 0.9, security: 0.1, performance: 0.9, compatibility: 0.9, maintenance: 0.9 }));
    expect(result.overall).toBeGreaterThan(0.7);
    expect(result.decision).toBe('deny');
  });

  it('respects a custom policy', () => {
    const result = decide(card('p6', '1.0.0', { trust: 0.5, quality: 0.5, security: 0.5, performance: 0.5, compatibility: 0.5, maintenance: 0.5 }), {
      ...DEFAULT_TRUST_POLICY,
      denyBelow: 0.6,
    });
    expect(result.decision).toBe('deny');
  });
});

describe('TrustRegistry', () => {
  it('keeps a lineage of score history', () => {
    const registry = new TrustRegistry();
    registry.register(decide(card('p1', '1.0.0', { trust: 0.4, quality: 0.4, security: 0.9, performance: 0.4, compatibility: 0.4, maintenance: 0.4 })), 1);
    registry.register(decide(card('p1', '2.0.0', { trust: 0.9, quality: 0.9, security: 0.9, performance: 0.9, compatibility: 0.9, maintenance: 0.9 })), 2);
    const history = registry.historyFor('p1');
    expect(history).toHaveLength(2);
    expect(history[0].version).toBe('1.0.0');
    expect(history[1].decision).toBe('allow');
    expect(registry.get('p1')?.version).toBe('2.0.0');
  });
});
