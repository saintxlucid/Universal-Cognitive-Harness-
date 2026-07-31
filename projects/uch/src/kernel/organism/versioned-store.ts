import {
  readSnapshot,
  writeSnapshot,
  type Storable,
} from '../../cognitive-plane/persistence/persistence-engine.js';

export interface VersionRecord<T> {
  version: number;
  value: T;
  committedAt: Date;
  message?: string;
}

export class VersionedStore<T> implements Storable {
  kind: string;
  private records: VersionRecord<T>[] = [];
  private head = -1;
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date(), kind = 'organism') {
    this.now = now;
    this.kind = kind;
  }

  commit(value: T, message?: string): number {
    const record: VersionRecord<T> = {
      version: this.records.length + 1,
      value: structuredClone(value),
      committedAt: this.now(),
    };
    if (message !== undefined) record.message = message;
    this.records.push(record);
    this.head = this.records.length - 1;
    return record.version;
  }

  current(): VersionRecord<T> {
    const record = this.records[this.head];
    if (!record) throw new Error('versioned store is empty');
    return structuredClone(record);
  }

  at(version: number): T | undefined {
    if (!Number.isInteger(version) || version < 1) return undefined;
    const record = this.records[version - 1];
    if (!record || record.version !== version) return undefined;
    return structuredClone(record.value);
  }

  history(): VersionRecord<T>[] {
    return this.records.map((record) => structuredClone(record));
  }

  // rollback only moves the head; records stay append-only so versions 1..n never collide (law 12)
  rollbackTo(version: number): boolean {
    if (!Number.isInteger(version) || version < 1) return false;
    const record = this.records[version - 1];
    if (!record || record.version !== version) return false;
    this.head = version - 1;
    return true;
  }

  async persist(filePath: string): Promise<void> {
    writeSnapshot(filePath, { kind: this.kind, records: this.records, head: this.head });
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{ kind?: string; records?: VersionRecord<T>[]; head?: number }>(filePath);
    if (!data) return 0;
    this.records = data.records ?? [];
    if (data.kind !== undefined) this.kind = data.kind;
    const last = this.records.length - 1;
    this.head = data.head !== undefined && data.head >= 0 && data.head <= last ? data.head : last;
    return this.records.length;
  }
}

export function createVersionedStore<T>(kind: string): VersionedStore<T> {
  return new VersionedStore<T>(undefined, kind);
}
