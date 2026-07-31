import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentMiddleware, MiddlewareContext } from './types.js';

export interface SkillSource {
  path: string;
  displayName?: string;
}

export interface SkillFileEntry {
  source: string;
  name: string;
  description: string;
  body: string;
  loadedAt: string;
}

export function parseSkillFrontmatter(raw: string): { name: string; description: string; body: string } | null {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    return { name: 'unnamed', description: '', body: raw };
  }
  const [, frontmatter = '', body = ''] = match;
  const nameMatch = /^name:\s*(.+)$/m.exec(frontmatter);
  const descMatch = /^description:\s*(.+)$/m.exec(frontmatter);
  return {
    name: nameMatch?.[1]?.trim() ?? 'unnamed',
    description: descMatch?.[1]?.trim() ?? '',
    body: body.trim(),
  };
}

export async function loadSkillFile(filePath: string, rootDir: string): Promise<SkillFileEntry | null> {
  const relative = filePath.replace(/^[\\/]+/, '');
  const resolved = path.resolve(rootDir, relative);
  const rootResolved = path.resolve(rootDir);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    return null;
  }
  try {
    const raw = await fs.readFile(resolved, 'utf-8');
    const parsed = parseSkillFrontmatter(raw);
    if (!parsed) return null;
    return {
      source: filePath,
      name: parsed.name,
      description: parsed.description,
      body: parsed.body,
      loadedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export class SkillsMiddleware implements AgentMiddleware {
  readonly name = 'SkillsMiddleware';
  private entries: SkillFileEntry[] = [];

  constructor(
    private readonly sources: SkillSource[] | string[],
    private readonly rootDir: string = process.cwd(),
  ) {}

  async load(): Promise<SkillFileEntry[]> {
    const sources = this.sources.map((source) => (typeof source === 'string' ? { path: source } : source));
    const loaded: SkillFileEntry[] = [];
    for (const source of sources) {
      const entry = await loadSkillFile(source.path, this.rootDir);
      if (entry) {
        if (source.displayName) entry.name = source.displayName;
        loaded.push(entry);
      }
    }
    const byName = new Map<string, SkillFileEntry>();
    for (const entry of loaded) {
      byName.set(entry.name, entry);
    }
    this.entries = [...byName.values()];
    return [...this.entries];
  }

  get loadedSkills(): SkillFileEntry[] {
    return [...this.entries];
  }

  async systemPrompt(current: string, _context: MiddlewareContext): Promise<string> {
    if (this.entries.length === 0) return current;
    const sections = this.entries.map((entry) => {
      const header = `### Skill: ${entry.name}`;
      const description = entry.description ? `\n\n${entry.description}` : '';
      return `${header}${description}\n\n${entry.body}`;
    });
    return `${current}\n\n## Available Skills\n\n${sections.join('\n\n')}`;
  }
}
