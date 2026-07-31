import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { skillFromFile, type SkillDefinition } from '../agentic/skills/skills.js';
import type { SkillRegistry, SkillDefinition as RegistrySkillDefinition } from '../cognitive-memory/skill-registry.js';

export interface SkillPackSummary {
  packName: string;
  sourceDir: string;
  skillCount: number;
  skills: string[];
  invalidFiles: number;
}

export interface ScanOptions {
  recursive?: boolean;
  includeDisabled?: boolean;
}

const DEFAULT_SCAN_OPTIONS: Required<ScanOptions> = {
  recursive: true,
  includeDisabled: false,
};

export class SkillPackScanner {
  async scanDir(dir: string, options: ScanOptions = {}): Promise<SkillPackSummary> {
    const opts = { ...DEFAULT_SCAN_OPTIONS, ...options };
    const skillFiles = await this.findSkillFiles(dir, opts.recursive);
    const skills: SkillDefinition[] = [];
    let invalidFiles = 0;

    for (const file of skillFiles) {
      const content = await fs.readFile(file, 'utf8').catch(() => null);
      if (content === null) {
        invalidFiles += 1;
        continue;
      }
      const skill = skillFromFile(file, content);
      if (!skill) {
        invalidFiles += 1;
        continue;
      }
      if (skill.disabled && !opts.includeDisabled) continue;
      skills.push(skill);
    }

    skills.sort((a, b) => a.name.localeCompare(b.name));
    return {
      packName: path.basename(path.resolve(dir)),
      sourceDir: dir,
      skillCount: skills.length,
      skills: skills.map((s) => s.name),
      invalidFiles,
    };
  }

  private async findSkillFiles(dir: string, recursive: boolean): Promise<string[]> {
    const results: string[] = [];
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!recursive || entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const nested = await this.findSkillFiles(path.join(dir, entry.name), recursive);
        results.push(...nested);
      } else if (entry.isFile() && entry.name === 'SKILL.md') {
        results.push(path.join(dir, entry.name));
      }
    }
    return results;
  }
}

export class SkillPackInstaller {
  private registry: SkillRegistry;
  private scanner: SkillPackScanner;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
    this.scanner = new SkillPackScanner();
  }

  async installFromDir(
    dir: string,
    options: ScanOptions & { sourcePrefix?: string } = {},
  ): Promise<{ installed: string[]; skipped: string[] }> {
    const summary = await this.scanner.scanDir(dir, options);
    const installed: string[] = [];
    const skipped: string[] = [];

    for (const skill of summary.skills) {
      const id = skill;
      const existing = this.registry.getById(id);
      if (existing && existing.enabled) {
        skipped.push(id);
        continue;
      }
      this.registry.register(this.toRegistrySkill(id, dir, options.sourcePrefix));
      installed.push(id);
    }
    return { installed, skipped };
  }

  private toRegistrySkill(name: string, sourceDir: string, sourcePrefix?: string): RegistrySkillDefinition {
    const source = sourcePrefix ? `${sourcePrefix}/${name}` : sourceDir;
    return {
      id: name,
      name,
      description: name,
      trigger_patterns: [name.replace(/-/g, ' ')],
      location: path.join(sourceDir, name, 'SKILL.md'),
      enabled: true,
      version: '1.0.0',
      metadata: { source, origin: 'skillpack' },
    };
  }
}
