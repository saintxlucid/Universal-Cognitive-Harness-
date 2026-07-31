import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentMiddleware, MiddlewareContext } from './types.js';

export interface MemorySource {
  path: string;
  displayName?: string;
}

export interface MemoryFileEntry {
  source: string;
  displayName: string;
  content: string;
  loadedAt: string;
}

export async function loadMemoryFile(filePath: string, rootDir: string): Promise<MemoryFileEntry | null> {
  const relative = filePath.replace(/^[\\/]+/, '');
  const resolved = path.resolve(rootDir, relative);
  const rootResolved = path.resolve(rootDir);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    return null;
  }
  try {
    const content = await fs.readFile(resolved, 'utf-8');
    return {
      source: filePath,
      displayName: filePath.split('/').filter(Boolean).at(-1) ?? filePath,
      content,
      loadedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export class MemoryMiddleware implements AgentMiddleware {
  readonly name = 'MemoryMiddleware';
  private entries: MemoryFileEntry[] = [];

  constructor(
    private readonly sources: MemorySource[] | string[],
    private readonly rootDir: string = process.cwd(),
  ) {}

  async load(): Promise<MemoryFileEntry[]> {
    const sources = this.sources.map((source) =>
      typeof source === 'string' ? { path: source } : source,
    );
    this.entries = [];
    for (const source of sources) {
      const entry = await loadMemoryFile(source.path, this.rootDir);
      if (entry && source.displayName) entry.displayName = source.displayName;
      if (entry) this.entries.push(entry);
    }
    return [...this.entries];
  }

  get loadedEntries(): MemoryFileEntry[] {
    return [...this.entries];
  }

  async systemPrompt(current: string, _context: MiddlewareContext): Promise<string> {
    if (this.entries.length === 0) return current;
    const sections = this.entries.map((entry) => `### ${entry.displayName}\n\n${entry.content.trim()}`);
    return `${current}\n\n## Project Memory\n\n${sections.join('\n\n')}`;
  }
}
