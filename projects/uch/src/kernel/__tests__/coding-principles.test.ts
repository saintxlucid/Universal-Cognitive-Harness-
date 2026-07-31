import { describe, it, expect } from 'vitest';
import { CodingPrinciplesEngine } from '../constitution/coding-principles.js';

describe('CodingPrinciplesEngine', () => {
  it('passes clean changes with explicit assumptions and verification', () => {
    const engine = new CodingPrinciplesEngine();
    const result = engine.evaluate({
      intent: 'Add validation to the form. Write tests for invalid inputs first, then make them pass.',
      proposedChange: 'Add a validate() function and tests for it.',
    });
    expect(result.verdict).toBe('pass');
    expect(result.score).toBeGreaterThan(0.9);
  });

  it('flags silent assumptions (think before coding)', () => {
    const engine = new CodingPrinciplesEngine();
    const result = engine.evaluate({
      intent: 'I assume the API returns JSON, just fix the parser',
      proposedChange: 'Update parser to handle JSON.',
    });
    const think = result.principles.find((p) => p.principle === 'think-before-coding');
    expect(think?.pass).toBe(false);
    expect(think?.flags).toContain('silent-assumption');
    expect(result.verdict).toBe('review');
  });

  it('flags bloat markers (simplicity first)', () => {
    const engine = new CodingPrinciplesEngine();
    const result = engine.evaluate({
      intent: 'Add a configurable generic wrapper just in case we need flexibility later',
      proposedChange: 'Introduce an abstract base class for the parser.',
    });
    const simplicity = result.principles.find((p) => p.principle === 'simplicity-first');
    expect(simplicity?.pass).toBe(false);
    expect(simplicity?.flags.length).toBeGreaterThan(0);
  });

  it('flags scope creep (surgical changes)', () => {
    const engine = new CodingPrinciplesEngine();
    const result = engine.evaluate({
      intent: 'Fix the bug in login, and while Im at it also clean up the dashboard code',
      proposedChange: 'Fix login and reformat unrelated dashboard files.',
    });
    const surgical = result.principles.find((p) => p.principle === 'surgical-changes');
    expect(surgical?.pass).toBe(false);
    expect(surgical?.flags).toContain('scope-creep');
  });

  it('flags vague goals without verification (goal-driven execution)', () => {
    const engine = new CodingPrinciplesEngine();
    const result = engine.evaluate({
      intent: 'Just make it work asap',
      proposedChange: 'Update the service.',
    });
    const goal = result.principles.find((p) => p.principle === 'goal-driven-execution');
    expect(goal?.pass).toBe(false);
    expect(goal?.flags).toContain('vague-success-criteria');
  });

  it('accepts a plan with verification steps as the verification loop', () => {
    const engine = new CodingPrinciplesEngine();
    const result = engine.evaluate({
      intent: 'Just make it work asap',
      proposedChange: 'Update the service.',
      context: { plan: ['Refactor parser', 'Run the test suite to verify no regressions'] },
    });
    const goal = result.principles.find((p) => p.principle === 'goal-driven-execution');
    expect(goal?.pass).toBe(true);
  });

  it('recommends improvements for failing principles', () => {
    const engine = new CodingPrinciplesEngine();
    const result = engine.evaluate({
      intent: 'I assume X, just make it work',
      proposedChange: 'Also fix the formatting while I am here.',
    });
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.verdict).toBe('review');
  });
});
