import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceEvolutionHistory, type CycleSummary } from '../workspace-graphs/evolution-history.js';

describe('WorkspaceEvolutionHistory', () => {
  let dir: string;
  let history: WorkspaceEvolutionHistory;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-wsg-'));
    history = new WorkspaceEvolutionHistory(dir);
  });

  afterEach(() => {
    history.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('records cycles with numeric timestamps and improvements', () => {
    const summary: CycleSummary = {
      cycleId: 1,
      startedAt: 1700000000000,
      completedAt: 1700000030000,
      durationMs: 30000,
      successful: true,
      improvements: { sub: { metric: 0.5 } },
      mutationsApplied: 1,
      mutationsKept: 1,
    };
    history.recordCycle(summary);
    const cycle = history.getCycle(1);
    expect(cycle!.id).toBe('cycle:1');
    expect(cycle!.name).toBe('Cycle 1');
    expect(cycle!.properties.successful).toBe(true);
    expect(cycle!.properties.improvements).toEqual({ sub: { metric: 0.5 } });
    expect(typeof cycle!.properties.startedAt).toBe('number');
    expect(cycle!.properties.startedAt).not.toBeInstanceOf(Date);
  });

  it('tracks stats and accumulates mutationsKept across cycles', () => {
    history.recordCycle({
      cycleId: 1,
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      successful: true,
      improvements: {},
      mutationsApplied: 1,
      mutationsKept: 1,
    });
    expect(history.getStats()).toEqual({ cycles: 1, successful: 1, failed: 0, mutationsKept: 1 });

    history.recordCycle({
      cycleId: 2,
      startedAt: 2,
      completedAt: 3,
      durationMs: 1,
      successful: true,
      improvements: {},
      mutationsApplied: 2,
      mutationsKept: 2,
    });
    expect(history.getStats()).toEqual({ cycles: 2, successful: 2, failed: 0, mutationsKept: 3 });
  });

  it('counts unsuccessful cycles as failures', () => {
    history.recordCycle({
      cycleId: 1,
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      successful: false,
      improvements: {},
      mutationsApplied: 0,
      mutationsKept: 0,
    });
    expect(history.getStats()).toEqual({ cycles: 1, successful: 0, failed: 1, mutationsKept: 0 });
  });

  it('returns cycles in insertion order', () => {
    history.recordCycle({
      cycleId: 1,
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      successful: true,
      improvements: {},
      mutationsApplied: 0,
      mutationsKept: 0,
    });
    history.recordCycle({
      cycleId: 2,
      startedAt: 2,
      completedAt: 3,
      durationMs: 1,
      successful: true,
      improvements: {},
      mutationsApplied: 0,
      mutationsKept: 0,
    });
    const cycles = history.getCycles();
    expect(cycles[0]!.id).toBe('cycle:1');
    expect(cycles[1]!.id).toBe('cycle:2');
  });

  it('caps cycle growth at maxCycles', () => {
    const capped = new WorkspaceEvolutionHistory(dir, 2);
    for (let i = 1; i <= 3; i++) {
      capped.recordCycle({
        cycleId: i,
        startedAt: i,
        completedAt: i + 1,
        durationMs: 1,
        successful: true,
        improvements: {},
        mutationsApplied: 0,
        mutationsKept: 0,
      });
    }
    expect(capped.getCycleCount()).toBe(2);
    capped.close();
  });

  it('creates a sqlite graph file at the expected path', () => {
    expect(existsSync(join(dir, 'evolution-history', 'graph.sqlite'))).toBe(true);
  });

  it('persists and loads manifests with counters', async () => {
    history.recordCycle({
      cycleId: 1,
      startedAt: 1,
      completedAt: 2,
      durationMs: 1,
      successful: true,
      improvements: {},
      mutationsApplied: 1,
      mutationsKept: 1,
    });
    history.recordCycle({
      cycleId: 2,
      startedAt: 2,
      completedAt: 3,
      durationMs: 1,
      successful: true,
      improvements: {},
      mutationsApplied: 1,
      mutationsKept: 2,
    });
    const file = join(dir, 'evolution-history.json');
    await history.persist(file);

    const manifest = JSON.parse(readFileSync(file, 'utf-8')) as {
      counters: { cycles: number };
    };
    expect(manifest.counters.cycles).toBe(2);

    const fresh = new WorkspaceEvolutionHistory(dir);
    expect(await fresh.load(file)).toBe(2);
    expect(fresh.getStats()).toEqual({ cycles: 2, successful: 2, failed: 0, mutationsKept: 3 });
    expect(await fresh.load(join(dir, 'missing.json'))).toBe(0);
    fresh.close();
  });
});
