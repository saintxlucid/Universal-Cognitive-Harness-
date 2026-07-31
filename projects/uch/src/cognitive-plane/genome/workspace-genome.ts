import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';
import { SpeciesGenome } from './species-genome.js';
import { AdaptiveGenome } from './adaptive-genome.js';

export type GenomeSection =
  | 'mission' | 'vision' | 'architecture' | 'principles'
  | 'tech-stack' | 'design-philosophy' | 'patterns'
  | 'coding-standards' | 'naming-conventions' | 'security-model'
  | 'performance-goals' | 'business-rules' | 'team-roles'
  | 'release-strategy' | 'risk-profile' | 'domain-model';

export interface GenomeEntry {
  id: string;
  section: GenomeSection;
  key: string;
  value: string;
  tags: string[];
  provenance: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface WorkspaceGenomeConfig {
  workspaceId: string;
  projectName: string;
  description: string;
}

export class WorkspaceGenome {
  private entries: Map<string, GenomeEntry> = new Map();
  private config: WorkspaceGenomeConfig;
  private readonly builtinKeys: Set<string> = new Set();
  private readonly species: SpeciesGenome;
  private readonly adaptive: AdaptiveGenome;

  constructor(config: WorkspaceGenomeConfig, species?: SpeciesGenome, adaptive?: AdaptiveGenome) {
    this.config = config;
    this.species = species ?? new SpeciesGenome();
    this.adaptive = adaptive ?? new AdaptiveGenome();
    this.initializeBuiltinSections();
  }

  getSpecies(): SpeciesGenome { return this.species; }
  getAdaptive(): AdaptiveGenome { return this.adaptive; }

  get workspaceId(): string { return this.config.workspaceId; }
  get projectName(): string { return this.config.projectName; }

  set(key: string, section: GenomeSection, value: string, opts?: { tags?: string[]; provenance?: string }): GenomeEntry {
    const existing = this.getByKey(key);
    if (existing) {
      existing.value = value;
      existing.updatedAt = new Date();
      existing.version++;
      if (opts?.tags) existing.tags = [...new Set([...existing.tags, ...opts.tags])];
      if (opts?.provenance) existing.provenance = opts.provenance;
      return existing;
    }

    const entry: GenomeEntry = {
      id: crypto.randomUUID(),
      section, key, value,
      tags: opts?.tags ?? [],
      provenance: opts?.provenance ?? 'manual',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    };
    this.entries.set(entry.id, entry);
    return entry;
  }

  getByKey(key: string): GenomeEntry | undefined {
    return [...this.entries.values()].find((e) => e.key === key);
  }

  getBySection(section: GenomeSection): GenomeEntry[] {
    return [...this.entries.values()].filter((e) => e.section === section);
  }

  get(id: string): GenomeEntry | undefined {
    return this.entries.get(id);
  }

  getAll(): GenomeEntry[] {
    return [...this.entries.values()];
  }

  delete(key: string): boolean {
    const entry = this.getByKey(key);
    if (!entry || this.builtinKeys.has(key)) return false;
    return this.entries.delete(entry.id);
  }

  clone(): WorkspaceGenome {
    const clone = new WorkspaceGenome({ ...this.config });
    for (const [, entry] of this.entries) {
      const newEntry: GenomeEntry = { ...entry, id: crypto.randomUUID(), createdAt: new Date(), updatedAt: new Date() };
      clone.entries.set(newEntry.id, newEntry);
      if (this.builtinKeys.has(entry.key)) clone.builtinKeys.add(entry.key);
    }
    return clone;
  }

  export(): object {
    return {
      config: this.config,
      entries: [...this.entries.values()].map((e) => ({
        section: e.section, key: e.key, value: e.value,
        tags: e.tags, provenance: e.provenance, version: e.version,
      })),
    };
  }

  getStats(): { totalEntries: number; bySection: Record<string, number>; builtinCount: number } {
    const bySection: Record<string, number> = {};
    for (const [, e] of this.entries) {
      bySection[e.section] = (bySection[e.section] ?? 0) + 1;
    }
    return { totalEntries: this.entries.size, bySection, builtinCount: this.builtinKeys.size };
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      config: this.config,
      entries: mapToRecord(this.entries),
      builtinKeys: [...this.builtinKeys],
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      config: WorkspaceGenomeConfig;
      entries: Record<string, GenomeEntry>;
      builtinKeys: string[];
    }>(filePath);
    if (!data) return 0;

    if (data.config) this.config = data.config;
    this.entries = recordToMap(data.entries ?? {});
    this.builtinKeys.clear();
    if (data.builtinKeys) {
      for (const key of data.builtinKeys) this.builtinKeys.add(key);
    }
    return this.entries.size;
  }

  private initializeBuiltinSections(): void {
    const builtins: Array<{ key: string; section: GenomeSection; value: string }> = [
      { key: 'project-mission', section: 'mission', value: this.config.description },
      { key: 'project-vision', section: 'vision', value: '' },
      { key: 'architecture-style', section: 'architecture', value: 'microservices' },
      { key: 'core-principles', section: 'principles', value: 'simplicity, correctness, performance' },
      { key: 'primary-language', section: 'tech-stack', value: 'TypeScript' },
      { key: 'design-philosophy', section: 'design-philosophy', value: 'pragmatic minimalism' },
      { key: 'coding-standards', section: 'coding-standards', value: 'strict typing, no any, exhaustive error handling' },
      { key: 'naming-convention', section: 'naming-conventions', value: 'camelCase for functions/variables, PascalCase for classes/types' },
      { key: 'security-model', section: 'security-model', value: 'least privilege, defense in depth' },
      { key: 'release-strategy', section: 'release-strategy', value: 'continuous delivery with semantic versioning' },
    ];

    for (const b of builtins) {
      const entry = this.set(b.key, b.section, b.value, { provenance: 'genome-builtin' });
      this.builtinKeys.add(entry.key);
    }
  }
}
