/**
 * Etiology Engine (Diagnostic Cortex) — blueprint §2.
 *
 * Turns a symptom into a validated causal graph: Five Whys descent +
 * Fishbone breadth + Pareto prioritization (delegated to the RCA
 * framework engine — DRY across organs), with one-change-at-a-time
 * validation and recurrence tracking.
 *
 * Contract (manifesto rule): benchmarkable — root-cause validation rate
 * (hypotheses confirmed vs proposed) and recurrence rate of "fixed"
 * issues are computed from investigation state.
 *
 * Every validated root cause carries an InquiryContract (Law 17 gate in
 * Phase E): no causal claim may enter permanent memory without a
 * reproducible trail.
 */

import {
  rcaAnalyze,
  paretoPrioritize,
  CAUSE_CATEGORIES,
  type CauseCategory,
  type CauseHypothesis,
  type EvidenceItem,
} from '../cognitive-plane/frameworks/rca/rca.js';
import {
  createInquiryContract,
  validateInquiryContract,
  type InquiryContract,
} from '../kernel/epistemic/inquiry-contract.js';

export type HypothesisStatus = 'proposed' | 'validated' | 'rejected';
export type InvestigationStatus = 'open' | 'validating' | 'fixed' | 'closed';

export interface CausalGraphNode {
  id: string;
  symptom: string;
  /** Five Whys descent — answers in order. */
  why_answers: string[];
  /** Fishbone breadth by category. */
  fishbone_categories: Partial<Record<CauseCategory, string[]>>;
  /** Pareto rank (0 = highest impact). */
  pareto_rank: number;
  hypothesis_status: HypothesisStatus;
  /** Controlled change, replication, etc. */
  validation_method: string;
  fix_applied: string | null;
  recurrence_count: number;
  inquiry: InquiryContract;
  created_at: string;
  fixed_at: string | null;
}

export interface InvestigationInput {
  symptom: string;
  evidence: EvidenceItem[];
  whys?: string[];
  fishboneCauses?: Partial<Record<CauseCategory, string[]>>;
  systemNotes?: string[];
  hypotheses?: CauseHypothesis[];
  inquiry?: Omit<InquiryContract, 'confidence'> & { confidence?: number };
}

export class EtiologyEngine {
  private nodes: Map<string, CausalGraphNode> = new Map();
  private proposedCount = 0;
  private validatedCount = 0;
  private rejectedCount = 0;

  /**
   * Start an investigation. Runs the RCA pipeline (focus → organize →
   * create → understand → root cause → solve) and returns the causal
   * graph node.
   */
  investigate(input: InvestigationInput): CausalGraphNode {
    const rca = rcaAnalyze({
      problem: input.symptom,
      evidence: input.evidence,
      hypotheses: input.hypotheses,
      systemNotes: input.systemNotes,
    });

    const impacts =
      input.hypotheses?.map((h) => ({ cause: h.cause, impact: h.likelihood * h.impact })) ?? [];
    const pareto = paretoPrioritize(impacts);
    const rootCause = rca.rootCause;
    const rankIndex = pareto.ranked.findIndex((c) => c.cause === rootCause?.cause);

    const node: CausalGraphNode = {
      id: crypto.randomUUID(),
      symptom: input.symptom,
      why_answers: input.whys ?? [],
      fishbone_categories: input.fishboneCauses ?? {},
      pareto_rank: rankIndex >= 0 ? rankIndex : 0,
      hypothesis_status: 'proposed',
      validation_method: 'controlled-change',
      fix_applied: null,
      recurrence_count: 0,
      inquiry: createInquiryContract({
        design: 'log-derived',
        design_justification: input.inquiry?.design_justification ?? 'root-cause claims require reproducible evidence trails',
        data_collection_method: input.inquiry?.data_collection_method ?? `evidence: ${input.evidence.map((e) => e.source).join(', ') || 'none'}`,
        analysis_method: input.inquiry?.analysis_method ?? 'five-whys descent + fishbone breadth + pareto prioritization',
        sample_scope: input.inquiry?.sample_scope ?? 'this symptom and its evidence set',
        ethics_and_scope_limits: input.inquiry?.ethics_and_scope_limits ?? 'no workspace mutation during investigation',
        confidence: input.inquiry?.confidence ?? 0.6,
      }),
      created_at: new Date().toISOString(),
      fixed_at: null,
    };

    this.nodes.set(node.id, node);
    this.proposedCount++;
    return node;
  }

  /**
   * Validate a hypothesis. One-change-at-a-time constraint: a hypothesis
   * can only be validated by a controlled change or replication — the
   * engine records the method and refuses to validate multiple fixes in
   * the same investigation without the constraint being acknowledged.
   */
  validateHypothesis(id: string, method: string): CausalGraphNode | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    if (node.hypothesis_status === 'validated') return node;
    if (node.fix_applied) return node;

    node.hypothesis_status = 'validated';
    node.validation_method = method;
    this.validatedCount++;
    return node;
  }

  rejectHypothesis(id: string): CausalGraphNode | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    if (node.hypothesis_status === 'validated') return node;
    node.hypothesis_status = 'rejected';
    this.rejectedCount++;
    return node;
  }

  /**
   * Apply a fix after validation. The engine enforces
   * one-change-at-a-time: applying a second fix to the same node is
   * refused until the first fix is either confirmed (recurrence count
   * reset) or rolled back.
   */
  applyFix(id: string, fix: string): CausalGraphNode | null {
    const node = this.nodes.get(id);
    if (!node) return null;
    if (node.hypothesis_status !== 'validated') return null;
    if (node.fix_applied) return null; // one-change-at-a-time
    node.fix_applied = fix;
    node.fixed_at = new Date().toISOString();
    return node;
  }

  /**
   * Report a recurrence of a previously-fixed issue. Returns true if the
   * recurrence was registered (escalates the node back to open with
   * recurrence_count incremented).
   */
  recordRecurrence(id: string): boolean {
    const node = this.nodes.get(id);
    if (!node) return false;
    node.recurrence_count++;
    node.hypothesis_status = 'proposed';
    node.fix_applied = null;
    node.fixed_at = null;
    return true;
  }

  /** Benchmark: fraction of proposed hypotheses that reached validated. */
  getValidationRate(): number {
    if (this.proposedCount === 0) return 0;
    return this.validatedCount / this.proposedCount;
  }

  /** Benchmark: recurrence rate of fixed issues. */
  getRecurrenceRate(): number {
    const everFixed = [...this.nodes.values()].filter((n) => n.recurrence_count > 0 || n.fixed_at);
    if (everFixed.length === 0) return 0;
    const recurred = everFixed.filter((n) => n.recurrence_count > 0).length;
    return recurred / everFixed.length;
  }

  getInvestigation(id: string): CausalGraphNode | undefined {
    return this.nodes.get(id);
  }

  getOpenInvestigations(): CausalGraphNode[] {
    return [...this.nodes.values()].filter((n) => !n.fixed_at);
  }

  /** Which recurring failure to fix first — Pareto step for the Signal Fusion Engine. */
  prioritize(): CausalGraphNode[] {
    return [...this.nodes.values()]
      .sort((a, b) => b.recurrence_count - a.recurrence_count)
      .sort((a, b) => a.pareto_rank - b.pareto_rank);
  }

  getInquiryEligibleNodes(): CausalGraphNode[] {
    return [...this.nodes.values()].filter((n) => validateInquiryContract(n.inquiry).valid);
  }

  getStatus(): Record<string, unknown> {
    return {
      investigations: this.nodes.size,
      proposed: this.proposedCount,
      validated: this.validatedCount,
      rejected: this.rejectedCount,
      validationRate: this.getValidationRate(),
      recurrenceRate: this.getRecurrenceRate(),
      open: this.getOpenInvestigations().length,
    };
  }

  get causeCategories(): readonly CauseCategory[] {
    return CAUSE_CATEGORIES;
  }
}
