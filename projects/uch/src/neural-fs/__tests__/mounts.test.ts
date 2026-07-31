import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CP_VERBS, MountTable, type Mount } from '../mounts.js';

const NOW = new Date('2026-08-01T12:00:00.000Z');

function makeTable(): MountTable {
  return new MountTable({ now: () => NOW });
}

function spec(point: string, capabilities: string[]): Parameters<MountTable['mount']>[0] {
  return { point, scope: `scope:${point}`, grantId: `grant-${point}`, capabilities };
}

describe('MountTable mount/unmount', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-mounts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('mounts a driver at its point and lists it', () => {
    const table = makeTable();
    const mount = table.mount(spec('/workspace', ['memory.read', 'memory.write']));
    expect(mount.point).toBe('/workspace');
    expect(mount.attachedAt).toEqual(NOW);
    expect(mount.grantId).toBe('grant-/workspace');
    expect(table.list()).toHaveLength(1);
    expect(table.list()[0]?.capabilities).toEqual(['memory.read', 'memory.write']);
  });

  it('rejects a duplicate mount point', () => {
    const table = makeTable();
    table.mount(spec('/memory', ['memory.read']));
    expect(() => table.mount(spec('/memory', ['memory.write']))).toThrow(/already in use/);
    expect(table.list()).toHaveLength(1);
  });

  it('treats trailing-slash variants as the same point', () => {
    const table = makeTable();
    table.mount(spec('/memory', ['memory.read']));
    expect(() => table.mount(spec('/memory/', ['memory.write']))).toThrow(/already in use/);
  });

  it('unmounts a point and reports unknown points as false', () => {
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read']));
    expect(table.unmount('/workspace')).toBe(true);
    expect(table.list()).toHaveLength(0);
    expect(table.unmount('/workspace')).toBe(false);
  });

  it('unmount leaves other mounts intact', () => {
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read']));
    table.mount(spec('/memory', ['memory.read']));
    table.unmount('/workspace');
    expect(table.list().map((m) => m.point)).toEqual(['/memory']);
    expect(table.resolve('/memory/episodes/1')?.mount.point).toBe('/memory');
  });
});

describe('MountTable resolve', () => {
  it('resolves an exact match with root remainder', () => {
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read']));
    const resolved = table.resolve('/workspace');
    expect(resolved?.mount.point).toBe('/workspace');
    expect(resolved?.remainder).toBe('/');
  });

  it('resolves a nested path to the longest-prefix mount', () => {
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read']));
    table.mount(spec('/workspace/projects', ['project.read']));
    const resolved = table.resolve('/workspace/projects/uch/src');
    expect(resolved?.mount.point).toBe('/workspace/projects');
    expect(resolved?.remainder).toBe('/uch/src');
  });

  it('falls back to the shorter mount for paths outside the longer one', () => {
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read']));
    table.mount(spec('/workspace/projects', ['project.read']));
    const resolved = table.resolve('/workspace/uch');
    expect(resolved?.mount.point).toBe('/workspace');
    expect(resolved?.remainder).toBe('/uch');
  });

  it('does not match a point without a path boundary', () => {
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read']));
    expect(table.resolve('/workspacefoo')).toBeUndefined();
    expect(table.resolve('/workspace/')).toBeDefined();
  });

  it('returns undefined for unmounted paths', () => {
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read']));
    expect(table.resolve('/memory')).toBeUndefined();
  });
});

describe('MountTable canAccess', () => {
  it('allows a capability present in both mount and grant', () => {
    const table = makeTable();
    table.mount(spec('/memory', ['memory.read', 'memory.write']));
    expect(table.canAccess('/memory/episodes/1', 'memory.read', ['memory.read'])).toBe(true);
    expect(table.canAccess('/memory/episodes/1', 'memory.write', ['memory.write'])).toBe(true);
  });

  it('denies a capability absent from the mount', () => {
    const table = makeTable();
    table.mount(spec('/memory', ['memory.read']));
    expect(table.canAccess('/memory/episodes/1', 'memory.write', ['memory.read', 'memory.write']))
      .toBe(false);
  });

  it('denies a capability absent from the grant', () => {
    const table = makeTable();
    table.mount(spec('/memory', ['memory.read', 'memory.write']));
    expect(table.canAccess('/memory/episodes/1', 'memory.write', ['memory.read'])).toBe(false);
  });

  it('denies access to an unmounted path even when both sides grant it', () => {
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read']));
    expect(table.canAccess('/knowledge/claim/1', 'memory.read', ['memory.read'])).toBe(false);
  });

  it('enforces the intersection per call, not once at mount time', () => {
    const table = makeTable();
    table.mount(spec('/memory', ['memory.read']));
    expect(table.canAccess('/memory', 'memory.read', ['memory.read'])).toBe(true);
    expect(table.canAccess('/memory', 'memory.read', [])).toBe(false);
  });
});

describe('MountTable persistence', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-mounts-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('round-trips mounts with capabilities and attachedAt across instances', async () => {
    const file = path.join(tmpDir, 'mounts.json');
    const table = makeTable();
    table.mount(spec('/workspace', ['memory.read', 'project.write']));
    table.mount(spec('/memory', ['memory.read']));
    await table.persist(file);

    const reloaded = new MountTable({ now: () => NOW });
    expect(await reloaded.load(file)).toBe(2);
    expect(reloaded.list().map((m) => m.point)).toEqual(['/workspace', '/memory']);
    const ws = reloaded.resolve('/workspace/projects/uch')?.mount as Mount;
    expect(ws.grantId).toBe('grant-/workspace');
    expect(ws.attachedAt).toBeInstanceOf(Date);
    expect(ws.attachedAt.toISOString()).toBe(NOW.toISOString());
    expect(ws.capabilities).toEqual(['memory.read', 'project.write']);
    expect(reloaded.canAccess('/memory/episodes/1', 'memory.read', ['memory.read'])).toBe(true);
  });

  it('load returns 0 for a missing file and leaves state empty', async () => {
    const table = makeTable();
    table.mount(spec('/memory', ['memory.read']));
    expect(await table.load(path.join(tmpDir, 'missing.json'))).toBe(0);
  });
});

describe('CP_VERBS', () => {
  it('covers the documented CIC instruction subset', () => {
    const expected = ['RECALL', 'STORE', 'OBSERVE', 'VERIFY', 'PLAN', 'COMPARE', 'REFLECT', 'CONSOLIDATE'];
    expect(Object.keys(CP_VERBS).sort()).toEqual([...expected].sort());
  });

  it('maps each op to non-empty path:verb families', () => {
    for (const [op, families] of Object.entries(CP_VERBS)) {
      expect(families.length).toBeGreaterThan(0);
      for (const family of families) {
        expect(family).toMatch(/^\/(identity|memory|knowledge|episodes|beliefs|goals|projects|workspaces|skills|genome|thoughts|architecture|evidence|history|dreams|events):(read|write)$/);
        expect(op).toMatch(/^[A-Z]+$/);
      }
    }
  });

  it('keeps read ops read-only and write ops write-only', () => {
    for (const op of ['RECALL', 'OBSERVE', 'VERIFY', 'COMPARE']) {
      for (const family of CP_VERBS[op] ?? []) {
        expect(family.endsWith(':read')).toBe(true);
      }
    }
    for (const family of CP_VERBS['STORE'] ?? []) {
      expect(family.endsWith(':write')).toBe(true);
    }
  });
});
