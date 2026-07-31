import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { GitIngester } from '../git/ingester.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-ingest-sec-'));

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(tmpRoot, 'repo-'));
  execSync('git init -q', { cwd: dir });
  execSync('git config user.email test@test.test && git config user.name test', { cwd: dir });
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
  execSync('git add -A && git commit -qm init', { cwd: dir });
  return dir;
}

function makeIngester(repoPath: string): GitIngester {
  const kernel = new CognitiveKernel({ agent_id: 'sec', user_id: 'sec', project_id: 'sec' });
  return new GitIngester({ kernel, repoPath });
}

describe('GitIngester — shell injection hardening', () => {
  let repo: string;
  let marker: string;

  beforeEach(() => {
    repo = makeRepo();
    marker = path.join(tmpRoot, `pwn-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`);
  });

  afterEach(() => {
    fs.rmSync(marker, { force: true });
  });

  it('rejects non-numeric count values without executing them', () => {
    const ingester = makeIngester(repo);
    const payload = `1& echo pwned > ${marker}`;
    const commits = ingester.getRecentCommits(payload as unknown as number);
    expect(commits).toHaveLength(1);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('rejects negative and non-finite counts', () => {
    const ingester = makeIngester(repo);
    expect(ingester.getRecentCommits(-3 as unknown as number)).toHaveLength(1);
    expect(ingester.getRecentCommits(Number.NaN)).toHaveLength(1);
    expect(ingester.getRecentCommits(Number.POSITIVE_INFINITY)).toHaveLength(1);
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('rejects injected hashes in ingestSince without executing them', async () => {
    const ingester = makeIngester(repo);
    const payload = `HEAD& echo pwned > ${marker} & `;
    const result = await ingester.ingestSince(payload as unknown as string);
    expect(result).toEqual({ commits: 0, episodes: 0 });
    expect(fs.existsSync(marker)).toBe(false);
  });

  it('accepts a normal numeric count', () => {
    const ingester = makeIngester(repo);
    expect(ingester.getRecentCommits(1)).toHaveLength(1);
  });
});
