/**
 * Decision Model Router — blueprint §3.1.
 *
 * Extension of the Executive System: classifies a decision context
 * (data richness, time pressure, stakeholders, uncertainty,
 * reversibility) and routes to the right model from the 12-model
 * decision library. The model library itself lives in the Cognitive
 * Frameworks corpus (`frameworks/decisions`) — this organ adds the
 * stateful routing layer: context classification, model selection,
 * DecisionRecords with InquiryContract, and outcome tracking for the
 * router-selection benchmark.
 *
 * Benchmark: router-selection agreement rate against human-labeled
 * cases; decision-outcome quality delta tracked retrospectively.
 */

import {
  createFrameworkRegistry,
  classifyDecision,
  type FrameworkRegistry,
} from '../cognitive-plane/frameworks/index.js';
import {
  createInquiryContract,
  validateInquiryContract,
  type InquiryContract,
} from '../kernel/epistemic/inquiry-contract.js';

export type DataRichness = 'low' | 'medium' | 'high';
export type TimePressure = 'none' | 'moderate' | 'critical';
export type StakeholderCount = 'one' | 'few' | 'many';
export type Uncertainty = 'low' | 'high';
export type Reversibility = 'reversible' | 'irreversible';
export type DecisionOutcome = 'pending' | 'confirmed_good' | 'confirmed_bad';

export interface DecisionContextClassification {
  data_richness: DataRichness;
  time_pressure: TimePressure;
  stakeholder_count: StakeholderCount;
  uncertainty: Uncertainty;
  reversibility: Reversibility;
}

export interface DecisionRecord {
  id: string;
  problem: string;
  context_classification: DecisionContextClassification;
  model_selected: string;
  alternatives: string[];
  rationale: string;
  outcome: DecisionOutcome;
  inquiry: InquiryContract;
  created_at: string;
}

export interface RouteResult {
  decision: DecisionRecord;
  fitScore: number;
}

export class DecisionModelRouter {
  private registry: FrameworkRegistry;
  private records: Map<string, DecisionRecord> = new Map();
  private agreements = 0;
  private disagreements = 0;

  constructor(registry?: FrameworkRegistry) {
    this.registry = registry ?? createFrameworkRegistry();
  }

  /** Classify the decision context from raw signals (corpus quick guide). */
  classify(
    data_richness: number,
    time_pressure: number,
    stakeholder_count: number,
    uncertainty: number,
    reversibility: boolean,
  ): DecisionContextClassification {
    return {
      data_richness: data_richness >= 0.66 ? 'high' : data_richness >= 0.33 ? 'medium' : 'low',
      time_pressure: time_pressure >= 0.66 ? 'critical' : time_pressure >= 0.33 ? 'moderate' : 'none',
      stakeholder_count: stakeholder_count >= 2 ? 'many' : stakeholder_count >= 1 ? 'few' : 'one',
      uncertainty: uncertainty >= 0.5 ? 'high' : 'low',
      reversibility: reversibility ? 'reversible' : 'irreversible',
    };
  }

  /**
   * Route a decision: classify the context, select a model from the
   * 12-model library, and record a DecisionRecord carrying the
   * InquiryContract. The record is Knowledge-tier material until the
   * outcome is validated (Wisdom requires outcome validation).
   */
  route(input: {
    problem: string;
    data_richness: number;
    time_pressure: number;
    stakeholder_count: number;
    uncertainty: number;
    reversibility: boolean;
    inquiry?: Omit<InquiryContract, 'confidence'> & { confidence?: number };
  }): RouteResult {
    const context = this.classify(
      input.data_richness,
      input.time_pressure,
      input.stakeholder_count,
      input.uncertainty,
      input.reversibility,
    );

    const modelId = this.pickModel(context);
    const def = this.registry.get(modelId);
    const selected = def ?? this.registry.list('decisions')[0]!;
    const fitScore = this.registry.scoreFit(selected, {
      problem: input.problem,
      family: 'decisions',
      dataAvailability: input.data_richness,
      timePressure: input.time_pressure,
      stakeholderInvolvement: input.stakeholder_count,
      risk: input.uncertainty,
    });

    const decision: DecisionRecord = {
      id: crypto.randomUUID(),
      problem: input.problem,
      context_classification: context,
      model_selected: selected.id,
      alternatives: this.registry
        .list('decisions')
        .map((f) => f.id)
        .filter((id) => id !== selected.id)
        .slice(0, 3),
      rationale: this.buildRationale(context, selected.name),
      outcome: 'pending',
      inquiry: createInquiryContract({
        design: 'log-derived',
        design_justification: input.inquiry?.design_justification ?? 'decision routing traces to classified context',
        data_collection_method: input.inquiry?.data_collection_method ?? `context signals: data=${input.data_richness}, time=${input.time_pressure}`,
        analysis_method: input.inquiry?.analysis_method ?? `routed via '${selected.id}' model from the 12-model library`,
        sample_scope: input.inquiry?.sample_scope ?? 'this decision context only',
        ethics_and_scope_limits: input.inquiry?.ethics_and_scope_limits ?? 'no side effects during routing',
        confidence: input.inquiry?.confidence ?? 0.7,
      }),
      created_at: new Date().toISOString(),
    };

    this.records.set(decision.id, decision);
    return { decision, fitScore };
  }

  /** The routing table from the blueprint §3.1, made executable. */
  pickModel(context: DecisionContextClassification): string {
    const c = context;
    if (c.time_pressure === 'critical') return 'intuitive';
    if (c.data_richness === 'high' && c.time_pressure === 'none') {
      return c.reversibility === 'reversible' ? 'cost-benefit' : 'decision-matrix';
    }
    if (c.stakeholder_count === 'many') return 'delphi';
    if (c.uncertainty === 'high' && c.reversibility === 'irreversible') return 'decision-tree';
    return 'rational';
  }

  /** Retrospective benchmark: how often the router agreed with an expert pick. */
  recordAgreement(agreed: boolean): void {
    if (agreed) this.agreements++;
    else this.disagreements++;
  }

  getAgreementRate(): number {
    const total = this.agreements + this.disagreements;
    return total === 0 ? 0 : this.agreements / total;
  }

  /** Record the validated outcome of a decision (Wisdom-tier input). */
  recordOutcome(id: string, outcome: 'confirmed_good' | 'confirmed_bad'): boolean {
    const decision = this.records.get(id);
    if (!decision || decision.outcome !== 'pending') return false;
    decision.outcome = outcome;
    return true;
  }

  getDecision(id: string): DecisionRecord | undefined {
    return this.records.get(id);
  }

  getDecisionsByOutcome(outcome: DecisionOutcome): DecisionRecord[] {
    return [...this.records.values()].filter((d) => d.outcome === outcome);
  }

  /** Routed decisions with fully-populated inquiry contracts. */
  getInquiryEligible(): DecisionRecord[] {
    return [...this.records.values()].filter((d) => validateInquiryContract(d.inquiry).valid);
  }

  /** Decision-outcome quality delta: good outcomes minus bad, normalized. */
  getOutcomeQuality(): number {
    const good = this.getDecisionsByOutcome('confirmed_good').length;
    const bad = this.getDecisionsByOutcome('confirmed_bad').length;
    const total = good + bad;
    return total === 0 ? 0 : (good - bad) / total;
  }

  getStatus(): Record<string, unknown> {
    return {
      decisions: this.records.size,
      agreementRate: this.getAgreementRate(),
      outcomeQuality: this.getOutcomeQuality(),
      open: this.getDecisionsByOutcome('pending').length,
    };
  }

  private buildRationale(context: DecisionContextClassification, modelName: string): string {
    return [
      `data_richness=${context.data_richness}`,
      `time_pressure=${context.time_pressure}`,
      `stakeholders=${context.stakeholder_count}`,
      `uncertainty=${context.uncertainty}`,
      `reversibility=${context.reversibility}`,
      `→ ${modelName}`,
    ].join(', ');
  }
}

/** Convenience re-export of the corpus classifier for consumers. */
export function classifyWithCorpus(input: Parameters<typeof classifyDecision>[0]) {
  return classifyDecision(input);
}
