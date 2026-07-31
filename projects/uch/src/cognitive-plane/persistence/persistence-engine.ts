import * as fs from 'node:fs';
import * as path from 'node:path';

export interface Storable {
  persist(filePath: string): Promise<void>;
  load(filePath: string): Promise<number>;
}

export function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return value;
}

export function writeSnapshot(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function readSnapshot<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw, dateReviver) as T;
}

export function mapToRecord<K extends string, V>(map: Map<K, V>): Record<string, V> {
  const obj: Record<string, V> = {};
  for (const [k, v] of map) obj[k] = v;
  return obj;
}

export function recordToMap<K extends string, V>(record: Record<string, V>): Map<K, V> {
  const map = new Map<K, V>();
  for (const [k, v] of Object.entries(record)) map.set(k as K, v as V);
  return map;
}

export function serializeDates<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v instanceof Date) result[k] = v.toISOString();
    else if (Array.isArray(v)) result[k] = v.map((item) =>
      typeof item === 'object' && item !== null ? serializeDates(item as Record<string, unknown>) : item
    );
    else if (typeof v === 'object' && v !== null) result[k] = serializeDates(v as Record<string, unknown>);
    else result[k] = v;
  }
  return result as T;
}

export function collectPersistableStores(stores: Record<string, Storable | undefined>): Storable[] {
  return Object.values(stores).filter((s): s is Storable => s !== undefined);
}
