import { execSync } from 'node:child_process';
import type { NeuralEventBus } from '../../event-bus/neural-event-bus.js';

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

  private run(args: string): string {
    try {
      return execSync(`git ${args}`, {
        cwd: this.repoPath,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      }).trim();
    } catch {
      return '';
    }
  }

  getStatus(): GitStatusEntry[] {
    const output = this.run('status --porcelain');
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
    const output = this.run(`log --format="%H|%an|%ad|%s" --date=iso --max-count=${count}`);
    if (!output) return [];

    return output.split('\n').filter(Boolean).map((line) => {
      const [hash, author, dateStr, ...msgParts] = line.split('|');
      const filesOutput = this.run(`diff-tree --no-commit-id --name-only -r ${hash ?? ''}`);
      return {
        hash: hash ?? '',
        author: author ?? '',
        message: msgParts.join('|'),
        date: new Date(dateStr ?? ''),
        files: filesOutput ? filesOutput.split('\n').filter(Boolean) : [],
      };
    });
  }

  getDiff(hash?: string): string {
    if (hash) return this.run(`diff ${hash}^..${hash}`);
    return this.run('diff --cached');
  }

  getBranch(): string {
    return this.run('rev-parse --abbrev-ref HEAD');
  }

  getCurrentHash(): string {
    return this.run('rev-parse HEAD');
  }

  isRepo(): boolean {
    try {
      this.run('rev-parse --git-dir');
      return true;
    } catch {
      return false;
    }
  }

  async commit(message: string, author?: string): Promise<GitCommitInfo | null> {
    const authorFlag = author ? ` --author="${author}"` : '';
    this.run(`add -A`);
    this.run(`commit${authorFlag} -m "${message.replace(/"/g, '\\"')}"`);

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
    try {
      this.run(`push ${remote} ${target}`);
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
    try {
      this.run(`pull ${remote} ${target}`);
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
    try {
      this.run(`checkout ${branch}`);
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
