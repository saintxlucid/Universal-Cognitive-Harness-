export interface CacheEntry<T> {
  value: T;
  expiresAt: number | null;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private order: string[] = [];
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeOrder(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    this.touch(key);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.removeOrder(key);
    } else if (this.order.length >= this.maxSize) {
      const evicted = this.order.shift()!;
      this.cache.delete(evicted);
    }
    this.cache.set(key, {
      value,
      expiresAt: ttlMs ? Date.now() + ttlMs : null,
    });
    this.order.push(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeOrder(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    const existed = this.cache.delete(key);
    if (existed) this.removeOrder(key);
    return existed;
  }

  clear(): void {
    this.cache.clear();
    this.order = [];
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): { size: number; maxSize: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  private touch(key: string): void {
    this.removeOrder(key);
    this.order.push(key);
  }

  private removeOrder(key: string): void {
    const idx = this.order.indexOf(key);
    if (idx !== -1) this.order.splice(idx, 1);
  }
}
