import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { parseFrontmatter, skillFromFile, type SkillDefinition } from '../agentic/skills/skills.js';

export interface SkillCatalogEntry {
  name: string;
  description: string;
  license?: string;
  allowedTools?: string[];
  author?: string;
  version?: string;
  domain?: string;
  triggers?: string[];
  role?: string;
  scope?: string;
  outputFormat?: string;
  relatedSkills?: string[];
  filePath: string;
  referenceFiles: string[];
  sizeBytes: number;
}

export interface SkillCatalogSummary {
  sourceDir: string;
  skillCount: number;
  totalSizeBytes: number;
  entries: SkillCatalogEntry[];
  errors: string[];
}

export interface ImportResult {
  installed: string[];
  skipped: string[];
  failed: Array<{ name: string; reason: string }>;
  totalBytes: number;
}

export interface ImportOptions {
  force?: boolean;
  copyReferences?: boolean;
}

export interface ImportIndex {
  version: number;
  skills: Record<
    string,
    {
      sourceRepo: string;
      sourcePath: string;
      installedAt: string;
      files: string[];
      force: boolean;
    }
  >;
}

export const IMPORT_INDEX_FILENAME = '.import-index.json';
const IMPORT_INDEX_VERSION = 1;

function parseNestedFrontmatter(content: string): Record<string, unknown> {
  const { frontmatter } = parseFrontmatter(content);
  const result: Record<string, unknown> = { ...frontmatter };

  const raw = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content)?.[1] ?? '';
  const lines = raw.split('\n');
  let inMetadata = false;
  let currentKey: string | null = null;

  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    const trimmed = line.trim();
    if (indent === 0) {
      inMetadata = trimmed.startsWith('metadata:');
      currentKey = null;
      continue;
    }
    if (!inMetadata || indent === 0) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx <= 0) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key === 'metadata') {
      inMetadata = true;
      currentKey = null;
      continue;
    }
    if (inMetadata) {
      if (currentKey === null) {
        currentKey = key;
        result[`metadata:${currentKey}`] = value === '' ? [] : value;
      } else {
        let bucket: unknown = result[`metadata:${currentKey}`];
        if (!Array.isArray(bucket)) {
          bucket = typeof bucket === 'string' && bucket !== '' ? [bucket] : [];
          result[`metadata:${currentKey}`] = bucket;
        }
        const list = bucket as string[];
        if (trimmed.startsWith('-')) {
          list.push(trimmed.slice(1).trim().replace(/^["']|["']$/g, ''));
        } else {
          list.push(value);
        }
      }
    }
  }

  return result;
}

function toList(value: unknown): string[] | undefined {
  if (value === undefined || value === '') return undefined;
  if (Array.isArray(value)) return value.map((v) => String(v));
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseEntry(filePath: string, content: string): SkillCatalogEntry | null {
  const skill = skillFromFile(filePath, content);
  if (!skill) return null;
  const fm = parseNestedFrontmatter(content);

  const get = (key: string): string | undefined => {
    const v = fm[key];
    return typeof v === 'string' && v ? v : undefined;
  };

  return {
    name: skill.name,
    description: skill.description,
    license: get('license'),
    allowedTools: toList(get('allowed-tools')),
    author: get('author') ?? get('metadata:author'),
    version: get('version') ?? get('metadata:version'),
    domain: get('metadata:domain'),
    triggers: toList(get('metadata:triggers')),
    role: get('metadata:role'),
    scope: get('metadata:scope'),
    outputFormat: get('metadata:output-format'),
    relatedSkills: toList(get('metadata:related-skills')),
    filePath,
    referenceFiles: [],
    sizeBytes: Buffer.byteLength(content, 'utf-8'),
  };
}

export class SkillCatalogScanner {
  async scanDir(dir: string): Promise<SkillCatalogSummary> {
    const errors: string[] = [];
    const entries: SkillCatalogEntry[] = [];
    let totalSizeBytes = 0;

    const skillDirs = await this.findSkillDirs(dir);
    for (const skillDir of skillDirs) {
      const skillFile = path.join(skillDir, 'SKILL.md');
      const content = await fs.readFile(skillFile, 'utf-8').catch(() => null);
      if (content === null) {
        errors.push(`Missing SKILL.md in ${skillDir}`);
        continue;
      }
      const entry = parseEntry(skillFile, content);
      if (!entry) {
        errors.push(`Invalid frontmatter in ${skillFile}`);
        continue;
      }

      const files = await fs.readdir(skillDir, { withFileTypes: true }).catch(() => []);
      for (const file of files) {
        if (!file.isFile()) continue;
        const full = path.join(skillDir, file.name);
        const stat = await fs.stat(full).catch(() => null);
        const size = stat?.size ?? 0;
        totalSizeBytes += size;
        if (file.name !== 'SKILL.md') entry.referenceFiles.push(file.name);
      }
      entries.push(entry);
    }

    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { sourceDir: dir, skillCount: entries.length, totalSizeBytes, entries, errors };
  }

  async findSkill(name: string, dir: string): Promise<string | null> {
    const summary = await this.scanDir(dir);
    const entry = summary.entries.find((e) => e.name === name);
    return entry ? path.dirname(entry.filePath) : null;
  }

  private async findSkillDirs(dir: string): Promise<string[]> {
    const results: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const nested = path.join(dir, entry.name);
      const hasSkill = await fs.access(path.join(nested, 'SKILL.md'), fs.constants.F_OK).then(
        () => true,
        () => false,
      );
      if (hasSkill) {
        results.push(nested);
      } else {
        results.push(...(await this.findSkillDirs(nested)));
      }
    }
    return results;
  }
}

export class SkillImporter {
  private scanner: SkillCatalogScanner;

  constructor() {
    this.scanner = new SkillCatalogScanner();
  }

  async importFromDir(
    sourceDir: string,
    targetDir: string,
    skillNames: string[],
    options: ImportOptions = {},
  ): Promise<ImportResult> {
    const result: ImportResult = { installed: [], skipped: [], failed: [], totalBytes: 0 };
    const summary = await this.scanner.scanDir(sourceDir);

    for (const name of skillNames) {
      const entry = summary.entries.find((e) => e.name === name);
      if (!entry) {
        result.failed.push({ name, reason: 'not found in source catalog' });
        continue;
      }

      const targetSkillDir = path.join(targetDir, name);
      const exists = await fs.access(targetSkillDir, fs.constants.F_OK).then(
        () => true,
        () => false,
      );

      if (exists && !options.force) {
        result.skipped.push(name);
        continue;
      }

      try {
        await fs.rm(targetSkillDir, { recursive: true, force: true });
        await fs.cp(path.dirname(entry.filePath), targetSkillDir, {
          recursive: true,
          filter: (src) => !path.basename(src).startsWith('.'),
        });
        result.installed.push(name);
        result.totalBytes += entry.sizeBytes;
      } catch (error) {
        result.failed.push({
          name,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await this.recordImport(sourceDir, targetDir, result.installed, options.force ?? false);
    return result;
  }

  private async recordImport(
    sourceDir: string,
    targetDir: string,
    installed: string[],
    force: boolean,
  ): Promise<void> {
    if (installed.length === 0) return;
    const indexPath = path.join(targetDir, IMPORT_INDEX_FILENAME);
    const existing = await fs.readFile(indexPath, 'utf-8').then(
      (raw) => JSON.parse(raw.replace(/^\uFEFF/, '')) as ImportIndex,
      () => null,
    );
    const index: ImportIndex = existing ?? { version: IMPORT_INDEX_VERSION, skills: {} };
    index.version = IMPORT_INDEX_VERSION;

    for (const name of installed) {
      const skillDir = path.join(targetDir, name);
      const files = await fs.readdir(skillDir, { recursive: true }).catch(() => []);
      index.skills[name] = {
        sourceRepo: path.basename(path.resolve(sourceDir)),
        sourcePath: path.resolve(sourceDir),
        installedAt: new Date().toISOString(),
        files: files.map((f) => f.replace(/\\/g, '/')),
        force,
      };
    }

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  }
}

export async function loadImportIndex(targetDir: string): Promise<ImportIndex | null> {
  const indexPath = path.join(targetDir, IMPORT_INDEX_FILENAME);
  const raw = await fs.readFile(indexPath, 'utf-8').catch(() => null);
  if (raw === null) return null;
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, '')) as ImportIndex;
  } catch {
    return null;
  }
}

export function renderSkillCatalogTable(summary: SkillCatalogSummary): string {
  const header = `${summary.skillCount} skills in ${summary.sourceDir} (${(summary.totalSizeBytes / 1024).toFixed(0)} KB)\n`;
  const rows = summary.entries.map((e) => {
    const domain = e.domain ? ` [${e.domain}]` : '';
    const refs = e.referenceFiles.length > 0 ? ` refs:${e.referenceFiles.length}` : '';
    const related = e.relatedSkills ? ` related:${e.relatedSkills.join(',')}` : '';
    return `  ${e.name.padEnd(26)} ${(e.description.length > 70 ? e.description.slice(0, 67) + '...' : e.description)}${domain}${refs}${related}`;
  });
  const errors = summary.errors.length > 0 ? `\nWARNINGS:\n${summary.errors.map((e) => `  - ${e}`).join('\n')}` : '';
  return header + rows.join('\n') + errors;
}

export type { SkillDefinition };
