import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export type JournalOperation =
  | { type: 'episode:append'; episode_id: string; data: string }
  | { type: 'episode:mark_compressed'; episode_id: string; summary: string }
  | { type: 'episode:prune'; episode_ids: string[] }
  | { type: 'concept:add'; concept_id: string; data: string }
  | { type: 'edge:add'; edge_id: string; data: string }
  | { type: 'edge:invalidate'; edge_id: string; invalid_at: string }
  | { type: 'snapshot:created'; store_version: number }
  | { type: 'consolidation:cycle'; cycle_number: number; promoted: number; pruned: number };

export interface JournalEntry {
  seq: number;
  timestamp: string;
  operation: JournalOperation;
}

export class Journal {
  private path: string;
  private seq = 0;
  private entries: JournalEntry[] = [];

  constructor(basePath: string) {
    this.path = join(basePath, 'journal.ndjson');
  }

  async append(operation: JournalOperation): Promise<JournalEntry> {
    this.seq++;
    const entry: JournalEntry = {
      seq: this.seq,
      timestamp: new Date().toISOString(),
      operation,
    };
    this.entries.push(entry);
    const line = JSON.stringify(entry) + '\n';
    await appendFile(this.path, line, 'utf8');
    return entry;
  }

  async replay(): Promise<JournalEntry[]> {
    if (!existsSync(this.path)) return [];
    const raw = await readFile(this.path, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    const entries: JournalEntry[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line) as JournalEntry;
        entries.push(entry);
        this.seq = Math.max(this.seq, entry.seq);
      } catch {
        continue;
      }
    }
    this.entries = entries;
    return entries;
  }

  async rotate(): Promise<void> {
    const dir = dirname(this.path);
    const archivePath = join(dir, `journal-${Date.now()}.ndjson`);
    if (existsSync(this.path)) {
      await writeFile(archivePath, '');
    }
    this.entries = [];
    this.seq = 0;
    await writeFile(this.path, '', 'utf8');
  }

  getEntries(): JournalEntry[] {
    return [...this.entries];
  }

  getEntryCount(): number {
    return this.entries.length;
  }

  getLastSeq(): number {
    return this.seq;
  }
}

export async function initJournal(basePath: string): Promise<Journal> {
  await mkdir(basePath, { recursive: true });
  const journal = new Journal(basePath);
  await journal.replay();
  return journal;
}
