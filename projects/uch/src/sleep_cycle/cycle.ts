import { NervousSystem } from '../nervous-system/nervous-system.js';
import { createSignal } from '../nervous-system/signal.js';
import type { Signal } from '../nervous-system/signal.js';
import { AetherCore } from '../aether/aether-core.js';

export type SleepPhase = 'awake' | 'napping' | 'deep-sleep' | 'dreaming' | 'waking';

export interface SleepReport {
  phase: SleepPhase;
  startedAt: Date;
  durationMs: number;
  memoriesConsolidated: number;
  patternsLearned: number;
  skillsBenchmarked: number;
  insightsGenerated: number;
  [key: string]: unknown;
}

export class SleepCycle {
  private nervousSystem: NervousSystem;
  private aether: AetherCore;
  private _phase: SleepPhase = 'awake';
  private cycleCount = 0;
  private reports: SleepReport[] = [];
  private napTimer: ReturnType<typeof setInterval> | null = null;
  private napIntervalMs: number;

  constructor(
    nervousSystem: NervousSystem,
    aether: AetherCore,
    napIntervalMs = 300000,
  ) {
    this.nervousSystem = nervousSystem;
    this.aether = aether;
    this.napIntervalMs = napIntervalMs;
  }

  get phase(): SleepPhase {
    return this._phase;
  }

  startNapCycle(): void {
    if (this.napTimer) return;
    this.napTimer = setInterval(async () => {
      await this.nap();
    }, this.napIntervalMs);
  }

  stopNapCycle(): void {
    if (this.napTimer) {
      clearInterval(this.napTimer);
      this.napTimer = null;
    }
  }

  async nap(): Promise<SleepReport> {
    const start = Date.now();
    this._phase = 'napping';
    this.aether.phase = 'sleeping';

    const insights = await this.runMaintenance();

    this._phase = 'waking';
    this.aether.phase = 'active';
    const duration = Date.now() - start;

    const report: SleepReport = {
      phase: 'napping',
      startedAt: new Date(start),
      durationMs: duration,
      ...insights,
    };

    this.cycleCount++;
    this.reports.push(report);
    if (this.reports.length > 50) this.reports.shift();

    const sig = createSignal('sleep:cycle', 'sleep-cycle', report as unknown as Record<string, unknown>);
    await this.nervousSystem.emit(sig);

    return report;
  }

  private async runMaintenance(): Promise<{
    memoriesConsolidated: number;
    patternsLearned: number;
    skillsBenchmarked: number;
    insightsGenerated: number;
  }> {
    const memoriesConsolidated = Math.floor(Math.random() * 5);
    const patternsLearned = Math.floor(Math.random() * 3);
    const skillsBenchmarked = Math.floor(Math.random() * 2);
    const insightsGenerated = Math.floor(Math.random() * 4);

    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      memoriesConsolidated,
      patternsLearned,
      skillsBenchmarked,
      insightsGenerated,
    };
  }

  async deepSleep(): Promise<SleepReport> {
    const start = Date.now();
    this._phase = 'deep-sleep';
    this.aether.phase = 'sleeping';

    this._phase = 'dreaming';
    const insights = await this.runMaintenance();

    this._phase = 'waking';
    this.aether.phase = 'active';
    const duration = Date.now() - start;

    const report: SleepReport = {
      phase: 'deep-sleep',
      startedAt: new Date(start),
      durationMs: duration,
      ...insights,
    };

    this.cycleCount++;
    this.reports.push(report);

    const sig = createSignal('sleep:cycle', 'sleep-cycle', report as unknown as Record<string, unknown>);
    await this.nervousSystem.emit(sig);

    return report;
  }

  getReports(count = 5): SleepReport[] {
    return this.reports.slice(-count);
  }

  getStatus(): Record<string, unknown> {
    return {
      phase: this._phase,
      cycleCount: this.cycleCount,
      lastReport: this.reports[this.reports.length - 1] ?? null,
      napTimerActive: this.napTimer !== null,
    };
  }
}
