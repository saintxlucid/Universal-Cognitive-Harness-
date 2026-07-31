import { describe, it, expect } from 'vitest';
import {
  createFrameworkRegistry,
  createFrameworkCatalog,
  FRAMEWORK_CATALOG_VERSION,
} from '../registry.js';
import { classifyDecision } from '../decisions/model-selector.js';
import { decisionMatrix, costBenefit, paretoAnalysis, decisionTree, swotAnalysis, premortem, prosCons } from '../decisions/decision-models.js';

describe('FrameworkRegistry', () => {
  const registry = createFrameworkRegistry();

  it('registers the full catalog across 10 families', () => {
    const all = registry.list();
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(registry.families().length).toBe(10);
  });

  it('returns every family definition', () => {
    const families = registry.families();
    const ids = families.map((f) => f.family);
    expect(ids).toEqual(expect.arrayContaining([
      'decisions', 'problems', 'rca', 'strategy', 'productivity',
      'research', 'critical', 'knowledge', 'signals', 'code',
    ]));
  });

  it('selects the analytical model for data-rich problems', () => {
    const result = registry.select({
      problem: 'Choose between three vendors with full pricing data',
      dataAvailability: 0.9,
      timePressure: 0.1,
    });
    expect(['decision-matrix', 'rational', 'cost-benefit']).toContain(result.selected.id);
    expect(result.rationale.length).toBeGreaterThan(20);
  });

  it('selects rapid models under time pressure', () => {
    const result = registry.select({
      problem: 'Server is down, decide now',
      timePressure: 0.95,
      dataAvailability: 0.2,
    });
    expect(['pmi', 'lean-decision', 'intuitive', 'ooda']).toContain(result.selected.id);
  });

  it('selects root-cause frameworks when rootCauseNeeded', () => {
    const result = registry.select({
      problem: 'Recurring production defects with unknown cause',
      rootCauseNeeded: true,
    });
    expect(['five-whys', 'fishbone', 'rca-focus']).toContain(result.selected.id);
  });

  it('selects group models with stakeholder involvement', () => {
    const result = registry.select({
      problem: 'Team consensus needed on roadmap',
      stakeholderInvolvement: 0.9,
    });
    expect(['nominal-group', 'delphi', 'stepladder', 'multi-voting']).toContain(result.selected.id);
  });

  it('selects strategy frameworks in the strategy family', () => {
    const result = registry.select({
      problem: 'Where should the company compete?',
      family: 'strategy',
    });
    expect(result.selected.family).toBe('strategy');
  });
});

describe('ModelSelector (decision-about-decisions)', () => {
  it('classifies a fast group decision', () => {
    const sel = classifyDecision({ problem: 'x', timePressure: 0.9, stakeholderInvolvement: 0.8 });
    expect(['nominal-group', 'delphi', 'pmi', 'lean-decision']).toContain(sel.primary);
  });

  it('classifies a data-rich decision', () => {
    const sel = classifyDecision({ problem: 'x', dataAvailability: 0.9, timePressure: 0.1 });
    expect(['decision-matrix', 'cost-benefit']).toContain(sel.primary);
  });
});

describe('Decision engines (deterministic)', () => {
  it('decision matrix ranks weighted scores', () => {
    const { winner } = decisionMatrix(
      [{ name: 'cost', weight: 0.7 }, { name: 'speed', weight: 0.3 }],
      [
        { name: 'A', scores: [10, 5] },
        { name: 'B', scores: [4, 9] },
      ],
    );
    expect(winner?.option).toBe('A');
    expect(winner?.weightedScore).toBeCloseTo(8.5);
  });

  it('cost-benefit adopts when benefits exceed costs', () => {
    const [r] = costBenefit([{ name: 'X', costs: [100], benefits: [200] }]);
    expect(r.netValue).toBe(100);
    expect(r.verdict).toBe('adopt');
  });

  it('pareto identifies the vital few', () => {
    const r = paretoAnalysis([
      { name: 'a', impact: 70 },
      { name: 'b', impact: 15 },
      { name: 'c', impact: 10 },
      { name: 'd', impact: 5 },
    ]);
    expect(r.vitalFew[0]).toBe('a');
    expect(r.vitalSharePct).toBeGreaterThanOrEqual(70);
  });

  it('decision tree computes expected value', () => {
    const { best } = decisionTree([
      {
        name: 'Gamble', branches: [
          { label: 'win', probability: 0.5, value: 40 },
          { label: 'lose', probability: 0.5, value: -50 },
        ],
      },
      { name: 'Safe', branches: [{ label: 'certain', probability: 1, value: 20 }] },
    ]);
    expect(best?.option).toBe('Safe');
    expect(best?.expectedValue).toBe(20);
  });

  it('swot synthesizes cross-products', () => {
    const r = swotAnalysis({
      strengths: ['fast team'], weaknesses: ['small budget'],
      opportunities: ['growing market'], threats: ['new competitor'],
    });
    expect(r.synthesis.so.length).toBeGreaterThan(0);
    expect(r.synthesis.wt.length).toBeGreaterThan(0);
  });

  it('pre-mortem ranks causes by risk', () => {
    const r = premortem({
      plan: 'launch in 30 days',
      possibleCauses: ['team burnout', 'regulatory miss'],
      likelihood: [0.9, 0.1],
      impact: [0.9, 0.9],
    });
    expect(r.rankedCauses[0].cause).toBe('team burnout');
    expect(r.topMitigations.length).toBe(2);
  });

  it('pros & cons adopts when pros outweigh cons', () => {
    const r = prosCons({ pros: ['fast', 'cheap', 'simple'], cons: ['risky'] });
    expect(r.proCount).toBe(3);
    expect(r.conCount).toBe(1);
    expect(r.weightedScore).toBeCloseTo(0.5);
    expect(r.verdict).toBe('adopt');
  });

  it('pros & cons rejects when cons dominate', () => {
    const r = prosCons({ pros: ['fast'], cons: ['expensive', 'fragile', 'opaque'] });
    expect(r.verdict).toBe('reject');
    expect(r.weightedScore).toBeLessThan(0);
  });

  it('pros & cons balances evenly split lists', () => {
    const r = prosCons({ pros: ['a', 'b'], cons: ['c', 'd'] });
    expect(r.verdict).toBe('balanced');
    expect(r.weightedScore).toBe(0);
  });

  it('the pros-cons framework is registered in the decisions family', () => {
    const def = createFrameworkRegistry().get('pros-cons');
    expect(def?.family).toBe('decisions');
    expect(def?.stages.length).toBeGreaterThanOrEqual(3);
  });
});

describe('Catalog integrity', () => {
  it('every catalog entry has required metadata', () => {
    for (const def of createFrameworkCatalog()) {
      expect(def.id).toBeTruthy();
      expect(def.family).toBeTruthy();
      expect(def.name).toBeTruthy();
      expect(def.purpose).toBeTruthy();
      expect(def.stages.length).toBeGreaterThan(0);
      expect(def.selection.contexts.length).toBeGreaterThan(0);
    }
  });

  it('catalog ids are unique', () => {
    const catalog = createFrameworkCatalog();
    const ids = catalog.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every family is a valid member of the 10-family enum', () => {
    const valid = new Set([
      'decisions', 'problems', 'rca', 'strategy', 'productivity',
      'research', 'critical', 'knowledge', 'signals', 'code',
    ]);
    for (const def of createFrameworkCatalog()) {
      expect(valid.has(def.family)).toBe(true);
    }
  });

  it('every selection context is valid and selection fields are booleans', () => {
    const validContexts = new Set([
      'analytical', 'experience-based', 'strategic', 'uncertainty', 'group', 'rapid',
    ]);
    const booleanFields = [
      'dataRich', 'timeCritical', 'groupNeeded', 'rootCauseNeeded',
      'humanCentered', 'continuousImprovement', 'speedAdaptability', 'comprehensiveRigor',
    ] as const;
    for (const def of createFrameworkCatalog()) {
      for (const ctx of def.selection.contexts) {
        expect(validContexts.has(ctx)).toBe(true);
      }
      for (const field of booleanFields) {
        const value = def.selection[field];
        expect(value === undefined || typeof value === 'boolean').toBe(true);
      }
    }
  });

  it('catalog version is a semver-style string and exported', () => {
    expect(FRAMEWORK_CATALOG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
