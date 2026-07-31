/**
 * Signal Fusion Engine (Cortex Kernel) — blueprint §2.
 *
 * Sub-organ of the Cortex Kernel (Integration Cortex): fuses many weak,
 * weakly-correlated signals into a robust ranked composite. Delegates the
 * fusion math to the signal-fusion framework engine (normalize → weight →
 * fuse → rank → risk — the quant-investing architecture from the corpus)
 * and adds the stateful organ behavior: run history, risk-flag and
 * decision-separation benchmarks, and event-driven workflow wiring.
 *
 * Benchmarkable: decision separation (buy/watch/avoid banding quality),
 * risk-flag rate (signals carrying structural risk), average factor
 * coverage per fused candidate.
 */

import {
  fuseSignals,
  type Candidate,
  type FusionOptions,
  type FusionResult,
} from '../cognitive-plane/frameworks/signals/signal-fusion.js';

export interface FusionRunRecord {
  id: string;
  at: string;
  candidateCount: number;
  ranked: string[];
  recommendation: { buy: string[]; watch: string[]; avoid: string[] };
  averageCoverage: number;
  riskFlagCount: number;
}

export interface SignalFusionEvent {
  type: 'signal:fused';
  source: string;
  payload: Record<string, unknown>;
}

export interface SignalFusionEngineConfig {
  /** Fire-and-forget event sink for the event-driven workflow layer. */
  eventSink?: (event: SignalFusionEvent) => void;
}

export class SignalFusionEngine {
  private runs: FusionRunRecord[] = [];
  private readonly eventSink: ((event: SignalFusionEvent) => void) | undefined;
  private totalCandidates = 0;
  private totalRiskFlags = 0;

  constructor(config: SignalFusionEngineConfig = {}) {
    this.eventSink = config.eventSink;
  }

  /**
   * Fuse candidates into a ranked composite with risk controls.
   * Deterministic given the same input; records the run for benchmarks.
   */
  fuse(candidates: Candidate[], options?: FusionOptions): FusionResult {
    const result = fuseSignals(candidates, options);
    const coverageSum = result.ranked.reduce((acc, c) => acc + c.coverage, 0);
    const riskFlagCount = result.ranked.reduce((acc, c) => acc + c.riskFlags.length, 0);
    this.totalCandidates += candidates.length;
    this.totalRiskFlags += riskFlagCount;

    const run: FusionRunRecord = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      candidateCount: candidates.length,
      ranked: result.ranked.map((c) => c.name),
      recommendation: result.recommendation,
      averageCoverage: candidates.length > 0 ? Math.round((coverageSum / candidates.length) * 100) / 100 : 0,
      riskFlagCount,
    };
    this.runs.push(run);

    this.eventSink?.({
      type: 'signal:fused',
      source: 'signal-fusion-engine',
      payload: {
        run_id: run.id,
        candidates: run.candidateCount,
        buy: run.recommendation.buy,
        watch: run.recommendation.watch,
        avoid: run.recommendation.avoid,
        risk_flags: run.riskFlagCount,
      },
    });

    return result;
  }

  getRuns(): FusionRunRecord[] {
    return [...this.runs];
  }

  getLastRun(): FusionRunRecord | null {
    return this.runs.length > 0 ? { ...this.runs[this.runs.length - 1]! } : null;
  }

  /** Benchmark: share of fused candidates that clear the composite bar. */
  getDecisionSeparationRate(): number {
    if (this.totalCandidates === 0) return 0;
    const banded = this.runs.reduce(
      (acc, r) => acc + r.recommendation.buy.length + r.recommendation.watch.length,
      0,
    );
    return Math.round((banded / this.totalCandidates) * 100) / 100;
  }

  /** Benchmark: structural risk flags per fused candidate. */
  getRiskFlagRate(): number {
    if (this.totalCandidates === 0) return 0;
    return Math.round((this.totalRiskFlags / this.totalCandidates) * 100) / 100;
  }

  /** Benchmark: mean factor coverage across all runs. */
  getAverageCoverage(): number {
    if (this.totalCandidates === 0) return 0;
    const sum = this.runs.reduce((acc, r) => acc + r.averageCoverage * r.candidateCount, 0);
    return Math.round((sum / this.totalCandidates) * 100) / 100;
  }

  getStatus(): Record<string, unknown> {
    return {
      runs: this.runs.length,
      candidates: this.totalCandidates,
      decisionSeparationRate: this.getDecisionSeparationRate(),
      riskFlagRate: this.getRiskFlagRate(),
      averageCoverage: this.getAverageCoverage(),
      lastRun: this.getLastRun(),
    };
  }
}
