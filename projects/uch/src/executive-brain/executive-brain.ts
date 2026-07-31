import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { Planner, type Plan } from './planner.js';
import { DecisionEngine, type Decision, type DecisionOption } from './decision-engine.js';
import { Critic, type Critique, type CritiqueIssue } from './critic.js';
import {
  EngineeringJudgmentEngine,
  type EngineeringJudgmentInput,
  type EngineeringJudgmentResult,
} from '../kernel/constitution/engineering-judgment.js';
import {
  autoTarget,
  createEngineeringJudgment,
} from '../engineering-intelligence/index.js';
import type { EngineeringReview } from '../engineering-intelligence/types.js';
import { MistakeLogger } from '../shared/mistake-logger.js';
import { premortem, type PremortemResult } from '../cognitive-plane/frameworks/decisions/decision-models.js';
import type { FrameworkSelectionInput } from '../cognitive-plane/frameworks/types.js';

export interface ExecutiveBrainConfig {
  eventBus: NeuralEventBus;
}

export interface ChangeAssessment {
  judgment: EngineeringJudgmentResult;
  critique: Critique;
  plan: Plan;
  /** Deterministic engineering-gate review (EI layer); veto findings escalate the verdict. */
  engineeringReview?: EngineeringReview;
  /** Concept ids that vetoed via engineering gates (escalated to review). */
  engineeringVetoes?: string[];
}

export class ExecutiveBrain {
  readonly planner: Planner;
  readonly decisionEngine: DecisionEngine;
  readonly critic: Critic;
  readonly mistakeLogger: MistakeLogger;
  private eventBus: NeuralEventBus;
  private judgmentEngine: EngineeringJudgmentEngine;

  constructor(config: ExecutiveBrainConfig) {
    this.eventBus = config.eventBus;
    this.planner = new Planner();
    this.decisionEngine = new DecisionEngine();
    this.critic = new Critic();
    this.mistakeLogger = new MistakeLogger();
    this.judgmentEngine = new EngineeringJudgmentEngine();

    this.eventBus.subscribeToProtocol('module:handoff', async (event) => {
      const intent = String(event.payload.intent ?? 'handoff');
      const message = String(event.payload.message ?? '');

      const normalizedIntent = intent.toLowerCase();
      const normalizedMessage = message.toLowerCase();
      const isFailureSignal =
        normalizedIntent.includes('error') ||
        normalizedIntent.includes('failure') ||
        normalizedIntent.includes('fail') ||
        normalizedMessage.includes('failed') ||
        normalizedMessage.includes('error') ||
        normalizedMessage.includes('failure');

      let plan: Plan | null = null;
      if (isFailureSignal) {
        const existing = this.mistakeLogger.hasSeen(intent, message);
        if (!existing) {
          this.mistakeLogger.recordMistake({
            source: 'executive-brain',
            intent,
            message,
            severity: 'critical',
          });
          plan = this.planner.createPlan(`Handle ${intent}`);
          this.planner.addStep(plan.id, `Review ${intent}: ${message}`);
          this.critic.createCritique(`Handoff:${intent}`, 'code', [
            {
              severity: 'critical',
              category: 'correctness',
              description: `Failure signal received for ${intent}`,
              evidence: message,
              recommendation: 'Investigate the failing path and add verification before continuing',
            },
          ]);
        }
      } else {
        plan = this.planner.createPlan(`Handle ${intent}`);
        this.planner.addStep(plan.id, `Review ${intent}: ${message}`);
      }

      if (plan) {
        this.eventBus.publish({
          type: 'cognitive:state_changed',
          source: 'executive-brain',
          payload: { intent, message, plan_id: plan?.id, is_failure_signal: isFailureSignal },
        });
      }
    });
  }

  createPlan(goal: string): Plan {
    const plan = this.planner.createPlan(goal);
    this.eventBus.publish({
      type: 'session:started',
      source: 'executive-brain',
      payload: { plan_id: plan.id, goal },
    });
    return plan;
  }

  async executePlanStep(planId: string, stepId: string): Promise<boolean> {
    const plan = this.planner.getPlan(planId);
    if (!plan) return false;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step || step.status !== 'pending') return false;

    this.planner.updateStepStatus(planId, stepId, 'in_progress');

    try {
      // Execute the step (in a real system, this dispatches to the appropriate executor)
      this.planner.updateStepStatus(planId, stepId, 'completed', 'Step executed successfully');
      return true;
    } catch {
      this.planner.updateStepStatus(planId, stepId, 'failed', undefined, 'Execution error');
      return false;
    }
  }

  makeDecision(
    prompt: string,
    options: Omit<DecisionOption, 'id'>[],
    profile?: FrameworkSelectionInput,
  ): Decision {
    const decision = this.decisionEngine.createDecision(prompt, options, profile);
    this.eventBus.publish({
      type: 'cognitive:state_changed',
      source: 'executive-brain',
      payload: {
        decision_id: decision.id,
        prompt,
        option_count: options.length,
        model: decision.model?.id ?? null,
      },
    });
    return decision;
  }

  /**
   * Pre-mortem pre-commit gate (blueprint §5.2): assume the plan failed,
   * rank the plausible causes, and gate the commit when any cause's
   * likelihood × impact crosses the risk threshold.
   */
  premortemGate(
    goal: string,
    possibleCauses?: string[],
    likelihood?: number[],
    impact?: number[],
    threshold = 0.6,
  ): { gate: PremortemResult; passed: boolean; topRisks: string[] } {
    const causes =
      possibleCauses ??
      [
        'scope creep beyond the defined boundary',
        'verification gap — change lands without tests or checks',
        'unclear requirements — the goal is ambiguous',
        'timeline slippage — effort underestimated',
        'resource contention — dependencies are unavailable',
      ];
    const gate = premortem({ plan: goal, possibleCauses: causes, likelihood, impact });
    const topRisks = gate.rankedCauses
      .filter((r) => r.riskScore / 100 >= threshold)
      .map((r) => r.cause);
    this.eventBus.publish({
      type: 'cognitive:state_changed',
      source: 'executive-brain',
      payload: {
        premortem: { plan: goal, passed: topRisks.length === 0, topRisks },
        risk_score: gate.rankedCauses[0]?.riskScore ?? 0,
      },
    });
    return { gate, passed: topRisks.length === 0, topRisks };
  }

  review(target: string, targetType: Critique['target_type']): Critique {
    const searchResults = this.eventBus.getHistory();
    const issues: Omit<CritiqueIssue, 'id'>[] = [];

    if (searchResults.length === 0) {
      issues.push({
        severity: 'suggestion',
        category: 'completeness',
        description: 'No recent context found for review',
        evidence: 'Event history is empty',
        recommendation: 'Populate event history before critiquing',
      });
    }

    const lowerTarget = target.toLowerCase();
    if (lowerTarget.includes('new') && lowerTarget.includes('service')) {
      issues.push({
        severity: 'major',
        category: 'consistency',
        description: 'Potential duplicate abstraction introduced',
        evidence:
          'The proposal appears to create a parallel service instead of extending existing ownership',
        recommendation: 'Prefer changing the current abstraction and preserve module boundaries',
      });
    }

    if (
      lowerTarget.includes('without tests') ||
      lowerTarget.includes('no tests') ||
      lowerTarget.includes('no docs')
    ) {
      issues.push({
        severity: 'major',
        category: 'safety',
        description: 'Verification and documentation are missing from the proposed change',
        evidence: 'The proposal skips tests and docs',
        recommendation:
          'Require tests, documentation, and an explicit risk review before acceptance',
      });
    }

    return this.critic.createCritique(target, targetType, issues);
  }

  evaluateChange(input: EngineeringJudgmentInput): ChangeAssessment {
    const judgment = this.judgmentEngine.evaluate(input);
    const critique = this.review(input.proposedChange, 'code');

    // Engineering-intelligence filter: deterministic gates over the
    // proposed change. Veto findings escalate the executive verdict
    // from pass to review regardless of the lightweight judgment.
    const engineeringReview = createEngineeringJudgment().evaluator.evaluate(
      autoTarget(input.proposedChange),
    );
    const engineeringVetoes = engineeringReview.findings
      .filter((f) => f.gate === 'veto')
      .map((f) => f.conceptId);
    const escalatedJudgment = engineeringVetoes.length > 0 && judgment.verdict === 'pass'
      ? { ...judgment, verdict: 'review' as const }
      : judgment;

    const plan = this.planner.createPlan(`Assess ${input.intent}`, {
      intent: input.intent,
      judgment: escalatedJudgment,
    });
    this.planner.addStep(plan.id, 'Map the change against the existing architecture');
    this.planner.addStep(plan.id, 'Verify tests, docs, and risk coverage');
    this.planner.addStep(plan.id, 'Record follow-up actions for review');

    return {
      judgment: escalatedJudgment,
      critique,
      plan,
      engineeringReview,
      ...(engineeringVetoes.length > 0 ? { engineeringVetoes } : {}),
    };
  }

  summarizeAssessment(assessment: ChangeAssessment): string {
    return [
      'Change assessment',
      `- verdict: ${assessment.judgment.verdict}`,
      `- score: ${assessment.judgment.score.toFixed(2)}`,
      `- risk: ${assessment.judgment.riskLevel}`,
      `- next steps: ${assessment.judgment.nextSteps.join(' | ')}`,
      `- critique issues: ${assessment.critique.issues.length}`,
      `- plan steps: ${assessment.plan.steps.length}`,
    ].join('\n');
  }

  summary(): string {
    const activePlans = this.planner.getActivePlans();
    const recentDecisions = this.decisionEngine.getRecentDecisions(5);
    const criticalIssues = this.critic.getCriticalIssues();

    return [
      '=== Executive Brain ===',
      `Active plans: ${activePlans.length}`,
      ...activePlans.map(
        (p) =>
          `  [${p.status}] ${p.goal} (${p.steps.filter((s) => s.status === 'completed').length}/${p.steps.length} steps)`,
      ),
      '',
      `Recent decisions: ${recentDecisions.length}`,
      ...recentDecisions.map((d) => `  [${d.status}] ${d.prompt}`),
      '',
      `Critical issues: ${criticalIssues.length}`,
      ...criticalIssues.map((i) => `  [${i.severity}] ${i.description}`),
    ].join('\n');
  }
}
