export type ProbeFn = () => Promise<boolean> | boolean;

export interface AvailabilityOptions {
  ttlMs?: number;
  probeTimeoutMs?: number;
}

export interface AvailabilityEntry {
  name: string;
  probe: ProbeFn;
  ttlMs: number;
  probeTimeoutMs: number;
  cachedValue: boolean;
  cachedAt: number;
  inFlight: Promise<boolean> | null;
  generation: number;
}

export const DEFAULT_AVAILABILITY_TTL_MS = 30_000;

export class AvailabilityRegistry {
  private entries = new Map<string, AvailabilityEntry>();
  private generation = 0;

  register(name: string, probe: ProbeFn, options: AvailabilityOptions = {}): void {
    const existing = this.entries.get(name);
    if (existing) {
      existing.probe = probe;
      existing.ttlMs = options.ttlMs ?? DEFAULT_AVAILABILITY_TTL_MS;
      existing.probeTimeoutMs = options.probeTimeoutMs ?? 5_000;
      existing.cachedValue = true;
      existing.cachedAt = 0;
      existing.inFlight = null;
      existing.generation = this.generation;
      return;
    }
    this.entries.set(name, {
      name,
      probe,
      ttlMs: options.ttlMs ?? DEFAULT_AVAILABILITY_TTL_MS,
      probeTimeoutMs: options.probeTimeoutMs ?? 5_000,
      cachedValue: true,
      cachedAt: 0,
      inFlight: null,
      generation: this.generation,
    });
  }

  unregister(name: string): boolean {
    return this.entries.delete(name);
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  names(): string[] {
    return [...this.entries.keys()].sort();
  }

  getCached(name: string): boolean | null {
    const entry = this.entries.get(name);
    if (!entry) return null;
    const now = Date.now();
    if (entry.cachedAt > 0 && now - entry.cachedAt < entry.ttlMs && entry.generation === this.generation) {
      return entry.cachedValue;
    }
    return null;
  }

  async isAvailable(name: string): Promise<boolean> {
    const entry = this.entries.get(name);
    if (!entry) return false;
    const cached = this.getCached(name);
    if (cached !== null) return cached;
    if (entry.inFlight) return entry.inFlight;
    const probe = this.runProbe(entry);
    entry.inFlight = probe;
    try {
      return await probe;
    } finally {
      entry.inFlight = null;
    }
  }

  private async runProbe(entry: AvailabilityEntry): Promise<boolean> {
    try {
      const result = await withTimeout(entry.probe(), entry.probeTimeoutMs);
      entry.cachedValue = result === true;
    } catch {
      entry.cachedValue = false;
    }
    entry.cachedAt = Date.now();
    entry.generation = this.generation;
    return entry.cachedValue;
  }

  invalidate(name: string): void {
    const entry = this.entries.get(name);
    if (!entry) return;
    entry.cachedAt = 0;
    entry.generation = this.generation;
  }

  invalidateAll(): void {
    this.generation++;
  }

  clear(): void {
    this.entries.clear();
    this.generation++;
  }
}

export async function withTimeout<T>(promise: Promise<T> | T, timeoutMs: number): Promise<T> {
  if (timeoutMs <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Probe timed out after ${timeoutMs}ms`)), timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
