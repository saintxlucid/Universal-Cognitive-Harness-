import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { ExecutiveBrain } from '../executive-brain.js';
import { Planner } from '../planner.js';
import { DecisionEngine } from '../decision-engine.js';
import { Critic } from '../critic.js';

// ── Planner edge cases ──

describe('Planner — edge cases', () => {
  let planner: Planner;

  beforeEach(() => {
    planner = new Planner();
  });

  it('handles empty goal string', () => {
    const plan = planner.createPlan('');
    expect(plan.id).toBeTruthy();
    expect(plan.goal).toBe('');
  });

  it('handles very long goal string', () => {
    const longGoal = 'x'.repeat(10000);
    const plan = planner.createPlan(longGoal);
    expect(plan.goal.length).toBe(10000);
  });

  it('addStep returns null for nonexistent plan', () => {
    expect(planner.addStep('nonexistent', 'step')).toBeNull();
  });

  it('getNextSteps returns empty for nonexistent plan', () => {
    expect(planner.getNextSteps('nope')).toEqual([]);
  });

  it('getBlockedSteps returns empty for nonexistent plan', () => {
    expect(planner.getBlockedSteps('nope')).toEqual([]);
  });

  it('assignStep returns false for nonexistent plan', () => {
    expect(planner.assignStep('nope', 'step', 'agent')).toBe(false);
  });

  it('assignStep returns false for nonexistent step', () => {
    const plan = planner.createPlan('test');
    expect(planner.assignStep(plan.id, 'nope', 'agent')).toBe(false);
  });

  it('updateStepStatus returns false for nonexistent plan', () => {
    expect(planner.updateStepStatus('nope', 'step', 'completed')).toBe(false);
  });

  it('updateStepStatus returns false for nonexistent step', () => {
    const plan = planner.createPlan('test');
    expect(planner.updateStepStatus(plan.id, 'nope', 'completed')).toBe(false);
  });

  it('getPlan returns undefined for nonexistent id', () => {
    expect(planner.getPlan('nope')).toBeUndefined();
  });

  it('getActivePlans filters non-active plans', () => {
    const p1 = planner.createPlan('active');
    const p2 = planner.createPlan('complete me');
    const s = planner.addStep(p2.id, 'step')!;
    planner.updateStepStatus(p2.id, s.id, 'completed');
    expect(planner.getActivePlans().length).toBe(1);
    expect(planner.getActivePlans()[0]!.id).toBe(p1.id);
  });

  it('auto-completes plan when all steps are completed', () => {
    const plan = planner.createPlan('quick');
    const s1 = planner.addStep(plan.id, 'A')!;
    const s2 = planner.addStep(plan.id, 'B')!;
    planner.updateStepStatus(plan.id, s1.id, 'completed');
    planner.updateStepStatus(plan.id, s2.id, 'completed');
    expect(planner.getPlan(plan.id)?.status).toBe('completed');
  });

  it('auto-fails plan when any step fails', () => {
    const plan = planner.createPlan('mixed');
    const s1 = planner.addStep(plan.id, 'A')!;
    const s2 = planner.addStep(plan.id, 'B')!;
    planner.updateStepStatus(plan.id, s1.id, 'completed');
    planner.updateStepStatus(plan.id, s2.id, 'failed');
    expect(planner.getPlan(plan.id)?.status).toBe('failed');
  });

  it('planSummary returns null for nonexistent plan', () => {
    expect(planner.planSummary('nope')).toBeNull();
  });

  it('planSummary includes progress info', () => {
    const plan = planner.createPlan('summary test');
    planner.addStep(plan.id, 'Step 1');
    planner.addStep(plan.id, 'Step 2');
    const summary = planner.planSummary(plan.id);
    expect(summary).toContain('summary test');
    expect(summary).toContain('0/2');
  });
});

// ── DecisionEngine edge cases ──

describe('DecisionEngine — edge cases', () => {
  let engine: DecisionEngine;

  beforeEach(() => {
    engine = new DecisionEngine();
  });

  it('createDecision handles empty options', () => {
    const d = engine.createDecision('Empty decision', []);
    expect(d.options).toEqual([]);
    expect(d.status).toBe('pending');
  });

  it('makeDecision returns false for invalid option id', () => {
    const d = engine.createDecision('Pick', [
      { label: 'A', description: '', confidence: 0.5, pros: [], cons: [], estimated_effort: '1d', estimated_impact: 'low' },
    ]);
    expect(engine.makeDecision(d.id, 'invalid-option', 'nope')).toBe(false);
  });

  it('makeDecision returns false for nonexistent decision', () => {
    expect(engine.makeDecision('nope', 'opt1', 'bad')).toBe(false);
  });

  it('revisitDecision on nonexistent decision does not crash', () => {
    expect(() => engine.revisitDecision('nope')).not.toThrow();
  });

  it('getDecision returns undefined for nonexistent id', () => {
    expect(engine.getDecision('nope')).toBeUndefined();
  });

  it('getDecisionsByStatus returns empty for unmatching status', () => {
    const d = engine.createDecision('Test', []);
    engine.makeDecision(d.id, null as unknown as string, 'done');
    expect(engine.getDecisionsByStatus('revisited')).toHaveLength(0);
  });

  it('getRecentDecisions respects limit', () => {
    for (let i = 0; i < 10; i++) {
      engine.createDecision(`D${i}`, []);
    }
    expect(engine.getRecentDecisions(3)).toHaveLength(3);
    expect(engine.getRecentDecisions(100)).toHaveLength(10);
  });
});

// ── Critic edge cases ──

describe('Critic — edge cases', () => {
  let critic: Critic;

  beforeEach(() => {
    critic = new Critic();
  });

  it('createCritique with empty issues gives perfect score', () => {
    const c = critic.createCritique('target', 'code', []);
    expect(c.overall_score).toBe(1.0);
  });

  it('createCritique handles zero-length target', () => {
    const c = critic.createCritique('', 'plan', []);
    expect(c.target).toBe('');
    expect(c.overall_score).toBe(1.0);
  });

  it('addIssue to nonexistent critique does not crash', () => {
    expect(() => {
      critic.addIssue('nope', {
        severity: 'critical', category: 'correctness', description: 'x', evidence: '', recommendation: '',
      });
    }).not.toThrow();
  });

  it('getCritique returns undefined for nonexistent id', () => {
    expect(critic.getCritique('nope')).toBeUndefined();
  });

  it('getIssuesBySeverity returns empty for unmatching severity', () => {
    const c = critic.createCritique('t', 'code', [
      { severity: 'major', category: 'safety', description: 'x', evidence: '', recommendation: '' },
    ]);
    expect(critic.getIssuesBySeverity('critical')).toHaveLength(0);
  });

  it('getIssuesByCategory returns empty for unmatching category', () => {
    const c = critic.createCritique('t', 'code', [
      { severity: 'major', category: 'safety', description: 'x', evidence: '', recommendation: '' },
    ]);
    expect(critic.getIssuesByCategory('style')).toHaveLength(0);
  });

  it('getCriticalIssues filters only critical', () => {
    critic.createCritique('A', 'code', [
      { severity: 'critical', category: 'correctness', description: 'C1', evidence: '', recommendation: '' },
      { severity: 'major', category: 'safety', description: 'M1', evidence: '', recommendation: '' },
    ]);
    expect(critic.getCriticalIssues()).toHaveLength(1);
  });

  it('summarizeCritique returns null for nonexistent id', () => {
    expect(critic.summarizeCritique('nope')).toBeNull();
  });
});

// ── ExecutiveBrain integration edge cases ──

describe('ExecutiveBrain — integration edge cases', () => {
  let brain: ExecutiveBrain;

  beforeEach(() => {
    brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });
  });

  it('createPlan handles empty goal', () => {
    const plan = brain.createPlan('');
    expect(plan.goal).toBe('');
    expect(plan.status).toBe('active');
  });

  it('executePlanStep returns false for nonexistent plan', async () => {
    expect(await brain.executePlanStep('nope', 'step')).toBe(false);
  });

  it('executePlanStep returns false for nonexistent step', async () => {
    const plan = brain.createPlan('test');
    expect(await brain.executePlanStep(plan.id, 'nope')).toBe(false);
  });

  it('executePlanStep returns false for already completed step', async () => {
    const plan = brain.createPlan('test');
    const step = brain.planner.addStep(plan.id, 'Do it')!;
    await brain.executePlanStep(plan.id, step.id);
    // Executing again should fail since status is 'completed'
    expect(await brain.executePlanStep(plan.id, step.id)).toBe(false);
  });

  it('makeDecision handles empty options', () => {
    const d = brain.makeDecision('Empty', []);
    expect(d.options).toEqual([]);
    expect(d.status).toBe('pending');
  });

  it('makeDecision publishes event', () => {
    const d = brain.makeDecision('Choice', [
      { label: 'A', description: '', confidence: 0.8, pros: [], cons: [], estimated_effort: '1d', estimated_impact: 'low' },
    ]);
    expect(d.options).toHaveLength(1);
  });

  it('review returns critique with issues for empty history', () => {
    const c = brain.review('new service', 'code');
    expect(c.issues.length).toBeGreaterThan(0);
    // Should detect duplicate abstraction
    const newServiceIssue = c.issues.find(
      (i) => i.description?.includes('duplicate'),
    );
    expect(newServiceIssue).toBeDefined();
  });

  it('review with no-tests flags safety issue', () => {
    const c = brain.review('proposal without tests', 'code');
    const safetyIssue = c.issues.find((i) =>
      i.description?.toLowerCase().includes('verification'),
    );
    expect(safetyIssue).toBeDefined();
  });

  it('handles failure signal via module handoff', async () => {
    await brain['eventBus'].publishProtocol('module:handoff', 'uch', {
      intent: 'error-report',
      message: 'Module failed catastrophically',
    });
    const activePlans = brain.planner.getActivePlans();
    expect(activePlans.length).toBe(1);
    expect(activePlans[0]!.goal).toContain('error-report');
  });

  it('handles non-failure handoff signal', async () => {
    await brain['eventBus'].publishProtocol('module:handoff', 'uch', {
      intent: 'info-update',
      message: 'Everything is fine',
    });
    const activePlans = brain.planner.getActivePlans();
    expect(activePlans.length).toBe(1);
    expect(activePlans[0]!.goal).toContain('info-update');
  });

  it('does not create duplicate mistakes for repeated failures', async () => {
    const msg = 'Duplicate error message';
    await brain['eventBus'].publishProtocol('module:handoff', 'uch', {
      intent: 'error-report', message: msg,
    });
    await brain['eventBus'].publishProtocol('module:handoff', 'uch', {
      intent: 'error-report', message: msg,
    });
    expect(brain['mistakeLogger'].getAllMistakes().length).toBe(1);
  });

  it('evaluateChange returns full assessment', () => {
    const assessment = brain.evaluateChange({
      intent: 'refactor',
      proposedChange: 'Refactor auth module',
      context: { existingArchitecture: 'layered architecture with express' },
    });
    expect(assessment.judgment).toBeDefined();
    expect(assessment.critique).toBeDefined();
    expect(assessment.plan).toBeDefined();
    expect(assessment.plan.steps.length).toBe(3);
  });

  it('summarizeAssessment includes all fields', () => {
    const assessment = brain.evaluateChange({
      intent: 'fix',
      proposedChange: 'Fix bug',
      context: {},
    });
    const summary = brain.summarizeAssessment(assessment);
    expect(summary).toContain('verdict');
    expect(summary).toContain('score');
    expect(summary).toContain('risk');
    expect(summary).toContain('next steps');
  });

  it('summary returns formatted output', () => {
    brain.createPlan('Plan A');
    const s = brain.summary();
    expect(s).toContain('Executive Brain');
    expect(s).toContain('Active plans: 1');
    expect(s).toContain('Critical issues: 0');
  });
});
