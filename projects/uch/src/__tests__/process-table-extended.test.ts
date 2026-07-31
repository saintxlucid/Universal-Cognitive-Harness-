import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { ProcessTable } from '../kernel/process/process-table.js';

const T0 = new Date('2026-08-01T00:00:00.000Z');
const T1 = new Date('2026-08-01T01:00:00.000Z');

describe('ProcessTable lifecycle (COGNITIVE-PROCESSES.md)', () => {
  it('working memory is process state shared by every thread, not copied', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user', workingMemory: { seed: 1 } }, T0);
    table.attach(p.pid, 'claude', T1);
    table.attach(p.pid, 'codex', T1);
    const process = table.get(p.pid)!;
    expect(process.workingMemory).toEqual({ seed: 1 });
    process.workingMemory!['shared'] = 'same-object';
    expect(process.workingMemory!['shared']).toBe('same-object');
    expect(process.threads.map((t) => t.driverLabel).sort()).toEqual(['claude', 'codex']);
  });

  it('spawn copies working memory instead of aliasing it', () => {
    const memory = { seed: 1 };
    const table = new ProcessTable();
    const p = table.spawn({ name: 't', ownerLabel: 'o', workingMemory: memory }, T0);
    memory['seed'] = 2;
    expect(p.workingMemory).toEqual({ seed: 1 });
  });

  it('attach is blocked for suspended and draining processes', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    table.signal(p.pid, 'pause', T1);
    expect(table.get(p.pid)?.status).toBe('suspended');
    expect(() => table.attach(p.pid, 'claude')).toThrow(/suspended/);

    const draining = table.spawn({ name: 'd', ownerLabel: 'user' }, T0);
    table.signal(draining.pid, 'terminate', T1);
    expect(table.get(draining.pid)?.status).toBe('draining');
    expect(() => table.attach(draining.pid, 'claude')).toThrow(/draining/);
  });

  it('reserved signals transition status and are queued (pause/resume/terminate)', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    table.signal(p.pid, 'pause', T1);
    expect(p.status).toBe('suspended');
    table.signal(p.pid, 'resume', T1);
    expect(p.status).toBe('running');
    table.signal(p.pid, 'terminate', T1);
    expect(p.status).toBe('draining');
    expect(p.pendingSignals).toEqual(['pause', 'resume', 'terminate']);
  });

  it('custom signals are queued without changing status', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    table.signal(p.pid, 'REVIEW', T1);
    expect(p.status).toBe('running');
    expect(p.pendingSignals).toEqual(['REVIEW']);
  });

  it('detach removes one thread; the process keeps running', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    const t = table.attach(p.pid, 'claude', T1);
    expect(table.detach(p.pid, t.threadId)).toBe(true);
    expect(table.threadsOf(p.pid)).toEqual([]);
    expect(p.status).toBe('running');
    expect(table.detach(p.pid, t.threadId)).toBe(false);
  });

  it('detachDriver removes every thread of a driver', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    table.attach(p.pid, 'claude', T1);
    table.attach(p.pid, 'claude', T1);
    table.attach(p.pid, 'codex', T1);
    expect(table.detachDriver(p.pid, 'claude')).toBe(2);
    expect(table.threadsOf(p.pid).map((t) => t.driverLabel)).toEqual(['codex']);
    expect(table.detachDriver(p.pid, 'ghost')).toBe(0);
  });

  it('kill drains threads and terminates, preserving the record', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user', goals: ['keep'] }, T0);
    table.attach(p.pid, 'claude', T1);
    table.attach(p.pid, 'codex', T1);
    expect(table.kill(p.pid, T1)).toBe(true);
    const stopped = table.get(p.pid)!;
    expect(stopped.status).toBe('terminated');
    expect(stopped.threads).toEqual([]);
    expect(stopped.goals).toEqual(['keep']);
    expect(stopped.pendingSignals).toContain('terminate');
    expect(stopped.updatedAt).toBe(T1);
  });

  it('stats summarise the table across all states', () => {
    const table = new ProcessTable();
    table.spawn({ name: 'a', ownerLabel: 'o' }, T0);
    const b = table.spawn({ name: 'b', ownerLabel: 'o' }, T0);
    table.attach(b.pid, 'claude', T1);
    table.signal(b.pid, 'pause', T1);
    const c = table.spawn({ name: 'c', ownerLabel: 'o' }, T0);
    table.kill(c.pid, T1);
    const stats = table.stats();
    expect(stats.total).toBe(3);
    expect(stats.running).toBe(1);
    expect(stats.suspended).toBe(1);
    expect(stats.terminated).toBe(1);
    expect(stats.threads).toBe(1);
  });

  it('publishes governed events for every transition', () => {
    const bus = new NeuralEventBus();
    const table = new ProcessTable({ eventBus: bus });
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    const t = table.attach(p.pid, 'claude', T1);
    table.detach(p.pid, t.threadId);
    table.signal(p.pid, 'pause', T1);
    table.kill(p.pid, T1);
    expect(bus.getHistory('process:spawned').length).toBe(1);
    expect(bus.getHistory('process:joined').length).toBe(1);
    expect(bus.getHistory('process:detached').length).toBe(1);
    expect(bus.getHistory('process:signaled').length).toBe(2);
    expect(bus.getHistory('process:killed').length).toBe(1);
    expect(bus.getHistory('process:spawned')[0]?.payload.pid).toBe(p.pid);
  });

  it('persists and reloads working memory, status, and dates', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-proc-ext-'));
    const file = path.join(dir, 'processes.json');
    try {
      const table = new ProcessTable();
      const p = table.spawn({ name: 'task', ownerLabel: 'user', workingMemory: { seed: 7 } }, T0);
      table.attach(p.pid, 'claude', T1);
      table.signal(p.pid, 'pause', T1);
      await table.persist(file);

      const reloaded = new ProcessTable();
      const count = await reloaded.load(file);
      expect(count).toBe(1);
      const restored = reloaded.get(p.pid)!;
      expect(restored.status).toBe('suspended');
      expect(restored.workingMemory).toEqual({ seed: 7 });
      expect(restored.threads[0]?.driverLabel).toBe('claude');
      expect(restored.createdAt).toBeInstanceOf(Date);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
