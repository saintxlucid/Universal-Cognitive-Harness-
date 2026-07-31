import { describe, it, expect } from 'vitest';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { DecisionEngine } from '../executive-brain/decision-engine.js';
import { IntegrityChecklist } from '../cognitive-plane/integrity/integrity-checklist.js';
import { assessInformation } from '../cognitive-plane/frameworks/critical/critical-evaluator.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

const OPTIONS = [
  {
    label: 'Option A',
    description: 'First option',
    confidence: 0.7,
    pros: ['fast'],
    cons: ['risky'],
    estimated_effort: '1d',
    estimated_impact: 'high',
  },
];

describe('Executive brain framework integration (blueprint §5.2)', () => {
  it('attaches the selected model when a profile is supplied', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });
    const decision = brain.makeDecision('Choose between three vendors with full pricing data', OPTIONS, {
      dataAvailability: 0.9,
      timePressure: 0.1,
    });
    expect(decision.model).not.toBeNull();
    expect(['decision-matrix', 'rational', 'cost-benefit']).toContain(decision.model?.id);
    expect(decision.model?.stages.length).toBeGreaterThan(0);
    expect(decision.model?.rationale.length).toBeGreaterThan(10);
  });

  it('keeps decisions model-free without a profile (backward compatible)', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });
    const decision = brain.makeDecision('Plain decision', OPTIONS);
    expect(decision.model).toBeNull();
  });

  it('selects rapid models under time pressure through the engine', () => {
    const engine = new DecisionEngine();
    const decision = engine.createDecision('Server is down, decide now', OPTIONS, {
      timePressure: 0.95,
      dataAvailability: 0.2,
    });
    expect(['pmi', 'lean-decision', 'intuitive', 'ooda']).toContain(decision.model?.id);
  });
});

describe('Pre-mortem pre-commit gate (blueprint §5.2)', () => {
  it('blocks when a failure cause crosses the risk threshold', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });
    const { gate, passed, topRisks } = brain.premortemGate(
      'launch in 30 days',
      ['regulatory miss', 'team burnout'],
      [0.9, 0.9],
      [0.9, 0.9],
    );
    expect(passed).toBe(false);
    expect(topRisks).toContain('regulatory miss');
    expect(gate.rankedCauses[0]?.cause).toBe('regulatory miss');
    expect(gate.rankedCauses[0]?.riskScore).toBe(81);
  });

  it('passes when all causes are low risk', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });
    const { passed, topRisks } = brain.premortemGate('rename a variable', ['typo'], [0.1], [0.1]);
    expect(passed).toBe(true);
    expect(topRisks).toEqual([]);
  });

  it('uses the default failure-cause checklist when none supplied', () => {
    const brain = new ExecutiveBrain({ eventBus: new NeuralEventBus() });
    const { gate, passed } = brain.premortemGate('ship the feature');
    expect(gate.rankedCauses.length).toBe(5);
    expect(typeof passed).toBe('boolean');
  });
});

describe('Critical-evaluator integrity filter (blueprint §5.2)', () => {
  it('fails the filter when the 9-question assessment rejects the claim', () => {
    const checklist = new IntegrityChecklist();
    const assessment = assessInformation({
      target: 'stock tip from a random ad',
      answers: {
        needs: 'yes, relevant',
        qualified_source: 'no, anonymous',
        currency: 'no, stale',
        prejudice: 'yes, selling angle',
        propaganda: 'yes, it is an advertisement',
        fact_vs_opinion: 'yes, opinions presented as facts',
        motivation: 'yes, sells the product',
        whole_story: 'no, one-sided',
        better_sources: 'no, single source',
      },
    });
    expect(assessment.verdict).toBe('reject');
    const result = checklist.evaluateInformation(
      { claim: 'stock tip from a random ad', objective: true, qualifiedSource: false },
      assessment,
    );
    expect(result.passed).toBe(false);
    const flags = result.issues.map((i) => i.flag);
    expect(flags).toContain('unqualified_source');
    expect(flags).toContain('prejudice');
    expect(flags).toContain('propaganda');
    expect(flags).toContain('subjectivity');
    expect(flags).toContain('omission');
  });

  it('passes when the checklist and evaluator both clear the claim', () => {
    const checklist = new IntegrityChecklist();
    const assessment = assessInformation({
      target: 'peer-reviewed study',
      answers: {
        qualified_source: 'yes, peer-reviewed',
        prejudice: 'no bias',
        propaganda: 'no, not an ad',
        fact_vs_opinion: 'no, factual',
        whole_story: 'yes, full methods and limits',
      },
    });
    const result = checklist.evaluateInformation(
      { claim: 'peer-reviewed study', objective: true, qualifiedSource: true, wholeTruth: true },
      assessment,
    );
    expect(result.passed).toBe(true);
  });
});
