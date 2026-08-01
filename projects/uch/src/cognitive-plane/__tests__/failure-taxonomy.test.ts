import { describe, expect, it } from 'vitest';
import {
  FAILURE_CLASSES,
  classifyFailure,
  responseFor,
  neverRetries,
  recordFailure,
  failureRateByClass,
  DEFAULT_FACULTY,
  type FailureRecord,
} from '../failure/failure-taxonomy.js';

describe('Failure taxonomy', () => {
  it('defines all ten faculty classes', () => {
    const faculties = FAILURE_CLASSES.map((c) => c.faculty);
    expect(faculties).toContain('reasoning');
    expect(faculties).toContain('knowledge');
    expect(faculties).toContain('memory');
    expect(faculties).toContain('identity');
    expect(faculties).toContain('constitution');
    expect(faculties).toContain('evidence');
    expect(faculties).toContain('simulation');
    expect(faculties).toContain('verification');
    expect(faculties).toContain('attention');
    expect(faculties).toContain('homeostasis');
  });

  it('classifies by detection signal', () => {
    expect(classifyFailure('the reasoning chain contains a contradiction')).toBe('reasoning');
    expect(classifyFailure('memory corruption detected in episode store')).toBe('memory');
    expect(classifyFailure('law violation: veto issued by constitution')).toBe('constitution');
    expect(classifyFailure('hallucination: claim has no evidence')).toBe('evidence');
    expect(classifyFailure('energy budget exhausted')).toBe('homeostasis');
    expect(classifyFailure('attention saturated, dropping signals')).toBe('attention');
  });

  it('defaults conservatively to reasoning on ambiguity', () => {
    expect(classifyFailure('something weird happened')).toBe(DEFAULT_FACULTY);
  });

  it('maps canonical responses per faculty', () => {
    expect(responseFor('constitution')).toBe('veto');
    expect(responseFor('memory')).toBe('quarantine');
    expect(responseFor('reasoning')).toBe('reverify');
    expect(responseFor('attention')).toBe('degrade');
    expect(responseFor('simulation')).toBe('retry');
    expect(responseFor('homeostasis')).toBe('rehomeostat');
  });

  it('never retries constitution failures', () => {
    expect(neverRetries('constitution')).toBe(true);
    expect(neverRetries('reasoning')).toBe(false);
  });

  it('produces full failure records', () => {
    const record = recordFailure('verification failed: gate rejected', 42);
    expect(record).toMatchObject({
      faculty: 'verification',
      response: 'reverify',
      severity: 'major',
      eventType: 'failure:verification',
      atTick: 42,
    });
  });

  it('computes failure rates per class', () => {
    const records: FailureRecord[] = [
      recordFailure('contradiction detected', 1),
      recordFailure('hallucination', 2),
      recordFailure('another contradiction', 3),
    ];
    const rates = failureRateByClass(records);
    expect(rates.reasoning).toBeCloseTo(2 / 3);
    expect(rates.evidence).toBeCloseTo(1 / 3);
    expect(rates.memory).toBe(0);
  });

  it('carries ADR-002-compatible event types', () => {
    for (const c of FAILURE_CLASSES) {
      expect(c.eventType).toMatch(/^failure:[a-z-]+$/);
    }
  });
});
