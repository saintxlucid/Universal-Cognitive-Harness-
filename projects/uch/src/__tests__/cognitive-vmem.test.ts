import { describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CognitiveVMem } from '../kernel/memory/vmem/index.js';
import type { PageMeta } from '../kernel/memory/vmem/index.js';

const T0 = new Date('2026-08-01T00:00:00Z');
const T1 = new Date('2026-08-01T01:00:00Z');
const T2 = new Date('2026-08-01T02:00:00Z');

function meta(salience: number, energyCost = 1, sizeBytes = 100): PageMeta {
  return { salience, energyCost, sizeBytes };
}

function fixedClock(at: Date): () => Date {
  return () => at;
}

function tempFile(name: string): string {
  return join(mkdtempSync(join(tmpdir(), 'uch-vmem-')), name);
}

describe('CognitiveVMem paging hierarchy', () => {
  it('pageIn starts a page hot with the injected clock timestamp', () => {
    const vmem = new CognitiveVMem({}, fixedClock(T0));
    const page = vmem.pageIn('p1', 'ref:plan', meta(0.8, 1, 256));

    expect(page.tier).toBe('hot');
    expect(page.lastTouched).toEqual(T0);
    expect(vmem.residency('p1')).toBe('hot');
    expect(vmem.residency('missing')).toBeUndefined();
  });

  it('touch auto-promotes a warm page to hot when the score passes the threshold', () => {
    const vmem = new CognitiveVMem({ hotCapacity: 2 }, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(1, 0));
    vmem.pageIn('p2', 'ref:b', meta(1, 0));
    vmem.pageIn('p3', 'ref:c', meta(1, 0));
    expect(vmem.residency('p1')).toBe('warm');

    expect(vmem.touch('p1', T1)).toBe(true);
    expect(vmem.residency('p1')).toBe('hot');

    expect(vmem.touch('unknown', T1)).toBe(false);
  });

  it('touch does not promote when the score stays below the threshold', () => {
    const vmem = new CognitiveVMem({ hotCapacity: 2 }, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(0.05, 0));
    vmem.pageIn('p2', 'ref:b', meta(1, 0));
    vmem.pageIn('p3', 'ref:c', meta(1, 0));
    expect(vmem.residency('p1')).toBe('warm');

    vmem.touch('p1', T1);
    expect(vmem.residency('p1')).toBe('warm');
  });

  it('capacity overflow evicts the lowest-scored page deterministically under a fixed clock', () => {
    const vmem = new CognitiveVMem({ hotCapacity: 2, warmCapacity: 2, coldCapacity: 2 }, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(0.9, 0));
    vmem.pageIn('p2', 'ref:b', meta(0.5, 0));
    vmem.pageIn('p3', 'ref:c', meta(0.2, 0));
    expect(vmem.residency('p1')).toBe('hot');
    expect(vmem.residency('p2')).toBe('hot');
    expect(vmem.residency('p3')).toBe('warm');

    vmem.pageIn('p4', 'ref:d', meta(0.8, 0));
    expect(vmem.residency('p4')).toBe('hot');
    expect(vmem.residency('p2')).toBe('warm');
    expect(vmem.stats().perTier).toEqual({ hot: 2, warm: 2, cold: 0, archive: 0 });
  });

  it('overflow cascades down the hierarchy and never deletes archive pages', () => {
    const vmem = new CognitiveVMem({ hotCapacity: 1, warmCapacity: 1, coldCapacity: 1 }, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(0.2, 0));
    vmem.pageIn('p2', 'ref:b', meta(0.5, 0));
    vmem.pageIn('p3', 'ref:c', meta(0.8, 0));
    vmem.pageIn('p4', 'ref:d', meta(0.9, 0));

    expect(vmem.residency('p4')).toBe('hot');
    expect(vmem.residency('p3')).toBe('warm');
    expect(vmem.residency('p2')).toBe('cold');
    expect(vmem.residency('p1')).toBe('archive');
    expect(vmem.stats().perTier).toEqual({ hot: 1, warm: 1, cold: 1, archive: 1 });
    expect(vmem.stats().totalBytes).toBe(400);
  });

  it('evict demotes the lowest-scored warm/cold page and leaves archive untouched', () => {
    const vmem = new CognitiveVMem({ hotCapacity: 1, evictThreshold: 1.0 }, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(0.2, 0));
    vmem.pageIn('p2', 'ref:b', meta(0.9, 0));
    expect(vmem.residency('p1')).toBe('warm');

    const first = vmem.evict();
    expect(first?.id).toBe('p1');
    expect(vmem.residency('p1')).toBe('cold');

    vmem.evict();
    expect(vmem.residency('p1')).toBe('archive');

    expect(vmem.evict()).toBeUndefined();
    expect(vmem.residency('p1')).toBe('archive');
  });

  it('evict returns undefined when every warm/cold page still scores above the threshold', () => {
    const vmem = new CognitiveVMem({ hotCapacity: 1, evictThreshold: 0.01 }, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(0.2, 0));
    vmem.pageIn('p2', 'ref:b', meta(0.9, 0));
    expect(vmem.evict()).toBeUndefined();
    expect(vmem.residency('p1')).toBe('warm');
  });

  it('compact merges pages sharing a payloadRef hash into one and sums sizeBytes', () => {
    const vmem = new CognitiveVMem({}, fixedClock(T0));
    vmem.pageIn('a1', 'ref:shared', meta(0.9, 1, 100));
    vmem.pageIn('a2', 'ref:shared', meta(0.5, 1, 200));
    vmem.pageIn('b1', 'ref:other', meta(0.7, 1, 50));

    const removed = vmem.compact();
    expect(removed).toBe(1);
    expect(vmem.residency('a1')).toBe('hot');
    expect(vmem.residency('a2')).toBeUndefined();
    expect(vmem.residency('b1')).toBe('hot');
    expect(vmem.stats().totalBytes).toBe(350);
  });

  it('compact is a no-op when compactByHash is disabled', () => {
    const vmem = new CognitiveVMem({ compactByHash: false }, fixedClock(T0));
    vmem.pageIn('a1', 'ref:shared', meta(0.9, 1, 100));
    vmem.pageIn('a2', 'ref:shared', meta(0.5, 1, 200));

    expect(vmem.compact()).toBe(0);
    expect(vmem.residency('a2')).toBe('hot');
    expect(vmem.stats().totalBytes).toBe(300);
  });

  it('an archive page can be promoted back (reversibility)', () => {
    const vmem = new CognitiveVMem({ hotCapacity: 1, warmCapacity: 1, coldCapacity: 1 }, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(0.6, 0));
    vmem.pageIn('p2', 'ref:b', meta(0.7, 0));
    vmem.pageIn('p3', 'ref:c', meta(0.8, 0));
    vmem.pageIn('p4', 'ref:d', meta(0.9, 0));
    expect(vmem.residency('p1')).toBe('archive');

    const promoted = vmem.promote('p1', T1);
    expect(promoted?.tier).toBe('cold');
    expect(vmem.residency('p1')).toBe('cold');
    expect(vmem.residency('p2')).toBe('archive');
    expect(vmem.promote('unknown')).toBeUndefined();
  });

  it('persist/load round-trips pages and preserves tiers and timestamps', async () => {
    const file = tempFile('vmem.json');
    const vmem = new CognitiveVMem({ hotCapacity: 1, warmCapacity: 1, coldCapacity: 1 }, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(0.2, 0, 100));
    vmem.pageIn('p2', 'ref:b', meta(0.5, 0, 200));
    vmem.pageIn('p3', 'ref:c', meta(0.8, 0, 300));
    vmem.pageIn('p4', 'ref:d', meta(0.9, 0, 400));
    await vmem.persist(file);

    const loaded = new CognitiveVMem();
    const count = await loaded.load(file);
    expect(count).toBe(4);
    expect(loaded.residency('p1')).toBe('archive');
    expect(loaded.residency('p2')).toBe('cold');
    expect(loaded.residency('p3')).toBe('warm');
    expect(loaded.residency('p4')).toBe('hot');
    expect(loaded.stats().totalBytes).toBe(1000);

    const reloaded = new CognitiveVMem({ evictThreshold: 1.0 });
    await reloaded.load(file);
    const victim = reloaded.evict(T1);
    expect(victim?.id).toBe('p2');
    expect(victim?.lastTouched).toBeInstanceOf(Date);
    expect(victim?.lastTouched.toISOString()).toBe(T0.toISOString());
  });

  it('load on a missing snapshot returns 0 and leaves state untouched', async () => {
    const vmem = new CognitiveVMem({}, fixedClock(T0));
    vmem.pageIn('p1', 'ref:a', meta(1, 0));

    const count = await vmem.load(tempFile('missing.json'));
    expect(count).toBe(0);
    expect(vmem.residency('p1')).toBe('hot');
  });

  it('clock injection changes scores deterministically', () => {
    const fresh = new CognitiveVMem({}, fixedClock(T0));
    const stale = new CognitiveVMem({}, fixedClock(T2));
    const freshPage = fresh.pageIn('p1', 'ref:a', meta(0.5, 0));
    const stalePage = stale.pageIn('p1', 'ref:a', meta(0.5, 0));

    expect(freshPage.lastTouched).toEqual(T0);
    expect(stalePage.lastTouched).toEqual(T2);

    const freshScore = fresh.score(freshPage, T1);
    const staleScore = stale.score(stalePage, T1);
    expect(freshScore).toBeCloseTo(0.48, 5);
    expect(staleScore).toBeCloseTo(0.5, 5);
    expect(freshScore).toBeLessThan(staleScore);
  });
});
