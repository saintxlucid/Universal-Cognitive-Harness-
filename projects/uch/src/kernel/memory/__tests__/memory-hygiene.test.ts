import { describe, expect, it } from 'vitest';
import {
  MemoryHygieneEngine,
  type MemoryItem,
} from '../hygiene/memory-hygiene.js';

const mk = (id: string, subject: string, content: string, extra?: Partial<MemoryItem>): MemoryItem => ({
  id,
  subject,
  content,
  evidenceAge: 0,
  confidence: 0.9,
  links: [],
  ...extra,
});

describe('MemoryHygieneEngine scan', () => {
  it('detects duplicates (identical content, same subject)', () => {
    const engine = new MemoryHygieneEngine();
    const items = [mk('a', 's', 'same'), mk('b', 's', 'same')];
    const findings = engine.scan(items, ['a', 'b'], 1);
    expect(findings.filter((f) => f.cls === 'duplicate')).toHaveLength(1);
  });

  it('detects stale conflicting evidence (same subject, different age)', () => {
    const engine = new MemoryHygieneEngine();
    const items = [mk('a', 's', 'v1', { evidenceAge: 10 }), mk('b', 's', 'v2', { evidenceAge: 1 })];
    const findings = engine.scan(items, ['a', 'b'], 1);
    expect(findings.filter((f) => f.cls === 'stale')).toHaveLength(1);
  });

  it('detects low-confidence old memories as stale', () => {
    const engine = new MemoryHygieneEngine(100, 0.3);
    const item = mk('a', 's', 'old', { evidenceAge: 200, confidence: 0.1 });
    const findings = engine.scan([item], ['a'], 1);
    expect(findings.filter((f) => f.cls === 'stale')).toHaveLength(1);
  });

  it('detects broken links to dead object ids', () => {
    const engine = new MemoryHygieneEngine();
    const item = mk('a', 's', 'links b', { links: ['b'] });
    const findings = engine.scan([item], ['a'], 1);
    expect(findings.filter((f) => f.cls === 'broken-link')).toHaveLength(1);
    expect(findings[0].relatedId).toBe('b');
  });
});

describe('MemoryHygieneEngine propose + commit', () => {
  it('merges duplicates losslessly', () => {
    const engine = new MemoryHygieneEngine();
    const items = [mk('a', 's', 'same'), mk('b', 's', 'same')];
    const findings = engine.scan(items, ['a', 'b'], 1);
    const proposals = engine.propose(findings, 1);
    const merge = proposals.find((p) => p.action === 'merge');
    expect(merge).toBeDefined();
    expect(merge!.verifiedNoLoss).toBe(true);
  });

  it('surfaces conflicts rather than merging them', () => {
    const engine = new MemoryHygieneEngine();
    const items = [mk('a', 's', 'claim-x'), mk('b', 's', 'claim-y')];
    const findings = engine.scan(items, ['a', 'b'], 1);
    const proposals = engine.propose(findings, 1);
    expect(proposals.every((p) => p.action !== 'merge')).toBe(true);
  });

  it('journals every proposal and commit', () => {
    const engine = new MemoryHygieneEngine();
    const items = [mk('a', 's', 'same'), mk('b', 's', 'same')];
    const findings = engine.scan(items, ['a', 'b'], 1);
    const proposals = engine.propose(findings, 2);
    engine.commit(proposals[0], 3);
    expect(engine.journalFor('b').length).toBeGreaterThanOrEqual(2);
  });

  it('commit removes the merged item from the live set', () => {
    const engine = new MemoryHygieneEngine();
    const items = [mk('a', 's', 'same'), mk('b', 's', 'same')];
    const findings = engine.scan(items, ['a', 'b'], 1);
    const proposals = engine.propose(findings, 1);
    engine.commit(proposals[0], 2);
    const rescan = engine.scan(items, ['a'], 3);
    expect(rescan.filter((f) => f.cls === 'broken-link')).toHaveLength(0);
  });
});
