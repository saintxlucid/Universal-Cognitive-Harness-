import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { composeDriver } from '../compose.js';
import { GitDriver } from '../git/git-driver.js';
import { GitSensor } from '../sensors/git-sensor.js';
import { SessionSensor } from '../sensors/session-sensor.js';
import { MemoryEffector } from '../effectors/memory-effector.js';
import type { Sensor, SensorObservation } from '../sensors/sensor.js';
import type { Effector } from '../effectors/effector.js';

const ORIGINAL_ENV = {
  GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME,
  GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL,
  GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME,
  GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function createTempDir(prefix: string): string {
  const dir = path.join(os.tmpdir(), `uch-sensor-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe('composeDriver', () => {
  it('starts sensors and drains initial observations through onObservation', async () => {
    const observed: SensorObservation[] = [];
    const sensor: Sensor = {
      id: 'test-sensor',
      surfaces: ['test'],
      observe: () => [{ source: 'test-sensor', type: 'test.observation', payload: { n: 1 }, timestamp: new Date() }],
    };
    const driver = composeDriver({
      id: 'composed',
      name: 'Composed Test Driver',
      sensors: [sensor],
      onObservation: (obs) => observed.push(obs),
    });

    await driver.start();
    expect(observed).toHaveLength(1);
    expect(observed[0]!.type).toBe('test.observation');
    await driver.stop();
  });

  it('routes events only to effectors that declare the event type', async () => {
    const calls: string[] = [];
    const effector: Effector = {
      id: 'e1',
      reactsTo: ['test:failed'],
      apply: () => {
        calls.push('e1');
        return [];
      },
    };
    const other: Effector = {
      id: 'e2',
      reactsTo: ['unrelated'],
      apply: () => {
        calls.push('e2');
        return [];
      },
    };
    const driver = composeDriver({ id: 'routed', name: 'Routed', effectors: [effector, other] });

    await driver.handleEvent!({ type: 'test:failed', source: 'runner' });
    expect(calls).toEqual(['e1']);
  });

  it('isolates effector failures so one broken effector does not block the rest', async () => {
    const calls: string[] = [];
    const broken: Effector = {
      id: 'broken',
      reactsTo: ['x'],
      apply: () => {
        throw new Error('boom');
      },
    };
    const healthy: Effector = {
      id: 'healthy',
      reactsTo: ['x'],
      apply: () => {
        calls.push('healthy');
        return [];
      },
    };
    const driver = composeDriver({ id: 'isolated', name: 'Isolated', effectors: [broken, healthy] });

    await expect(driver.handleEvent!({ type: 'x', source: 's' })).resolves.toBeUndefined();
    expect(calls).toEqual(['healthy']);
  });

  it('routes effector follow-ups through onObservation', async () => {
    const observed: SensorObservation[] = [];
    const effector: Effector = {
      id: 'memory-effector',
      reactsTo: ['test:failed'],
      apply: () => [{ type: 'memory.suggested', source: 'memory-effector', payload: { note: 'fix' } }],
    };
    const driver = composeDriver({
      id: 'followups',
      name: 'FollowUps',
      effectors: [effector],
      onObservation: (obs) => observed.push(obs),
    });

    await driver.handleEvent!({ type: 'test:failed', source: 'runner', payload: { error: 'timeout' } });
    expect(observed).toHaveLength(1);
    expect(observed[0]!.type).toBe('memory.suggested');
    expect(observed[0]!.source).toBe('memory-effector');
  });
});

describe('SessionSensor', () => {
  it('emits a lifecycle observation only when the session status changes', () => {
    let status: 'active' | 'idle' | 'ended' = 'active';
    const sensor = new SessionSensor(() => ({ status, session_id: 's1', host: 'claude' }));

    const first = sensor.observe();
    expect(first).toHaveLength(1);
    expect(first[0]!.type).toBe('session.lifecycle');
    expect(first[0]!.payload).toMatchObject({ status: 'active', session_id: 's1', host: 'claude', transitioned_from: null });

    expect(sensor.observe()).toHaveLength(0);

    status = 'ended';
    const changed = sensor.observe();
    expect(changed).toHaveLength(1);
    expect(changed[0]!.payload).toMatchObject({ status: 'ended', transitioned_from: 'active' });
  });
});

describe('GitSensor', () => {
  it('observes the git state of a real working tree', async () => {
    const repo = createTempDir('git');
    try {
      execFileSync('git', ['init', '-q'], { cwd: repo });
      execFileSync('git', ['config', 'user.email', 'uch@test.dev'], { cwd: repo });
      execFileSync('git', ['config', 'user.name', 'UCH Test'], { cwd: repo });
      fs.writeFileSync(path.join(repo, 'a.txt'), 'hello');

      const sensor = new GitSensor({ repoPath: repo });
      const dirty = sensor.observe();
      expect(dirty).toHaveLength(1);
      expect(dirty[0]!.payload!.change_count).toBe(1);
      expect(dirty[0]!.payload!.changes).toEqual(['untracked:a.txt']);

      const git = new GitDriver(undefined, { repoPath: repo });
      await git.commit('init');
      const clean = sensor.observe();
      const payload = clean[0]!.payload!;
      expect(clean[0]!.type).toBe('git.state');
      expect(['master', 'main']).toContain(payload.branch);
      expect(payload.change_count).toBe(0);
      expect(payload.changes).toEqual([]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});

describe('MemoryEffector', () => {
  it('suggests a memory entry from a failure signal', async () => {
    const effector = new MemoryEffector();
    const followUps = await effector.apply({
      type: 'test:failed',
      source: 'vitest',
      payload: { error: 'timeout in cache.test' },
    });

    expect(followUps).toHaveLength(1);
    expect(followUps[0]!.type).toBe('memory.suggested');
    expect(followUps[0]!.payload!.suggestion).toBe('failure signal from vitest: timeout in cache.test');
  });
});
