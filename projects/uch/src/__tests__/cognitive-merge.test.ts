import { describe, expect, it } from 'vitest';
import { mergeCognition } from '../kernel/merge/cognitive-merge.js';
import type { BeliefLike } from '../kernel/merge/cognitive-merge.js';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const key of Object.keys(value)) {
      const child = (value as Record<string, unknown>)[key];
      if (child && typeof child === 'object') deepFreeze(child);
    }
  }
  return value;
}

describe('mergeCognition', () => {
  it('unions disjoint beliefs as additions', () => {
    const a: BeliefLike[] = [
      { claim: 'db is postgres', confidence: 0.9, evidence: ['e1'] },
    ];
    const b: BeliefLike[] = [
      { claim: 'api is hono', confidence: 0.8, verdict: 'accepted', evidence: ['e2', 'e3'] },
    ];
    const result = mergeCognition(a, b);
    expect(result.conflicts).toEqual([]);
    expect(result.stats).toEqual({ added: 2, merged: 0, conflicted: 0 });
    expect(result.beliefs.map((x) => x.claim)).toEqual(['api is hono', 'db is postgres']);
    expect(result.beliefs[0]).toEqual({ claim: 'api is hono', confidence: 0.8, verdict: 'accepted', evidence: ['e2', 'e3'] });
    expect(result.beliefs[1]).toEqual({ claim: 'db is postgres', confidence: 0.9, evidence: ['e1'] });
  });

  it('merges identical claim with same verdict: evidence union and mean confidence', () => {
    const a: BeliefLike[] = [{ claim: 'cache is redis', confidence: 0.75, verdict: 'accepted', evidence: ['e1', 'e2'] }];
    const b: BeliefLike[] = [{ claim: 'cache is redis', confidence: 0.875, verdict: 'accepted', evidence: ['e2', 'e3'] }];
    const result = mergeCognition(a, b);
    expect(result.conflicts).toEqual([]);
    expect(result.stats).toEqual({ added: 0, merged: 1, conflicted: 0 });
    expect(result.beliefs).toEqual([
      { claim: 'cache is redis', confidence: 0.8125, verdict: 'accepted', evidence: ['e1', 'e2', 'e3'] },
    ]);
  });

  it('merges within the confidence tolerance at 0.15 difference', () => {
    const a: BeliefLike[] = [{ claim: 'x', confidence: 0.5, evidence: ['e1'] }];
    const b: BeliefLike[] = [{ claim: 'x', confidence: 0.625, evidence: ['e2'] }];
    const result = mergeCognition(a, b);
    expect(result.conflicts).toEqual([]);
    expect(result.stats.merged).toBe(1);
  });

  it('flags confidence divergence above 0.15 as a conflict preserving both sources', () => {
    const a: BeliefLike[] = [{ claim: 'rate limit is 100 rpm', confidence: 0.5, verdict: 'accepted', evidence: ['e1'] }];
    const b: BeliefLike[] = [{ claim: 'rate limit is 100 rpm', confidence: 0.75, verdict: 'accepted', evidence: ['e2'] }];
    const result = mergeCognition(a, b);
    expect(result.beliefs).toEqual([]);
    expect(result.stats).toEqual({ added: 0, merged: 0, conflicted: 1 });
    expect(result.conflicts).toEqual([
      {
        claim: 'rate limit is 100 rpm',
        a: { claim: 'rate limit is 100 rpm', confidence: 0.5, verdict: 'accepted', evidence: ['e1'] },
        b: { claim: 'rate limit is 100 rpm', confidence: 0.75, verdict: 'accepted', evidence: ['e2'] },
        reason: 'confidence',
      },
    ]);
  });

  it('flags verdict mismatch as a conflict', () => {
    const a: BeliefLike[] = [{ claim: 'feature works', confidence: 0.8, verdict: 'accepted', evidence: ['e1'] }];
    const b: BeliefLike[] = [{ claim: 'feature works', confidence: 0.9, verdict: 'rejected', evidence: ['e2'] }];
    const result = mergeCognition(a, b);
    expect(result.beliefs).toEqual([]);
    expect(result.stats.conflicted).toBe(1);
    expect(result.conflicts[0]?.reason).toBe('verdict');
    expect(result.conflicts[0]?.a.verdict).toBe('accepted');
    expect(result.conflicts[0]?.b.verdict).toBe('rejected');
  });

  it('flags a verdict present on one side and absent on the other as a conflict', () => {
    const a: BeliefLike[] = [{ claim: 'plan is sound', confidence: 0.7, evidence: ['e1'] }];
    const b: BeliefLike[] = [{ claim: 'plan is sound', confidence: 0.7, verdict: 'accepted', evidence: ['e2'] }];
    const result = mergeCognition(a, b);
    expect(result.stats.conflicted).toBe(1);
    expect(result.conflicts[0]?.reason).toBe('verdict');
  });

  it('handles empty sides', () => {
    const empty = mergeCognition([], []);
    expect(empty.beliefs).toEqual([]);
    expect(empty.conflicts).toEqual([]);
    expect(empty.stats).toEqual({ added: 0, merged: 0, conflicted: 0 });

    const one = { claim: 'only', confidence: 0.6, evidence: ['e1'] };
    const left = mergeCognition([one], []);
    expect(left.beliefs).toEqual([one]);
    expect(left.stats).toEqual({ added: 1, merged: 0, conflicted: 0 });

    const right = mergeCognition([], [one]);
    expect(right.beliefs).toEqual([one]);
    expect(right.stats).toEqual({ added: 1, merged: 0, conflicted: 0 });
  });

  it('is deterministic across runs and input order', () => {
    const a: BeliefLike[] = [
      { claim: 'zeta', confidence: 0.5, evidence: ['e1'] },
      { claim: 'alpha', confidence: 0.8, verdict: 'ok', evidence: ['e2'] },
    ];
    const b: BeliefLike[] = [
      { claim: 'alpha', confidence: 0.9, verdict: 'ok', evidence: ['e3'] },
      { claim: 'middle', confidence: 0.4, evidence: ['e4'] },
    ];
    const first = mergeCognition(a, b);
    const second = mergeCognition(a, b);
    expect(second).toEqual(first);
    expect(first.beliefs.map((x) => x.claim)).toEqual(['alpha', 'middle', 'zeta']);
    const reversed = mergeCognition([...b].reverse(), [...a].reverse());
    expect(reversed.beliefs.map((x) => x.claim)).toEqual(['alpha', 'middle', 'zeta']);
    expect(reversed.stats).toEqual(first.stats);
    expect(reversed.conflicts).toEqual(first.conflicts);
  });

  it('never mutates inputs and returns defensive copies', () => {
    const evidenceA = ['e1'];
    const evidenceB = ['e1', 'e2'];
    const a: BeliefLike[] = deepFreeze([
      { claim: 'shared', confidence: 0.75, verdict: 'accepted', evidence: evidenceA },
    ]);
    const b: BeliefLike[] = deepFreeze([
      { claim: 'shared', confidence: 0.875, verdict: 'accepted', evidence: evidenceB },
    ]);
    const result = mergeCognition(a, b);
    expect(a).toEqual([{ claim: 'shared', confidence: 0.75, verdict: 'accepted', evidence: ['e1'] }]);
    expect(b).toEqual([{ claim: 'shared', confidence: 0.875, verdict: 'accepted', evidence: ['e1', 'e2'] }]);
    expect(result.beliefs[0]?.evidence).toEqual(['e1', 'e2']);
    expect(result.beliefs[0]?.evidence).not.toBe(evidenceA);
    expect(result.beliefs[0]?.evidence).not.toBe(evidenceB);
  });

  it('reports exact combined stats across added, merged, and conflicted', () => {
    const a: BeliefLike[] = [
      { claim: 'merged', confidence: 0.75, verdict: 'ok', evidence: ['e1'] },
      { claim: 'conflicted', confidence: 0.5, verdict: 'ok', evidence: ['e2'] },
    ];
    const b: BeliefLike[] = [
      { claim: 'merged', confidence: 0.875, verdict: 'ok', evidence: ['e3'] },
      { claim: 'conflicted', confidence: 0.9, verdict: 'ok', evidence: ['e4'] },
      { claim: 'only-b', confidence: 0.3, evidence: ['e5'] },
    ];
    const result = mergeCognition(a, b);
    expect(result.stats).toEqual({ added: 1, merged: 1, conflicted: 1 });
    expect(result.beliefs.map((x) => x.claim)).toEqual(['merged', 'only-b']);
    expect(result.conflicts.map((x) => x.claim)).toEqual(['conflicted']);
  });
});
