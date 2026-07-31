export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type ComponentCategory = 'control-plane' | 'cognitive-plane' | 'drivers' | 'storage';

export interface ComponentHealth {
  name: string;
  category: ComponentCategory;
  status: HealthStatus;
  message?: string;
  lastCheck: Date;
  responseTimeMs: number;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckResult {
  status: HealthStatus;
  components: ComponentHealth[];
  uptimeMs: number;
  timestamp: Date;
  summary: { healthy: number; degraded: number; unhealthy: number };
}

export type HealthCheckFn = () => ComponentHealth | Promise<ComponentHealth>;

export class HealthMonitor {
  private checks: Map<string, { fn: HealthCheckFn; intervalMs: number; lastResult: ComponentHealth | null }> = new Map();
  private startTime = Date.now();
  private checkTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

  register(name: string, category: ComponentCategory, fn: HealthCheckFn, intervalMs = 30_000): void {
    this.checks.set(name, { fn, intervalMs, lastResult: null });
  }

  unregister(name: string): void {
    this.stopCheck(name);
    this.checks.delete(name);
  }

  startAll(): void {
    for (const [name, config] of this.checks) {
      this.startCheck(name, config);
    }
  }

  stopAll(): void {
    for (const [name] of this.checkTimers) {
      this.stopCheck(name);
    }
  }

  async runCheck(name: string): Promise<ComponentHealth> {
    const config = this.checks.get(name);
    if (!config) {
      return {
        name, category: 'control-plane', status: 'unhealthy',
        message: 'Unknown component', lastCheck: new Date(),
        responseTimeMs: 0,
      };
    }
    const start = Date.now();
    try {
      const result = await config.fn();
      result.responseTimeMs = Date.now() - start;
      result.lastCheck = new Date();
      config.lastResult = result;
      return result;
    } catch (err) {
      const failed: ComponentHealth = {
        name, category: 'control-plane', status: 'unhealthy',
        message: err instanceof Error ? err.message : String(err),
        lastCheck: new Date(), responseTimeMs: Date.now() - start,
      };
      config.lastResult = failed;
      return failed;
    }
  }

  async runAll(): Promise<HealthCheckResult> {
    const results = await Promise.all(
      [...this.checks.keys()].map((name) => this.runCheck(name)),
    );
    return this.buildResult(results);
  }

  getLastResult(name: string): ComponentHealth | null {
    return this.checks.get(name)?.lastResult ?? null;
  }

  getComponent(name: string): ComponentHealth | null {
    return this.checks.get(name)?.lastResult ?? null;
  }

  listComponents(): string[] {
    return [...this.checks.keys()];
  }

  private startCheck(name: string, config: { fn: HealthCheckFn; intervalMs: number; lastResult: ComponentHealth | null }): void {
    if (this.checkTimers.has(name)) return;
    this.checkTimers.set(
      name,
      setInterval(() => { this.runCheck(name).catch(() => {}); }, config.intervalMs),
    );
  }

  private stopCheck(name: string): void {
    const timer = this.checkTimers.get(name);
    if (timer) {
      clearInterval(timer);
      this.checkTimers.delete(name);
    }
  }

  private buildResult(components: ComponentHealth[]): HealthCheckResult {
    const healthy = components.filter((c) => c.status === 'healthy').length;
    const degraded = components.filter((c) => c.status === 'degraded').length;
    const unhealthy = components.filter((c) => c.status === 'unhealthy').length;

    let status: HealthStatus = 'healthy';
    if (unhealthy > 0) status = 'unhealthy';
    else if (degraded > 0) status = 'degraded';

    return {
      status, components,
      uptimeMs: Date.now() - this.startTime,
      timestamp: new Date(),
      summary: { healthy, degraded, unhealthy },
    };
  }
}
