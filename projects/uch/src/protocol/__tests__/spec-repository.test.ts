import { describe, expect, it } from 'vitest';
import {
  SpecRepository,
  validateEntry,
  generateTsTypes,
  FAMILY_SCHEMAS,
  type SpecEntry,
} from '../spec-repository/spec-repository.js';

const LAW_1: SpecEntry = {
  family: 'laws',
  id: 'law-1',
  version: '1.0.0',
  body: { number: 1, statement: 'Cognition is owned by its owner.' },
  conformance: 'constitution.test.ts',
};

const CP_OP = (op: string): SpecEntry => ({
  family: 'isa',
  id: `op-${op}`,
  version: '1.0.0',
  body: { op, category: 'planning' },
  conformance: 'catalog.test.ts',
});

describe('validateEntry', () => {
  it('validates entries against family schemas', () => {
    expect(validateEntry(LAW_1)).toEqual([]);
    const broken = { ...LAW_1, body: { statement: 'missing number' } };
    expect(validateEntry(broken)).toContain('missing body key(s): number');
  });

  it('rejects unknown families', () => {
    const bogus = { ...LAW_1, family: 'nope' as SpecEntry['family'] };
    expect(validateEntry(bogus).length).toBeGreaterThan(0);
  });

  it('covers all fourteen primitive families', () => {
    expect(FAMILY_SCHEMAS.map((s) => s.family).sort()).toEqual(
      ['laws', 'signals', 'isa', 'memory', 'drivers', 'runtime', 'lifecycles', 'errors', 'events', 'capabilities', 'metrics', 'policies', 'transactions', 'permissions'].sort(),
    );
  });
});

describe('SpecRepository', () => {
  it('registers and retrieves valid entries', () => {
    const repo = new SpecRepository();
    expect(repo.register(LAW_1)).toEqual([]);
    expect(repo.get('laws', 'law-1')).toBe(LAW_1);
  });

  it('rejects invalid entries', () => {
    const repo = new SpecRepository();
    const invalid = { ...LAW_1, body: {} };
    expect(repo.register(invalid).length).toBeGreaterThan(0);
    expect(repo.get('laws', 'law-1')).toBeUndefined();
  });

  it('lists entries by family', () => {
    const repo = new SpecRepository();
    repo.register(CP_OP('observe'));
    repo.register(CP_OP('think'));
    repo.register(LAW_1);
    expect(repo.list('isa')).toHaveLength(2);
    expect(repo.list('laws')).toHaveLength(1);
  });
});

describe('generateTsTypes (the headline proof case)', () => {
  it('generates a CPOp union from ISA spec data', () => {
    const repo = new SpecRepository();
    repo.register(CP_OP('observe'));
    repo.register(CP_OP('think'));
    repo.register(CP_OP('retrieve'));
    const generated = generateTsTypes(repo)!;
    expect(generated.typeName).toBe('CPOp');
    expect(generated.code).toContain("| 'observe'");
    expect(generated.code).toContain("| 'think'");
    expect(generated.code).toContain('Generated from isa spec family');
    expect(generated.generatedFrom).toHaveLength(3);
  });

  it('returns undefined for empty families', () => {
    const repo = new SpecRepository();
    repo.register(LAW_1);
    expect(generateTsTypes(repo, 'isa')).toBeUndefined();
  });

  it('sorts generated unions deterministically', () => {
    const repo = new SpecRepository();
    repo.register(CP_OP('think'));
    repo.register(CP_OP('observe'));
    const first = generateTsTypes(repo)!.code;
    repo.register(CP_OP('retrieve'));
    const second = generateTsTypes(repo)!.code;
    expect(first).toContain("| 'observe'");
    expect(second).toContain("| 'retrieve'");
    const positions = ['observe', 'think'].map((op) => second.indexOf(`'${op}'`));
    expect(positions[0]).toBeLessThan(positions[1]);
  });
});
