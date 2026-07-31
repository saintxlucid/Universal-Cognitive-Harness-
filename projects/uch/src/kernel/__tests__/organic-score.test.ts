import { describe, it, expect } from 'vitest';
import { OrganicScoreEngine } from '../constitution/organic-score.js';
import type { EngineeringFinding } from '../../engineering-intelligence/types.js';

const vetoFinding = (
  conceptId = 'sys.spof',
  gate: EngineeringFinding['gate'] = 'veto',
): EngineeringFinding => ({
  tier: 'tier-03-systems',
  severity: 'blocking',
  conceptId,
  message: 'Single point of failure: a critical component is described without redundancy.',
  evidence: ['singularity + critical asset'],
  suggestion: ['State the redundancy model (replicas, failover, standby).'],
  gate,
});

describe('OrganicScoreEngine', () => {
  const engine = new OrganicScoreEngine();

  it('passes a clean, traceable, tested change', () => {
    const result = engine.evaluate({
      intent: 'Extend the existing validate() helper to reject invalid emails. Add negative tests first.',
      change: 'Reuses the canonical validate() per ADR-007; adds edge case tests for empty input; propagates errors with context.',
      context: { testsRun: ['npm test'], filesTouched: ['src/validate.ts'] },
    });
    expect(result.verdict).toBe('pass');
    expect(result.score).toBeGreaterThanOrEqual(90);
  });

  it('rejects error-masking (C5)', () => {
    const result = engine.evaluate({
      intent: 'Wrap the fetch in try/catch so the page does not crash',
      change: 'catch (e) {} and ignore errors.',
    });
    const errorHandling = result.metrics.find((m) => m.metric === 'error-handling');
    expect(errorHandling?.score).toBeLessThan(10);
    expect(result.findings.some((f) => f.pitfall === 'C5')).toBe(true);
    expect(result.verdict).toBe('reject');
  });

  it('flags security smells with high penalty (D1)', () => {
    const result = engine.evaluate({
      intent: 'Add login endpoint',
      change: 'Validate with hardcoded password and eval() on user input.',
    });
    const security = result.metrics.find((m) => m.metric === 'security');
    expect(security?.score).toBeLessThanOrEqual(2);
    expect(result.findings.some((f) => f.pitfall === 'D1')).toBe(true);
  });

  it('flags duplication / reinvention (C1)', () => {
    const result = engine.evaluate({
      intent: 'Add a date formatter',
      change: 'Copy the existing formatDate function into a new helper for the same purpose.',
    });
    const reuse = result.metrics.find((m) => m.metric === 'reuse');
    expect(reuse?.score).toBeLessThan(10);
    expect(result.recommendations.join(' ')).toContain('C1');
  });

  it('flags generic naming (D7)', () => {
    const result = engine.evaluate({
      intent: 'Add a user manager',
      change: 'Create UserManager2 with processData() helper.',
    });
    const naming = result.metrics.find((m) => m.metric === 'naming');
    expect(naming?.score).toBeLessThan(10);
  });

  it('flags scope creep (B1/surgical)', () => {
    const result = engine.evaluate({
      intent: 'Fix the login bug, and while Im at it also clean up the dashboard',
      change: 'Fix login and reformat dashboard files.',
    });
    const arch = result.metrics.find((m) => m.metric === 'architecture-integrity');
    expect(arch?.flags.length).toBeGreaterThan(0);
  });

  it('credits testsRun context for testability', () => {
    const result = engine.evaluate({
      intent: 'Fix parser',
      change: 'Update parser.',
      context: { testsRun: ['npm test'], filesTouched: ['src/parser.ts'] },
    });
    const tests = result.metrics.find((m) => m.metric === 'testability-tests');
    expect(tests?.score).toBe(10);
  });

  it('never exceeds the 0-100 range and reports all 15 metrics', () => {
    const result = engine.evaluate({
      intent: 'Rewrite everything',
      change: 'Move everything to a new module with a plugin architecture just in case, catch {} and ignore errors.',
    });
    expect(result.metrics).toHaveLength(15);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(['pass', 'revise', 'reject']).toContain(result.verdict);
  });
});

describe('OrganicScoreEngine — engineering veto hookup', () => {
  const engine = new OrganicScoreEngine();

  const cleanInput = {
    intent: 'Extend the existing validate() helper to reject invalid emails. Add negative tests first.',
    change: 'Reuses the canonical validate() per ADR-007; adds edge case tests for empty input; propagates errors with context.',
    context: { testsRun: ['npm test'], filesTouched: ['src/validate.ts'] },
  };

  it('hard-rejects on a gate=veto finding even when the text is clean', () => {
    const result = engine.evaluate({
      ...cleanInput,
      engineeringFindings: [vetoFinding('sys.spof')],
    });
    expect(result.verdict).toBe('reject');
    expect(result.vetoedBy).toEqual(['sys.spof']);
    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.recommendations.join(' ')).toContain('sys.spof');
  });

  it('does not veto on advisory findings', () => {
    const result = engine.evaluate({
      ...cleanInput,
      engineeringFindings: [vetoFinding('sys.spof', 'advisory')],
    });
    expect(result.verdict).toBe('pass');
    expect(result.vetoedBy).toBeUndefined();
  });

  it('records every vetoing concept id, deduplicated', () => {
    const result = engine.evaluate({
      ...cleanInput,
      engineeringFindings: [
        vetoFinding('sys.spof'),
        vetoFinding('failure.network-loss'),
        vetoFinding('sys.spof'),
      ],
    });
    expect(result.verdict).toBe('reject');
    expect(result.vetoedBy).toEqual(['sys.spof', 'failure.network-loss']);
  });

  it('mixes with constitutional vetoes without losing the veto record', () => {
    const result = engine.evaluate({
      intent: 'Wrap the fetch in try/catch so the page does not crash',
      change: 'catch (e) {} and ignore errors.',
      engineeringFindings: [vetoFinding('failure.network-loss')],
    });
    expect(result.verdict).toBe('reject');
    expect(result.vetoedBy).toEqual(['failure.network-loss']);
    expect(result.findings.some((f) => f.pitfall === 'C5')).toBe(true);
  });

  it('ignores an empty findings list entirely', () => {
    const result = engine.evaluate({ ...cleanInput, engineeringFindings: [] });
    expect(result.verdict).toBe('pass');
    expect(result.vetoedBy).toBeUndefined();
  });
});
