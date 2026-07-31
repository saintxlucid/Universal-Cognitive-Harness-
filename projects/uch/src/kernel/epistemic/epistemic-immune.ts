/**
 * Epistemic Immune System — the 9-question gate (blueprint §3.3).
 *
 * The Immune System's existing contract (pattern-match known-bad,
 * quarantine, escalate) applied to a new signal class: epistemic claims
 * (LLM output, tool results, external fetches, sub-agent claims) rather
 * than system anomalies. Every inbound signal is gated before it may be
 * written as fact into Memory or promoted by the Epistemic Elevation
 * Engine.
 *
 * Operationalizes the critical-thinking governor (9 questions, source
 * triangulation) — the framework the corpus itself calls the governor of
 * every other framework — as a benchmarkable organ:
 *   false-acceptance rate, quarantine-to-resolution latency,
 *   source-diversity ratio on Wisdom-tier objects.
 *
 * Deterministic. Delegates the per-question evaluation to the
 * critical-evaluator engine (pure function) and adds the stateful gate
 * behavior: confidence scoring, corroboration counting, quarantine,
 * resolution.
 */

import {
  assessInformation,
  type InformationAssessment,
  type CriticalQuestionId,
} from '../../cognitive-plane/frameworks/critical/critical-evaluator.js';

export type GateVerdict = 'accept' | 'quarantine' | 'reject';

export interface InboundSignal {
  id?: string;
  target: string;
  content: string;
  source_type: 'llm' | 'tool' | 'external_fetch' | 'sub_agent' | 'user';
  source_id: string;
  timestamp?: Date;
  /** Optional raw answers to the 9 questions; unanswered questions lower confidence. */
  answers?: Partial<Record<CriticalQuestionId, string>>;
  /** Independent corroborating sources already attached. */
  corroborations?: string[];
}

export interface GateResult {
  signalId: string;
  target: string;
  verdict: GateVerdict;
  confidence: number; // 0-1
  assessment: InformationAssessment;
  corroborationCount: number;
  reasons: string[];
  timestamp: Date;
}

export interface QuarantineEntry {
  signalId: string;
  target: string;
  confidence: number;
  reasons: string[];
  quarantinedAt: Date;
  resolvedAt: Date | null;
  resolution: 'corroborated' | 'rejected' | 'pending' | null;
  corroborationsAdded: number;
}

export interface ImmuneGateConfig {
  /** Minimum confidence for acceptance (default 0.8). */
  acceptThreshold?: number;
  /** Corroborating sources required for acceptance (default 1). */
  minCorroborations?: number;
  /** Independent sources required for Wisdom-tier promotion (default 2). */
  wisdomCorroborationThreshold?: number;
}

export class EpistemicImmuneSystem {
  private config: Required<ImmuneGateConfig>;
  private quarantine: Map<string, QuarantineEntry> = new Map();
  private gatedCount = 0;
  private acceptedCount = 0;
  private quarantinedCount = 0;
  private rejectedCount = 0;
  private laterContradicted: string[] = [];

  constructor(config: ImmuneGateConfig = {}) {
    this.config = {
      acceptThreshold: config.acceptThreshold ?? 0.8,
      minCorroborations: config.minCorroborations ?? 1,
      wisdomCorroborationThreshold: config.wisdomCorroborationThreshold ?? 2,
    };
  }

  /**
   * The 9-question gate. Runs the critical evaluator, computes a
   * confidence score, and routes: accept (≥ threshold + corroboration),
   * quarantine (below threshold — wait for corroboration), reject
   * (hard failures).
   */
  gateSignal(signal: InboundSignal): GateResult {
    const signalId = signal.id ?? crypto.randomUUID();
    this.gatedCount++;

    const assessment = assessInformation({
      target: signal.target,
      answers: signal.answers ?? {},
    });

    const corroborationCount = signal.corroborations?.length ?? 0;
    const confidence = this.computeConfidence(assessment, corroborationCount);

    const reasons: string[] = [];
    let verdict: GateVerdict;

    if (assessment.verdict === 'reject') {
      verdict = 'reject';
      this.rejectedCount++;
      reasons.push(...assessment.failures.map((f) => `rejected: ${f}`));
    } else if (
      confidence >= this.config.acceptThreshold &&
      corroborationCount >= this.config.minCorroborations
    ) {
      verdict = 'accept';
      this.acceptedCount++;
      reasons.push(`confidence ${confidence.toFixed(2)} ≥ ${this.config.acceptThreshold} with ${corroborationCount} corroboration(s)`);
    } else {
      verdict = 'quarantine';
      this.quarantinedCount++;
      reasons.push(`confidence ${confidence.toFixed(2)} below threshold — corroboration required`);
      if (assessment.recommendations.length > 0) {
        reasons.push(...assessment.recommendations.slice(0, 2));
      }
      this.quarantine.set(signalId, {
        signalId,
        target: signal.target,
        confidence,
        reasons: [...reasons],
        quarantinedAt: new Date(),
        resolvedAt: null,
        resolution: 'pending',
        corroborationsAdded: corroborationCount,
      });
    }

    return {
      signalId,
      target: signal.target,
      verdict,
      confidence,
      assessment,
      corroborationCount,
      reasons,
      timestamp: new Date(),
    };
  }

  /**
   * Add corroborating evidence to a quarantined signal. When enough
   * independent sources arrive, the signal is resolved as corroborated
   * and becomes acceptable.
   */
  corroborate(signalId: string, _sourceId: string): {
    resolution: 'corroborated' | 'still-pending';
    corroborations: number;
  } {
    const entry = this.quarantine.get(signalId);
    if (!entry) {
      return { resolution: 'still-pending', corroborations: 0 };
    }
    if (entry.resolution === 'rejected' || entry.resolution === 'corroborated') {
      return { resolution: entry.resolution === 'corroborated' ? 'corroborated' : 'still-pending', corroborations: entry.corroborationsAdded };
    }
    entry.corroborationsAdded++;
    if (entry.corroborationsAdded >= this.config.minCorroborations) {
      entry.resolution = 'corroborated';
      entry.resolvedAt = new Date();
      this.acceptedCount++;
      return { resolution: 'corroborated', corroborations: entry.corroborationsAdded };
    }
    return { resolution: 'still-pending', corroborations: entry.corroborationsAdded };
  }

  /** Reject a quarantined signal (contradicted, or judgment decides). */
  reject(signalId: string): boolean {
    const entry = this.quarantine.get(signalId);
    if (!entry || entry.resolution === 'corroborated') return false;
    entry.resolution = 'rejected';
    entry.resolvedAt = new Date();
    return true;
  }

  /**
   * Record that an accepted claim was later contradicted — the
   * false-acceptance signal for benchmarking the gate.
   */
  recordContradiction(signalId: string): void {
    this.laterContradicted.push(signalId);
  }

  /** Independent sources required for Wisdom-tier promotion (blueprint §3.3 Q9). */
  get wisdomCorroborationThreshold(): number {
    return this.config.wisdomCorroborationThreshold;
  }

  isWisdomEligible(signalId: string): boolean {
    const entry = this.quarantine.get(signalId);
    return (entry?.corroborationsAdded ?? 0) >= this.config.wisdomCorroborationThreshold;
  }

  getQuarantine(): QuarantineEntry[] {
    return [...this.quarantine.values()].sort(
      (a, b) => b.quarantinedAt.getTime() - a.quarantinedAt.getTime(),
    );
  }

  getQuarantineById(signalId: string): QuarantineEntry | undefined {
    return this.quarantine.get(signalId);
  }

  /** Benchmark: fraction of accepted signals later contradicted. */
  getFalseAcceptanceRate(): number {
    if (this.acceptedCount === 0) return 0;
    return this.laterContradicted.length / this.acceptedCount;
  }

  /** Benchmark: average time from quarantine to resolution (ms). */
  getQuarantineResolutionLatencyMs(): number {
    const resolved = [...this.quarantine.values()].filter((q) => q.resolvedAt);
    if (resolved.length === 0) return 0;
    const total = resolved.reduce(
      (acc, q) => acc + (q.resolvedAt!.getTime() - q.quarantinedAt.getTime()),
      0,
    );
    return Math.round(total / resolved.length);
  }

  getStatus(): Record<string, unknown> {
    return {
      gatedCount: this.gatedCount,
      acceptedCount: this.acceptedCount,
      quarantinedCount: this.quarantinedCount,
      rejectedCount: this.rejectedCount,
      openQuarantine: [...this.quarantine.values()].filter((q) => q.resolution === 'pending').length,
      falseAcceptanceRate: this.getFalseAcceptanceRate(),
      quarantineResolutionLatencyMs: this.getQuarantineResolutionLatencyMs(),
    };
  }

  private computeConfidence(
    assessment: InformationAssessment,
    corroborationCount: number,
  ): number {
    const answered = assessment.checks.filter((c) => c.answered).length;
    const base = assessment.reliabilityScore / 100;
    const answeredPenalty = 1 - answered / assessment.checks.length;
    const corroborationBoost = Math.min(0.2, corroborationCount * 0.1);
    return Math.max(0, Math.min(1, base - answeredPenalty * 0.3 + corroborationBoost));
  }
}
