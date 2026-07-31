export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitState {
  agentId: string;
  remaining: number;
  resetAt: Date;
  totalAllowed: number;
  totalDenied: number;
}

export class RateLimiter {
  private limits: Map<string, { count: number; windowStart: number }> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  private defaultConfig: RateLimitConfig;
  private allowedCount = 0;
  private deniedCount = 0;

  constructor(defaultConfig?: Partial<RateLimitConfig>) {
    this.defaultConfig = {
      maxRequests: defaultConfig?.maxRequests ?? 100,
      windowMs: defaultConfig?.windowMs ?? 60_000,
    };
  }

  setLimit(agentId: string, config: RateLimitConfig): void {
    this.configs.set(agentId, config);
  }

  removeLimit(agentId: string): void {
    this.configs.delete(agentId);
    this.limits.delete(agentId);
  }

  check(agentId: string): { allowed: boolean; remaining: number; resetAt: Date } {
    const config = this.configs.get(agentId) ?? this.defaultConfig;
    const now = Date.now();
    const entry = this.limits.get(agentId) ?? { count: 0, windowStart: now };

    if (now - entry.windowStart >= config.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    entry.count++;
    const allowed = entry.count <= config.maxRequests;

    if (allowed) {
      this.allowedCount++;
    } else {
      this.deniedCount++;
    }

    this.limits.set(agentId, entry);

    return {
      allowed,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetAt: new Date(entry.windowStart + config.windowMs),
    };
  }

  getState(agentId: string): RateLimitState | null {
    const config = this.configs.get(agentId) ?? this.defaultConfig;
    const entry = this.limits.get(agentId);
    if (!entry) return null;
    return {
      agentId,
      remaining: Math.max(0, config.maxRequests - entry.count),
      resetAt: new Date(entry.windowStart + config.windowMs),
      totalAllowed: this.allowedCount,
      totalDenied: this.deniedCount,
    };
  }

  reset(agentId?: string): void {
    if (agentId) {
      this.limits.delete(agentId);
    } else {
      this.limits.clear();
    }
  }

  getStats(): { agents: number; totalAllowed: number; totalDenied: number } {
    return {
      agents: this.limits.size,
      totalAllowed: this.allowedCount,
      totalDenied: this.deniedCount,
    };
  }
}
