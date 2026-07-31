import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createVersionedStore,
  restoreOrganism,
  VersionedStore,
  type RestoreTarget,
} from '../kernel/organism/index.js';

interface Genome {
  name: string;
  traits: string[];
}

interface Flagged {
  ok: boolean;
  label: string;
}

const T0 = new Date('2026-01-01T00:00:00.000Z');

describe('VersionedStore', () => {
  it('commits monotonic versions 1..n', () => {
    const store = new VersionedStore<string>(() => T0);
    expect(store.commit('a')).toBe(1);
    expect(store.commit('b')).toBe(2);
    expect(store.commit('c')).toBe(3);
    expect(store.current().version).toBe(3);
    expect(store.current().value).toBe('c');
    expect(store.history().map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it('throws current() on an empty store', () => {
    const store = new VersionedStore<string>(() => T0);
    expect(() => store.current()).toThrow();
  });

  it('records committedAt from the injected clock', () => {
    const t1 = new Date('2026-01-02T00:00:00.000Z');
    let now = T0;
    const store = new VersionedStore<string>(() => now);
    store.commit('a');
    now = t1;
    store.commit('b');
    expect(store.history().map((r) => r.committedAt.getTime())).toEqual([T0.getTime(), t1.getTime()]);
  });

  it('history() returns immutable copies that cannot corrupt the store', () => {
    const store = new VersionedStore<Genome>(() => T0);
    store.commit({ name: 'g1', traits: ['a'] }, 'birth');
    const hist = store.history();
    const first = hist[0];
    if (!first) throw new Error('expected a record');
    first.version = 999;
    first.committedAt = new Date(0);
    first.message = 'tampered';
    first.value.name = 'tampered';
    first.value.traits.push('evil');
    hist.push({ version: 1000, value: { name: 'fake', traits: [] }, committedAt: new Date() });
    hist.length = 0;

    expect(store.current().version).toBe(1);
    expect(store.current().value).toEqual({ name: 'g1', traits: ['a'] });
    expect(store.current().message).toBe('birth');
    expect(store.history()).toHaveLength(1);
    expect(store.history()[0]?.value).toEqual({ name: 'g1', traits: ['a'] });
  });

  it('at() returns copies that cannot corrupt the store', () => {
    const store = new VersionedStore<Genome>(() => T0);
    store.commit({ name: 'g1', traits: ['a'] });
    const value = store.at(1);
    if (!value) throw new Error('expected a value');
    value.traits.push('evil');
    expect(store.at(1)).toEqual({ name: 'g1', traits: ['a'] });
  });

  it('rollbackTo restores the exact value and keeps history', () => {
    const store = new VersionedStore<Genome>(() => T0);
    store.commit({ name: 'g1', traits: ['a'] });
    store.commit({ name: 'g2', traits: ['b'] });
    store.commit({ name: 'g3', traits: ['c'] });
    expect(store.rollbackTo(2)).toBe(true);
    expect(store.current().version).toBe(2);
    expect(store.current().value).toEqual({ name: 'g2', traits: ['b'] });
    expect(store.history().map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it('rollbackTo an unknown version returns false and does not mutate', () => {
    const store = new VersionedStore<Genome>(() => T0);
    store.commit({ name: 'g1', traits: ['a'] });
    store.commit({ name: 'g2', traits: ['b'] });
    for (const version of [0, -1, 3, 4, 2.5, Number.NaN]) {
      expect(store.rollbackTo(version)).toBe(false);
    }
    expect(store.current().version).toBe(2);
    expect(store.current().value).toEqual({ name: 'g2', traits: ['b'] });
    expect(store.history()).toHaveLength(2);
  });

  it('rolls forward again after a rollback with a fresh monotonic version', () => {
    const store = new VersionedStore<Genome>(() => T0);
    store.commit({ name: 'g1', traits: ['a'] });
    store.commit({ name: 'g2', traits: ['b'] });
    expect(store.rollbackTo(1)).toBe(true);
    expect(store.commit({ name: 'g4', traits: ['d'] })).toBe(3);
    expect(store.current().version).toBe(3);
    expect(store.current().value).toEqual({ name: 'g4', traits: ['d'] });
    expect(store.history().map((r) => r.version)).toEqual([1, 2, 3]);
  });

  it('isolates stores per kind', () => {
    const genome = createVersionedStore<Genome>('genome');
    const skills = createVersionedStore<string>('skills');
    genome.commit({ name: 'species', traits: ['x'] });
    skills.commit('parsing');
    skills.commit('refactoring');
    expect(genome.kind).toBe('genome');
    expect(skills.kind).toBe('skills');
    expect(genome.current().value).toEqual({ name: 'species', traits: ['x'] });
    expect(skills.current().value).toBe('refactoring');
    expect(skills.rollbackTo(1)).toBe(true);
    expect(genome.current().version).toBe(1);
    expect(genome.current().value).toEqual({ name: 'species', traits: ['x'] });
    expect(skills.current().value).toBe('parsing');
  });
});

describe('VersionedStore persistence', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips history, head, kind, and continues the version counter', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'organism-versioning-'));
    const file = path.join(dir, 'genome.json');
    const s1 = new VersionedStore<Genome>(() => T0, 'genome');
    s1.commit({ name: 'g1', traits: ['a'] }, 'birth');
    s1.commit({ name: 'g2', traits: ['b'] });
    s1.commit({ name: 'g3', traits: ['c'] });
    s1.rollbackTo(1);
    await s1.persist(file);

    const s2 = new VersionedStore<Genome>();
    expect(await s2.load(file)).toBe(3);
    expect(s2.kind).toBe('genome');
    expect(s2.current().version).toBe(1);
    expect(s2.current().value).toEqual({ name: 'g1', traits: ['a'] });
    expect(s2.current().message).toBe('birth');
    expect(s2.history().map((r) => r.committedAt.getTime())).toEqual([
      T0.getTime(),
      T0.getTime(),
      T0.getTime(),
    ]);
    expect(s2.commit({ name: 'g4', traits: ['d'] })).toBe(4);
    expect(s2.current().version).toBe(4);
    expect(s2.current().value).toEqual({ name: 'g4', traits: ['d'] });
  });

  it('load of a missing file returns 0 and leaves the store empty', async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'organism-versioning-'));
    const store = new VersionedStore<Genome>(() => T0);
    expect(await store.load(path.join(dir, 'absent.json'))).toBe(0);
    expect(store.history()).toHaveLength(0);
  });
});

describe('restoreOrganism', () => {
  const target: RestoreTarget = 'beliefs';

  function seeded(): VersionedStore<Flagged> {
    const store = new VersionedStore<Flagged>(() => T0);
    store.commit({ ok: false, label: 'v1' });
    store.commit({ ok: true, label: 'v2' });
    store.commit({ ok: false, label: 'v3' });
    return store;
  }

  it('restores when the validator passes and reports from/to/restoredAt', () => {
    const store = seeded();
    const report = restoreOrganism({
      store,
      target,
      toVersion: 2,
      validator: (v) => (v.ok ? [] : ['not ok']),
      now: () => T0,
    });
    expect(report).toEqual({
      target,
      from: 3,
      to: 2,
      verified: true,
      reasons: [],
      restoredAt: T0,
    });
    expect(store.current().version).toBe(2);
    expect(store.current().value).toEqual({ ok: true, label: 'v2' });
    expect(store.history()).toHaveLength(3);
  });

  it('does not touch the store when the validator rejects', () => {
    const store = seeded();
    const seen: Flagged[] = [];
    const report = restoreOrganism({
      store,
      target,
      toVersion: 1,
      validator: (v) => {
        seen.push(v);
        return v.ok ? [] : ['missing ok flag'];
      },
    });
    expect(report.verified).toBe(false);
    expect(report.reasons).toEqual(['missing ok flag']);
    expect(report.from).toBe(3);
    expect(report.to).toBe(1);
    expect(seen).toEqual([{ ok: false, label: 'v1' }]);
    expect(store.current().version).toBe(3);
    expect(store.current().value).toEqual({ ok: false, label: 'v3' });
    expect(store.history()).toHaveLength(3);
  });

  it('records multiple validator reasons verbatim', () => {
    const store = seeded();
    const report = restoreOrganism({
      store,
      target,
      toVersion: 1,
      validator: () => ['shape invalid', 'schema mismatch'],
    });
    expect(report.verified).toBe(false);
    expect(report.reasons).toEqual(['shape invalid', 'schema mismatch']);
    expect(store.current().version).toBe(3);
  });

  it('treats a missing validator as passing', () => {
    const store = seeded();
    const report = restoreOrganism({ store, target, toVersion: 1 });
    expect(report.verified).toBe(true);
    expect(report.reasons).toEqual([]);
    expect(store.current().version).toBe(1);
  });

  it('reports unknown versions without mutating the store', () => {
    const store = seeded();
    const report = restoreOrganism({ store, target, toVersion: 99 });
    expect(report.verified).toBe(false);
    expect(report.reasons).toEqual(['unknown version 99']);
    expect(report.from).toBe(3);
    expect(store.current().version).toBe(3);
    expect(store.history()).toHaveLength(3);
  });

  it('handles an empty store', () => {
    const store = new VersionedStore<Flagged>(() => T0);
    const report = restoreOrganism({ store, target, toVersion: 1 });
    expect(report.verified).toBe(false);
    expect(report.from).toBe(0);
    expect(store.history()).toHaveLength(0);
  });

  it('restores to the current version without complaint', () => {
    const store = seeded();
    const report = restoreOrganism({ store, target, toVersion: 3 });
    expect(report.verified).toBe(true);
    expect(report.from).toBe(3);
    expect(report.to).toBe(3);
    expect(store.current().version).toBe(3);
  });
});
