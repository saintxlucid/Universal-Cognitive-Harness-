import { execFileSync } from 'node:child_process';
import type { NeuralEventBus } from '../../event-bus/neural-event-bus.js';

const REF_TOKEN = /^[A-Za-z0-9._/-]+$/;
const HASH_REV = /^[0-9a-f]{4,40}$/i;

function hasControlChars(value: string): boolean {
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

function sanitizeCount(count: number): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) return 10;
  return Math.max(1, Math.min(1000, Math.floor(count)));
}

function isValidRef(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && REF_TOKEN.test(value)
    && !hasControlChars(value);
}

function isValidHash(value: unknown): value is string {
  return typeof value === 'string' && HASH_REV.test(value.trim());
}

function isSafeAuthor(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 200
    && !hasControlChars(value)
    && !/[;&|`$<>"']/.test(value);
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  message: string;
  date: Date;
  files: string[];
}

export interface GitStatusEntry {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
}

export interface GitDriverConfig {
  repoPath?: string;
}

export class GitDriver {
  private eventBus: NeuralEventBus;
  private repoPath: string;

  constructor(eventBus: NeuralEventBus, config?: GitDriverConfig) {
    this.eventBus = eventBus;
    this.repoPath = config?.repoPath ?? '.';
  }

  private run(args: string[]): string {
    try {
      return execFileSync('git', args, {
        cwd: this.repoPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }).trim();
    } catch {
      return '';
    }
  }

  getStatus(): GitStatusEntry[] {
    const output = this.run(['status', '--porcelain']);
    if (!output) return [];

    return output.split('\n').filter(Boolean).map((line) => {
      const status = line.slice(0, 2).trim();
      const filePath = line.slice(3).trim();
      let mapped: GitStatusEntry['status'] = 'modified';
      if (status === '??') mapped = 'untracked';
      else if (status === 'A') mapped = 'added';
      else if (status === 'D') mapped = 'deleted';
      else if (status === 'R') mapped = 'renamed';
      return { path: filePath, status: mapped };
    });
  }

  getRecentCommits(count = 10): GitCommitInfo[] {
    const n = sanitizeCount(count);
    const output = this.run(['log', '--format=%H|%an|%ad|%s', '--date=iso', `--max-count=${n}`]);
    if (!output) return [];

    return output.split('\n').filter(Boolean).map((line) => {
      const [hash, author, dateStr, ...msgParts] = line.split('|');
      const hashClean = hash ?? '';
      const files = isValidHash(hashClean)
        ? this.run(['diff-tree', '--no-commit-id', '--name-only', '-r', hashClean])
        : '';
      return {
        hash: hashClean,
        author: author ?? '',
        message: msgParts.join('|'),
        date: new Date(dateStr ?? ''),
        files: files ? files.split('\n').filter(Boolean) : [],
      };
    });
  }

  getDiff(hash?: string): string {
    if (hash) {
      if (!isValidRef(hash)) return '';
      return this.run(['diff', `${hash}^..${hash}`]);
    }
    return this.run(['diff', '--cached']);
  }

  getBranch(): string {
    return this.run(['rev-parse', '--abbrev-ref', 'HEAD']);
  }

  getCurrentHash(): string {
    return this.run(['rev-parse', 'HEAD']);
  }

  isRepo(): boolean {
    try {
      this.run(['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  async commit(message: string, author?: string): Promise<GitCommitInfo | null> {
    const args = ['commit', '-m', message];
    if (author !== undefined && isSafeAuthor(author)) {
      args.push('--author', author);
    }
    this.run(['add', '-A']);
    this.run(args);

    const hash = this.getCurrentHash();
    if (!hash) return null;

    const info = this.getRecentCommits(1)[0] ?? null;

    this.eventBus.publish({
      type: 'git:commit',
      source: 'git-driver',
      payload: { message, hash, author, branch: this.getBranch() },
    });

    return info;
  }

  async push(remote = 'origin', branch?: string): Promise<boolean> {
    const target = branch ?? this.getBranch();
    if (!isValidRef(remote) || !isValidRef(target)) return false;
    try {
      this.run(['push', remote, target]);
      this.eventBus.publish({
        type: 'git:push',
        source: 'git-driver',
        payload: { remote, branch: target },
      });
      return true;
    } catch {
      return false;
    }
  }

  async pull(remote = 'origin', branch?: string): Promise<boolean> {
    const target = branch ?? this.getBranch();
    if (!isValidRef(remote) || !isValidRef(target)) return false;
    try {
      this.run(['pull', remote, target]);
      this.eventBus.publish({
        type: 'git:pull',
        source: 'git-driver',
        payload: { remote, branch: target },
      });
      return true;
    } catch {
      return false;
    }
  }

  async checkout(branch: string): Promise<boolean> {
    if (!isValidRef(branch)) return false;
    try {
      this.run(['checkout', branch]);
      this.eventBus.publish({
        type: 'git:branch_changed',
        source: 'git-driver',
        payload: { branch },
      });
      return true;
    } catch {
      return false;
    }
  }
}
