import { describe, it, expect } from 'vitest';

export interface ConformanceFixture {
  id: string;
  name: string;
  description: string;
  category: 'kernel' | 'cortex' | 'transport' | 'persistence' | 'security' | 'integration';
  run: () => Promise<ConformanceResult>;
}

export interface ConformanceResult {
  fixtureId: string;
  passed: boolean;
  durationMs: number;
  assertions: number;
  failures: string[];
  details: Record<string, unknown>;
}

export interface ConformanceReport {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  fixtures: ConformanceResult[];
  summary: string;
}

export class ConformanceRunner {
  private fixtures: ConformanceFixture[] = [];
  private results: ConformanceResult[] = [];

  register(fixture: ConformanceFixture): void {
    this.fixtures.push(fixture);
  }

  registerMany(fixtures: ConformanceFixture[]): void {
    this.fixtures.push(...fixtures);
  }

  async runAll(): Promise<ConformanceReport> {
    const start = Date.now();
    this.results = [];

    for (const fixture of this.fixtures) {
      const result = await this.runFixture(fixture);
      this.results.push(result);
    }

    const durationMs = Date.now() - start;
    const passed = this.results.filter((r) => r.passed).length;
    const failed = this.results.filter((r) => !r.passed).length;

    return {
      total: this.results.length,
      passed,
      failed,
      durationMs,
      fixtures: this.results,
      summary: `${passed}/${this.results.length} fixtures passed (${durationMs}ms)`,
    };
  }

  async runByCategory(category: ConformanceFixture['category']): Promise<ConformanceReport> {
    const filtered = this.fixtures.filter((f) => f.category === category);
    const runner = new ConformanceRunner();
    runner.registerMany(filtered);
    return runner.runAll();
  }

  async runById(id: string): Promise<ConformanceResult | null> {
    const fixture = this.fixtures.find((f) => f.id === id);
    if (!fixture) return null;
    return this.runFixture(fixture);
  }

  getResults(): ConformanceResult[] {
    return [...this.results];
  }

  getSummary(): string {
    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    return `${passed}/${total} fixtures passed`;
  }

  private async runFixture(fixture: ConformanceFixture): Promise<ConformanceResult> {
    const start = Date.now();
    try {
      const result = await fixture.run();
      return {
        ...result,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        fixtureId: fixture.id,
        passed: false,
        durationMs: Date.now() - start,
        assertions: 0,
        failures: [String(err)],
        details: { error: String(err) },
      };
    }
  }
}

export function defineFixture(def: Omit<ConformanceFixture, 'run'> & {
  run: () => Promise<ConformanceResult> | ConformanceResult;
}): ConformanceFixture {
  return {
    ...def,
    run: async () => {
      if (def.run instanceof Promise) {
        return def.run;
      }
      return def.run();
    },
  };
}

export function pass(fixtureId: string, details?: Record<string, unknown>): ConformanceResult {
  return {
    fixtureId,
    passed: true,
    durationMs: 0,
    assertions: 1,
    failures: [],
    details: details ?? {},
  };
}

export function fail(fixtureId: string, failures: string[], details?: Record<string, unknown>): ConformanceResult {
  return {
    fixtureId,
    passed: false,
    durationMs: 0,
    assertions: 0,
    failures,
    details: details ?? {},
  };
}
