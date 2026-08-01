import { describe, expect, it } from 'vitest';
import {
  normalizeIntent,
  compileIntent,
  isSuccess,
  DEFAULT_INTENT,
  type IntentEnvelope,
} from '../intent/intent-objects.js';

const FULL_INTENT: IntentEnvelope = {
  id: 'mission-1',
  goal: 'Refactor Auth',
  constraints: ['no schema change'],
  success: 'all tests pass',
  failure: 'breaking change required',
  priority: 'high',
  deadlineTick: 500,
  stakeholders: ['security'],
  risk: 'conservative',
  evidence: ['test-results', 'benchmark'],
};

describe('normalizeIntent', () => {
  it('fills every defaultable field', () => {
    const normalized = normalizeIntent({ id: 'x', goal: 'do the thing' });
    expect(normalized.success).toBe(DEFAULT_INTENT.success);
    expect(normalized.priority).toBe('normal');
    expect(normalized.risk).toBe('balanced');
    expect(normalized.constraints).toEqual([]);
    expect(normalized.evidence).toEqual([]);
  });

  it('preserves explicitly declared fields', () => {
    const normalized = normalizeIntent(FULL_INTENT);
    expect(normalized.priority).toBe('high');
    expect(normalized.risk).toBe('conservative');
    expect(normalized.success).toBe('all tests pass');
  });
});

describe('compileIntent', () => {
  it('compiles the success predicate as the verification gate', () => {
    const compiled = compileIntent(FULL_INTENT);
    expect(compiled.successPredicate).toBe('all tests pass');
  });

  it('derives decision-law parameters', () => {
    const compiled = compileIntent(FULL_INTENT, 400);
    expect(compiled.riskWeight).toBe(1.0); // conservative
    expect(compiled.priorityWeight).toBe(0.75); // high
    expect(compiled.hasDeadline).toBe(true);
    expect(compiled.latencyPressure).toBeGreaterThan(0);
    expect(compiled.evidenceRequirements).toEqual(['test-results', 'benchmark']);
  });

  it('drops latency pressure without a deadline', () => {
    const compiled = compileIntent({ id: 'y', goal: 'g' }, 0);
    expect(compiled.hasDeadline).toBe(false);
    expect(compiled.latencyPressure).toBe(0);
  });

  it('handles expired deadlines as no pressure (and flags them)', () => {
    const compiled = compileIntent({ id: 'z', goal: 'g', deadlineTick: 10 }, 100);
    expect(compiled.hasDeadline).toBe(false);
    expect(compiled.latencyPressure).toBe(0);
  });

  it('maps all risk appetites', () => {
    expect(compileIntent({ id: 'a', goal: 'g', risk: 'aggressive' }).riskWeight).toBe(0.2);
    expect(compileIntent({ id: 'b', goal: 'g', risk: 'balanced' }).riskWeight).toBe(0.6);
  });
});

describe('isSuccess', () => {
  it('accepts any non-empty outcome for the default predicate', () => {
    expect(isSuccess(normalizeIntent({ id: 'x', goal: 'g' }), 'done')).toBe(true);
  });

  it('matches the declared success predicate', () => {
    expect(isSuccess(normalizeIntent(FULL_INTENT), 'all tests pass and no regressions')).toBe(true);
    expect(isSuccess(normalizeIntent(FULL_INTENT), 'tests failed')).toBe(false);
  });
});
