import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProcessTable } from '../kernel/process/process-table.js';

const T0 = new Date('2026-08-01T00:00:00.000Z');
const T1 = new Date('2026-08-01T01:00:00.000Z');

describe('ProcessTable spawn + PID namespace', () => {
  let table: ProcessTable;

  beforeEach(() => {
    table = new ProcessTable();
  });

  it('spawn returns a running process with the injected clock', () => {
    const p = table.spawn({ name: 'investigate', ownerLabel: 'orchestrator' }, T0);
    expect(p.status).toBe('running');
    expect(p.pid).toBe(1);
    expect(p.createdAt).toBe(T0);
    expect(p.updatedAt).toBe(T0);
    expect(p.pendingSignals).toEqual([]);
    expect(p.threads).toEqual([]);
  });

  it('pids are monotonic and never reused after kill', () => {
    const a = table.spawn({ name: 'a', ownerLabel: 'o' }, T0);
    const b = table.spawn({ name: 'b', ownerLabel: 'o' }, T0);
    expect(a.pid).toBe(1);
    expect(b.pid).toBe(2);
    expect(table.kill(b.pid)).toBe(true);
    const c = table.spawn({ name: 'c', ownerLabel: 'o' }, T0);
    expect(c.pid).toBe(3);
  });

  it('spawn copies spec arrays instead of aliasing them', () => {
    const goals = ['g1'];
    const p = table.spawn({ name: 't', ownerLabel: 'o', goals }, T0);
    goals.push('g2');
    expect(p.goals).toEqual(['g1']);
  });

  it('get returns undefined for unknown pid', () => {
    expect(table.get(42)).toBeUndefined();
  });
});

describe('ProcessTable attach / threads', () => {
  it('attach adds a thread; a second driver threads the same pid', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    const claude = table.attach(p.pid, 'claude', T1);
    const codex = table.attach(p.pid, 'codex', T1);
    expect(claude.threadId).toBe(1);
    expect(codex.threadId).toBe(2);
    expect(claude.driverLabel).toBe('claude');
    expect(claude.attachedAt).toBe(T1);
    expect(table.threadsOf(p.pid).map((t) => t.driverLabel)).toEqual(['claude', 'codex']);
    expect(table.list()).toHaveLength(1);
    expect(table.get(p.pid)!.updatedAt).toBe(T1);
  });

  it('attach to an unknown pid throws', () => {
    const table = new ProcessTable();
    expect(() => table.attach(99, 'claude')).toThrow(/unknown or terminated/);
  });

  it('attach to a terminated pid throws', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    table.kill(p.pid);
    expect(() => table.attach(p.pid, 'codex')).toThrow(/unknown or terminated/);
  });

  it('attach carries no process state — thread has only thread fields', () => {
    const table = new ProcessTable();
    const p = table.spawn(
      { name: 'task', ownerLabel: 'user', goals: ['secret-goal'], capabilities: ['secret-cap'] },
      T0,
    );
    const thread = table.attach(p.pid, 'claude', T1);
    expect(thread).toEqual({ threadId: 1, driverLabel: 'claude', attachedAt: T1 });
    expect('pid' in thread).toBe(false);
    expect('goals' in thread).toBe(false);
    expect('pendingSignals' in thread).toBe(false);
    expect(p.threads).toHaveLength(1);
  });

  it('threadsOf returns [] for unknown pid', () => {
    const table = new ProcessTable();
    expect(table.threadsOf(7)).toEqual([]);
  });
});

describe('ProcessTable kill preserves the record', () => {
  it('marks terminated but keeps the record in the table (law 12 reversibility)', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    expect(table.kill(p.pid, T1)).toBe(true);
    const after = table.get(p.pid)!;
    expect(after.status).toBe('terminated');
    expect(after.pid).toBe(p.pid);
    expect(after.name).toBe('task');
    expect(after.ownerLabel).toBe('user');
    expect(after.createdAt).toBe(T0);
    expect(after.updatedAt).toBe(T1);
    expect(table.list()).toHaveLength(1);
  });

  it('kill on unknown pid returns false; on terminated pid is idempotent', () => {
    const table = new ProcessTable();
    expect(table.kill(999)).toBe(false);
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    expect(table.kill(p.pid)).toBe(true);
    const updatedAt = p.updatedAt;
    expect(table.kill(p.pid)).toBe(true);
    expect(p.updatedAt).toBe(updatedAt);
    expect(p.status).toBe('terminated');
  });
});

describe('ProcessTable signal / drain queue', () => {
  it('signal appends and drain consumes in FIFO order', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    expect(table.signal(p.pid, 'INT')).toBe(true);
    expect(table.signal(p.pid, 'RESUME')).toBe(true);
    expect(p.pendingSignals).toEqual(['INT', 'RESUME']);
    expect(table.drainSignals(p.pid)).toEqual(['INT', 'RESUME']);
    expect(p.pendingSignals).toEqual([]);
    expect(table.drainSignals(p.pid)).toEqual([]);
  });

  it('drain returns a fresh array each time', () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    table.signal(p.pid, 'INT');
    const first = table.drainSignals(p.pid);
    const second = table.drainSignals(p.pid);
    first.push('MUTATED');
    expect(second).toEqual([]);
    expect(p.pendingSignals).toEqual([]);
  });

  it('signal on unknown or terminated pid returns false', () => {
    const table = new ProcessTable();
    expect(table.signal(42, 'INT')).toBe(false);
    const p = table.spawn({ name: 'task', ownerLabel: 'user' }, T0);
    table.kill(p.pid);
    expect(table.signal(p.pid, 'INT')).toBe(false);
  });
});

describe('ProcessTable persistence', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-proc-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips processes, threads, signals, and the pid counter', async () => {
    const file = join(dir, 'processes.json');
    const table = new ProcessTable();
    const p = table.spawn(
      {
        name: 'task',
        ownerLabel: 'user',
        goals: ['g1'],
        capabilities: ['c1'],
        permissions: ['p1'],
        openFiles: ['/memory'],
        episodeId: 'ep-1',
        contextRef: 'ctx-1',
      },
      T0,
    );
    table.attach(p.pid, 'claude', T1);
    table.signal(p.pid, 'INT', T1);
    const other = table.spawn({ name: 'other', ownerLabel: 'user' }, T0);
    table.kill(other.pid, T1);

    await table.persist(file);

    const restored = new ProcessTable();
    const count = await restored.load(file);
    expect(count).toBe(2);

    const rp = restored.get(p.pid)!;
    expect(rp.status).toBe('running');
    expect(rp.name).toBe('task');
    expect(rp.goals).toEqual(['g1']);
    expect(rp.capabilities).toEqual(['c1']);
    expect(rp.permissions).toEqual(['p1']);
    expect(rp.openFiles).toEqual(['/memory']);
    expect(rp.episodeId).toBe('ep-1');
    expect(rp.contextRef).toBe('ctx-1');
    expect(rp.pendingSignals).toEqual(['INT']);
    expect(rp.createdAt).toBeInstanceOf(Date);
    expect(rp.threads).toHaveLength(1);
    expect(rp.threads[0]!.driverLabel).toBe('claude');
    expect(rp.threads[0]!.attachedAt).toBeInstanceOf(Date);

    const rk = restored.get(other.pid)!;
    expect(rk.status).toBe('terminated');

    const next = restored.spawn({ name: 'next', ownerLabel: 'user' }, T1);
    expect(next.pid).toBe(3);
    const nextThread = restored.attach(rp.pid, 'codex', T1);
    expect(nextThread.threadId).toBe(2);
  });

  it('load on a missing file returns 0 and leaves the table empty', async () => {
    const table = new ProcessTable();
    const count = await table.load(join(dir, 'missing.json'));
    expect(count).toBe(0);
    expect(table.list()).toEqual([]);
  });

  it('load replaces prior in-memory state', async () => {
    const file = join(dir, 'processes.json');
    const table = new ProcessTable();
    const p = table.spawn({ name: 'a', ownerLabel: 'user' }, T0);
    await table.persist(file);

    const other = new ProcessTable();
    other.spawn({ name: 'stale', ownerLabel: 'user' }, T0);
    const count = await other.load(file);
    expect(count).toBe(1);
    expect(other.list().map((x) => x.name)).toEqual(['a']);
    expect(other.get(p.pid)?.name).toBe('a');
  });
});
