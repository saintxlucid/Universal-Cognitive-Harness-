import { describe, it, expect } from 'vitest';
import { assessInformation, QUESTIONS } from '../critical/critical-evaluator.js';

describe('Critical Thinking Evaluator', () => {
  it('covers all nine critical questions', () => {
    expect(QUESTIONS.length).toBe(9);
    expect(QUESTIONS.map((q) => q.id)).toEqual(
      expect.arrayContaining([
        'needs', 'qualified_source', 'currency', 'prejudice', 'fact_vs_opinion',
        'propaganda', 'motivation', 'whole_story', 'better_sources',
      ]),
    );
  });

  it('maps questions onto the constitution integrity laws', () => {
    const laws = QUESTIONS.map((q) => q.law).filter(Boolean);
    expect(laws).toContain('Qualified Source Required');
    expect(laws).toContain('No Prejudice as Evidence');
    expect(laws).toContain('No Propaganda as Evidence');
    expect(laws).toContain('Whole Truth Requirement');
    expect(laws).toContain('Objectivity Required');
  });

  it('verdicts reliable when answers pass every check', () => {
    const r = assessInformation({
      target: 'Report X',
      answers: {
        needs: 'yes it is relevant',
        qualified_source: 'yes, a peer-reviewed expert source',
        currency: 'yes, verified and recent',
        prejudice: 'no, no bias detected',
        fact_vs_opinion: 'no, facts with data',
        propaganda: 'no, not an ad',
        motivation: 'yes, educational motivation',
        whole_story: 'yes, confirmed by multiple accounts',
        better_sources: 'yes, converges with other sources',
      },
    });
    expect(r.verdict).toBe('reliable');
    expect(r.reliabilityScore).toBeGreaterThanOrEqual(80);
  });

  it('rejects when most checks fail', () => {
    const r = assessInformation({
      target: 'Rumor',
      answers: {
        needs: 'no',
        qualified_source: 'unknown source',
        currency: 'no, outdated',
        prejudice: 'yes biased',
        fact_vs_opinion: 'yes opinions as facts',
        propaganda: 'yes',
        motivation: 'no, selling something',
        whole_story: 'no, missing context',
        better_sources: 'no, single source',
      },
    });
    expect(r.verdict).toBe('reject');
    expect(r.failures.length).toBe(9);
  });

  it('flags unanswered questions and recommends cross-checking', () => {
    const r = assessInformation({
      target: 'Article',
      answers: { qualified_source: 'yes, expert' },
    });
    expect(r.verdict).toBe('cross-check');
    expect(r.recommendations.some((rec) => rec.includes('unanswered'))).toBe(true);
  });

  it('detects partial-truth risk in the whole-story check', () => {
    const r = assessInformation({
      target: 'Claim',
      answers: {
        needs: 'yes',
        qualified_source: 'yes expert',
        currency: 'yes recent',
        prejudice: 'no',
        fact_vs_opinion: 'no',
        propaganda: 'no',
        motivation: 'yes educational',
        whole_story: 'no, only showing successes',
        better_sources: 'yes verified',
      },
    });
    expect(r.recommendations.some((rec) => rec.includes('partial truth'))).toBe(true);
  });
});
