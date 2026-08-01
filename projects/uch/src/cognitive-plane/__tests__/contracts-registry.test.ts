import { describe, expect, it } from 'vitest';
import {
  ContractRegistry,
  probeContract,
  parseTimingEnvelope,
  parseResourceEnvelope,
  type ContractRecord,
  type ObservedBehavior,
} from '../contracts/contracts-registry.js';

const MEMORY_CONTRACT: ContractRecord = {
  subsystem: 'memory',
  version: '1.2.0',
  inputs: ['query', 'scope'],
  outputs: ['ranked-results'],
  sideEffects: [],
  guarantees: ['deterministic ranking'],
  failureModes: ['memory-miss', 'timeout'],
  timing: 'p95 < 200ms',
  resources: 'energy <= 5 per call',
  security: ['no cross-scope reads'],
};

describe('envelope parsing', () => {
  it('parses p95 timing envelopes', () => {
    expect(parseTimingEnvelope('p95 < 200ms')).toEqual({ p95Ms: 200 });
    expect(parseTimingEnvelope('p95 < 15.5ms')).toEqual({ p95Ms: 15.5 });
    expect(parseTimingEnvelope('no envelope')).toBeUndefined();
  });

  it('parses resource envelopes', () => {
    expect(parseResourceEnvelope('energy <= 5 per call')).toEqual({ maxUnits: 5 });
    expect(parseResourceEnvelope('tokens max 1200')).toEqual({ maxUnits: 1200 });
    expect(parseResourceEnvelope('unbounded')).toBeUndefined();
  });
});

describe('probeContract', () => {
  it('returns untested when no observations exist', () => {
    expect(probeContract(MEMORY_CONTRACT, undefined).verdict).toBe('untested');
  });

  it('flags undeclared outputs', () => {
    const observed: ObservedBehavior = {
      outputs: ['ranked-results', 'leaked-secret'],
      sideEffects: [],
      failures: [],
      timingMs: 50,
      resources: 1,
    };
    const result = probeContract(MEMORY_CONTRACT, observed);
    expect(result.verdict).toBe('violated');
    expect(result.violations).toContain('undeclared output: leaked-secret');
  });

  it('flags undeclared side effects and failure modes', () => {
    const observed: ObservedBehavior = {
      outputs: ['ranked-results'],
      sideEffects: ['writes-to-graph'],
      failures: ['spontaneous-combustion'],
      timingMs: 50,
      resources: 1,
    };
    const result = probeContract(MEMORY_CONTRACT, observed);
    expect(result.violations).toContain('undeclared side effect: writes-to-graph');
    expect(result.violations).toContain('undeclared failure mode: spontaneous-combustion');
  });

  it('flags envelope exceedances', () => {
    const observed: ObservedBehavior = {
      outputs: ['ranked-results'],
      sideEffects: [],
      failures: [],
      timingMs: 500,
      resources: 9,
    };
    const result = probeContract(MEMORY_CONTRACT, observed);
    expect(result.verdict).toBe('violated');
    expect(result.violations.some((v) => v.includes('timing'))).toBe(true);
    expect(result.violations.some((v) => v.includes('resources'))).toBe(true);
  });

  it('passes a conformant observation', () => {
    const observed: ObservedBehavior = {
      outputs: ['ranked-results'],
      sideEffects: [],
      failures: ['memory-miss'],
      timingMs: 120,
      resources: 4,
    };
    const result = probeContract(MEMORY_CONTRACT, observed);
    expect(result.verdict).toBe('conformant');
    expect(result.violations).toEqual([]);
  });
});

describe('ContractRegistry', () => {
  it('registers, retrieves, and lists contracts', () => {
    const registry = new ContractRegistry();
    registry.register(MEMORY_CONTRACT);
    expect(registry.get('memory')).toBe(MEMORY_CONTRACT);
    expect(registry.list()).toHaveLength(1);
  });

  it('detects breaking changes (removed output, tightened envelope)', () => {
    const registry = new ContractRegistry();
    const removed: ContractRecord = { ...MEMORY_CONTRACT, outputs: [] };
    expect(registry.isBreakingChange(MEMORY_CONTRACT, removed)).toBe(true);
    const tightened: ContractRecord = { ...MEMORY_CONTRACT, timing: 'p95 < 10ms' };
    expect(registry.isBreakingChange(MEMORY_CONTRACT, tightened)).toBe(true);
    const additive: ContractRecord = {
      ...MEMORY_CONTRACT,
      version: '1.3.0',
      outputs: ['ranked-results', 'suggestions'],
    };
    expect(registry.isBreakingChange(MEMORY_CONTRACT, additive)).toBe(false);
  });

  it('breaking change triggers capability negotiation instead of silent break', () => {
    const registry = new ContractRegistry();
    const v2: ContractRecord = { ...MEMORY_CONTRACT, version: '2.0.0', outputs: ['re-ranked-results'] };
    expect(registry.isBreakingChange(MEMORY_CONTRACT, v2)).toBe(true);
  });
});
