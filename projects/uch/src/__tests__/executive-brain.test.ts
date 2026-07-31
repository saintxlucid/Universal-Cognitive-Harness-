import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { Planner } from '../executive-brain/planner.js';
import { DecisionEngine } from '../executive-brain/decision-engine.js';
import { Critic } from '../executive-brain/critic.js';

describe('Planner', () => {
  let planner: Planner;

  beforeEach(() => {
    planner = new Planner();
  });

  it('creates a plan', () => {
    const plan = planner.createPlan('Build auth module');
    expect(plan.id).toBeTruthy();
    expect(plan.goal).toBe('Build auth module');
    expect(plan.status).toBe('active');
  });

  it('adds steps to a plan', () => {
    const plan = planner.createPlan('Deploy');
    const step = planner.addStep(plan.id, 'Build Docker image');
    expect(step).not.toBeNull();
    expect(step!.description).toBe('Build Docker image');
    expect(step!.status).toBe('pending');
  });

  it('returns null when adding step to nonexistent plan', () => {
    expect(planner.addStep('nope', 'step')).toBeNull();
  });

  it('resolves step dependencies', () => {
    const plan = planner.createPlan('CI');
    const s1 = planner.addStep(plan.id, 'Lint')!;
    const s2 = planner.addStep(plan.id, 'Test', [s1.id])!;
    planner.addStep(plan.id, 'Deploy', [s2.id]);

    // Only lint should be ready
    let next = planner.getNextSteps(plan.id);
    expect(next.length).toBe(1);
    expect(next[0]!.id).toBe(s1.id);

    // Complete lint, test should become ready
    planner.updateStepStatus(plan.id, s1.id, 'completed');
    next = planner.getNextSteps(plan.id);
    expect(next.length).toBe(1);
    expect(next[0]!.id).toBe(s2.id);
  });

  it('reveals blocked steps and assigns agents', () => {
    const plan = planner.createPlan('Block test');
    const s1 = planner.addStep(plan.id, 'Start')!;
    const s2 = planner.addStep(plan.id, 'Wait', [s1.id])!;
    planner.updateStepStatus(plan.id, s2.id, 'blocked', undefined, 'dependency issue');
    planner.assignStep(plan.id, s1.id, 'agent-1');

    expect(planner.getBlockedSteps(plan.id)).toHaveLength(1);
    expect(planner.getBlockedSteps(plan.id)[0]!.id).toBe(s2.id);
    expect(planner.getPlan(plan.id)?.steps[0]?.assigned_agent).toBe('agent-1');
    expect(planner.getReadySteps(plan.id)).toHaveLength(1);
  });

  it('auto-completes plan when all steps done', () => {
    const plan = planner.createPlan('Quick');
    const step = planner.addStep(plan.id, 'Do it')!;
    planner.updateStepStatus(plan.id, step.id, 'completed');
    expect(planner.getPlan(plan.id)?.status).toBe('completed');
  });

  it('marks plan as failed when any step fails', () => {
    const plan = planner.createPlan('Risk');
    const s1 = planner.addStep(plan.id, 'Step 1')!;
    const s2 = planner.addStep(plan.id, 'Step 2')!;
    planner.updateStepStatus(plan.id, s1.id, 'completed');
    planner.updateStepStatus(plan.id, s2.id, 'failed');
    expect(planner.getPlan(plan.id)?.status).toBe('failed');
  });

  it('lists active plans', () => {
    planner.createPlan('Active one');
    const p2 = planner.createPlan('Active two');
    const step = planner.addStep(p2.id, 'Step')!;
    planner.updateStepStatus(p2.id, step.id, 'completed');

    expect(planner.getActivePlans().length).toBe(1);
  });

  it('generates plan summary', () => {
    const plan = planner.createPlan('Test');
    planner.addStep(plan.id, 'Step A');
    const summary = planner.planSummary(plan.id);
    expect(summary).toContain('Test');
    expect(summary).toContain('0/1');
  });

  it('returns null summary for nonexistent plan', () => {
    expect(planner.planSummary('nope')).toBeNull();
  });
});

describe('DecisionEngine', () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine();
  });

  it('creates a decision with options', () => {
    const d = engine.createDecision('Which framework?', [
      {
        label: 'React',
        description: 'UI library',
        confidence: 0.9,
        pros: ['Popular'],
        cons: ['Large'],
        estimated_effort: '2d',
        estimated_impact: 'high',
      },
      {
        label: 'Vue',
        description: 'Progressive',
        confidence: 0.7,
        pros: ['Simple'],
        cons: ['Less jobs'],
        estimated_effort: '3d',
        estimated_impact: 'medium',
      },
    ]);
    expect(d.options.length).toBe(2);
    expect(d.status).toBe('pending');
  });

  it('makes a decision', () => {
    const d = engine.createDecision('Pick one', [
      {
        label: 'A',
        description: 'A',
        confidence: 0.5,
        pros: [],
        cons: [],
        estimated_effort: '1d',
        estimated_impact: 'low',
      },
    ]);
    const ok = engine.makeDecision(d.id, d.options[0]!.id, 'Best choice');
    expect(ok).toBe(true);
    const retrieved = engine.getDecision(d.id);
    expect(retrieved?.status).toBe('made');
    expect(retrieved?.selected_option).toBe(d.options[0]!.id);
    expect(retrieved?.rationale).toBe('Best choice');
  });

  it('fails to make decision with invalid option', () => {
    const d = engine.createDecision('Pick', [
      {
        label: 'A',
        description: 'A',
        confidence: 0.5,
        pros: [],
        cons: [],
        estimated_effort: '1d',
        estimated_impact: 'low',
      },
    ]);
    expect(engine.makeDecision(d.id, 'bad-option', 'nope')).toBe(false);
  });

  it('revisits a decision', () => {
    const d = engine.createDecision('Pick', [
      {
        label: 'A',
        description: 'A',
        confidence: 0.5,
        pros: [],
        cons: [],
        estimated_effort: '1d',
        estimated_impact: 'low',
      },
    ]);
    engine.revisitDecision(d.id);
    expect(engine.getDecision(d.id)?.status).toBe('revisited');
  });

  it('filters by status', () => {
    engine.createDecision('D1', []);
    const d2 = engine.createDecision('D2', []);
    engine.revisitDecision(d2.id);
    expect(engine.getDecisionsByStatus('pending').length).toBe(1);
    expect(engine.getDecisionsByStatus('revisited').length).toBe(1);
  });
});

describe('Critic', () => {
  let critic: Critic;

  beforeEach(() => {
    critic = new Critic();
  });

  it('creates a critique with issues', () => {
    const c = critic.createCritique('Login page', 'code', [
      {
        severity: 'major',
        category: 'safety',
        description: 'No CSRF',
        evidence: 'Login.mts line 42',
        recommendation: 'Add CSRF token',
      },
    ]);
    expect(c.target).toBe('Login page');
    expect(c.issues.length).toBe(1);
    expect(c.overall_score).toBeLessThan(1.0);
  });

  it('gives perfect score with no issues', () => {
    const c = critic.createCritique('Simple', 'code', []);
    expect(c.overall_score).toBe(1.0);
  });

  it('adds issues to existing critique', () => {
    const c = critic.createCritique('Target', 'plan', []);
    critic.addIssue(c.id, {
      severity: 'critical',
      category: 'correctness',
      description: 'Bug',
      evidence: 'Line 1',
      recommendation: 'Fix',
    });
    expect(critic.getCritique(c.id)?.issues.length).toBe(1);
    expect(critic.getCritique(c.id)?.overall_score).toBe(0.6);
  });

  it('aggregates critical issues across critiques', () => {
    critic.createCritique('A', 'code', [
      {
        severity: 'critical',
        category: 'correctness',
        description: 'C1',
        evidence: '',
        recommendation: '',
      },
    ]);
    critic.createCritique('B', 'code', [
      {
        severity: 'major',
        category: 'safety',
        description: 'M1',
        evidence: '',
        recommendation: '',
      },
    ]);
    expect(critic.getCriticalIssues().length).toBe(1);
  });

  it('filters issues by severity and category and summarizes', () => {
    const critique = critic.createCritique('API', 'plan', [
      {
        severity: 'major',
        category: 'consistency',
        description: 'Mismatch protocol',
        evidence: 'Spec vs implementation',
        recommendation: 'Align data contract',
      },
      {
        severity: 'minor',
        category: 'style',
        description: 'Naming consistency',
        evidence: 'variable names',
        recommendation: 'Rename for clarity',
      },
    ]);

    expect(critic.getIssuesBySeverity('major').length).toBe(1);
    expect(critic.getIssuesByCategory('style').length).toBe(1);
    expect(critic.summarizeCritique(critique.id)).toContain('Mismatch protocol');
  });
});

describe('ExecutiveBrain (integration)', () => {
  let brain: ExecutiveBrain;

  beforeEach(() => {
    brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });
  });

  it('creates plans', () => {
    const plan = brain.createPlan('Build feature');
    expect(plan.goal).toBe('Build feature');
    expect(plan.status).toBe('active');
  });

  it('executes plan steps', async () => {
    const plan = brain.createPlan('Deploy');
    const step = brain.planner.addStep(plan.id, 'Run tests')!;
    const result = await brain.executePlanStep(plan.id, step.id);
    expect(result).toBe(true);
    expect(brain.planner.getPlan(plan.id)?.steps[0]!.status).toBe('completed');
  });

  it('fails to execute nonexistent step', async () => {
    const plan = brain.createPlan('Test');
    expect(await brain.executePlanStep(plan.id, 'nope')).toBe(false);
  });

  it('makes decisions with event publishing', () => {
    const d = brain.makeDecision('Choice', [
      {
        label: 'A',
        description: 'Opt A',
        confidence: 0.8,
        pros: ['Fast'],
        cons: ['Costly'],
        estimated_effort: '1d',
        estimated_impact: 'high',
      },
    ]);
    expect(d.status).toBe('pending');
  });

  it('reviews targets and generates critiques', () => {
    const c = brain.review('Codebase', 'code');
    expect(c.target).toBe('Codebase');
    expect(c.issues.length).toBeGreaterThan(0);
  });

  it('generates a summary', () => {
    brain.createPlan('Plan 1');
    const s = brain.summary();
    expect(s).toContain('Executive Brain');
    expect(s).toContain('Active plans: 1');
  });

  it('creates follow-up plans from module handoffs', async () => {
    await brain['eventBus'].publishProtocol('module:handoff', 'uch', {
      intent: 'error-report',
      message: 'TypeScript compilation failed',
    });

    const activePlans = brain.planner.getActivePlans();
    expect(activePlans.length).toBe(1);
    expect(activePlans[0]!.goal).toContain('error-report');
  });

  it('creates a critique for failure handoffs', async () => {
    await brain['eventBus'].publishProtocol('module:handoff', 'uch', {
      intent: 'error-report',
      message: 'Integration tests failed after deploy',
    });

    const summary = brain.summary();
    expect(summary).toContain('Critical issues: 1');
  });

  it('does not re-create the same mistake twice', async () => {
    await brain['eventBus'].publishProtocol('module:handoff', 'uch', {
      intent: 'error-report',
      message: 'Database connection failed',
    });
    await brain['eventBus'].publishProtocol('module:handoff', 'uch', {
      intent: 'error-report',
      message: 'Database connection failed',
    });

    const activePlans = brain.planner.getActivePlans();
    expect(activePlans.length).toBe(1);
    expect(brain['mistakeLogger'].getAllMistakes().length).toBe(1);
  });
});
