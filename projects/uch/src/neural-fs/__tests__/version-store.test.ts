import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CognitiveKernel } from '../../kernel/cognitive-kernel.js';
import { VersionStore, contentID, stableSerialize, captureKernelState } from '../version-store.js';
import { NeuralFS } from '../index.js';

function makeKernel(): CognitiveKernel {
  return new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
}

describe('content addressing', () => {
  it('is deterministic for identical payloads', () => {
    const a = contentID({ name: 'alpha', tags: ['x', 'y'], nested: { n: 1 } });
    const b = contentID({ name: 'alpha', tags: ['x', 'y'], nested: { n: 1 } });
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('is key-order independent', () => {
    const a = contentID({ b: 2, a: 1 });
    const b = contentID({ a: 1, b: 2 });
    expect(a).toBe(b);
  });

  it('differs for different payloads', () => {
    expect(contentID({ v: 1 })).not.toBe(contentID({ v: 2 }));
  });

  it('serializes arrays and primitives stably', () => {
    expect(stableSerialize([3, 1, 2])).toBe('[3,1,2]');
    expect(stableSerialize('hello')).toBe('"hello"');
  });
});

describe('VersionStore', () => {
  let kernel: CognitiveKernel;
  let tmpDir: string;

  beforeEach(() => {
    kernel = makeKernel();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-nfs-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('captures kernel state into a snapshot tree', async () => {
    await kernel.remember({ content: { type: 'text', text: 'first lesson' } });
    kernel.addConcept({ name: 'canary', concept_type: 'abstract', definition: 'gradual rollout' });
    await kernel.learnEvidence('tests pass', 'ran suite', 0.9);

    const tree = captureKernelState(kernel);
    expect(tree.type).toBe('snapshot-tree');
    expect(tree.domains.concepts?.length).toBe(1);
    expect(tree.domains.episodes?.length).toBe(1);
    expect(tree.domains.beliefs?.length).toBe(1);
    expect(tree.domains.edges).toEqual([]);
  });

  it('commits capture state and build a parent chain', async () => {
    const store = new VersionStore(kernel, { author: 'test-agent' });
    await kernel.remember({ content: { type: 'text', text: 'memory one' } });
    const c1 = await store.commit('first memory');
    await kernel.remember({ content: { type: 'text', text: 'memory two' } });
    const c2 = await store.commit('second memory');

    expect(c1.parent).toBeNull();
    expect(c2.parent).toBe(c1.cid);
    expect(store.headCommit()?.cid).toBe(c2.cid);
    expect(store.log().map((c) => c.cid)).toEqual([c2.cid, c1.cid]);
    expect(c1.cid).toMatch(/^sha256:/);
  });

  it('checkout resolves the recorded snapshot (time travel)', async () => {
    const store = new VersionStore(kernel);
    await kernel.remember({ content: { type: 'text', text: 'alpha' } });
    const c1 = await store.commit('alpha');
    await kernel.remember({ content: { type: 'text', text: 'beta' } });
    await store.commit('beta');

    const tree = store.checkout(c1.cid);
    expect(tree?.domains.episodes?.length).toBe(1);
    const episodes = tree?.domains.episodes as Array<{ content: { text: string } }>;
    expect(episodes[0]?.content.text).toBe('alpha');
  });

  it('diff reports added, removed and changed objects', async () => {
    const store = new VersionStore(kernel);
    kernel.addConcept({ name: 'alpha', concept_type: 'abstract', definition: 'first' });
    const c1 = await store.commit('baseline');
    kernel.addConcept({ name: 'beta', concept_type: 'abstract', definition: 'second' });
    const c2 = await store.commit('added beta');

    const diff = store.diff(c1.cid, c2.cid);
    expect(diff.added.some((a) => a.startsWith('concepts:'))).toBe(true);
    expect(diff.changed.some((c) => c.startsWith('concepts:'))).toBe(true);
    expect(diff.removed).toEqual([]);
  });

  it('restore replays a snapshot idempotently', async () => {
    const store = new VersionStore(kernel);
    await kernel.remember({ content: { type: 'text', text: 'restorable memory' } });
    kernel.addConcept({ name: 'restored-concept', concept_type: 'abstract', definition: 'def' });
    await kernel.learnEvidence('restored belief', 'evidence', 0.8);
    const c1 = await store.commit('snapshot');

    const fresh = makeKernel();
    const result = await store.restore(c1.cid, fresh);
    expect(result?.concepts).toBe(1);
    expect(result?.beliefs).toBe(1);

    const again = await store.restore(c1.cid, fresh);
    expect(again?.concepts).toBe(0);
    expect(again?.beliefs).toBe(0);
    expect(fresh.findConcept('restored-concept')).toBeDefined();
    expect(fresh.getBeliefs().propositions.has('restored belief')).toBe(true);
  });

  it('returns null for unknown commits', async () => {
    const store = new VersionStore(kernel);
    expect(store.checkout('sha256:deadbeef')).toBeUndefined();
    expect(await store.restore('sha256:deadbeef')).toBeNull();
    expect(store.getCommit('nope')).toBeUndefined();
  });

  it('persists commits and objects across instances via journal', async () => {
    const store1 = new VersionStore(kernel, { persistencePath: tmpDir });
    await store1.init();
    kernel.addConcept({ name: 'persisted-concept', concept_type: 'abstract', definition: 'p' });
    const c1 = await store1.commit('persisted');
    await store1.shutdown();

    const store2 = new VersionStore(makeKernel(), { persistencePath: tmpDir });
    await store2.init();
    expect(store2.countCommits()).toBe(1);
    expect(store2.headCommit()?.cid).toBe(c1.cid);
    const tree = store2.checkout(c1.cid);
    expect((tree?.domains.concepts as Array<{ name: string }>)[0]?.name).toBe('persisted-concept');
  });

  it('is exposed through NeuralFS', async () => {
    const nfs = new NeuralFS(kernel);
    await kernel.remember({ content: { type: 'text', text: 'via nfs' } });
    const commit = await nfs.version.commit('nfs commit');
    expect(commit.message).toBe('nfs commit');
    expect(nfs.version.log().length).toBe(1);
  });
});
