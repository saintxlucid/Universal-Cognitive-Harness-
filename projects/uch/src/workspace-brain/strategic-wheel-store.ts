/**
 * Strategic Wheel Store + Strategy/Plan Separation — blueprint §3.2.
 *
 * Extension of the Workspace Brain: the workspace-owned identity layer.
 * Strategy (20-question Strategic Wheel, quarterly cadence, 3-5yr
 * horizon) and Plan (daily cadence) are two separate, non-conflatable
 * stores with different mutation cadences — enforced at the schema and
 * authorization level, not by convention.
 *
 * The bug this prevents: agent memory systems routinely conflate "what
 * we decided to build" with "what's in this sprint". Enforcing different
 * mutation cadences prevents an agent from silently overwriting
 * workspace purpose while updating a todo list.
 *
 * Benchmarkable: strategy-mutation frequency (should trend quarterly or
 * slower; alarm on daily-rate writes), plan/strategy cross-contamination
 * rate (writes touching both stores in one transaction).
 *
 * Strategy writes require the elevated `strategy.wheel.write` grant and
 * are versioned and diffable (Law 18).
 */

import { strategyWheel, strategyVsPlan, type StrategyWheelInput } from '../cognitive-plane/frameworks/strategy/strategy-wheel.js';

export interface StrategicWheelState {
  purpose_and_direction: {
    mission: string;
    beliefs: string[];
    three_year_vision: string;
  };
  market_and_advantage: {
    highest_value_users: string[];
    differentiators: string[];
  };
  goals_and_metrics: {
    top_priorities: string[];
    north_star_metric: string;
    review_cadence: string;
  };
  actions_and_tactics: {
    quick_wins: string[];
    blockers: string[];
    owners: Record<string, string>;
  };
  last_reviewed: string;
  mutation_cadence: 'quarterly';
}

export interface PlanState {
  goals: string[];
  ownership: Record<string, string>;
  resources: Record<string, string>;
  timeline: Record<string, string>;
  tracking: Record<string, string>;
  mutation_cadence: 'daily';
}

export interface StrategyVersion {
  version: number;
  state: StrategicWheelState;
  written_by: string;
  written_at: string;
  grant: string;
}

export type StrategyWriteResult =
  | { ok: true; version: number; state: StrategicWheelState }
  | { ok: false; reason: 'missing-grant' | 'too-frequent' | 'cross-contamination' };

export type PlanWriteResult =
  | { ok: true; plan: PlanState }
  | { ok: false; reason: 'cross-contamination' | 'missing-plan' };

export class StrategicWheelStore {
  private strategy: StrategicWheelState;
  private plan: PlanState;
  private versions: StrategyVersion[] = [];
  private strategyWrites: string[] = [];
  private crossContaminationCount = 0;
  private readonly minStrategyWriteIntervalMs: number;

  constructor(minStrategyWriteIntervalMs = 30 * 24 * 60 * 60 * 1000) {
    this.minStrategyWriteIntervalMs = minStrategyWriteIntervalMs;
    this.strategy = {
      purpose_and_direction: { mission: '', beliefs: [], three_year_vision: '' },
      market_and_advantage: { highest_value_users: [], differentiators: [] },
      goals_and_metrics: { top_priorities: [], north_star_metric: '', review_cadence: '' },
      actions_and_tactics: { quick_wins: [], blockers: [], owners: {} },
      last_reviewed: new Date().toISOString(),
      mutation_cadence: 'quarterly',
    };
    this.plan = {
      goals: [],
      ownership: {},
      resources: {},
      timeline: {},
      tracking: {},
      mutation_cadence: 'daily',
    };
  }

  /**
   * Write to the Strategic Wheel. Requires the elevated grant
   * (`strategy.wheel.write` — distinct from `plan.write` per Law 18),
   * respects the quarterly mutation cadence, and refuses
   * cross-contaminated writes that touch plan state in the same
   * transaction.
   */
  writeStrategy(
    updates: Partial<StrategicWheelState>,
    context: { grant: string; writer: string },
    contaminated?: { plan?: unknown },
  ): StrategyWriteResult {
    if (context.grant !== 'strategy.wheel.write') {
      return { ok: false, reason: 'missing-grant' };
    }
    if (contaminated && contaminated.plan !== undefined) {
      this.crossContaminationCount++;
      return { ok: false, reason: 'cross-contamination' };
    }

    const lastWrite = this.strategyWrites[this.strategyWrites.length - 1];
    if (lastWrite && Date.now() - new Date(lastWrite).getTime() < this.minStrategyWriteIntervalMs) {
      return { ok: false, reason: 'too-frequent' };
    }

    this.strategy = {
      ...this.strategy,
      ...updates,
      mutation_cadence: 'quarterly',
      last_reviewed: new Date().toISOString(),
    };
    this.strategyWrites.push(new Date().toISOString());

    const version: StrategyVersion = {
      version: this.versions.length + 1,
      state: { ...this.strategy },
      written_by: context.writer,
      written_at: new Date().toISOString(),
      grant: context.grant,
    };
    this.versions.push(version);

    return { ok: true, version: version.version, state: { ...this.strategy } };
  }

  /**
   * Write to the Plan store (daily cadence — no interval restriction).
   * A plan write that also touches strategic_wheel state is refused and
   * counted as contamination.
   */
  writePlan(
    updates: Partial<PlanState>,
    contaminated?: { strategy?: unknown },
  ): PlanWriteResult {
    if (contaminated && contaminated.strategy !== undefined) {
      this.crossContaminationCount++;
      return { ok: false, reason: 'cross-contamination' };
    }
    this.plan = {
      ...this.plan,
      ...updates,
      mutation_cadence: 'daily',
    };
    return { ok: true, plan: { ...this.plan } };
  }

  getStrategy(): StrategicWheelState {
    return { ...this.strategy };
  }

  getPlan(): PlanState {
    return { ...this.plan };
  }

  getVersions(): StrategyVersion[] {
    return [...this.versions];
  }

  /** Run the 20-question wheel audit against the stored strategy. */
  auditWheel(): ReturnType<typeof strategyWheel> {
    return strategyWheel(this.wheelInput());
  }

  /** Run the strategy-vs-plan separation audit. */
  auditSeparation(): ReturnType<typeof strategyVsPlan> {
    return strategyVsPlan({
      strategy: {
        purpose: this.strategy.purpose_and_direction.mission,
        arena: this.strategy.market_and_advantage.highest_value_users.join(', '),
        advantage: this.strategy.market_and_advantage.differentiators.join(', '),
        capabilities: this.strategy.actions_and_tactics.owners
          ? 'ownership defined per outcome'
          : undefined,
        revenueLogic: this.strategy.goals_and_metrics.north_star_metric || undefined,
      },
      plan: {
        goals: this.plan.goals.join(', ') || undefined,
        ownership: Object.keys(this.plan.ownership).length > 0 ? 'defined' : undefined,
        resources: Object.keys(this.plan.resources).length > 0 ? 'defined' : undefined,
        timeline: Object.keys(this.plan.timeline).length > 0 ? 'defined' : undefined,
        tracking: Object.keys(this.plan.tracking).length > 0 ? 'defined' : undefined,
      },
    });
  }

  /** Benchmark: strategy mutation frequency (writes per day, trailing window). */
  getStrategyWriteFrequencyPerDay(days = 30): number {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = this.strategyWrites.filter((w) => new Date(w).getTime() >= cutoff).length;
    return Math.round((recent / days) * 100) / 100;
  }

  /** Benchmark: plan/strategy cross-contamination rate. */
  getCrossContaminationRate(): number {
    const total = this.strategyWrites.length + this.crossContaminationCount;
    return total === 0 ? 0 : this.crossContaminationCount / total;
  }

  private wheelInput(): StrategyWheelInput {
    const s = this.strategy;
    return {
      answers: {
        purpose: [
          { question: 'What is our mission in one clear sentence?', answer: s.purpose_and_direction.mission || undefined },
          { question: 'What do we believe that drives how we operate?', answer: s.purpose_and_direction.beliefs.join('; ') || undefined },
          { question: 'Where do we want to be in three years?', answer: s.purpose_and_direction.three_year_vision || undefined },
        ],
        market: [
          { question: 'Who is our highest-value customer?', answer: s.market_and_advantage.highest_value_users.join('; ') || undefined },
          { question: 'Why do people choose us instead of competitors?', answer: s.market_and_advantage.differentiators.join('; ') || undefined },
        ],
        goals: [
          { question: 'What are our top three priorities?', answer: s.goals_and_metrics.top_priorities.join('; ') || undefined },
          { question: "What's the one number that matters today?", answer: s.goals_and_metrics.north_star_metric || undefined },
          { question: 'How often should we review progress?', answer: s.goals_and_metrics.review_cadence || undefined },
        ],
        actions: [
          { question: 'What quick wins create momentum?', answer: s.actions_and_tactics.quick_wins.join('; ') || undefined },
          { question: "What's blocking progress?", answer: s.actions_and_tactics.blockers.join('; ') || undefined },
          { question: 'Who owns each outcome?', answer: Object.keys(s.actions_and_tactics.owners).join('; ') || undefined },
        ],
      },
    };
  }
}
