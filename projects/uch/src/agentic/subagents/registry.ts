import { promises as fs } from 'node:fs';
import path from 'node:path';

export type SubagentStatus = 'running' | 'completed' | 'failed' | 'expired' | 'orphaned';

export interface SubagentRecord {
  id: string;
  name: string;
  parentId: string | null;
  depth: number;
  status: SubagentStatus;
  prompt: string;
  model: string | null;
  createdAt: string;
  updatedAt: string;
  result: string | null;
  error: string | null;
  expiresAt: string | null;
}

export interface SubagentSpawnOptions {
  name: string;
  prompt: string;
  parentId?: string;
  model?: string;
  maxDepth?: number;
  ttlMs?: number;
  runner: (request: { prompt: string; model?: string; parentId?: string }) => Promise<string>;
}

export interface SubagentRegistryOptions {
  persistPath?: string;
  defaultMaxDepth?: number;
  defaultTtlMs?: number;
}

export interface RegistrySnapshot {
  records: SubagentRecord[];
  pendingAnnouncements: string[];
  retries: RetryRecord[];
}

export interface RetryRecord {
  recordId: string;
  attempts: number;
  nextRetryAt: string;
  lastError: string;
}

export function createSubagentId(): string {
  return `sub-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class SubagentRegistry {
  private records = new Map<string, SubagentRecord>();
  private pendingAnnouncements: string[] = [];
  private retries: RetryRecord[] = [];
  private readonly options: Required<Pick<SubagentRegistryOptions, 'defaultMaxDepth' | 'defaultTtlMs'>> & Pick<SubagentRegistryOptions, 'persistPath'>;

  constructor(options: SubagentRegistryOptions = {}) {
    this.options = {
      defaultMaxDepth: options.defaultMaxDepth ?? 4,
      defaultTtlMs: options.defaultTtlMs ?? 24 * 60 * 60 * 1000,
      persistPath: options.persistPath,
    };
  }

  async spawn(options: SubagentSpawnOptions): Promise<SubagentRecord> {
    const parent = options.parentId ? this.records.get(options.parentId) : null;
    if (parent && parent.depth >= this.options.defaultMaxDepth) {
      throw new Error(`Subagent depth limit exceeded (${this.options.defaultMaxDepth})`);
    }
    const depth = (parent?.depth ?? 0) + 1;
    const now = new Date().toISOString();
    const record: SubagentRecord = {
      id: createSubagentId(),
      name: options.name,
      parentId: options.parentId ?? null,
      depth,
      status: 'running',
      prompt: options.prompt,
      model: options.model ?? null,
      createdAt: now,
      updatedAt: now,
      result: null,
      error: null,
      expiresAt: options.ttlMs ? new Date(Date.now() + options.ttlMs).toISOString() : null,
    };
    this.records.set(record.id, record);
    const snapshot = { ...record };
    void this.executeSpawn(record, options);
    await this.persist();
    return snapshot;
  }

  private async executeSpawn(record: SubagentRecord, options: SubagentSpawnOptions): Promise<void> {
    try {
      const result = await options.runner({ prompt: options.prompt, model: options.model, parentId: options.parentId });
      this.complete(record.id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.fail(record.id, message);
      this.scheduleRetry(record, message);
    }
  }

  private scheduleRetry(record: SubagentRecord, error: string): void {
    const existing = this.retries.find((r) => r.recordId === record.id);
    if (existing) {
      existing.attempts++;
      existing.lastError = error;
      existing.nextRetryAt = new Date(Date.now() + Math.min(60_000, 1_000 * Math.pow(2, existing.attempts))).toISOString();
      return;
    }
    this.retries.push({
      recordId: record.id,
      attempts: 1,
      nextRetryAt: new Date(Date.now() + 1_000).toISOString(),
      lastError: error,
    });
  }

  complete(id: string, result: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.status = 'completed';
    record.result = result;
    record.updatedAt = new Date().toISOString();
    this.retries = this.retries.filter((r) => r.recordId !== id);
    this.pendingAnnouncements.push(id);
    void this.persist();
    return true;
  }

  fail(id: string, error: string): boolean {
    const record = this.records.get(id);
    if (!record) return false;
    record.status = 'failed';
    record.error = error;
    record.updatedAt = new Date().toISOString();
    void this.persist();
    return true;
  }

  get(id: string): SubagentRecord | null {
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  list(filter?: { status?: SubagentStatus; parentId?: string }): SubagentRecord[] {
    return [...this.records.values()]
      .filter((record) => {
        if (filter?.status && record.status !== filter.status) return false;
        if (filter?.parentId !== undefined && record.parentId !== filter.parentId) return false;
        return true;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((record) => ({ ...record }));
  }

  async reconcileOrphans(activeIds: string[] | (() => Promise<string[]>)): Promise<SubagentRecord[]> {
    const ids = typeof activeIds === 'function' ? await activeIds() : activeIds;
    const active = new Set(ids);
    const orphans: SubagentRecord[] = [];
    for (const record of this.records.values()) {
      if (record.status === 'running' && !active.has(record.id)) {
        record.status = 'orphaned';
        record.updatedAt = new Date().toISOString();
        orphans.push({ ...record });
      }
    }
    await this.persist();
    return orphans;
  }

  async expireStale(now = Date.now()): Promise<SubagentRecord[]> {
    const expired: SubagentRecord[] = [];
    for (const record of this.records.values()) {
      if (record.status === 'running' && record.expiresAt && new Date(record.expiresAt).getTime() < now) {
        record.status = 'expired';
        record.updatedAt = new Date(now).toISOString();
        expired.push({ ...record });
      }
    }
    await this.persist();
    return expired;
  }

  drainAnnouncements(): string[] {
    const drained = [...this.pendingAnnouncements];
    this.pendingAnnouncements = [];
    return drained;
  }

  retriesDue(now = Date.now()): RetryRecord[] {
    return this.retries.filter((retry) => new Date(retry.nextRetryAt).getTime() <= now);
  }

  snapshot(): RegistrySnapshot {
    return {
      records: [...this.records.values()].map((r) => ({ ...r })),
      pendingAnnouncements: [...this.pendingAnnouncements],
      retries: this.retries.map((r) => ({ ...r })),
    };
  }

  async loadSnapshot(snapshot: RegistrySnapshot): Promise<void> {
    this.records = new Map(snapshot.records.map((record) => [record.id, { ...record }]));
    this.pendingAnnouncements = [...snapshot.pendingAnnouncements];
    this.retries = snapshot.retries.map((r) => ({ ...r }));
  }

  async persist(): Promise<void> {
    if (!this.options.persistPath) return;
    await fs.mkdir(path.dirname(this.options.persistPath), { recursive: true });
    await fs.writeFile(this.options.persistPath, JSON.stringify(this.snapshot(), null, 2), 'utf-8');
  }

  async load(): Promise<void> {
    if (!this.options.persistPath) return;
    try {
      const raw = await fs.readFile(this.options.persistPath, 'utf-8');
      await this.loadSnapshot(JSON.parse(raw) as RegistrySnapshot);
    } catch {
      // no persisted state — start fresh
    }
  }
}
