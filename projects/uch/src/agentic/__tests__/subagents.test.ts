import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SubagentRegistry, createSubagentId } from '../subagents/registry.js';
import { AsyncSubagentRegistry } from '../subagents/async-registry.js';

function deferred<T = string>() {
  let resolve: (value: T) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('SubagentRegistry', () => {
  it('spawns and completes a subagent', async () => {
    const registry = new SubagentRegistry();
    const record = await registry.spawn({
      name: 'researcher',
      prompt: 'research X',
      runner: async () => 'findings',
    });
    expect(record.status).toBe('running');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const completed = registry.get(record.id);
    expect(completed?.status).toBe('completed');
    expect(completed?.result).toBe('findings');
    expect(completed?.depth).toBe(1);
  });

  it('enforces depth limits', async () => {
    const registry = new SubagentRegistry({ defaultMaxDepth: 2 });
    const parent = await registry.spawn({
      name: 'a',
      prompt: 'a',
      runner: async () => 'a',
    });
    const child = await registry.spawn({
      name: 'b',
      prompt: 'b',
      parentId: parent.id,
      runner: async () => 'b',
    });
    expect(child.depth).toBe(2);
    await expect(registry.spawn({
      name: 'c',
      prompt: 'c',
      parentId: child.id,
      runner: async () => 'c',
    })).rejects.toThrow('depth limit');
  });

  it('records failures and schedules retries', async () => {
    const registry = new SubagentRegistry();
    const record = await registry.spawn({
      name: 'flaky',
      prompt: 'p',
      runner: async () => {
        throw new Error('boom');
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const failed = registry.get(record.id);
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('boom');
    expect(registry.retriesDue(Date.now() + 5000).some((r) => r.recordId === record.id)).toBe(true);
  });

  it('tracks parent-child relationships', async () => {
    const registry = new SubagentRegistry();
    const parent = await registry.spawn({ name: 'p', prompt: 'p', runner: async () => 'p' });
    const child = await registry.spawn({ name: 'c', prompt: 'c', parentId: parent.id, runner: async () => 'c' });
    expect(child.parentId).toBe(parent.id);
    expect(child.depth).toBe(2);
    expect(registry.list({ parentId: parent.id })).toHaveLength(1);
    expect(registry.list().map((r) => r.depth).sort()).toEqual([1, 2]);
  });

  it('reconciles orphans against active ids', async () => {
    const registry = new SubagentRegistry();
    const first = await registry.spawn({ name: 'a', prompt: 'a', runner: () => new Promise(() => {}) });
    const second = await registry.spawn({ name: 'b', prompt: 'b', runner: () => new Promise(() => {}) });
    const orphans = await registry.reconcileOrphans([first.id]);
    expect(orphans.map((o) => o.id)).toEqual([second.id]);
    expect(registry.get(second.id)?.status).toBe('orphaned');
    expect(registry.get(first.id)?.status).toBe('running');
  });

  it('expires stale running subagents', async () => {
    const registry = new SubagentRegistry();
    const record = await registry.spawn({
      name: 'slow',
      prompt: 'p',
      ttlMs: 10,
      runner: () => new Promise(() => {}),
    });
    await new Promise((resolve) => setTimeout(resolve, 25));
    const expired = await registry.expireStale();
    expect(expired.map((e) => e.id)).toContain(record.id);
    expect(registry.get(record.id)?.status).toBe('expired');
  });

  it('drains announcement queue', async () => {
    const registry = new SubagentRegistry();
    const record = await registry.spawn({ name: 'a', prompt: 'a', runner: async () => 'done' });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const drained = registry.drainAnnouncements();
    expect(drained).toContain(record.id);
    expect(registry.drainAnnouncements()).toHaveLength(0);
  });

  it('persists and restores state from disk', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'uch-sub-'));
    try {
      const persistPath = path.join(dir, 'subagents.json');
      const registry = new SubagentRegistry({ persistPath });
      const record = await registry.spawn({ name: 'a', prompt: 'a', runner: async () => 'done' });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await registry.persist();
      const raw = await readFile(persistPath, 'utf-8');
      expect(raw).toContain(record.id);

      const restored = new SubagentRegistry({ persistPath });
      await restored.load();
      expect(restored.get(record.id)?.status).toBe('completed');
      expect(restored.get(record.id)?.result).toBe('done');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('snapshot and load round-trip', async () => {
    const registry = new SubagentRegistry();
    const record = await registry.spawn({ name: 'a', prompt: 'a', runner: async () => 'x' });
    registry.complete(record.id, 'result');
    const snapshot = registry.snapshot();
    const other = new SubagentRegistry();
    await other.loadSnapshot(snapshot);
    expect(other.get(record.id)?.status).toBe('completed');
  });

  it('generates unique ids', () => {
    expect(createSubagentId()).not.toBe(createSubagentId());
  });

  it('complete and fail return false for unknown ids', () => {
    const registry = new SubagentRegistry();
    expect(registry.complete('missing', 'x')).toBe(false);
    expect(registry.fail('missing', 'x')).toBe(false);
  });
});

describe('AsyncSubagentRegistry', () => {
  it('launches background tasks with status transitions', async () => {
    const registry = new AsyncSubagentRegistry();
    const id = registry.launch('compile', async () => 'build ok');
    expect(registry.check(id)?.status).toBe('queued');
    await new Promise((resolve) => setTimeout(resolve, 10));
    const record = registry.check(id);
    expect(record?.status).toBe('completed');
    expect(record?.result).toBe('build ok');
  });

  it('tracks progress updates', async () => {
    const registry = new AsyncSubagentRegistry();
    const gate = deferred();
    const id = registry.launch('long', async () => {
      await gate.promise;
      return 'done';
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(registry.updateProgress(id, 'halfway')).toBe(true);
    expect(registry.check(id)?.progress).toBe('halfway');
    gate.resolve('go');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(registry.check(id)?.status).toBe('completed');
  });

  it('records failures with error messages', async () => {
    const registry = new AsyncSubagentRegistry();
    const id = registry.launch('failing', async () => {
      throw new Error('bad task');
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(registry.check(id)?.status).toBe('failed');
    expect(registry.check(id)?.error).toBe('bad task');
  });

  it('cancels queued and running tasks', async () => {
    const registry = new AsyncSubagentRegistry();
    const gate = deferred();
    const id = registry.launch('cancellable', async () => {
      await gate.promise;
      return 'done';
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(registry.cancel(id)).toBe(true);
    expect(registry.check(id)?.status).toBe('cancelled');
    gate.resolve('go');
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(registry.check(id)?.status).toBe('cancelled');
  });

  it('cancel returns false for unknown tasks', () => {
    const registry = new AsyncSubagentRegistry();
    expect(registry.cancel('nope')).toBe(false);
  });

  it('lists and filters tasks', async () => {
    const registry = new AsyncSubagentRegistry();
    registry.launch('a', async () => 'a');
    registry.launch('b', async () => {
      throw new Error('x');
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(registry.list().length).toBe(2);
    expect(registry.list({ status: 'failed' })).toHaveLength(1);
    expect(registry.list({ status: 'completed' })).toHaveLength(1);
  });

  it('clears finished tasks', async () => {
    const registry = new AsyncSubagentRegistry();
    registry.launch('a', async () => 'a');
    await new Promise((resolve) => setTimeout(resolve, 10));
    registry.clearCompleted();
    expect(registry.list()).toHaveLength(0);
  });
});
