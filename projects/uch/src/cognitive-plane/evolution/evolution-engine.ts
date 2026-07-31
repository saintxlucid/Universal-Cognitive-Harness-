import * as crypto from 'node:crypto';
import { BenchmarkEngine, type BenchmarkMetric, type BenchmarkRun, type Benchmarkable } from './benchmark-engine.js';
import { ExperimentEngine, type ExperimentDesign, type ExperimentResult } from './experiment-engine.js';
import { MutationEngine, type MutationProposal, type MutationResult, type MutableSubsystem, type Mutation } from './mutation-engine.js';

export class EvolutionEngine {
  benchmark: BenchmarkEngine;
  experiment: ExperimentEngine;
  mutation: MutationEngine;
  private evolutionCycles: number[] = [];
  private adaptations: Adaptation[] = [];

  constructor() {
    this.benchmark = new BenchmarkEngine();
    this.experiment = new ExperimentEngine();
    this.mutation = new MutationEngine();
  }

  registerSubsystem(name: string, bench: Benchmarkable, mut: MutableSubsystem): void {
    this.benchmark.register(bench);
    this.mutation.register(mut);
  }

  async runEvolutionCycle(): Promise<EvolutionCycleReport> {
    const cycleStart = Date.now();
    const cycleId = this.evolutionCycles.length + 1;
    this.evolutionCycles.push(Date.now());

    const baseline = await this.benchmark.runAll();
    const proposals = this.mutation.generateProposals(
      this.extractMetrics(baseline)
    );

    const appliedMutations: string[] = [];
    for (const proposal of proposals.slice(0, 3)) {
      const mutation = this.mutation.propose(proposal);
      this.mutation.apply(mutation.id);
      appliedMutations.push(mutation.id);
    }

    const after = await this.benchmark.runAll();
    const improvements = this.computeImprovements(baseline, after);

    for (const mutationId of appliedMutations) {
      const mut = this.mutation.getMutations().find((m) => m.id === mutationId);
      if (mut) {
        const score = Object.values(improvements[mut.subsystem] ?? {}).reduce((a, b) => a + (b > 0 ? 1 : 0), 0);
        const result: MutationResult = {
          mutationId, beforeMetrics: {}, afterMetrics: {},
          improvement: improvements[mut.subsystem] ?? {},
          score, keep: score > 0,
        };
        this.mutation.recordResult(mutationId, result);
        if (score <= 0) {
          this.mutation.rollback(mutationId);
        }
      }
    }

    const applied = appliedMutations.filter((id) => {
      const m = this.mutation.getMutations().find((x) => x.id === id);
      return m?.applied && !m?.rollbacked;
    });

    const report: EvolutionCycleReport = {
      cycleId, startedAt: new Date(cycleStart),
      completedAt: new Date(), durationMs: Date.now() - cycleStart,
      baselineRuns: baseline, afterRuns: after,
      improvements, mutationsProposed: proposals.length,
      mutationsApplied: applied.length,
      mutationsKept: applied.length,
      successful: applied.length > 0,
    };
    this.adaptations.push({ cycleId, report, timestamp: new Date() });
    return report;
  }

  private extractMetrics(runs: BenchmarkRun[]): Record<string, number> {
    const metrics: Record<string, number> = {};
    for (const run of runs) {
      for (const m of run.metrics) {
        metrics[`${run.subsystem}.${m.name}`] = m.value;
      }
    }
    return metrics;
  }

  private computeImprovements(before: BenchmarkRun[], after: BenchmarkRun[]): Record<string, Record<string, number>> {
    const improvements: Record<string, Record<string, number>> = {};
    for (const bRun of before) {
      const aRun = after.find((r) => r.subsystem === bRun.subsystem);
      if (!aRun) continue;
      improvements[bRun.subsystem] = {};
      for (const bMetric of bRun.metrics) {
        const aMetric = aRun.metrics.find((m) => m.name === bMetric.name);
      if (aMetric) {
        const target = improvements[bRun.subsystem]!;
        target[bMetric.name] = aMetric.value - bMetric.value;
      }
      }
    }
    return improvements;
  }

  async runExperiment(design: ExperimentDesign): Promise<ExperimentResult | null> {
    this.experiment.design(design);
    const trialsPerVariant = Math.max(design.minSampleSize, 3);

    for (let i = 0; i < trialsPerVariant; i++) {
      const controlMetrics = await this.benchmark.runSingle(design.controlLabel);
      this.experiment.recordTrial(design.name, 'control', controlMetrics.metrics);
      const treatmentMetrics = await this.benchmark.runSingle(design.treatmentLabel);
      this.experiment.recordTrial(design.name, 'treatment', treatmentMetrics.metrics);
    }

    return this.experiment.analyze(design.name);
  }

  getAdaptations(): Adaptation[] {
    return [...this.adaptations];
  }

  getCycleCount(): number {
    return this.evolutionCycles.length;
  }

  getStats(): Record<string, unknown> {
    return {
      cycles: this.evolutionCycles.length,
      adaptations: this.adaptations.length,
      benchmark: this.benchmark.getStats(),
      mutation: this.mutation.getStats(),
      experiments: this.experiment.getResults().length,
    };
  }
}

export interface EvolutionCycleReport {
  cycleId: number;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  baselineRuns: BenchmarkRun[];
  afterRuns: BenchmarkRun[];
  improvements: Record<string, Record<string, number>>;
  mutationsProposed: number;
  mutationsApplied: number;
  mutationsKept: number;
  successful: boolean;
}

export interface Adaptation {
  cycleId: number;
  report: EvolutionCycleReport;
  timestamp: Date;
}
