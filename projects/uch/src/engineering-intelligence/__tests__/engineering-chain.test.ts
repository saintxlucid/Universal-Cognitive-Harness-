import { describe, expect, it } from 'vitest';
import {
  CHAIN_STAGES,
  checkChain,
  isReplayable,
  isOrdered,
  type ChainArtifact,
} from '../chain/engineering-chain.js';

const art = (stage: ChainArtifact['stage'], id: string, hash: string, derivedFrom?: string, atTick = 1): ChainArtifact => ({
  stage,
  artifactId: id,
  contentHash: hash,
  derivedFrom,
  atTick,
});

const FULL_CHAIN: ChainArtifact[] = [
  art('plan', 'p1', 'h1', undefined, 1),
  art('simulation', 's1', 'h2', 'p1', 2),
  art('verification', 'v1', 'h3', 's1', 3),
  art('execution', 'e1', 'h4', 'v1', 4),
  art('validation', 'val1', 'h5', 'e1', 5),
  art('evidence', 'ev1', 'h6', 'val1', 6),
  art('replay', 'r1', 'h7', 'ev1', 7),
];

describe('checkChain', () => {
  it('declares a complete chain complete', () => {
    const result = checkChain(FULL_CHAIN);
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.brokenLinks).toEqual([]);
  });

  it('reports missing stages', () => {
    const partial = FULL_CHAIN.filter((a) => a.stage !== 'simulation');
    const result = checkChain(partial);
    expect(result.complete).toBe(false);
    expect(result.missing).toContain('simulation');
  });

  it('reports broken lineage links', () => {
    const broken = FULL_CHAIN.map((a) => (a.stage === 'execution' ? { ...a, derivedFrom: 'ghost' } : a));
    const result = checkChain(broken);
    expect(result.brokenLinks).toContain('e1');
    expect(result.complete).toBe(false);
  });

  it('requires the plan stage', () => {
    const noPlan = FULL_CHAIN.filter((a) => a.stage !== 'plan');
    const result = checkChain(noPlan);
    expect(result.missing).toContain('plan');
  });
});

describe('isReplayable + isOrdered', () => {
  it('replays when stage and hash match', () => {
    expect(isReplayable(art('plan', 'a', 'h1'), art('plan', 'b', 'h1'))).toBe(true);
    expect(isReplayable(art('plan', 'a', 'h1'), art('plan', 'b', 'h2'))).toBe(false);
    expect(isReplayable(art('plan', 'a', 'h1'), art('evidence', 'b', 'h1'))).toBe(false);
  });

  it('orders stages correctly', () => {
    expect(isOrdered(FULL_CHAIN)).toBe(true);
    const scrambled = [
      { ...FULL_CHAIN[6], atTick: 2 },
      { ...FULL_CHAIN[1], atTick: 7 },
    ];
    expect(isOrdered(scrambled)).toBe(false);
  });

  it('covers all seven stages', () => {
    expect(CHAIN_STAGES).toEqual(['plan', 'simulation', 'verification', 'execution', 'validation', 'evidence', 'replay']);
  });
});
