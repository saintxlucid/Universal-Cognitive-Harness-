import { describe, it, expect } from 'vitest';
import { MCPStdioServer } from '../mcp/stdio-server.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

interface ToolEntry {
  name: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const FRAMEWORK_TOOLS = [
  'framework-catalog', 'framework-select', 'decide', 'analyze-problem', 'rca',
  'strategy', 'plan-day', 'evaluate-info', 'research-methodology', 'research-gap',
  'dikw', 'compose-signals', 'code-audit',
];

function createServer(): MCPStdioServer {
  const bus = new NeuralEventBus();
  const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
  const workspace = new WorkspaceBrain({ workspace_id: 'test', name: 'test', root_path: '/test', eventBus: bus });
  const executive = new ExecutiveBrain({ eventBus: bus });
  const bio = new BiologicalFunctions(kernel, workspace, executive);
  return new MCPStdioServer({ kernel, bio, executive, workspace });
}

function tool(server: MCPStdioServer, name: string): ToolEntry {
  const tools = (server as unknown as { tools: Map<string, ToolEntry> }).tools;
  const entry = tools.get(name);
  if (!entry) throw new Error(`tool not registered: ${name}`);
  return entry;
}

interface CatalogItem {
  id: string;
  family: string;
  name: string;
  purpose: string;
  bestFor: string[];
  stages: string[];
}

describe('MCP framework tools', () => {
  it('registers all 13 framework tools', () => {
    const server = createServer();
    const tools = (server as unknown as { tools: Map<string, ToolEntry> }).tools;
    for (const name of FRAMEWORK_TOOLS) {
      expect(tools.has(name), `missing tool ${name}`).toBe(true);
    }
  });

  it('framework-catalog lists 10 families and 30+ frameworks', async () => {
    const server = createServer();
    const result = (await tool(server, 'framework-catalog').handler({})) as {
      families: { family: string; label: string; count: number }[];
      count: number;
      frameworks: CatalogItem[];
    };
    expect(result.families.length).toBe(10);
    expect(result.count).toBeGreaterThanOrEqual(30);
    const ids = result.frameworks.map((f) => f.id);
    for (const family of ['decisions', 'problems', 'rca', 'strategy', 'productivity', 'research', 'critical', 'knowledge', 'signals', 'code']) {
      expect(result.frameworks.some((f) => f.family === family), `missing family ${family}`).toBe(true);
    }
    expect(ids).toContain('decision-matrix');
    expect(ids).toContain('kepner-tregoe');
    expect(ids).toContain('rca-focus');
    expect(ids).toContain('dikw');
    expect(ids).toContain('signal-fusion');
    for (const f of result.frameworks) {
      expect(f.id.length).toBeGreaterThan(0);
      expect(f.name.length).toBeGreaterThan(0);
      expect(f.purpose.length).toBeGreaterThan(10);
      expect(f.stages.length).toBeGreaterThan(0);
    }
  });

  it('framework-catalog filters by family', async () => {
    const server = createServer();
    const result = (await tool(server, 'framework-catalog').handler({ family: 'rca' })) as {
      count: number;
      frameworks: CatalogItem[];
    };
    expect(result.count).toBeGreaterThanOrEqual(2);
    expect(result.frameworks.every((f) => f.family === 'rca')).toBe(true);
    expect(result.frameworks.map((f) => f.id)).toEqual(expect.arrayContaining(['rca-focus', 'fishbone']));
  });

  it('framework-select picks analytical models for data-rich problems', async () => {
    const server = createServer();
    const result = (await tool(server, 'framework-select').handler({
      problem: 'Choose between three vendors with full pricing data',
      dataAvailability: 0.9,
      timePressure: 0.1,
    })) as { selected: { id: string; family: string }; runnerUp: { id: string } | null; rationale: string; alternatives: string[] };
    expect(['decision-matrix', 'rational', 'cost-benefit']).toContain(result.selected.id);
    expect(result.selected.family).toBe('decisions');
    expect(result.rationale.length).toBeGreaterThan(20);
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
  });

  it('framework-select picks rapid models under time pressure', async () => {
    const server = createServer();
    const result = (await tool(server, 'framework-select').handler({
      problem: 'Server is down, decide now',
      timePressure: 0.95,
      dataAvailability: 0.2,
    })) as { selected: { id: string } };
    expect(['pmi', 'lean-decision', 'intuitive', 'ooda']).toContain(result.selected.id);
  });

  it('framework-select honors explicit root-cause signal', async () => {
    const server = createServer();
    const result = (await tool(server, 'framework-select').handler({
      problem: 'Recurring production defects with unknown cause',
      rootCauseNeeded: true,
    })) as { selected: { id: string } };
    expect(['five-whys', 'fishbone', 'rca-focus']).toContain(result.selected.id);
  });

  it('decide: decision-matrix ranks weighted scores', async () => {
    const server = createServer();
    const result = (await tool(server, 'decide').handler({
      model: 'decision-matrix',
      options: ['A', 'B'],
      criteria: ['cost', 'speed'],
      weights: [0.7, 0.3],
      scores: [[10, 5], [4, 9]],
    })) as { winner: { option: string; weightedScore: number } | null; results: unknown[] };
    expect(result.winner?.option).toBe('A');
    expect(result.winner?.weightedScore).toBeCloseTo(8.5);
    expect(result.results.length).toBe(2);
  });

  it('decide: cost-benefit computes verdicts', async () => {
    const server = createServer();
    const result = (await tool(server, 'decide').handler({
      model: 'cost-benefit',
      options: ['X', 'Y'],
      costs: [[100], [10]],
      benefits: [[200], [5]],
    })) as { option: string; netValue: number; verdict: string }[];
    expect(result[0]?.option).toBe('X');
    expect(result[0]?.netValue).toBe(100);
    expect(result[0]?.verdict).toBe('adopt');
    expect(result[1]?.verdict).toBe('reject');
  });

  it('decide: pareto identifies the vital few', async () => {
    const server = createServer();
    const result = (await tool(server, 'decide').handler({
      model: 'pareto',
      options: ['a', 'b', 'c', 'd'],
      impacts: [70, 15, 10, 5],
    })) as { vitalFew: string[]; vitalSharePct: number };
    expect(result.vitalFew[0]).toBe('a');
    expect(result.vitalSharePct).toBeGreaterThanOrEqual(70);
  });

  it('decide: decision-tree picks highest expected value', async () => {
    const server = createServer();
    const result = (await tool(server, 'decide').handler({
      model: 'decision-tree',
      options: ['Gamble', 'Safe'],
      probabilities: [[0.5, 0.5], [1]],
      values: [[40, -50], [20]],
    })) as { best: { option: string; expectedValue: number } | null };
    expect(result.best?.option).toBe('Safe');
    expect(result.best?.expectedValue).toBe(20);
  });

  it('decide: swot synthesizes cross-products', async () => {
    const server = createServer();
    const result = (await tool(server, 'decide').handler({
      model: 'swot',
      strengths: ['fast team'],
      weaknesses: ['small budget'],
      opportunities: ['growing market'],
      threats: ['new competitor'],
    })) as { synthesis: { so: string[]; wt: string[] } };
    expect(result.synthesis.so.length).toBeGreaterThan(0);
    expect(result.synthesis.wt.length).toBeGreaterThan(0);
  });

  it('decide: pre-mortem ranks causes by risk', async () => {
    const server = createServer();
    const result = (await tool(server, 'decide').handler({
      model: 'pre-mortem',
      plan: 'launch in 30 days',
      causes: ['team burnout', 'regulatory miss'],
    })) as { rankedCauses: { cause: string; riskScore: number }[]; topMitigations: string[] };
    expect(result.rankedCauses.length).toBe(2);
    expect(result.rankedCauses[0]?.cause).toBe('team burnout');
    expect(result.topMitigations.length).toBe(2);
  });

  it('decide: pros-cons weighs the balance and verdicts', async () => {
    const server = createServer();
    const adopt = (await tool(server, 'decide').handler({
      model: 'pros-cons',
      pros: ['fast', 'cheap', 'simple'],
      cons: ['risky'],
    })) as { proCount: number; conCount: number; weightedScore: number; verdict: string };
    expect(adopt.proCount).toBe(3);
    expect(adopt.conCount).toBe(1);
    expect(adopt.weightedScore).toBeGreaterThan(0);
    expect(adopt.verdict).toBe('adopt');

    const reject = (await tool(server, 'decide').handler({
      model: 'pros-cons',
      pros: ['fast'],
      cons: ['expensive', 'fragile', 'opaque'],
    })) as { verdict: string };
    expect(reject.verdict).toBe('reject');
  });

  it('decide: unknown model returns an error, not a throw', async () => {
    const server = createServer();
    const result = (await tool(server, 'decide').handler({ model: 'tarot' })) as { error: string };
    expect(result.error).toContain('unknown model');
  });

  it('analyze-problem: ideal returns the 5 stages', async () => {
    const server = createServer();
    const result = (await tool(server, 'analyze-problem').handler({
      framework: 'ideal',
      problem: 'Login is failing for some users',
    })) as { identified: string; defined: string; explored: string[]; acted: unknown; lookedBack: string[] };
    expect(result.identified).toContain('Login is failing');
    expect(result.explored.length).toBeGreaterThan(0);
    expect(result.lookedBack.length).toBeGreaterThan(0);
  });

  it('analyze-problem: five-whys traces the causal chain', async () => {
    const server = createServer();
    const result = (await tool(server, 'analyze-problem').handler({
      framework: 'five-whys',
      problem: 'Website crashed',
      whyAnswers: ['Database overloaded', 'No rate limiting', 'Gateway misconfigured'],
    })) as { symptom: string; chain: { depth: number; question: string; answer: string }[]; rootCause: string };
    expect(result.symptom).toBe('Website crashed');
    expect(result.chain.length).toBe(3);
    expect(result.chain[0]?.question).toContain('Why: Website crashed?');
    expect(result.rootCause).toBe('Gateway misconfigured');
  });

  it('analyze-problem: ooda returns the four phases', async () => {
    const server = createServer();
    const result = (await tool(server, 'analyze-problem').handler({
      framework: 'ooda',
      problem: 'Competitor dropped price',
      observations: ['Price dropped 20%', 'Inventory is high'],
    })) as { observe: string[]; orient: string[]; decide: string | null; act: string };
    expect(result.observe.length).toBe(2);
    expect(result.orient.length).toBeGreaterThan(0);
    expect(typeof result.act).toBe('string');
    expect(result.act.length).toBeGreaterThan(0);
  });

  it('analyze-problem: unknown framework returns an error', async () => {
    const server = createServer();
    const result = (await tool(server, 'analyze-problem').handler({ framework: 'guess' })) as { error: string };
    expect(result.error).toContain('unknown framework');
  });

  it('rca: F.O.C.U.S. produces a ranked root cause and corrective actions', async () => {
    const server = createServer();
    const result = (await tool(server, 'rca').handler({
      problem: 'Login service fails for 12% of users during peak traffic',
      evidenceFacts: ['Timeout errors at 5k RPM', 'No errors below 2k RPM'],
      evidenceSources: ['logs', 'metrics'],
      causes: ['Missing rate limit on gateway', 'Database connection pool exhausted'],
      categories: ['technology', 'technology'],
      likelihoods: [0.9, 0.4],
      impacts: [0.9, 0.8],
    })) as {
      focus: string;
      organize: { facts: { fact: string }[]; assumptionCount: number };
      rootCause: { cause: string; category: string; confidence: number } | null;
      solve: { correctiveActions: string[]; validationStep: string };
      prevention: { lessons: string[] };
    };
    expect(result.focus).toContain('12% of users');
    expect(result.organize.facts.length).toBe(2);
    expect(result.organize.assumptionCount).toBe(0);
    expect(result.rootCause?.cause).toBe('Missing rate limit on gateway');
    expect(result.rootCause?.category).toBe('technology');
    expect(result.rootCause?.confidence).toBeGreaterThan(80);
    expect(result.solve.correctiveActions.length).toBeGreaterThan(0);
    expect(result.solve.validationStep).toContain('Validate');
    expect(result.prevention.lessons.length).toBeGreaterThan(0);
  });

  it('strategy: strategy-wheel returns 4 quadrants of 20 questions', async () => {
    const server = createServer();
    const result = (await tool(server, 'strategy').handler({
      framework: 'strategy-wheel',
    })) as { quadrants: { name: string; questions: string[] }[]; hiddenFlow: string[]; completenessPct: number };
    expect(result.quadrants.length).toBe(4);
    const totalQuestions = result.quadrants.reduce((acc, q) => acc + q.questions.length, 0);
    expect(totalQuestions).toBe(20);
    expect(result.hiddenFlow.length).toBeGreaterThan(0);
    expect(result.completenessPct).toBeGreaterThanOrEqual(0);
  });

  it('strategy: strategy-vs-plan separates direction from execution', async () => {
    const server = createServer();
    const result = (await tool(server, 'strategy').handler({
      framework: 'strategy-vs-plan',
      purpose: 'Become the fastest delivery platform',
      planGoals: 'Ship 4 releases this quarter',
    })) as { strategyLayer: string[]; planLayer: string[]; diagnosis: string };
    expect(result.strategyLayer.length).toBeGreaterThan(0);
    expect(result.planLayer.length).toBeGreaterThan(0);
    expect(result.diagnosis.length).toBeGreaterThan(10);
  });

  it('plan-day: classifies Eisenhower quadrants, MIT, and two-minute actions', async () => {
    const server = createServer();
    const result = (await tool(server, 'plan-day').handler({
      tasks: ['Ship release', 'Reply emails', 'Tidy desk'],
      urgencies: ['urgent', 'urgent', 'not-urgent'],
      importances: ['important', 'not-important', 'not-important'],
      durations: [60, 1, 10],
      leverages: [0.9, 0.1, 0.05],
      focusHours: 4,
    })) as {
      mostImportantTasks: string[];
      eisenhower: { do: string[]; delegate: string[]; delete: string[] };
      vitalFew: string[];
      timeBlocks: { task: string; minutes: number }[];
      twoMinuteActions: string[];
      smartGoal: { specific: boolean; measurable: boolean };
    };
    expect(result.mostImportantTasks).toContain('Ship release');
    expect(result.eisenhower.do).toContain('Ship release');
    expect(result.eisenhower.delegate).toContain('Reply emails');
    expect(result.eisenhower.delete).toContain('Tidy desk');
    expect(result.vitalFew[0]).toBe('Ship release');
    expect(result.twoMinuteActions).toContain('Reply emails');
    expect(result.timeBlocks.length).toBeGreaterThan(0);
    expect(typeof result.smartGoal.specific).toBe('boolean');
  });

  it('evaluate-info: runs all 9 questions with integrity-law mapping', async () => {
    const server = createServer();
    const result = (await tool(server, 'evaluate-info').handler({
      target: 'A claim from an unverified blog post',
      answers: {
        needs: 'yes', qualified_source: 'unknown author', currency: 'outdated',
        prejudice: 'no bias', fact_vs_opinion: 'opinion presented as fact',
        propaganda: 'no propaganda', motivation: 'sell a product',
        whole_story: 'missing context', better_sources: 'single source',
      },
    })) as {
      target: string;
      checks: { id: string; law: string | null; answered: boolean; ok: boolean }[];
      reliabilityScore: number;
      verdict: string;
      failures: string[];
    };
    expect(result.checks.length).toBe(9);
    const sourceCheck = result.checks.find((c) => c.id === 'qualified_source');
    expect(sourceCheck?.law).toBe('Qualified Source Required');
    const prejudiceCheck = result.checks.find((c) => c.id === 'prejudice');
    expect(prejudiceCheck?.law).toBe('No Prejudice as Evidence');
    expect(prejudiceCheck?.answered).toBe(true);
    expect(result.reliabilityScore).toBeGreaterThanOrEqual(0);
    expect(['reliable', 'cross-check', 'reject']).toContain(result.verdict);
  });

  it('evaluate-info: answers without a bias denial fail the inverted question', async () => {
    const server = createServer();
    const result = (await tool(server, 'evaluate-info').handler({
      target: 'target',
      answers: { prejudice: 'yes biased' },
    })) as { checks: { id: string; ok: boolean }[] };
    const prejudice = result.checks.find((c) => c.id === 'prejudice');
    expect(prejudice?.ok).toBe(false);
  });

  it('research-methodology: complete plan passes the checklist', async () => {
    const server = createServer();
    const result = (await tool(server, 'research-methodology').handler({
      question: 'Does exercise improve memory in older adults?',
      designApproach: 'quantitative',
      designJustification: 'A randomized controlled trial isolates the causal effect of exercise on memory.',
      collectionMethods: ['survey', 'interviews'],
      collectionDetail: 'Online survey distributed to targeted respondents',
      analysisMethods: ['regression'],
      analysisDescription: 'Regression of memory scores on exercise hours controlling for age',
      population: 'Adults 60+',
      samplingMethod: 'random',
      sampleSize: '300',
      sampleJustification: '300 randomly selected respondents',
      informedConsent: true, confidentiality: true, voluntary: true, dataProtection: true,
    })) as { stages: { stage: string; ok: boolean }[]; mistakes: string[]; checklist: { ok: boolean }[]; ready: boolean };
    expect(result.stages.length).toBe(5);
    expect(result.mistakes).toEqual([]);
    expect(result.ready).toBe(true);
    expect(result.checklist.every((c) => c.ok)).toBe(true);
  });

  it('research-methodology: incomplete plan lists mistakes and is not ready', async () => {
    const server = createServer();
    const result = (await tool(server, 'research-methodology').handler({
      question: 'A question',
    })) as { mistakes: string[]; ready: boolean };
    expect(result.ready).toBe(false);
    expect(result.mistakes.length).toBeGreaterThanOrEqual(3);
  });

  it('research-gap: detects contradiction and methodological gaps', async () => {
    const server = createServer();
    const result = (await tool(server, 'research-gap').handler({
      topic: 'Exercise and memory',
      titles: ['Study A', 'Study B'],
      findings: ['Exercise improves memory', 'Exercise has no effect on memory'],
      limitations: ['Small sample'],
      years: [2019, 2020],
    })) as {
      topic: string;
      detected: { type: string; confidence: number }[];
      researchQuestion: string | null;
    };
    expect(result.topic).toBe('Exercise and memory');
    const types = result.detected.map((d) => d.type);
    expect(types).toContain('contradiction');
    expect(types).toContain('methodological');
    expect(result.researchQuestion).toContain('Exercise and memory');
  });

  it('research-gap: empty literature yields a knowledge gap', async () => {
    const server = createServer();
    const result = (await tool(server, 'research-gap').handler({
      topic: 'Brand new area',
      titles: [],
      findings: [],
    })) as { detected: { type: string; confidence: number }[] };
    expect(result.detected[0]?.type).toBe('knowledge');
    expect(result.detected[0]?.confidence).toBeGreaterThan(0.8);
  });

  it('dikw: transforms data through all four layers', async () => {
    const server = createServer();
    const result = (await tool(server, 'dikw').handler({
      attributes: ['temperature', 'time', 'patient'],
      values: ['38.6', '9:32 AM', '427'],
      priorities: ['Find the underlying infection'],
      tradeoffs: ['Treat symptoms vs treat cause'],
    })) as {
      data: { points: { attribute: string; value: string }[] };
      information: { entities: unknown[] };
      knowledge: { primaryQuestion: string };
      wisdom: { primaryQuestion: string; judgment: { priorities: string[] } | null };
      loop: string[];
    };
    expect(result.data.points.length).toBe(3);
    expect(result.information.entities.length).toBeGreaterThan(0);
    expect(result.knowledge.primaryQuestion).toBe('How?');
    expect(result.wisdom.primaryQuestion).toBe('Why?');
    expect(result.wisdom.judgment?.priorities).toContain('Find the underlying infection');
    expect(result.loop.length).toBeGreaterThan(0);
  });

  it('compose-signals: fuses factors into a ranked composite', async () => {
    const server = createServer();
    const result = (await tool(server, 'compose-signals').handler({
      candidates: ['A', 'B'],
      factors: [
        [{ id: 'momentum', label: 'Momentum', score: 0.9 }, { id: 'quality', label: 'Quality', score: 0.8 }],
        [{ id: 'momentum', label: 'Momentum', score: 0.2 }, { id: 'quality', label: 'Quality', score: 0.2 }],
      ],
    })) as {
      ranked: { name: string; composite: number; riskFlags: string[] }[];
      candidates: unknown[];
      riskControls: string[];
      insight: string;
    };
    expect(result.ranked.length).toBe(2);
    expect(result.ranked[0]?.name).toBe('A');
    expect(result.ranked[0]?.composite).toBeGreaterThan(result.ranked[1]?.composite ?? 1);
    expect(result.riskControls.length).toBeGreaterThan(0);
    expect(result.insight.length).toBeGreaterThan(10);
  });

  it('code-audit: flags YAGNI violations and returns trade-offs', async () => {
    const server = createServer();
    const result = (await tool(server, 'code-audit').handler({
      change: 'Build a plugin framework with a config engine just in case',
      intent: 'Handle a single report format',
    })) as {
      verdict: string;
      principles: { principle: string; score: number }[];
      tradeOffs: unknown[];
      recommendations: string[];
      score: number;
    };
    expect(result.principles.length).toBe(5);
    const yagni = result.principles.find((p) => p.principle === 'yagni');
    expect(yagni?.score).toBeLessThan(7);
    expect(result.verdict).toMatch(/clean|revise/);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
