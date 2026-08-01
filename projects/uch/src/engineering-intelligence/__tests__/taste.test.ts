import { describe, expect, it } from 'vitest';
import {
  TASTE_RUBRIC,
  TASTE_GATE,
  assessTaste,
  TasteRegistry,
  type TasteAssessment,
} from '../taste/taste.js';

const all = (score: number): TasteAssessment['scores'] => ({
  elegant: score,
  simple: score,
  composable: score,
  minimal: score,
  readable: score,
  maintainable: score,
  beautiful: score,
});

describe('taste rubric', () => {
  it('weights sum to 1 across seven qualities', () => {
    expect(TASTE_RUBRIC.reduce((sum, m) => sum + m.weight, 0)).toBeCloseTo(1);
    expect(TASTE_RUBRIC).toHaveLength(7);
    const qualities = TASTE_RUBRIC.map((m) => m.quality);
    expect(qualities).toContain('elegant');
    expect(qualities).toContain('beautiful');
  });

  it('gates at the organic-score threshold', () => {
    expect(TASTE_GATE).toBe(0.9);
  });
});

describe('assessTaste', () => {
  it('scores a strong assessment as passing', () => {
    const verdict = assessTaste({ artifactId: 'a', scores: all(0.95) });
    expect(verdict.passes).toBe(true);
    expect(verdict.score).toBeCloseTo(0.95);
  });

  it('fails a weak assessment', () => {
    const verdict = assessTaste({ artifactId: 'a', scores: all(0.5) });
    expect(verdict.passes).toBe(false);
  });

  it('identifies the weakest quality for feedback', () => {
    const verdict = assessTaste({
      artifactId: 'a',
      scores: { ...all(0.95), minimal: 0.4 },
    });
    expect(verdict.weakest).toBe('minimal');
    expect(verdict.weakestScore).toBe(0.4);
  });

  it('defaults missing dimensions to 0', () => {
    const verdict = assessTaste({ artifactId: 'a', scores: {} as TasteAssessment['scores'] });
    expect(verdict.passes).toBe(false);
  });
});

describe('TasteRegistry', () => {
  it('accumulates taste history per author', () => {
    const registry = new TasteRegistry();
    registry.record('alice', { artifactId: '1', scores: all(0.95) });
    registry.record('alice', { artifactId: '2', scores: all(0.9) });
    const alice = registry.author('alice')!;
    expect(alice.assessments).toHaveLength(2);
    expect(alice.passRate).toBe(1);
  });

  it('routes work to the most reliably tasteful author', () => {
    const registry = new TasteRegistry();
    registry.record('bob', { artifactId: '1', scores: all(0.5) });
    registry.record('alice', { artifactId: '1', scores: all(0.95) });
    registry.record('alice', { artifactId: '2', scores: all(0.92) });
    expect(registry.bestAuthor(['alice', 'bob'])).toBe('alice');
  });

  it('returns undefined for unknown authors', () => {
    const registry = new TasteRegistry();
    expect(registry.author('nobody')).toBeUndefined();
    expect(registry.bestAuthor(['nobody'])).toBeUndefined();
  });
});
