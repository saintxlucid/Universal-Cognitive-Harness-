import { describe, it, expect } from 'vitest';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

describe('ExecutiveBrain engineering judgment', () => {
  it('uses the engineering constitution when reviewing proposals', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });

    const critique = brain.review(
      'Create a new UserManager2 service and ship without tests or docs',
      'code',
    );

    expect(critique.overall_score).toBeLessThan(1);
    expect(
      critique.issues.some(
        (issue) => issue.category === 'safety' || issue.category === 'consistency',
      ),
    ).toBe(true);
  });

  it('produces an assessment for change proposals that preserves architecture', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });

    const assessment = brain.evaluateChange({
      intent: 'extend an existing profile API',
      proposedChange:
        'Extend the existing UserService with a profile summary method and add tests and docs.',
      context: {
        existingArchitecture: 'UserService already owns profile operations.',
        dependencies: ['zod'],
        modules: ['UserService', 'ProfileController'],
      },
    });

    expect(assessment.judgment.verdict).toBe('pass');
    expect(assessment.judgment.score).toBeGreaterThanOrEqual(0.8);
    expect(assessment.plan.steps.length).toBeGreaterThan(0);
  });

  it('formats an assessment into an operator-ready summary', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });

    const assessment = brain.evaluateChange({
      intent: 'extend an existing profile API',
      proposedChange:
        'Extend the existing UserService with a profile summary method and add tests and docs.',
      context: {
        existingArchitecture: 'UserService already owns profile operations.',
        dependencies: ['zod'],
        modules: ['UserService', 'ProfileController'],
      },
    });

    const summary = brain.summarizeAssessment(assessment);

    expect(summary).toContain('pass');
    expect(summary).toContain('next steps');
  });
});

describe('ExecutiveBrain — engineering-intelligence filter', () => {
  it('attaches a deterministic engineering review to every assessment', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });

    const assessment = brain.evaluateChange({
      intent: 'extend an existing profile API',
      proposedChange:
        'Extend the existing UserService with a profile summary method and add tests and docs.',
      context: { existingArchitecture: 'UserService owns profile operations.' },
    });

    expect(assessment.engineeringReview).toBeDefined();
    expect(assessment.engineeringReview?.score).toBeGreaterThan(0);
    expect(assessment.engineeringVetoes).toBeUndefined();
    expect(assessment.judgment.verdict).toBe('pass');
  });

  it('escalates the verdict to review when an engineering veto fires', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });

    const assessment = brain.evaluateChange({
      intent: 'add queue durability',
      proposedChange:
        'The message broker has no failover and no standby; if it dies the pipeline stops.',
      context: { existingArchitecture: 'The broker is the ingest path.' },
    });

    expect(assessment.engineeringVetoes).toEqual(['sys.spof']);
    expect(assessment.engineeringReview?.findings.some((f) => f.gate === 'veto')).toBe(true);
    expect(assessment.judgment.verdict).toBe('review');
  });
});
