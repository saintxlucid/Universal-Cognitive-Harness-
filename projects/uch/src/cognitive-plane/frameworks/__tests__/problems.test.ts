import { describe, it, expect } from 'vitest';
import { ideal, fiveWhys, designThinking, pdcaPlan, ooda, kepnerTregoe } from '../problems/problem-solver.js';

describe('IDEAL', () => {
  it('produces a complete structured workflow', () => {
    const r = ideal({ problem: 'Auth latency is too high', solutions: ['Add cache', 'Reduce queries'] });
    expect(r.identified).toContain('Auth latency');
    expect(r.explored.length).toBe(2);
    expect(r.acted).toBe('Add cache');
    expect(r.lookedBack.length).toBeGreaterThan(0);
  });
});

describe('Five Whys', () => {
  it('descends the causal chain to a root cause', () => {
    const r = fiveWhys({
      symptom: 'Website crashed',
      whyAnswers: [
        'Database overloaded',
        'Too many simultaneous requests',
        'No rate limiting',
        'API gateway not configured',
      ],
    });
    expect(r.chain.length).toBe(4);
    expect(r.rootCause).toContain('API gateway');
    expect(r.correction).toContain('system-level');
  });

  it('warns when the chain is too short', () => {
    const r = fiveWhys({ symptom: 'App fails', whyAnswers: ['Some error'] });
    expect(r.chain.length).toBe(1);
    expect(r.chain[0].answer).toBe('Some error');
  });
});

describe('Design Thinking', () => {
  it('returns deterministic scaffold without LLM', () => {
    const r = designThinking({ problem: 'Users abandon checkout' });
    expect(r.empathize.length).toBeGreaterThan(0);
    expect(r.define).toContain('Users abandon checkout');
    expect(r.prototype.length).toBeGreaterThan(0);
    expect(r.test.length).toBeGreaterThan(0);
  });

  it('is not a Promise when no LLM provider is given', () => {
    const r = designThinking({ problem: 'x' });
    expect(r instanceof Promise).toBe(false);
  });
});

describe('PDCA', () => {
  it('closes the loop with check criteria', () => {
    const r = pdcaPlan({ objective: 'Reduce p95 latency', checkCriteria: ['p95 < 200ms'] });
    expect(r.plan).toContain('Reduce p95 latency');
    expect(r.check).toContain('p95 < 200ms');
    expect(r.act).toContain('loop');
  });
});

describe('OODA', () => {
  it('emphasizes orientation and speed', () => {
    const r = ooda({ observations: ['Traffic doubled', 'Error rate up'] });
    expect(r.observe.length).toBe(2);
    expect(r.loopAdvice).toContain('faster');
  });
});

describe('Kepner-Tregoe', () => {
  it('performs all four analyses', () => {
    const r = kepnerTregoe({
      issues: [
        { description: 'Checkout fails', priority: 0.9 },
        { description: 'Search is slow', priority: 0.4 },
      ],
      criteria: ['cost', 'impact'],
      alternatives: [
        { name: 'Fix A', criteria: { cost: 8, impact: 9 } },
        { name: 'Fix B', criteria: { cost: 3, impact: 5 } },
      ],
      futureRisks: ['Regression in payments'],
    });
    expect(r.situationAppraisal[0].issue).toBe('Checkout fails');
    expect(r.decisionAnalysis?.[0].alternative).toBe('Fix A');
    expect(r.potentialProblemAnalysis[0].risk).toContain('Regression');
  });
});
