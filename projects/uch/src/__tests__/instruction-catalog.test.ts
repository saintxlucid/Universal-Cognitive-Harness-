import { describe, it, expect } from 'vitest';
import {
  instructionMetadata,
  catalogIsComplete,
  opsByCategory,
  energyCostOf,
  requiresConstitutionalGate,
  instructionRecord,
  nextCognitiveTick,
  compareRecords,
} from '../protocol/catalog.js';
import { CP_OPS } from '../protocol/cp.js';

describe('CP instruction catalog', () => {
  it('covers every op in CP v1', () => {
    expect(catalogIsComplete()).toBe(true);
    expect(CP_OPS.length).toBe(17);
  });

  it('exposes metadata per op: category, organ, cost, output, verification', () => {
    const execute = instructionMetadata('execute');
    expect(execute.category).toBe('execution');
    expect(execute.organ).toBe('agentic');
    expect(execute.energyCost).toBeGreaterThan(0);
    expect(execute.energyCost).toBeLessThanOrEqual(10);
    expect(execute.expectedOutput.length).toBeGreaterThan(0);
    expect(execute.verification).toBe('external');
  });

  it('flags constitutional-gate ops', () => {
    expect(requiresConstitutionalGate('evaluate')).toBe(true);
    expect(requiresConstitutionalGate('critique')).toBe(true);
    expect(requiresConstitutionalGate('remember')).toBe(false);
  });

  it('groups ops by category', () => {
    const memory = opsByCategory('memory');
    expect(memory).toEqual(['retrieve', 'remember']);
    expect(opsByCategory('evaluation')).toEqual(['evaluate', 'critique']);
  });

  it('computes energy budgets deterministically', () => {
    const twoMemories = energyCostOf(['retrieve', 'remember']);
    expect(twoMemories).toBe(3);
    expect(energyCostOf(['simulate'])).toBe(7);
  });
});

describe('monotonic cognitive clock', () => {
  it('issues strictly increasing ticks regardless of wall-clock order', () => {
    const lateWall = new Date('2020-01-01T00:00:00Z');
    const earlyWall = new Date('2030-01-01T00:00:00Z');

    const a = instructionRecord('observe', lateWall);
    const b = instructionRecord('think', earlyWall);

    expect(compareRecords(a, b)).toBeLessThan(0);
    expect(b.tick).toBeGreaterThan(a.tick);
  });

  it('records energy cost and verification requirement from the catalog', () => {
    const rec = instructionRecord('evaluate');
    expect(rec.energyCost).toBe(2);
    expect(rec.verification).toBe('constitutional');
    expect(nextCognitiveTick()).toBeGreaterThan(rec.tick);
  });
});
