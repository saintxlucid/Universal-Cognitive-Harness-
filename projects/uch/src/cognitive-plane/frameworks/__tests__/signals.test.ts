import { describe, it, expect } from 'vitest';
import { fuseSignals, factorRegimeNotes } from '../signals/signal-fusion.js';

describe('Composite Signal Fusion', () => {
  const candidates = [
    {
      name: 'Stock A',
      factors: [
        { id: 'momentum' as const, label: 'momentum', score: 0.8 },
        { id: 'quality' as const, label: 'quality', score: 0.7 },
        { id: 'liquidity' as const, label: 'liquidity', score: 0.6 },
      ],
    },
    {
      name: 'Stock B',
      factors: [
        { id: 'momentum' as const, label: 'momentum', score: 0.2 },
        { id: 'quality' as const, label: 'quality', score: 0.3 },
        { id: 'liquidity' as const, label: 'liquidity', score: 0.9 },
      ],
    },
    {
      name: 'Stock C',
      factors: [
        { id: 'volatility' as const, label: 'volatility', score: 0.9 },
        { id: 'liquidity' as const, label: 'liquidity', score: 0.2 },
      ],
    },
  ];

  it('ranks by composite score', () => {
    const r = fuseSignals(candidates);
    expect(r.ranked[0].name).toBe('Stock A');
    expect(r.ranked[r.ranked.length - 1].name).toBe('Stock B');
  });

  it('recommends only risk-clean high scorers for buy', () => {
    const r = fuseSignals(candidates);
    expect(r.recommendation.buy).toContain('Stock A');
    expect(r.recommendation.buy).not.toContain('Stock C');
    expect(r.recommendation.avoid).toContain('Stock B');
  });

  it('flags single-signal and liquidity risks', () => {
    const r = fuseSignals([{ name: 'Solo', factors: [{ id: 'momentum' as const, label: 'm', score: 0.9 }] }]);
    expect(r.ranked[0].riskFlags).toContain('few factors — single-signal risk (noise dominates)');
  });

  it('applies risk controls and explains the architecture', () => {
    const r = fuseSignals(candidates, { maxAllocationPct: 10, neutralizeSectors: true, topN: 1 });
    expect(r.riskControls.some((c) => c.includes('10%'))).toBe(true);
    expect(r.riskControls.some((c) => c.includes('sector-neutral'))).toBe(true);
    expect(r.recommendation.buy.length).toBeLessThanOrEqual(1);
    expect(r.insight).toContain('edge comes from the architecture');
  });
});

describe('Factor regimes', () => {
  it('documents why no factor dominates', () => {
    const momentum = factorRegimeNotes('momentum');
    expect(momentum?.excels).toBe('strong trends');
    expect(momentum?.struggles).toBe('choppy markets');
    const meanRev = factorRegimeNotes('mean-reversion');
    expect(meanRev?.excels).toBe('range-bound markets');
  });
});
