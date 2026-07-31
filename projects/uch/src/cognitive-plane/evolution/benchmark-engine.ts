import * as crypto from 'node:crypto';

export interface BenchmarkMetric {
  name: string;
  value: number;
  unit: string;
  higherIsBetter: boolean;
}

export interface BenchmarkRun {
  id: string;
  subsystem: string;
  timestamp: Date;
  metrics: BenchmarkMetric[];
  durationMs: number;
  configSnapshot: Record<string, unknown>;
}

export interface Benchmarkable {
  name: string;
  runBenchmark(): Promise<BenchmarkMetric[]>;
  getConfig(): Record<string, unknown>;
}

export class BenchmarkEngine {
  private history: BenchmarkRun[] = [];
  private maxHistory: number;

  constructor(maxHistory = 500) {
    this.maxHistory = maxHistory;
  }

  register(subsystem: Benchmarkable): void {
    this.subsystems.set(subsystem.name, subsystem);
  }

  private subsystems = new Map<string, Benchmarkable>();

  async runSingle(subsystemName: string): Promise<BenchmarkRun> {
    const sub = this.subsystems.get(subsystemName);
    if (!sub) throw new Error(`Unknown subsystem: ${subsystemName}`);
    const start = Date.now();
    const metrics = await sub.runBenchmark();
    const durationMs = Date.now() - start;
    const run: BenchmarkRun = {
      id: crypto.randomUUID(), subsystem: subsystemName,
      timestamp: new Date(), metrics, durationMs,
      configSnapshot: sub.getConfig(),
    };
    this.history.push(run);
    if (this.history.length > this.maxHistory) this.history.shift();
    return run;
  }

  async runAll(): Promise<BenchmarkRun[]> {
    const results: BenchmarkRun[] = [];
    for (const name of this.subsystems.keys()) {
      results.push(await this.runSingle(name));
    }
    return results;
  }

  getHistory(subsystem?: string): BenchmarkRun[] {
    if (subsystem) return this.history.filter((r) => r.subsystem === subsystem);
    return [...this.history];
  }

  getLatest(subsystem: string): BenchmarkRun | undefined {
    const runs = this.history.filter((r) => r.subsystem === subsystem);
    return runs.length > 0 ? runs[runs.length - 1] : undefined;
  }

  compare(subsystem: string, runA?: BenchmarkRun, runB?: BenchmarkRun): Record<string, { a: number; b: number; delta: number; deltaPercent: number; improved: boolean }> {
    const a = runA ?? this.history.filter((r) => r.subsystem === subsystem).at(-2);
    const b = runB ?? this.getLatest(subsystem);
    if (!a || !b) return {};
    const comparison: Record<string, { a: number; b: number; delta: number; deltaPercent: number; improved: boolean }> = {};
    for (const mA of a.metrics) {
      const mB = b.metrics.find((m) => m.name === mA.name);
      if (mB) {
        const delta = mB.value - mA.value;
        comparison[mA.name] = {
          a: mA.value, b: mB.value, delta,
          deltaPercent: mA.value !== 0 ? (delta / mA.value) * 100 : 0,
          improved: mA.higherIsBetter ? delta > 0 : delta < 0,
        };
      }
    }
    return comparison;
  }

  getStats(): Record<string, unknown> {
    return {
      totalRuns: this.history.length,
      subsystems: this.subsystems.size,
      subsystemNames: [...this.subsystems.keys()],
    };
  }
}
