import { describe, expect, it } from 'vitest';
import {
  parseSemver,
  compareSemver,
  negotiateDialects,
  findProviders,
  pickLatest,
  dialectKey,
  type CapabilityDescriptor,
} from '../protocol/capability-negotiation.js';

const MEMORY_V3: CapabilityDescriptor = { id: 'memory', version: '3.2.1', features: ['semantic', 'episodic'] };
const MEMORY_V2: CapabilityDescriptor = { id: 'memory', version: '2.4.0', features: ['episodic'] };
const SIGNAL_ABI: CapabilityDescriptor = { id: 'signal-abi', version: '2.1.0', features: ['priority', 'decay'] };

describe('parseSemver', () => {
  it('parses full and partial versions', () => {
    expect(parseSemver('3.2.1')).toEqual({ major: 3, minor: 2, patch: 1 });
    expect(parseSemver('3.2')).toEqual({ major: 3, minor: 2, patch: 0 });
    expect(parseSemver('3')).toEqual({ major: 3, minor: 0, patch: 0 });
  });

  it('rejects malformed versions', () => {
    expect(parseSemver('a.b.c')).toBeUndefined();
    expect(parseSemver('1.2.3.4')).toBeUndefined();
    expect(parseSemver('')).toBeUndefined();
  });

  it('orders semvers', () => {
    expect(compareSemver(parseSemver('1.8.0')!, parseSemver('1.8.1')!)).toBeLessThan(0);
    expect(compareSemver(parseSemver('2.0.0')!, parseSemver('1.9.9')!)).toBeGreaterThan(0);
    expect(compareSemver(parseSemver('1.0.0')!, parseSemver('1.0.0')!)).toBe(0);
  });
});

describe('negotiateDialects', () => {
  it('negotiates exact matches with full feature intersection', () => {
    const out = negotiateDialects([MEMORY_V3], [MEMORY_V3]);
    expect(out.matched).toEqual(['memory']);
    expect(out.unmatched).toEqual([]);
    expect(out.dialects[0]?.status).toBe('negotiated');
    expect(out.dialects[0]?.features).toEqual(['semantic', 'episodic']);
  });

  it('falls back explicitly when majors match but minor/patch differ', () => {
    const ours: CapabilityDescriptor = { id: 'memory', version: '3.2.1', features: ['semantic', 'episodic'] };
    const peer: CapabilityDescriptor = { id: 'memory', version: '3.0.0', features: ['semantic'] };
    const out = negotiateDialects([peer], [ours]);
    expect(out.matched).toEqual(['memory']);
    expect(out.dialects[0]?.status).toBe('fallback');
    expect(out.dialects[0]?.selectedVersion).toBe('3.2.1');
    expect(out.dialects[0]?.features).toEqual(['semantic']);
  });

  it('reports none when majors differ (never a silent downgrade)', () => {
    const out = negotiateDialects([MEMORY_V2], [MEMORY_V3]);
    expect(out.matched).toEqual([]);
    expect(out.unmatched).toEqual(['memory']);
  });

  it('rejects dialect mismatch when fallback is disabled', () => {
    const ours: CapabilityDescriptor = { id: 'memory', version: '3.2.1' };
    const peer: CapabilityDescriptor = { id: 'memory', version: '3.0.0' };
    const out = negotiateDialects([peer], [ours], { allowMajorFallback: false });
    expect(out.unmatched).toEqual(['memory']);
  });

  it('drops offered features the supported endpoint does not provide', () => {
    const offered: CapabilityDescriptor = { id: 'memory', version: '3.0.0', features: ['semantic', 'episodic', 'graph'] };
    const ours: CapabilityDescriptor = { id: 'memory', version: '3.0.0', features: ['semantic', 'episodic'] };
    const out = negotiateDialects([offered], [ours]);
    expect(out.dialects[0]?.features).toEqual(['semantic', 'episodic']);
  });

  it('negotiates multiple capabilities and reports unmatched ones', () => {
    const out = negotiateDialects([MEMORY_V3, { id: 'genome', version: '1.8.0' }], [MEMORY_V3, SIGNAL_ABI]);
    expect(out.matched).toEqual(['memory']);
    expect(out.unmatched).toEqual(['genome']);
    expect(out.dialects.length).toBe(1);
  });

  it('handles an empty offer deterministically', () => {
    const out = negotiateDialects([], [MEMORY_V3]);
    expect(out.dialects).toEqual([]);
    expect(out.matched).toEqual([]);
    expect(out.unmatched).toEqual([]);
  });

  it('is deterministic across repeated runs', () => {
    const a = negotiateDialects([MEMORY_V3, MEMORY_V2], [MEMORY_V3]);
    const b = negotiateDialects([MEMORY_V3, MEMORY_V2], [MEMORY_V3]);
    expect(dialectKey(a)).toBe(dialectKey(b));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('keeps matched capabilities when the supported set gains features (monotone)', () => {
    const peer: CapabilityDescriptor = { id: 'memory', version: '3.0.0', features: ['semantic'] };
    const lean: CapabilityDescriptor = { id: 'memory', version: '3.0.0', features: ['semantic'] };
    const rich: CapabilityDescriptor = { id: 'memory', version: '3.0.0', features: ['semantic', 'episodic'] };
    const before = negotiateDialects([peer], [lean]);
    const after = negotiateDialects([peer], [rich]);
    expect(after.matched).toEqual(before.matched);
    expect(after.dialects[0]?.features.length).toBeGreaterThanOrEqual(before.dialects[0]?.features.length ?? 0);
  });
});

describe('findProviders', () => {
  const providers: CapabilityDescriptor[] = [
    { id: 'verifier', version: '1.0.0', features: ['verify'], tags: ['rust'] },
    { id: 'optimizer', version: '1.0.0', features: ['optimize'], tags: ['rust', 'kubernetes'] },
    { id: 'simulator', version: '1.0.0', features: ['simulate'], tags: ['kubernetes'] },
  ];

  it('answers "who can verify this"', () => {
    const found = findProviders(providers, { requires: ['verify'] });
    expect(found.map((p) => p.id)).toEqual(['verifier']);
  });

  it('filters by domain tags', () => {
    const found = findProviders(providers, { domain: ['kubernetes'] });
    expect(found.map((p) => p.id)).toEqual(['optimizer', 'simulator']);
  });

  it('requires ALL features and ALL tags', () => {
    const found = findProviders(providers, { requires: ['optimize'], domain: ['kubernetes'] });
    expect(found.map((p) => p.id)).toEqual(['optimizer']);
  });

  it('returns empty when nothing matches', () => {
    expect(findProviders(providers, { requires: ['teleport'] })).toEqual([]);
    expect(findProviders([], { requires: ['verify'] })).toEqual([]);
  });
});

describe('pickLatest', () => {
  it('selects the highest version per id', () => {
    const picked = pickLatest([MEMORY_V2, MEMORY_V3], 'memory');
    expect(picked?.version).toBe('3.2.1');
  });

  it('returns undefined when the id is absent', () => {
    expect(pickLatest([MEMORY_V3], 'genome')).toBeUndefined();
  });
});
