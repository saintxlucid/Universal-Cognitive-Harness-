import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { LLMClient } from '../llm/provider.js';
import { execFileSync } from 'node:child_process';

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  files: string[];
  type?: string;
  scope?: string;
  breaking?: boolean;
}

export interface IngesterConfig {
  kernel: CognitiveKernel;
  llm?: LLMClient;
  repoPath?: string;
  maxHistory?: number;
}

export class GitIngester {
  private kernel: CognitiveKernel;
  private llm: LLMClient | null;
  private repoPath: string;
  private maxHistory: number;
  private lastIngestedHash: string | null = null;

  constructor(config: IngesterConfig) {
    this.kernel = config.kernel;
    this.llm = config.llm ?? null;
    this.repoPath = config.repoPath ?? process.cwd();
    this.maxHistory = config.maxHistory ?? 100;
  }

  private execGit(args: string[]): string {
    try {
      return execFileSync('git', args, { cwd: this.repoPath, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    } catch {
      return '';
    }
  }

  private sanitizeCount(count: number): number {
    if (typeof count !== 'number' || !Number.isFinite(count)) return this.maxHistory;
    return Math.max(1, Math.min(1000, Math.floor(count)));
  }

  private sanitizeHash(hash: string): string | null {
    if (typeof hash !== 'string' || !/^[0-9a-f]{4,40}$/i.test(hash.trim())) return null;
    return hash.trim();
  }

  parseConventionalCommit(message: string): { type: string; scope?: string; breaking: boolean; description: string } {
    const match = message.match(/^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/);
    if (match) {
      return {
        type: match[1] ?? 'chore',
        scope: match[2],
        breaking: match[3] === '!' || message.toLowerCase().includes('breaking change'),
        description: match[4] ?? message,
      };
    }
    return { type: 'other', breaking: false, description: message };
  }

  getRecentCommits(count = 50): GitCommitInfo[] {
    const n = this.sanitizeCount(count);
    const range = this.lastIngestedHash ? [`HEAD..${this.lastIngestedHash}`] : [];
    const log = this.execGit([
      'log', '--oneline', '--format=%H|%an|%ai|%s', `--max-count=${n}`, ...range,
    ]);
    if (!log.trim()) return [];

    const lines = log.trim().split('\n').filter(Boolean);
    const commits: GitCommitInfo[] = [];

    for (const line of lines) {
      const parts = line.split('|');
      if (parts.length < 4) continue;
      const hash = parts[0] ?? '';
      const author = parts[1] ?? '';
      const date = parts[2] ?? '';
      const message = parts.slice(3).join('|');
      const parsed = this.parseConventionalCommit(message);

      const files = this.execGit(['diff-tree', '--no-commit-id', '--name-only', '-r', hash])
        .trim().split('\n').filter(Boolean);

      commits.push({
        hash,
        author,
        date,
        message,
        files,
        type: parsed.type,
        scope: parsed.scope,
        breaking: parsed.breaking,
      });
    }

    return commits;
  }

  async ingestCommits(commits: GitCommitInfo[]): Promise<number> {
    let count = 0;
    for (const commit of commits) {
      const concepts = [commit.type ?? 'commit', commit.author, ...(commit.scope ? [commit.scope] : [])];

      const episode = await this.kernel.remember({
        content: {
          type: 'observation',
          observation: `[${commit.type ?? 'commit'}${commit.scope ? `(${commit.scope})` : ''}] ${commit.message}`,
        },
        concepts,
        provenance: { source: 'tool_output', reliability: 0.95 },
      });

      this.kernel.addConcept({
        name: `commit:${commit.hash.slice(0, 8)}`,
        concept_type: 'entity',
        definition: commit.message,
        purpose: `Git commit by ${commit.author} on ${commit.date}`,
        importance: commit.breaking ? 0.9 : 0.5,
      });

      for (const file of commit.files.slice(0, 20)) {
        this.kernel.addRelationship({
          source: episode.id,
          target: file,
          relationship: 'modified_file',
          source_episode: episode.id,
          confidence: 1.0,
        });
      }

      count++;
      this.lastIngestedHash = commit.hash;
    }
    return count;
  }

  async ingestRecent(count?: number): Promise<{ commits: number; episodes: number; concepts: number }> {
    const commits = this.getRecentCommits(count ?? this.maxHistory);
    if (commits.length === 0) return { commits: 0, episodes: 0, concepts: 0 };

    const episodes = await this.ingestCommits(commits);

    const stats = this.kernel.getStats();
    return {
      commits: commits.length,
      episodes,
      concepts: stats.concepts,
    };
  }

  async ingestSince(hash: string): Promise<{ commits: number; episodes: number }> {
    const clean = this.sanitizeHash(hash);
    if (!clean) return { commits: 0, episodes: 0 };
    this.lastIngestedHash = clean;
    return this.ingestRecent(500);
  }
}
