import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { GitDriver } from '../git-driver.js';
import type { NeuralEventBus } from '../../event-bus/neural-event-bus.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-gitdrv-sec-'));

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'repo-'));
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email test@test.test && git config user.name test', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  execSync('git add -A && git commit -qm init', { cwd: dir });
  return dir;
}

function makeDriver(repoPath: string): GitDriver {
  const mockPublish = (() => {}) as unknown as NeuralEventBus['publish'];
  const bus = { publish: mockPublish } as unknown as NeuralEventBus;
  return new GitDriver(bus, { repoPath });
}

describe('GitDriver — shell injection hardening (BUGC-001)', () => {
  let repo: string;
  let marker: string;

  beforeEach(() => {
    repo = makeRepo();
    marker = path.join(tmpRoot, `pwn-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  });

  afterEach(() => {
    fs.rmSync(marker, { force: true });
  });

  it('does not execute injected hashes in getDiff', () => {
    const driver = makeDriver(repo);
    const payload = 'HEAD; echo pwned > ' + marker.replace(/\\/g, '/');
    const out = driver.getDiff(payload);
    expect(out).toBe('');
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('does not execute injected counts in getRecentCommits', () => {
    const driver = makeDriver(repo);
    const payload = '1& echo pwned > ' + marker.replace(/\\/g, '/');
    const commits = driver.getRecentCommits(payload as unknown as number);
    expect(commits.length).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('commits messages containing shell metacharacters as plain args', async () => {
    const driver = makeDriver(repo);
    fs.writeFileSync(path.join(repo, 'b.txt'), 'b');
    const info = await driver.commit(`feat: pwned; echo pwned > ${marker.replace(/\\/g, '/')} & whoami`);
    expect(info).not.toBeNull();
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('rejects injected author flags', async () => {
    const driver = makeDriver(repo);
    fs.writeFileSync(path.join(repo, 'c.txt'), 'c');
    const info = await driver.commit('feat: author test', `A U Thor; echo pwned > ${marker.replace(/\\/g, '/')}`);
    expect(info).not.toBeNull();
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('rejects injected branches in checkout/push/pull', async () => {
    const driver = makeDriver(repo);
    const payload = `main; echo pwned > ${marker.replace(/\\/g, '/')}`;
    expect(await driver.checkout(payload)).toBe(false);
    expect(await driver.push('origin', payload)).toBe(false);
    expect(await driver.pull('origin', payload)).toBe(false);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('keeps normal operations working', async () => {
    const driver = makeDriver(repo);
    fs.writeFileSync(path.join(repo, 'second.txt'), 'second');
    execSync('git add -A && git commit -qm second', { cwd: repo });
    expect(driver.getBranch()).toBe('master');
    expect(driver.getCurrentHash().length).toBeGreaterThanOrEqual(7);
    expect(driver.getDiff('HEAD')).not.toBe('');
    expect(driver.getRecentCommits(1).length).toBe(1);
  });
});
