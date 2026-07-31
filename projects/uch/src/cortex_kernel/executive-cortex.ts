import { Consciousness } from '../aether/consciousness.js';
import { ConsciousnessGate } from './integrator.js';
import { AttentionCortex } from './attention-cortex.js';
import { UnderstandingCortex } from './understanding-cortex.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import type { Plan } from '../executive-brain/planner.js';

export interface ExecutiveCortexConfig {
  planningCadenceMs: number;
  maxActivePlans: number;
  autoSelect: boolean;
  minPlanConfidence: number;
  enableCompetitiveSelection: boolean;
}

export interface PlanProposal {
  goal: string;
  confidence: number;
  urgency: number;
  complexity: number;
  expectedValue: number;
  estimatedCost: number;
  context: Record<string, unknown>;
}

export class ExecutiveCortex {
  private consciousness: Consciousness;
  private gate: ConsciousnessGate;
  private attention: AttentionCortex;
  private understanding: UnderstandingCortex;
  private executive: ExecutiveBrain;
  private kernel: CognitiveKernel;
  private eventBus: NeuralEventBus;
  private config: Required<ExecutiveCortexConfig>;
  private proposals: PlanProposal[] = [];
  private planningTimer: ReturnType<typeof setInterval> | null = null;
  private totalPlansSelected = 0;
  private totalProposalsGenerated = 0;

  constructor(
    consciousness: Consciousness,
    gate: ConsciousnessGate,
    attention: AttentionCortex,
    understanding: UnderstandingCortex,
    executive: ExecutiveBrain,
    kernel: CognitiveKernel,
    eventBus: NeuralEventBus,
    config?: Partial<ExecutiveCortexConfig>,
  ) {
    this.consciousness = consciousness;
    this.gate = gate;
    this.attention = attention;
    this.understanding = understanding;
    this.executive = executive;
    this.kernel = kernel;
    this.eventBus = eventBus;
    this.config = {
      planningCadenceMs: config?.planningCadenceMs ?? 15000,
      maxActivePlans: config?.maxActivePlans ?? 5,
      autoSelect: config?.autoSelect ?? true,
      minPlanConfidence: config?.minPlanConfidence ?? 0.4,
      enableCompetitiveSelection: config?.enableCompetitiveSelection ?? true,
    };
  }

  proposePlan(proposal: PlanProposal): void {
    this.proposals.push(proposal);
    this.totalProposalsGenerated++;
    if (this.proposals.length > 20) {
      this.proposals = this.proposals.slice(-20);
    }

    this.consciousness.observe(
      'strategic',
      `Plan proposed: ${proposal.goal} (conf: ${proposal.confidence.toFixed(2)}, urgency: ${proposal.urgency.toFixed(2)})`,
      'executive-cortex',
    );
  }

  selectPlans(): Plan[] {
    const activePlans = this.executive.planner.getActivePlans();
    const availableSlots = Math.max(0, this.config.maxActivePlans - activePlans.length);

    if (availableSlots === 0 || this.proposals.length === 0) return [];

    let candidates = [...this.proposals];

    if (this.config.enableCompetitiveSelection) {
      candidates = this.competitiveSelection(candidates);
    }

    candidates = candidates
      .filter((p) => p.confidence >= this.config.minPlanConfidence)
      .sort((a, b) => {
        const scoreA = a.expectedValue * 0.4 + a.urgency * 0.3 + a.confidence * 0.3 - a.estimatedCost * 0.2;
        const scoreB = b.expectedValue * 0.4 + b.urgency * 0.3 + b.confidence * 0.3 - b.estimatedCost * 0.2;
        return scoreB - scoreA;
      });

    const selected = candidates.slice(0, availableSlots);
    this.proposals = this.proposals.filter((p) => !selected.includes(p));

    const createdPlans: Plan[] = [];
    for (const proposal of selected) {
      const plan = this.executive.createPlan(proposal.goal);
      createdPlans.push(plan);
      this.totalPlansSelected++;

      this.eventBus.publish({
        type: 'cognitive:state_changed',
        source: 'executive-cortex',
        payload: {
          planId: plan.id,
          goal: proposal.goal,
          confidence: proposal.confidence,
          urgency: proposal.urgency,
        },
      });

      this.consciousness.observe(
        'strategic',
        `Plan selected: ${proposal.goal} (plan: ${plan.id})`,
        'executive-cortex',
      );
    }

    return createdPlans;
  }

  private competitiveSelection(candidates: PlanProposal[]): PlanProposal[] {
    const scored = candidates.map((proposal) => {
      const competitorPenalty = candidates.filter(
        (c) => c !== proposal && this.areCompeting(proposal, c),
      ).length * 0.1;

      const noveltyBonus = this.isNovelProposal(proposal) ? 0.15 : 0;

      const finalScore =
        proposal.expectedValue * 0.3 +
        proposal.urgency * 0.2 +
        proposal.confidence * 0.2 -
        proposal.estimatedCost * 0.15 -
        competitorPenalty +
        noveltyBonus;

      return { proposal, score: finalScore };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .map((s) => s.proposal);
  }

  private areCompeting(a: PlanProposal, b: PlanProposal): boolean {
    const aWords = new Set(a.goal.toLowerCase().split(' '));
    const bWords = new Set(b.goal.toLowerCase().split(' '));
    let overlap = 0;
    for (const word of aWords) {
      if (bWords.has(word)) overlap++;
    }
    return overlap >= 2;
  }

  private isNovelProposal(proposal: PlanProposal): boolean {
    const activePlans = this.executive.planner.getActivePlans();
    return !activePlans.some((plan) => {
      const planWords = plan.goal.toLowerCase().split(' ');
      const propWords = proposal.goal.toLowerCase().split(' ');
      return planWords.some((w) => propWords.includes(w));
    });
  }

  schedulePlanning(): void {
    if (this.planningTimer) return;
    this.planningTimer = setInterval(async () => {
      if (this.config.autoSelect) {
        this.selectPlans();
      }
    }, this.config.planningCadenceMs);
  }

  stopPlanning(): void {
    if (this.planningTimer) {
      clearInterval(this.planningTimer);
      this.planningTimer = null;
    }
  }

  getProposals(limit = 10): PlanProposal[] {
    return this.proposals.slice(-limit);
  }

  getStats(): Record<string, unknown> {
    return {
      totalProposalsGenerated: this.totalProposalsGenerated,
      totalPlansSelected: this.totalPlansSelected,
      pendingProposals: this.proposals.length,
      activePlans: this.executive.planner.getActivePlans().length,
      config: {
        maxActivePlans: this.config.maxActivePlans,
        autoSelect: this.config.autoSelect,
        enableCompetitiveSelection: this.config.enableCompetitiveSelection,
      },
    };
  }
}
