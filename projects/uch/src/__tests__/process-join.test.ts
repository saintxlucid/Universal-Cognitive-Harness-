import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ProcessTable } from '../kernel/process/process-table.js';
import { joinProcess } from '../kernel/process/join.js';
import { createManifest, writeManifest } from '../workspace-manifest/loader.js';

function tempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-join-'));
  writeManifest(dir, createManifest({ name: 'join-test', minUchVersion: '0.2.0' }));
  return dir;
}

describe('joinProcess (attach = join, COGNITIVE-PROCESSES.md §8)', () => {
  it('joins an existing process: one thread per driver, nothing transfers', async () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'tester', workingMemory: { seed: 1 } });
    const dir = tempWorkspace();
    try {
      const claude = await joinProcess({
        processTable: table,
        pid: p.pid,
        agent_id: 'claude',
        user_id: 'tester',
        startDir: dir,
      });
      expect(claude.ok).toBe(true);
      if (!claude.ok) return;
      expect(claude.created).toBe(false);
      expect(claude.pid).toBe(p.pid);
      expect(claude.thread.driverLabel).toBe('claude');
      expect(claude.attachment.attached).toBe(true);
      expect(table.threadsOf(p.pid).length).toBe(1);

      const codex = await joinProcess({
        processTable: table,
        pid: p.pid,
        agent_id: 'codex',
        user_id: 'tester',
        startDir: dir,
      });
      expect(codex.ok).toBe(true);
      if (!codex.ok) return;
      expect(table.threadsOf(p.pid).length).toBe(2);
      expect(table.threadsOf(p.pid).map((t) => t.driverLabel).sort()).toEqual(['claude', 'codex']);

      const process = table.get(p.pid)!;
      process.workingMemory!['shared'] = 'same-object';
      expect(process.workingMemory!['shared']).toBe('same-object');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('creates a fresh process when no pid is given (create-or-join)', async () => {
    const table = new ProcessTable();
    const dir = tempWorkspace();
    try {
      const result = await joinProcess({
        processTable: table,
        agent_id: 'claude',
        user_id: 'tester',
        startDir: dir,
        processSpec: { name: 'ad-hoc', ownerLabel: 'tester', goals: ['investigate'] },
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.created).toBe(true);
      const process = table.get(result.pid)!;
      expect(process.name).toBe('ad-hoc');
      expect(process.goals).toEqual(['investigate']);
      expect(process.threads[0]?.driverLabel).toBe('claude');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rolls back a freshly spawned process when attachment fails', async () => {
    const table = new ProcessTable();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-join-empty-'));
    try {
      const result = await joinProcess({
        processTable: table,
        agent_id: 'claude',
        startDir: dir,
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toContain('manifest');
      const rolledBack = table.list()[0];
      expect(rolledBack?.status).toBe('terminated');
      expect(rolledBack?.threads).toEqual([]);
      expect(rolledBack?.pendingSignals).toContain('terminate');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not roll back an existing process when attachment fails', async () => {
    const table = new ProcessTable();
    const p = table.spawn({ name: 'task', ownerLabel: 'user' });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-join-empty2-'));
    try {
      const result = await joinProcess({
        processTable: table,
        pid: p.pid,
        agent_id: 'claude',
        startDir: dir,
      });
      expect(result.ok).toBe(false);
      expect(table.get(p.pid)?.status).toBe('running');
      expect(table.threadsOf(p.pid)).toEqual([]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('fails cleanly for an unknown pid', async () => {
    const table = new ProcessTable();
    const result = await joinProcess({ processTable: table, pid: 99, agent_id: 'claude' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('not found');
  });
});
