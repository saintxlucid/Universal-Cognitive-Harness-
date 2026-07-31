import * as crypto from 'node:crypto';
import type { BenchmarkMetric } from './benchmark-engine.js';

export interface ExperimentDesign {
  name: string;
  hypothesis: string;
  description: string;
  controlLabel: string;
  treatmentLabel: string;
  durationMs: number;
  metrics: string[];
  minSampleSize: number;
}

export interface ExperimentTrial {
  id: string;
  experimentName: string;
  variant: 'control' | 'treatment';
  metrics: BenchmarkMetric[];
  timestamp: Date;
}

export interface ExperimentResult {
  id: string;
  experiment: ExperimentDesign;
  controlTrials: ExperimentTrial[];
  treatmentTrials: ExperimentTrial[];
  conclusions: Record<string, {
    controlMean: number;
    treatmentMean: number;
    improvement: number;
    improvementPercent: number;
    significant: boolean;
    pValue: number;
    winner: 'control' | 'treatment' | 'tie';
  }>;
  startedAt: Date;
  completedAt: Date;
}

export class ExperimentEngine {
  private experiments = new Map<string, ExperimentDesign>();
  private trials: ExperimentTrial[] = [];
  private results: ExperimentResult[] = [];
  private maxResults: number;

  constructor(maxResults = 100) {
    this.maxResults = maxResults;
  }

  design(design: ExperimentDesign): void {
    this.experiments.set(design.name, design);
  }

  getDesign(name: string): ExperimentDesign | undefined {
    return this.experiments.get(name);
  }

  recordTrial(experimentName: string, variant: 'control' | 'treatment', metrics: BenchmarkMetric[]): ExperimentTrial {
    const trial: ExperimentTrial = {
      id: crypto.randomUUID(), experimentName, variant, metrics, timestamp: new Date(),
    };
    this.trials.push(trial);
    return trial;
  }

  getTrials(experimentName: string): { control: ExperimentTrial[]; treatment: ExperimentTrial[] } {
    const control = this.trials.filter((t) => t.experimentName === experimentName && t.variant === 'control');
    const treatment = this.trials.filter((t) => t.experimentName === experimentName && t.variant === 'treatment');
    return { control, treatment };
  }

  async analyze(experimentName: string): Promise<ExperimentResult | null> {
    const design = this.experiments.get(experimentName);
    if (!design) return null;
    const { control, treatment } = this.getTrials(experimentName);
    if (control.length < design.minSampleSize || treatment.length < design.minSampleSize) return null;

    const conclusions: ExperimentResult['conclusions'] = {};

    for (const metricName of design.metrics) {
      const cVals = control.map((t) => t.metrics.find((m) => m.name === metricName)?.value ?? 0);
      const tVals = treatment.map((t) => t.metrics.find((m) => m.name === metricName)?.value ?? 0);
      const cMean = cVals.reduce((a, b) => a + b, 0) / cVals.length;
      const tMean = tVals.reduce((a, b) => a + b, 0) / tVals.length;
      const improvement = tMean - cMean;
      const improvementPercent = cMean !== 0 ? (improvement / cMean) * 100 : 0;
      const pValue = this.calculatePValue(cVals, tVals);
      const significant = pValue < 0.05;
      const winner = Math.abs(improvement) < 0.001 ? 'tie' : improvement > 0 ? 'treatment' : 'control';

      conclusions[metricName] = { controlMean: cMean, treatmentMean: tMean, improvement, improvementPercent, significant, pValue, winner };
    }

    const result: ExperimentResult = {
      id: crypto.randomUUID(), experiment: design,
      controlTrials: control, treatmentTrials: treatment,
      conclusions, startedAt: control[0]?.timestamp ?? new Date(),
      completedAt: new Date(),
    };
    this.results.push(result);
    if (this.results.length > this.maxResults) this.results.shift();
    return result;
  }

  getResults(experimentName?: string): ExperimentResult[] {
    if (experimentName) return this.results.filter((r) => r.experiment.name === experimentName);
    return [...this.results];
  }

  private calculatePValue(a: number[], b: number[]): number {
    const meanA = a.reduce((s, v) => s + v, 0) / a.length;
    const meanB = b.reduce((s, v) => s + v, 0) / b.length;
    const varA = a.reduce((s, v) => s + (v - meanA) ** 2, 0) / (a.length - 1 || 1);
    const varB = b.reduce((s, v) => s + (v - meanB) ** 2, 0) / (b.length - 1 || 1);
    const se = Math.sqrt(varA / a.length + varB / b.length);
    if (se === 0) return 1.0;
    const t = Math.abs(meanA - meanB) / se;
    const df = a.length + b.length - 2;
    const p = Math.min(1, Math.exp(-t * t / (2 * df / (df - 2 > 0 ? df - 2 : 1))));
    return Math.round(p * 1000) / 1000;
  }
}
