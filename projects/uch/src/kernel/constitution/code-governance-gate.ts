/**
 * Code Governance Gate (Constitution) — blueprint §2.
 *
 * Sub-organ of the Governance System (Constitution): the pre-landing
 * gate for code changes. Delegates the principle audit to the clean-code
 * framework engine (SOC/DRY/KISS/DYC/YAGNI with explicit trade-offs) and
 * adds the constitutional enforcement layer: hard violations (a principle
 * scoring below the floor) block the change outright, moderate violations
 * defer to review, clean changes pass. Findings are recorded as evidence
 * (principle ids + flags — never file content), and the gate exposes the
 * governance benchmarks: review rate, block rate, revision-loop rate.
 *
 * Benchmarkable: block rate (hard violations caught before landing),
 * review rate (changes routed to the judgment tier), revision-loop rate
 * (changes repeatedly failing review in the same scope).
 */

import {
  auditCodePrinciples,
  type CodePrinciplesInput,
  type PrincipleId,
} from '../../cognitive-plane/frameworks/code/code-principles.js';

export type GovernanceVerdict = 'allow' | 'review' | 'block';

export interface GovernanceRecord {
  id: string;
  at: string;
  target: string;
  verdict: GovernanceVerdict;
  score: number;
  /** Principle ids + flags only — never change content. */
  evidence: string[];
  scope: string;
}

export interface CodeGovernanceEvent {
  type: 'governance:code_reviewed';
  source: string;
  payload: Record<string, unknown>;
}

export interface CodeGovernanceGateConfig {
  /** Scope of the gate (default 'workspace'). */
  scope?: string;
  /** Fire-and-forget event sink for the event-driven workflow layer. */
  eventSink?: (event: CodeGovernanceEvent) => void;
}

export interface CodeGovernanceInput {
  /** Description or diff snippet of the change. */
  change: string;
  /** Optional intent — used for YAGNI/DYC context. */
  intent?: string;
  /** Where the change lands (module/file/scope key). */
  target: string;
}

export class CodeGovernanceGate {
  private records: GovernanceRecord[] = [];
  private readonly scope: string;
  private readonly eventSink: ((event: CodeGovernanceEvent) => void) | undefined;

  constructor(config: CodeGovernanceGateConfig = {}) {
    this.scope = config.scope ?? 'workspace';
    this.eventSink = config.eventSink;
  }

  /** Review a change against the Clean Code Covenant. */
  review(input: CodeGovernanceInput): GovernanceRecord {
    const audit = auditCodePrinciples({ change: input.change, intent: input.intent } satisfies CodePrinciplesInput);
    const hardViolation = audit.principles.some((p) => p.score < 5);
    const verdict: GovernanceVerdict = audit.verdict === 'clean' ? 'allow' : hardViolation ? 'block' : 'review';

    const evidence: string[] = [];
    for (const p of audit.principles) {
      if (p.score < 7) evidence.push(`${p.principle}:<${p.score}>`);
      for (const flag of p.flags) evidence.push(`${p.principle}:${flag}`);
    }

    const record: GovernanceRecord = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      target: input.target,
      verdict,
      score: audit.score,
      evidence,
      scope: this.scope,
    };
    this.records.push(record);

    this.eventSink?.({
      type: 'governance:code_reviewed',
      source: 'code-governance-gate',
      payload: {
        record_id: record.id,
        target: record.target,
        verdict: record.verdict,
        score: record.score,
        scope: record.scope,
      },
    });

    return { ...record };
  }

  getRecords(): GovernanceRecord[] {
    return [...this.records];
  }

  getRecord(id: string): GovernanceRecord | undefined {
    const record = this.records.find((r) => r.id === id);
    return record ? { ...record } : undefined;
  }

  /** Benchmark: block rate over reviewed changes. */
  getBlockRate(): number {
    if (this.records.length === 0) return 0;
    return this.records.filter((r) => r.verdict === 'block').length / this.records.length;
  }

  /** Benchmark: review rate (deferred to the judgment tier). */
  getReviewRate(): number {
    if (this.records.length === 0) return 0;
    return this.records.filter((r) => r.verdict === 'review').length / this.records.length;
  }

  /** Benchmark: changes that repeatedly fail review in the same scope. */
  getRevisionLoopRate(): number {
    if (this.records.length < 2) return 0;
    const counts = new Map<string, number>();
    for (const r of this.records) {
      if (r.verdict !== 'allow') counts.set(r.target, (counts.get(r.target) ?? 0) + 1);
    }
    const looped = [...counts.values()].filter((c) => c >= 2).length;
    return Math.round((looped / this.records.length) * 100) / 100;
  }

  /** Benchmark: mean governance score across reviewed changes. */
  getAverageScore(): number {
    if (this.records.length === 0) return 0;
    const sum = this.records.reduce((acc, r) => acc + r.score, 0);
    return Math.round((sum / this.records.length) * 100) / 100;
  }

  getStatus(): Record<string, unknown> {
    return {
      reviewed: this.records.length,
      blockRate: this.getBlockRate(),
      reviewRate: this.getReviewRate(),
      revisionLoopRate: this.getRevisionLoopRate(),
      averageScore: this.getAverageScore(),
      evidenceFields: ['principle:<score>', 'principle:flag'],
    };
  }
}

export type { PrincipleId };
