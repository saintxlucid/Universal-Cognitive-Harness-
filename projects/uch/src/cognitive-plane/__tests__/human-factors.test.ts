import { describe, expect, it } from 'vitest';
import { HumanFactorsRegistry, HumanFactorField } from '../human-factors/human-factors.js';

const FIELDS: readonly HumanFactorField[] = [
  'expertise',
  'stress',
  'focus',
  'fatigue',
  'communicationStyle',
  'riskTolerance',
  'reviewStyle',
  'decisionStyle',
];

describe('HumanFactorsRegistry', () => {
  it('creates a profile with all eight fields defaulted', () => {
    const registry = new HumanFactorsRegistry();
    registry.create('user-1');
    const profile = registry.get('user-1')!;
    expect(profile.values.map((v) => v.field).sort()).toEqual([...FIELDS].sort());
    expect(profile.exportConsent).toBe(false);
  });

  it('updates a field with source and confidence', () => {
    const registry = new HumanFactorsRegistry();
    registry.create('user-1');
    expect(registry.update('user-1', 'riskTolerance', 0.8, 'stated preference', 0.9)).toBe(true);
    const value = registry.get('user-1')!.values.find((v) => v.field === 'riskTolerance')!;
    expect(value).toMatchObject({ level: 0.8, source: 'stated preference', confidence: 0.9 });
  });

  it('raises but never lowers confidence on update', () => {
    const registry = new HumanFactorsRegistry();
    registry.create('user-1');
    registry.update('user-1', 'stress', 0.9, 'signal', 0.4);
    registry.update('user-1', 'stress', 0.5, 'weak-signal', 0.1);
    const value = registry.get('user-1')!.values.find((v) => v.field === 'stress')!;
    expect(value.confidence).toBe(0.4);
    expect(value.level).toBe(0.5);
  });

  it('refuses updates to unknown users and zero-confidence observations', () => {
    const registry = new HumanFactorsRegistry();
    registry.create('user-1');
    expect(registry.update('ghost', 'stress', 0.5, 's', 0.5)).toBe(false);
    expect(registry.update('user-1', 'stress', 0.5, 's', 0)).toBe(false);
  });

  it('never exports the profile without consent', () => {
    const registry = new HumanFactorsRegistry();
    registry.create('user-1');
    expect(registry.riskToleranceForWorkflow('user-1')).toBeUndefined();
    registry.setExportConsent('user-1', true);
    expect(registry.riskToleranceForWorkflow('user-1')).toBeDefined();
  });

  it('signals workflow simplification under stress + fatigue', () => {
    const registry = new HumanFactorsRegistry();
    registry.create('user-1');
    expect(registry.shouldSimplify('user-1')).toBe(false);
    registry.update('user-1', 'stress', 0.9, 'signal', 0.8);
    registry.update('user-1', 'fatigue', 0.8, 'signal', 0.8);
    expect(registry.shouldSimplify('user-1')).toBe(true);
  });
});
