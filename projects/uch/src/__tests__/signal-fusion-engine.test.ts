import { describe, it, expect } from 'vitest';
import { SignalFusionEngine } from '../cortex_kernel/signal-fusion-engine.js';

describe('Signal Fusion Engine', () => {
  function candidates() {
    return [
      {
        name: 'Alpha',
        factors: [
          { id: 'quality' as const, label: 'quality', score: 0.8 },
          { id: 'fundamentals' as const, label: 'fundamentals', score: 0.7 },
          { id: 'momentum' as const, label: 'momentum', score: 0.6 },
        ],
      },
      {
        name: 'Beta',
        factors: [{ id: 'momentum' as const, label: 'momentum', score: 0.3 }],
      },
    ];
  }

  it('fuses candidates into a ranked composite with recommendation bands', () => {
    const engine = new SignalFusionEngine();
    const result = engine.fuse(candidates());
    expect(result.ranked.map((c) => c.name)).toEqual(['Alpha', 'Beta']);
    expect(result.recommendation.buy).toContain('Alpha');
    expect(result.recommendation.avoid).toContain('Beta');
    expect(result.ranked[0]!.composite).toBeGreaterThan(result.ranked[1]!.composite);
  });

  it('is deterministic across identical inputs', () => {
    const engine = new SignalFusionEngine();
    const first = engine.fuse(candidates());
    const second = engine.fuse(candidates());
    expect(second.ranked.map((c) => c.composite)).toEqual(first.ranked.map((c) => c.composite));
    expect(second.recommendation).toEqual(first.recommendation);
  });

  it('records run history with ranked order and bands', () => {
    const engine = new SignalFusionEngine();
    engine.fuse(candidates());
    const last = engine.getLastRun()!;
    expect(last.ranked).toEqual(['Alpha', 'Beta']);
    expect(last.candidateCount).toBe(2);
    expect(last.recommendation.buy).toEqual(['Alpha']);
    expect(engine.getRuns()).toHaveLength(1);
  });

  it('surfaces structural risk flags and the risk-flag benchmark', () => {
    const engine = new SignalFusionEngine();
    const result = engine.fuse(candidates());
    const beta = result.ranked.find((c) => c.name === 'Beta')!;
    expect(beta.riskFlags.join(' ')).toContain('few factors');
    expect(engine.getRiskFlagRate()).toBeCloseTo(0.5);
  });

  it('handles empty candidate sets without throwing', () => {
    const engine = new SignalFusionEngine();
    const result = engine.fuse([]);
    expect(result.ranked).toEqual([]);
    expect(result.recommendation.buy).toEqual([]);
    expect(engine.getAverageCoverage()).toBe(0);
  });

  it('computes the coverage benchmark from factor counts', () => {
    const engine = new SignalFusionEngine();
    engine.fuse(candidates());
    expect(engine.getAverageCoverage()).toBeCloseTo(2);
  });

  it('computes the decision-separation benchmark', () => {
    const engine = new SignalFusionEngine();
    engine.fuse(candidates());
    expect(engine.getDecisionSeparationRate()).toBeCloseTo(0.5);
  });

  it('emits signal:fused events when a sink is configured', () => {
    const events: Array<{ type: string; payload: Record<string, unknown> }> = [];
    const engine = new SignalFusionEngine({
      eventSink: (event) => {
        events.push(event);
      },
    });
    engine.fuse(candidates());
    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('signal:fused');
    expect(events[0]!.payload.buy).toEqual(['Alpha']);
  });

  it('reports status with run and benchmark counts', () => {
    const engine = new SignalFusionEngine();
    engine.fuse(candidates());
    const status = engine.getStatus();
    expect(status.runs).toBe(1);
    expect(status.candidates).toBe(2);
    expect(status.lastRun).not.toBeNull();
  });
});
