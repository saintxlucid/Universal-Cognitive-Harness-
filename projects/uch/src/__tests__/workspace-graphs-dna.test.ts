import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceDNA } from '../workspace-graphs/workspace-dna.js';

describe('WorkspaceDNA', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-wsg-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts with no fingerprint and no mutations', () => {
    const dna = new WorkspaceDNA('ws1', 'Test');
    expect(dna.getFingerprint()).toBeNull();
    expect(dna.mutationCount()).toBe(0);
  });

  it('produces stable fingerprints for stable inputs', () => {
    const dna = new WorkspaceDNA('ws1', 'Test');
    dna.recompute({ a: 1 });
    expect(dna.getFingerprint()).toMatch(/^sha256:[0-9a-f]{64}$/);
    const first = dna.getFingerprint();
    dna.recompute({ a: 1 });
    expect(dna.getFingerprint()).toBe(first);
    expect(dna.mutationCount()).toBe(0);
  });

  it('records input_changed mutations when the fingerprint changes', () => {
    const dna = new WorkspaceDNA('ws1', 'Test');
    dna.recompute({ a: 1 });
    const first = dna.getFingerprint();
    dna.recompute({ a: 2 });
    expect(dna.getFingerprint()).not.toBe(first);
    expect(dna.mutationCount()).toBe(1);
    const mutation = dna.getMutations()[0]!;
    expect(mutation.cause).toBe('input_changed');
    expect(mutation.locus).toBe('workspace');
    expect(mutation.fromFingerprint).toBe(first);
    expect(mutation.toFingerprint).toBe(dna.getFingerprint());
    expect(typeof mutation.at).toBe('number');
  });

  it('is invariant to key ordering', () => {
    const dna = new WorkspaceDNA('ws1', 'Test');
    dna.recompute({ a: 1, b: 2 });
    const first = dna.getFingerprint();
    dna.recompute({ b: 2, a: 1 });
    expect(dna.getFingerprint()).toBe(first);
    expect(dna.mutationCount()).toBe(0);
  });

  it('never leaks input values into the fingerprint', () => {
    const dna = new WorkspaceDNA('ws1', 'Test');
    dna.recompute({ password: 'hunter2secret' });
    expect(dna.getFingerprint()).not.toContain('hunter2secret');
  });

  it('persists and loads fingerprint and mutations', async () => {
    const dna = new WorkspaceDNA('ws1', 'Test');
    dna.recompute({ a: 1 });
    dna.recompute({ a: 2 });
    expect(dna.mutationCount()).toBe(1);
    const file = join(dir, 'dna.json');
    await dna.persist(file);
    expect(existsSync(file)).toBe(true);

    const fresh = new WorkspaceDNA('ws1', 'Test');
    expect(await fresh.load(file)).toBe(1);
    expect(fresh.getFingerprint()).toBe(dna.getFingerprint());
    expect(fresh.getMutations().length).toBe(1);
    expect(await fresh.load(join(dir, 'missing.json'))).toBe(0);
  });
});
