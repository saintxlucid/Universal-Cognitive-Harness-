export type CredentialState = 'healthy' | 'exhausted' | 'disabled';

export interface PoolCredential {
  id: string;
  provider: string;
  apiKey: string;
  baseURL?: string;
  model?: string;
  priority?: number;
}

export interface CredentialHealth {
  id: string;
  state: CredentialState;
  consecutiveFailures: number;
  exhaustedUntil: number | null;
  lastErrorCode: string | null;
  lastErrorAt: number | null;
  totalSuccesses: number;
  totalFailures: number;
}

export interface CredentialPoolOptions {
  exhaustionTtlMs?: number;
  failureThreshold?: number;
  rotation?: 'round-robin' | 'priority';
}

const EXHAUSTION_CODES = new Set([
  '429',
  'rate_limit_exceeded',
  'requests_rate_limit',
  'tokens_rate_limit',
  'insufficient_quota',
  'billing_not_active',
]);

const PERMANENT_CODES = new Set(['invalid_api_key', 'authentication_error']);

export class CredentialPool {
  private credentials: PoolCredential[] = [];
  private health = new Map<string, CredentialHealth>();
  private cursor = 0;
  private readonly options: Required<CredentialPoolOptions>;

  constructor(credentials: PoolCredential[] = [], options: CredentialPoolOptions = {}) {
    this.options = {
      exhaustionTtlMs: options.exhaustionTtlMs ?? 60_000,
      failureThreshold: options.failureThreshold ?? 3,
      rotation: options.rotation ?? 'round-robin',
    };
    for (const credential of credentials) {
      this.add(credential);
    }
  }

  add(credential: PoolCredential): void {
    if (!credential.id || !credential.provider || !credential.apiKey) {
      throw new Error('Credential requires id, provider, and apiKey');
    }
    if (!this.health.has(credential.id)) {
      this.health.set(credential.id, {
        id: credential.id,
        state: 'healthy',
        consecutiveFailures: 0,
        exhaustedUntil: null,
        lastErrorCode: null,
        lastErrorAt: null,
        totalSuccesses: 0,
        totalFailures: 0,
      });
    }
    const existing = this.credentials.find((c) => c.id === credential.id);
    if (existing) {
      Object.assign(existing, credential);
    } else {
      this.credentials.push({ ...credential, priority: credential.priority ?? 0 });
    }
  }

  remove(id: string): boolean {
    const before = this.credentials.length;
    this.credentials = this.credentials.filter((c) => c.id !== id);
    this.health.delete(id);
    if (this.cursor >= this.credentials.length) this.cursor = 0;
    return this.credentials.length < before;
  }

  clear(): void {
    this.credentials = [];
    this.health.clear();
    this.cursor = 0;
  }

  list(): PoolCredential[] {
    return this.credentials.map((c) => ({ ...c }));
  }

  get(id: string): PoolCredential | undefined {
    const found = this.credentials.find((c) => c.id === id);
    return found ? { ...found } : undefined;
  }

  size(): number {
    return this.credentials.length;
  }

  private isUsable(credential: PoolCredential, now: number): boolean {
    const health = this.health.get(credential.id);
    if (!health) return false;
    if (health.state === 'disabled') return false;
    if (health.exhaustedUntil !== null && health.exhaustedUntil > now) return false;
    if (health.state === 'exhausted' && PERMANENT_CODES.has(health.lastErrorCode ?? '')) return false;
    return true;
  }

  private orderedCandidates(provider?: string): PoolCredential[] {
    const filtered = provider
      ? this.credentials.filter((c) => c.provider === provider)
      : this.credentials;
    if (this.options.rotation === 'priority') {
      return [...filtered].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    }
    return filtered;
  }

  select(provider?: string): PoolCredential | null {
    if (this.credentials.length === 0) return null;
    const now = Date.now();
    const candidates = this.orderedCandidates(provider);
    const start = this.options.rotation === 'priority' ? 0 : this.cursor;
    for (let offset = 0; offset < candidates.length; offset++) {
      const index = (start + offset) % candidates.length;
      const candidate = candidates[index] as PoolCredential;
      if (!this.isUsable(candidate, now)) continue;
      if (this.options.rotation === 'priority') {
        return { ...candidate };
      }
      this.cursor = (index + 1) % candidates.length;
      return { ...candidate };
    }
    return null;
  }

  markSuccess(id: string): void {
    const health = this.health.get(id);
    if (!health) return;
    health.state = 'healthy';
    health.consecutiveFailures = 0;
    health.exhaustedUntil = null;
    health.lastErrorCode = null;
    health.totalSuccesses++;
  }

  markFailure(id: string, errorCode: string | null = null, _errorMessage?: string): void {
    const health = this.health.get(id);
    if (!health) return;
    const now = Date.now();
    health.consecutiveFailures++;
    health.totalFailures++;
    health.lastErrorCode = errorCode;
    health.lastErrorAt = now;

    if (PERMANENT_CODES.has(errorCode ?? '')) {
      health.state = 'disabled';
      health.exhaustedUntil = null;
      return;
    }
    if (EXHAUSTION_CODES.has(errorCode ?? '') || health.consecutiveFailures >= this.options.failureThreshold) {
      health.state = 'exhausted';
      health.exhaustedUntil = now + this.options.exhaustionTtlMs;
    }
  }

  isAvailable(id: string): boolean {
    const credential = this.get(id);
    if (!credential) return false;
    return this.isUsable(credential, Date.now());
  }

  healthOf(id: string): CredentialHealth | null {
    const health = this.health.get(id);
    return health ? { ...health } : null;
  }

  allHealth(): CredentialHealth[] {
    return this.credentials.map((c) => this.healthOf(c.id) ?? {
      id: c.id,
      state: 'healthy',
      consecutiveFailures: 0,
      exhaustedUntil: null,
      lastErrorCode: null,
      lastErrorAt: null,
      totalSuccesses: 0,
      totalFailures: 0,
    });
  }

  reset(): void {
    this.health.clear();
    this.cursor = 0;
    for (const credential of this.credentials) {
      this.add(credential);
    }
  }

  providers(): string[] {
    return [...new Set(this.credentials.map((c) => c.provider))].sort();
  }
}
