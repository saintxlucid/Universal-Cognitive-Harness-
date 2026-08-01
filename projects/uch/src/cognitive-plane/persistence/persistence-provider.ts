import * as path from 'node:path';
import type { Storable } from './persistence-engine.js';

export interface PersistenceConfig {
  baseDir: string;
  files: Record<string, string>;
}

export class PersistenceProvider {
  private stores = new Map<string, Storable>();
  private baseDir = '.uccp';
  private filePaths = new Map<string, string>();
  private loaded = false;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: Partial<PersistenceConfig>) {
    if (config?.baseDir) this.baseDir = config.baseDir;
    if (config?.files) {
      for (const [key, file] of Object.entries(config.files)) {
        this.filePaths.set(key, file);
      }
    }
  }

  register(name: string, store: Storable, fileName?: string): void {
    this.stores.set(name, store);
    if (fileName) this.filePaths.set(name, fileName);
  }

  private resolve(name: string): string {
    const file = this.filePaths.get(name);
    return file ? path.resolve(this.baseDir, file) : path.resolve(this.baseDir, `${name}.json`);
  }

  async persistAll(): Promise<void> {
    for (const [name, store] of this.stores) {
      try {
        await store.persist(this.resolve(name));
      } catch (err) {
        console.error(`[PersistenceProvider] Failed to persist ${name}:`, err);
      }
    }
  }

  async persist(name: string): Promise<void> {
    const store = this.stores.get(name);
    if (!store) throw new Error(`No store registered: ${name}`);
    await store.persist(this.resolve(name));
  }

  async loadAll(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const [name, store] of this.stores) {
      try {
        const count = await store.load(this.resolve(name));
        counts[name] = count;
      } catch (err) {
        console.error(`[PersistenceProvider] Failed to load ${name}:`, err);
        counts[name] = 0;
      }
    }
    this.loaded = true;
    return counts;
  }

  async load(name: string): Promise<number> {
    const store = this.stores.get(name);
    if (!store) throw new Error(`No store registered: ${name}`);
    return store.load(this.resolve(name));
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  storeNames(): string[] {
    return [...this.stores.keys()];
  }

  /** Periodically flush every registered store. Fires every `intervalMs`
   * (default 30s); failures are isolated per store by persistAll. */
  startAutoSave(intervalMs = 30000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.persistAll();
    }, intervalMs);
    this.timer.unref?.();
  }

  /** Stop the periodic flush. A final explicit persistAll() is still the
   * caller's responsibility at shutdown. */
  stopAutoSave(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
