import { createHash } from 'node:crypto';
import {
  writeSnapshot,
  readSnapshot,
  type Storable,
} from '../cognitive-plane/persistence/persistence-engine.js';

export interface DnaMutation {
  at: number;
  locus: string;
  fromFingerprint: string | null;
  toFingerprint: string;
  cause: 'input_changed' | 'deliberate';
}

export class WorkspaceDNA implements Storable {
  private readonly workspaceId: string;
  private readonly name: string;
  private readonly maxMutations: number;
  private fingerprint: string | null = null;
  private mutations: DnaMutation[] = [];

  constructor(workspaceId: string, name: string, maxMutations = 1000) {
    this.workspaceId = workspaceId;
    this.name = name;
    this.maxMutations = maxMutations;
  }

  private stableSerialize(value: unknown): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.stableSerialize(v)).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${this.stableSerialize(record[k])}`).join(',')}}`;
  }

  recompute(input: Record<string, unknown>): void {
    const next = `sha256:${createHash('sha256').update(this.stableSerialize(input)).digest('hex')}`;
    if (next !== this.fingerprint && this.fingerprint !== null) {
      this.mutations.push({
        at: Date.now(),
        locus: 'workspace',
        fromFingerprint: this.fingerprint,
        toFingerprint: next,
        cause: 'input_changed',
      });
      while (this.mutations.length > this.maxMutations) {
        this.mutations.shift();
      }
    }
    this.fingerprint = next;
  }

  getFingerprint(): string | null {
    return this.fingerprint;
  }

  getMutations(): DnaMutation[] {
    return [...this.mutations];
  }

  mutationCount(): number {
    return this.mutations.length;
  }

  async persist(filePath: string): Promise<void> {
    writeSnapshot(filePath, {
      workspaceId: this.workspaceId,
      name: this.name,
      fingerprint: this.fingerprint,
      mutations: this.mutations,
    });
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      workspaceId?: string;
      name?: string;
      fingerprint?: string | null;
      mutations?: DnaMutation[];
    }>(filePath);
    if (!data) return 0;
    this.fingerprint = data.fingerprint ?? null;
    this.mutations = data.mutations ?? [];
    return this.mutations.length;
  }
}
