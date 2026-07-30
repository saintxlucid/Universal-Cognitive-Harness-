import { writeSnapshot, readSnapshot } from '../persistence/persistence-engine.js';

export interface DecisionAlternative {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
}

export interface DecisionEntry {
  id: string;
  title: string;
  description: string;
  rationale: string;
  alternatives: DecisionAlternative[];
  outcome: string;
  tags: string[];
  timestamp: Date;
  metadata: Record<string, unknown>;
  traceIds: string[];
}

export interface DecisionLogStats {
  total: number;
  byOutcome: Record<string, number>;
  byTag: Record<string, number>;
  dateRange: { earliest: Date | null; latest: Date | null };
}

export class DecisionLog {
  private entries: DecisionEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  record(entry: Omit<DecisionEntry, 'id' | 'timestamp'>): DecisionEntry {
    const created: DecisionEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    this.entries.push(created);
    if (this.entries.length > this.maxEntries) this.entries.shift();
    return created;
  }

  get(id: string): DecisionEntry | undefined {
    return this.entries.find((e) => e.id === id);
  }

  getAll(limit = 100, offset = 0): DecisionEntry[] {
    return [...this.entries]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  getByTag(tag: string): DecisionEntry[] {
    return this.entries.filter((e) => e.tags.includes(tag))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getByOutcome(outcome: string): DecisionEntry[] {
    return this.entries.filter((e) => e.outcome === outcome)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getByTimeRange(start: Date, end: Date): DecisionEntry[] {
    return this.entries.filter((e) => e.timestamp >= start && e.timestamp <= end)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getByTraceId(traceId: string): DecisionEntry[] {
    return this.entries.filter((e) => e.traceIds.includes(traceId))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getStats(): DecisionLogStats {
    const byOutcome: Record<string, number> = {};
    const byTag: Record<string, number> = {};
    let earliest: Date | null = null;
    let latest: Date | null = null;

    for (const e of this.entries) {
      byOutcome[e.outcome] = (byOutcome[e.outcome] ?? 0) + 1;
      for (const tag of e.tags) {
        byTag[tag] = (byTag[tag] ?? 0) + 1;
      }
      if (!earliest || e.timestamp < earliest) earliest = e.timestamp;
      if (!latest || e.timestamp > latest) latest = e.timestamp;
    }

    return { total: this.entries.length, byOutcome, byTag, dateRange: { earliest, latest } };
  }

  count(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries = [];
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      entries: this.entries,
      maxEntries: this.maxEntries,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      entries: DecisionEntry[];
      maxEntries: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxEntries !== undefined) this.maxEntries = data.maxEntries;
    this.entries = data.entries ?? [];
    return this.entries.length;
  }
}
