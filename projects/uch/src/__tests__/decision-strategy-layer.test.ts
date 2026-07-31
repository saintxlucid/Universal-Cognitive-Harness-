import { describe, it, expect } from 'vitest';
import { DecisionModelRouter } from '../executive-brain/decision-router.js';
import { ProblemSolvingRouter } from '../executive-brain/problem-router.js';
import { EtiologyEngine } from '../etiology/etiology-engine.js';
import { StrategicWheelStore } from '../workspace-brain/strategic-wheel-store.js';

describe('Decision Model Router', () => {
  it('classifies a decision context from raw signals', () => {
    const router = new DecisionModelRouter();
    const context = router.classify(0.9, 0.1, 0, 0.2, true);
    expect(context).toEqual({
      data_richness: 'high',
      time_pressure: 'none',
      stakeholder_count: 'one',
      uncertainty: 'low',
      reversibility: 'reversible',
    });
  });

  it('routes time-critical decisions to fast models', () => {
    const router = new DecisionModelRouter();
    const { decision } = router.route({
      problem: 'incident response — act now',
      data_richness: 0.2,
      time_pressure: 0.9,
      stakeholder_count: 0,
      uncertainty: 0.6,
      reversibility: true,
    });
    expect(decision.model_selected).toBe('intuitive');
    expect(decision.inquiry.design).toBe('log-derived');
    expect(router.getDecision(decision.id)).toBeDefined();
  });

  it('routes data-rich unhurried decisions to analytical models', () => {
    const router = new DecisionModelRouter();
    const { decision } = router.route({
      problem: 'choose the caching layer',
      data_richness: 0.9,
      time_pressure: 0.1,
      stakeholder_count: 0,
      uncertainty: 0.2,
      reversibility: true,
    });
    expect(['cost-benefit', 'decision-matrix']).toContain(decision.model_selected);
  });

  it('routes irreversible high-uncertainty decisions to decision-tree', () => {
    const router = new DecisionModelRouter();
    const { decision } = router.route({
      problem: 'migrate the database',
      data_richness: 0.5,
      time_pressure: 0.2,
      stakeholder_count: 0,
      uncertainty: 0.9,
      reversibility: false,
    });
    expect(decision.model_selected).toBe('decision-tree');
  });

  it('routes many-stakeholder decisions to group models', () => {
    const router = new DecisionModelRouter();
    const { decision } = router.route({
      problem: 'set team roadmap',
      data_richness: 0.4,
      time_pressure: 0.3,
      stakeholder_count: 3,
      uncertainty: 0.4,
      reversibility: true,
    });
    expect(decision.model_selected).toBe('delphi');
  });

  it('tracks agreement rate and outcome quality benchmarks', () => {
    const router = new DecisionModelRouter();
    const { decision } = router.route({
      problem: 'pick a queue broker',
      data_richness: 0.8,
      time_pressure: 0.2,
      stakeholder_count: 0,
      uncertainty: 0.3,
      reversibility: true,
    });
    router.recordAgreement(true);
    router.recordAgreement(false);
    expect(router.getAgreementRate()).toBeCloseTo(0.5);

    router.recordOutcome(decision.id, 'confirmed_good');
    expect(router.recordOutcome(decision.id, 'confirmed_bad')).toBe(false); // already recorded
    expect(router.getOutcomeQuality()).toBeCloseTo(1);
    expect(router.getStatus().open).toBe(0);
  });
});

describe('Problem-Solving Router', () => {
  it('routes human-centered problems to design-thinking', () => {
    const router = new ProblemSolvingRouter();
    const result = router.route({
      problem: 'redesign onboarding for users',
      clarity: 0.4,
      complexity: 0.6,
      humanCentered: true,
    });
    expect(result.classification.class).toBe('human-centered');
    expect(result.framework).toBe('design-thinking');
  });

  it('routes continuous-improvement problems to pdca', () => {
    const router = new ProblemSolvingRouter();
    const result = router.route({
      problem: 'reduce build time steadily',
      clarity: 0.5,
      complexity: 0.4,
      continuousImprovement: true,
    });
    expect(result.framework).toBe('pdca');
  });

  it('routes fast-changing problems to ooda', () => {
    const router = new ProblemSolvingRouter();
    const result = router.route({
      problem: 'keep up with competitor releases',
      clarity: 0.3,
      complexity: 0.5,
      speedAdaptability: true,
    });
    expect(result.framework).toBe('ooda');
  });

  it('delegates kepner-tregoe problem analysis to the Etiology Engine', () => {
    const etiology = new EtiologyEngine();
    const router = new ProblemSolvingRouter(etiology);
    const result = router.route({
      problem: 'complex multi-causal production outage',
      clarity: 0.3,
      complexity: 0.9,
    });
    expect(result.delegatedToEtiology).toBe(true);
    expect(result.framework).toBe('kepner-tregoe');
  });

  it('keeps the etiology seam off when no engine is attached', () => {
    const router = new ProblemSolvingRouter();
    const result = router.route({
      problem: 'complex multi-causal production outage',
      clarity: 0.3,
      complexity: 0.9,
    });
    expect(result.delegatedToEtiology).toBe(false);
    expect(result.stages).toContain('Problem Analysis');
    expect(router.getStatus().frameworks).toContain('ideal');
  });
});

describe('Strategic Wheel Store', () => {
  const writer = { grant: 'strategy.wheel.write', writer: 'executive' };
  const ordinary = { grant: 'plan.write', writer: 'task-agent' };

  function store() {
    return new StrategicWheelStore(30 * 24 * 60 * 60 * 1000);
  }

  it('refuses strategy writes without the elevated grant', () => {
    const s = store();
    const result = s.writeStrategy({}, ordinary);
    expect(result).toEqual({ ok: false, reason: 'missing-grant' });
  });

  it('accepts strategy writes with the elevated grant and versions them', () => {
    const s = store();
    const result = s.writeStrategy(
      { goals_and_metrics: { top_priorities: ['a', 'b'], north_star_metric: 'X', review_cadence: 'q' } },
      writer,
    );
    expect(result.ok).toBe(true);
    expect(s.getVersions()).toHaveLength(1);
    expect(s.getVersions()[0]!.grant).toBe('strategy.wheel.write');
  });

  it('enforces the quarterly mutation cadence', () => {
    const s = new StrategicWheelStore(30 * 24 * 60 * 60 * 1000);
    s.writeStrategy({}, writer);
    const second = s.writeStrategy({}, writer);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toBe('too-frequent');
  });

  it('refuses cross-contaminated writes in both directions', () => {
    const s = store();
    const strategyWrite = s.writeStrategy({}, writer, { plan: { goals: ['x'] } });
    expect(strategyWrite.ok).toBe(false);
    const planWrite = s.writePlan({ goals: ['y'] }, { strategy: { mission: 'hijack' } });
    expect(planWrite.ok).toBe(false);
    expect(s.getCrossContaminationRate()).toBe(1);
  });

  it('allows plan writes at daily cadence without restriction', () => {
    const s = store();
    expect(s.writePlan({ goals: ['today'] }).ok).toBe(true);
    expect(s.writePlan({ goals: ['tomorrow'] }).ok).toBe(true);
    expect(s.getPlan().goals).toEqual(['tomorrow']);
  });

  it('audits the strategic wheel completeness', () => {
    const s = store();
    s.writeStrategy(
      {
        purpose_and_direction: { mission: 'ship reliable software', beliefs: ['fast'], three_year_vision: 'top of market' },
        market_and_advantage: { highest_value_users: ['devs'], differentiators: ['speed'] },
        goals_and_metrics: { top_priorities: ['reliability'], north_star_metric: 'uptime', review_cadence: 'quarterly' },
        actions_and_tactics: { quick_wins: ['docs'], blockers: [], owners: { docs: 'alice' } },
      },
      writer,
    );
    const audit = s.auditWheel();
    expect(audit.completenessPct).toBeGreaterThanOrEqual(50);
    s.writePlan({
      goals: ['release reliability backlog'],
      ownership: { reliability: 'alice' },
      resources: { q3: '2 engineers' },
      timeline: { release: 'Q3' },
      tracking: { velocity: 'weekly' },
    });
    expect(s.auditSeparation().diagnosis).toContain('aligned');
  });

  it('reports strategy write frequency benchmark', () => {
    const s = store();
    s.writeStrategy({}, writer);
    expect(s.getStrategyWriteFrequencyPerDay()).toBeLessThan(0.5);
  });

  it('runs the 20-question audit with answers wired to the wheel', () => {
    const s = store();
    const empty = s.auditWheel();
    expect(empty.completenessPct).toBe(0);
  });
});
