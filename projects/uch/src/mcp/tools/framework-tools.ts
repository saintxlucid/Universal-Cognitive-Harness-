import {
  createFrameworkRegistry,
  FRAMEWORK_CATALOG_VERSION,
} from '../../cognitive-plane/frameworks/registry.js';
import {
  decisionMatrix,
  costBenefit,
  paretoAnalysis,
  decisionTree,
  swotAnalysis,
  premortem,
  prosCons,
} from '../../cognitive-plane/frameworks/decisions/decision-models.js';
import { rcaAnalyze } from '../../cognitive-plane/frameworks/rca/rca.js';
import {
  strategyWheel,
  strategyVsPlan,
} from '../../cognitive-plane/frameworks/strategy/strategy-wheel.js';
import { planTasks } from '../../cognitive-plane/frameworks/productivity/productivity-os.js';
import {
  validateMethodology,
  detectGaps,
} from '../../cognitive-plane/frameworks/research/methodology.js';
import { assessInformation } from '../../cognitive-plane/frameworks/critical/critical-evaluator.js';
import { dikwTransform } from '../../cognitive-plane/frameworks/knowledge/dikw.js';
import { fuseSignals } from '../../cognitive-plane/frameworks/signals/signal-fusion.js';
import { auditCodePrinciples } from '../../cognitive-plane/frameworks/code/code-principles.js';
import {
  ideal,
  fiveWhys,
  ooda,
  kepnerTregoe,
  pdcaPlan,
} from '../../cognitive-plane/frameworks/problems/problem-solver.js';
import { FrameworkComposer } from '../../cognitive-plane/frameworks/composer/composer.js';
import type { MCPToolContext, ToolRegistrar } from './types.js';

/**
 * Framework trace helpers — record completion/error traces for every
 * framework tool invocation so usage stats and the decision journal
 * (blueprint §5.1, §5.4) see the actual engine activity.
 */
function profileFromArgs(args: Record<string, unknown>): Record<string, unknown> {
  const profile: Record<string, unknown> = {};
  for (const key of [
    'dataAvailability',
    'timePressure',
    'stakeholderInvolvement',
    'risk',
    'complexity',
    'rootCauseNeeded',
    'humanCentered',
    'continuousImprovement',
    'speedAdaptability',
  ]) {
    if (args[key] !== undefined) profile[key] = args[key];
  }
  return profile;
}

function completed(
  ctx: MCPToolContext,
  args: Record<string, unknown>,
  result: unknown,
  engine: string,
  family: string,
  verdict?: string | null,
): unknown {
  const problem = String(args.problem ?? args.target ?? args.topic ?? args.question ?? '');
  const profile = profileFromArgs(args);
  ctx.frameworkTracer.recordCompletion({
    engine,
    family,
    problem,
    profile,
    result: (result ?? {}) as Record<string, unknown>,
    verdict,
  });
  ctx.frameworkJournal.record({
    engine,
    family,
    problem,
    profile,
    verdict: verdict ?? null,
    mode: 'deterministic',
  });
  return result;
}

function failed(
  ctx: MCPToolContext,
  args: Record<string, unknown>,
  result: unknown,
  engine: string,
  family: string,
): unknown {
  const message =
    typeof result === 'object' && result !== null
      ? String((result as { error?: string }).error ?? 'unknown error')
      : 'unknown error';
  ctx.frameworkTracer.recordError({
    engine,
    family,
    problem: String(args.problem ?? args.target ?? args.topic ?? args.question ?? ''),
    message,
  });
  return result;
}

/**
 * Cognitive Frameworks Library tools — the codified reasoning, decision,
 * strategy, productivity, research, and quality frameworks as MCP tools.
 * All deterministic (no LLM required); see `src/cognitive-plane/frameworks/`.
 */
export function registerFrameworkTools(ctx: MCPToolContext, register: ToolRegistrar): void {
  const registry = createFrameworkRegistry(ctx.frameworkTracer);

  register(
    'framework-catalog',
    'List the Cognitive Frameworks Library: every codified framework (decision models, problem-solving, RCA, strategy, productivity, research, critical thinking, DIKW, signal fusion, code principles) with selection metadata',
    {
      type: 'object',
      properties: {
        family: {
          type: 'string',
          description:
            'Optional family filter: decisions, problems, rca, strategy, productivity, research, critical, knowledge, signals, code',
        },
      },
      required: [],
    },
    async (args) => {
      const family = args.family as string | undefined;
      const frameworks = family ? registry.list(family as never) : registry.list();
      return {
        version: FRAMEWORK_CATALOG_VERSION,
        families: registry.families(),
        count: frameworks.length,
        frameworks: frameworks.map((f) => ({
          id: f.id,
          family: f.family,
          name: f.name,
          purpose: f.purpose,
          bestFor: f.bestFor,
          stages: f.stages.map((s) => s.name),
        })),
      };
    },
  );

  register(
    'framework-select',
    'Select the right framework for a problem (decision-about-decisions): profile clarity, data, time pressure, stakeholders, risk, complexity',
    {
      type: 'object',
      properties: {
        problem: { type: 'string', description: 'The problem or decision description' },
        family: { type: 'string', description: 'Optional family filter' },
        dataAvailability: {
          type: 'number',
          description: '0-1 how much reliable data is available',
        },
        timePressure: { type: 'number', description: '0-1 time pressure' },
        stakeholderInvolvement: {
          type: 'number',
          description: '0-1 stakeholder/group involvement',
        },
        risk: { type: 'number', description: '0-1 risk/uncertainty' },
        complexity: { type: 'number', description: '0-1 complexity' },
        rootCauseNeeded: { type: 'boolean', description: 'Root-cause diagnosis required?' },
        humanCentered: { type: 'boolean', description: 'Human-centered (users involved)?' },
        continuousImprovement: { type: 'boolean', description: 'Continuous improvement goal?' },
        speedAdaptability: { type: 'boolean', description: 'Must adapt fast to change?' },
      },
      required: ['problem'],
    },
    async (args) => {
      return registry.select({
        problem: args.problem as string,
        family: args.family as never,
        dataAvailability: args.dataAvailability as number | undefined,
        timePressure: args.timePressure as number | undefined,
        stakeholderInvolvement: args.stakeholderInvolvement as number | undefined,
        risk: args.risk as number | undefined,
        complexity: args.complexity as number | undefined,
        rootCauseNeeded: args.rootCauseNeeded as boolean | undefined,
        humanCentered: args.humanCentered as boolean | undefined,
        continuousImprovement: args.continuousImprovement as boolean | undefined,
        speedAdaptability: args.speedAdaptability as boolean | undefined,
      });
    },
  );

  register(
    'decide',
    'Run a deterministic decision model: decision matrix, cost-benefit, pareto, decision tree, SWOT, pros & cons, or pre-mortem',
    {
      type: 'object',
      properties: {
        model: {
          type: 'string',
          description:
            'decision-matrix | cost-benefit | pareto | decision-tree | swot | pros-cons | pre-mortem',
        },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Option names (matrix, cost-benefit, tree, pre-mortem)',
        },
        criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'Criterion names for decision-matrix',
        },
        weights: {
          type: 'array',
          items: { type: 'number' },
          description: 'Criterion weights for decision-matrix',
        },
        scores: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' } },
          description: 'Per-option scores aligned with criteria (matrix)',
        },
        costs: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' } },
          description: 'Per-option cost arrays (cost-benefit)',
        },
        benefits: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' } },
          description: 'Per-option benefit arrays (cost-benefit)',
        },
        impacts: {
          type: 'array',
          items: { type: 'number' },
          description: 'Impact values (pareto)',
        },
        probabilities: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' } },
          description: 'Per-option branch probabilities (decision-tree)',
        },
        values: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' } },
          description: 'Per-option branch values (decision-tree)',
        },
        strengths: { type: 'array', items: { type: 'string' }, description: 'SWOT strengths' },
        weaknesses: { type: 'array', items: { type: 'string' }, description: 'SWOT weaknesses' },
        opportunities: {
          type: 'array',
          items: { type: 'string' },
          description: 'SWOT opportunities',
        },
        threats: { type: 'array', items: { type: 'string' }, description: 'SWOT threats' },
        pros: { type: 'array', items: { type: 'string' }, description: 'Pros & cons: advantages' },
        cons: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pros & cons: disadvantages',
        },
        causes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pre-mortem failure causes',
        },
        plan: { type: 'string', description: 'Pre-mortem plan description' },
      },
      required: ['model'],
    },
    async (args) => {
      const model = args.model as string;
      const options = (args.options as string[] | undefined) ?? [];
      switch (model) {
        case 'decision-matrix': {
          const criteria = ((args.criteria as string[] | undefined) ?? []).map((name, i) => ({
            name,
            weight: ((args.weights as number[] | undefined) ?? [])[i] ?? 1,
          }));
          const optionScores = ((args.scores as number[][] | undefined) ?? []).map((s, i) => ({
            name: options[i] ?? `Option ${i + 1}`,
            scores: s,
          }));
          return completed(ctx, args, decisionMatrix(criteria, optionScores), model, 'decisions');
        }
        case 'cost-benefit': {
          const costs = (args.costs as number[][] | undefined) ?? [];
          const benefits = (args.benefits as number[][] | undefined) ?? [];
          return completed(
            ctx,
            args,
            costBenefit(
              options.map((name, i) => ({
                name,
                costs: costs[i] ?? [],
                benefits: benefits[i] ?? [],
              })),
            ),
            model,
            'decisions',
          );
        }
        case 'pareto': {
          const impacts = (args.impacts as number[] | undefined) ?? [];
          return completed(
            ctx,
            args,
            paretoAnalysis(options.map((name, i) => ({ name, impact: impacts[i] ?? 0 }))),
            model,
            'decisions',
          );
        }
        case 'decision-tree': {
          const probabilities = (args.probabilities as number[][] | undefined) ?? [];
          const values = (args.values as number[][] | undefined) ?? [];
          return completed(
            ctx,
            args,
            decisionTree(
              options.map((name, i) => ({
                name,
                branches: (probabilities[i] ?? []).map((p, j) => ({
                  label: `branch ${j + 1}`,
                  probability: p,
                  value: values[i]?.[j] ?? 0,
                })),
              })),
            ),
            model,
            'decisions',
          );
        }
        case 'swot': {
          return completed(
            ctx,
            args,
            swotAnalysis({
              strengths: (args.strengths as string[] | undefined) ?? [],
              weaknesses: (args.weaknesses as string[] | undefined) ?? [],
              opportunities: (args.opportunities as string[] | undefined) ?? [],
              threats: (args.threats as string[] | undefined) ?? [],
            }),
            model,
            'decisions',
          );
        }
        case 'pros-cons': {
          const result = prosCons({
            pros: (args.pros as string[] | undefined) ?? [],
            cons: (args.cons as string[] | undefined) ?? [],
          });
          return completed(ctx, args, result, model, 'decisions', result.verdict);
        }
        case 'pre-mortem': {
          return completed(
            ctx,
            args,
            premortem({
              plan: (args.plan as string) ?? '',
              possibleCauses: (args.causes as string[] | undefined) ?? [],
            }),
            model,
            'decisions',
          );
        }
        default:
          return failed(
            ctx,
            args,
            {
              error: `unknown model: ${model}. Use: decision-matrix, cost-benefit, pareto, decision-tree, swot, pros-cons, pre-mortem`,
            },
            model,
            'decisions',
          );
      }
    },
  );

  register(
    'analyze-problem',
    'Run a problem-solving framework: IDEAL, five-whys, pdca, ooda, or kepner-tregoe',
    {
      type: 'object',
      properties: {
        framework: {
          type: 'string',
          description: 'ideal | five-whys | pdca | ooda | kepner-tregoe',
        },
        problem: { type: 'string', description: 'The problem statement' },
        whyAnswers: { type: 'array', items: { type: 'string' }, description: 'Five Whys answers' },
        objective: { type: 'string', description: 'PDCA objective' },
        observations: {
          type: 'array',
          items: { type: 'string' },
          description: 'OODA observations',
        },
        issues: {
          type: 'array',
          items: { type: 'string' },
          description: 'Kepner-Tregoe issue descriptions',
        },
      },
      required: ['framework'],
    },
    async (args) => {
      const framework = args.framework as string;
      const problem = (args.problem as string) ?? '';
      switch (framework) {
        case 'ideal':
          return completed(ctx, args, ideal({ problem }), framework, 'problems');
        case 'five-whys':
          return completed(
            ctx,
            args,
            fiveWhys({
              symptom: problem,
              whyAnswers: (args.whyAnswers as string[] | undefined) ?? [],
            }),
            framework,
            'problems',
          );
        case 'pdca':
          return completed(ctx, args, pdcaPlan({ objective: problem }), framework, 'problems');
        case 'ooda':
          return completed(
            ctx,
            args,
            ooda({ observations: (args.observations as string[] | undefined) ?? [problem] }),
            framework,
            'problems',
          );
        case 'kepner-tregoe':
          return completed(
            ctx,
            args,
            kepnerTregoe({
              issues: ((args.issues as string[] | undefined) ?? [problem]).map((description) => ({
                description,
              })),
            }),
            framework,
            'problems',
          );
        default:
          return failed(
            ctx,
            args,
            {
              error: `unknown framework: ${framework}. Use: ideal, five-whys, pdca, ooda, kepner-tregoe`,
            },
            framework,
            'problems',
          );
      }
    },
  );

  register(
    'rca',
    'Root cause analysis (F.O.C.U.S.): problem, evidence, hypotheses → ranked root cause, corrective actions, prevention',
    {
      type: 'object',
      properties: {
        problem: { type: 'string', description: 'Measurable problem statement' },
        evidenceFacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'Evidence facts (logs, metrics, observations)',
        },
        evidenceSources: {
          type: 'array',
          items: { type: 'string' },
          description: 'Source per evidence fact',
        },
        causes: { type: 'array', items: { type: 'string' }, description: 'Candidate causes' },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Category per cause (people, process, technology, materials, environment, management)',
        },
        likelihoods: {
          type: 'array',
          items: { type: 'number' },
          description: 'Likelihood 0-1 per cause',
        },
        impacts: { type: 'array', items: { type: 'number' }, description: 'Impact 0-1 per cause' },
      },
      required: ['problem'],
    },
    async (args) => {
      const facts = (args.evidenceFacts as string[] | undefined) ?? [];
      const sources = (args.evidenceSources as string[] | undefined) ?? [];
      const causes = (args.causes as string[] | undefined) ?? [];
      const categories = (args.categories as string[] | undefined) ?? [];
      const likelihoods = (args.likelihoods as number[] | undefined) ?? [];
      const impacts = (args.impacts as number[] | undefined) ?? [];
      return completed(
        ctx,
        args,
        rcaAnalyze({
          problem: args.problem as string,
          evidence: facts.map((fact, i) => ({ fact, source: sources[i] ?? 'observation' })),
          hypotheses: causes.map((cause, i) => ({
            cause,
            category: (categories[i] as never) ?? 'process',
            likelihood: likelihoods[i] ?? 0.5,
            impact: impacts[i] ?? 0.5,
          })),
        }),
        'rca-focus',
        'rca',
      );
    },
  );

  register(
    'strategy',
    'Run strategy frameworks: strategy-wheel (20 questions) or strategy-vs-plan (direction vs execution gap diagnosis)',
    {
      type: 'object',
      properties: {
        framework: { type: 'string', description: 'strategy-wheel | strategy-vs-plan' },
        purpose: { type: 'string' },
        arena: { type: 'string' },
        advantage: { type: 'string' },
        capabilities: { type: 'string' },
        revenueLogic: { type: 'string' },
        planGoals: { type: 'string' },
        planOwnership: { type: 'string' },
        planResources: { type: 'string' },
        planTimeline: { type: 'string' },
        planTracking: { type: 'string' },
      },
      required: ['framework'],
    },
    async (args) => {
      const framework = args.framework as string;
      if (framework === 'strategy-wheel') {
        return completed(ctx, args, strategyWheel(), framework, 'strategy');
      }
      return completed(
        ctx,
        args,
        strategyVsPlan({
          strategy: {
            purpose: args.purpose as string | undefined,
            arena: args.arena as string | undefined,
            advantage: args.advantage as string | undefined,
            capabilities: args.capabilities as string | undefined,
            revenueLogic: args.revenueLogic as string | undefined,
          },
          plan: {
            goals: args.planGoals as string | undefined,
            ownership: args.planOwnership as string | undefined,
            resources: args.planResources as string | undefined,
            timeline: args.planTimeline as string | undefined,
            tracking: args.planTracking as string | undefined,
          },
        }),
        framework,
        'strategy',
      );
    },
  );

  register(
    'plan-day',
    'Plan work with the Productivity OS: Eisenhower classification, MIT, Pareto vital few, eat-the-frog, time blocks, two-minute rule, SMART gaps',
    {
      type: 'object',
      properties: {
        tasks: { type: 'array', items: { type: 'string' }, description: 'Task names' },
        durations: { type: 'array', items: { type: 'number' }, description: 'Minutes per task' },
        urgencies: {
          type: 'array',
          items: { type: 'string' },
          description: 'urgent | not-urgent per task',
        },
        importances: {
          type: 'array',
          items: { type: 'string' },
          description: 'important | not-important per task',
        },
        leverages: {
          type: 'array',
          items: { type: 'number' },
          description: '0-1 leverage per task',
        },
        resistances: {
          type: 'array',
          items: { type: 'number' },
          description: '0-1 resistance per task',
        },
        notes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Goal notes (first task notes used for SMART check)',
        },
        focusHours: { type: 'number', description: 'Focus hours available' },
      },
      required: ['tasks'],
    },
    async (args) => {
      const names = (args.tasks as string[]) ?? [];
      const tasks = names.map((name, i) => ({
        name,
        durationMin: (args.durations as number[] | undefined)?.[i],
        urgency: (args.urgencies as string[] | undefined)?.[i] as never,
        importance: (args.importances as string[] | undefined)?.[i] as never,
        leverage: (args.leverages as number[] | undefined)?.[i],
        resistance: (args.resistances as number[] | undefined)?.[i],
        notes: (args.notes as string[] | undefined)?.[i],
      }));
      return completed(
        ctx,
        args,
        planTasks({ tasks, focusHours: (args.focusHours as number | undefined) ?? 4 }),
        'productivity-os',
        'productivity',
      );
    },
  );

  register(
    'evaluate-info',
    'Critical thinking: evaluate information against the 9 critical questions (maps to the 5 Information Integrity laws)',
    {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'What is being evaluated' },
        answers: {
          type: 'object',
          description:
            'Map of question id → answer: needs, qualified_source, currency, prejudice, fact_vs_opinion, propaganda, motivation, whole_story, better_sources',
        },
      },
      required: ['target'],
    },
    async (args) => {
      return assessInformation({
        target: args.target as string,
        answers: (args.answers as Record<string, string> | undefined) ?? {},
      });
    },
  );

  register(
    'research-methodology',
    'Validate a research methodology against the 5-stage structure (design, collection, analysis, sampling, ethics) with quality controls',
    {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Research question' },
        designApproach: { type: 'string', description: 'qualitative | quantitative | mixed' },
        designJustification: { type: 'string' },
        collectionMethods: { type: 'array', items: { type: 'string' } },
        collectionDetail: { type: 'string' },
        analysisMethods: { type: 'array', items: { type: 'string' } },
        analysisDescription: { type: 'string' },
        population: { type: 'string' },
        samplingMethod: { type: 'string' },
        sampleSize: { type: 'string' },
        sampleJustification: { type: 'string' },
        informedConsent: { type: 'boolean' },
        confidentiality: { type: 'boolean' },
        voluntary: { type: 'boolean' },
        dataProtection: { type: 'boolean' },
      },
      required: ['question'],
    },
    async (args) => {
      return validateMethodology({
        researchQuestion: args.question as string,
        design: {
          approach: args.designApproach as never,
          justification: args.designJustification as string | undefined,
        },
        collection: {
          methods: (args.collectionMethods as string[] | undefined) ?? [],
          detail: args.collectionDetail as string | undefined,
        },
        analysis: {
          methods: (args.analysisMethods as string[] | undefined) ?? [],
          description: args.analysisDescription as string | undefined,
        },
        sampling: {
          population: args.population as string | undefined,
          method: args.samplingMethod as string | undefined,
          size: args.sampleSize as string | undefined,
          justification: args.sampleJustification as string | undefined,
        },
        ethics: {
          informedConsent: Boolean(args.informedConsent),
          confidentiality: Boolean(args.confidentiality),
          voluntary: Boolean(args.voluntary),
          dataProtection: Boolean(args.dataProtection),
        },
      });
    },
  );

  register(
    'research-gap',
    'Research gap analysis: detect knowledge, evidence, methodological, population, context, time, contradiction, and theory gaps from literature notes',
    {
      type: 'object',
      properties: {
        topic: { type: 'string', description: 'Research topic' },
        titles: { type: 'array', items: { type: 'string' }, description: 'Paper titles' },
        findings: {
          type: 'array',
          items: { type: 'string' },
          description: 'Key findings per paper',
        },
        years: { type: 'array', items: { type: 'number' }, description: 'Publication years' },
        limitations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Limitations per paper',
        },
        futureRecommendations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Future-research recommendations per paper',
        },
      },
      required: ['topic'],
    },
    async (args) => {
      const titles = (args.titles as string[] | undefined) ?? [];
      const findings = (args.findings as string[] | undefined) ?? [];
      const years = (args.years as number[] | undefined) ?? [];
      const limitations = (args.limitations as string[] | undefined) ?? [];
      const futures = (args.futureRecommendations as string[] | undefined) ?? [];
      return detectGaps({
        topic: args.topic as string,
        notes: titles.map((title, i) => ({
          title,
          finding: findings[i] ?? '',
          year: years[i],
          limitation: limitations[i],
          futureRecommendation: futures[i],
        })),
      });
    },
  );

  register(
    'dikw',
    'DIKW transform: elevate data → information → knowledge → wisdom, and check representation invariance (truth across representations)',
    {
      type: 'object',
      properties: {
        attributes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Data attribute names',
        },
        values: { type: 'array', items: { type: 'string' }, description: 'Data values' },
        priorities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Judgment priorities (adds wisdom)',
        },
        tradeoffs: { type: 'array', items: { type: 'string' }, description: 'Judgment trade-offs' },
      },
      required: ['attributes'],
    },
    async (args) => {
      const attributes = (args.attributes as string[]) ?? [];
      const values = (args.values as string[]) ?? [];
      return dikwTransform({
        dataPoints: attributes.map((attribute, i) => ({ attribute, value: values[i] ?? '' })),
        judgment: (args.priorities as string[] | undefined)?.length
          ? {
              priorities: args.priorities as string[],
              tradeoffs: (args.tradeoffs as string[] | undefined) ?? [],
              ethicalConsiderations: [],
            }
          : undefined,
      });
    },
  );

  register(
    'compose-signals',
    'Composite signal fusion: combine weak signals into a ranked composite with risk controls (quant-style multi-factor scoring)',
    {
      type: 'object',
      properties: {
        candidates: { type: 'array', items: { type: 'string' }, description: 'Candidate names' },
        factors: {
          type: 'array',
          items: { type: 'object' },
          description: 'Per-candidate factors: [{id, label, score}...]',
        },
        maxAllocationPct: { type: 'number' },
        topN: { type: 'number' },
      },
      required: ['candidates'],
    },
    async (args) => {
      const candidates = (args.candidates as string[]) ?? [];
      const factors =
        (args.factors as { id: string; label: string; score: number }[][] | undefined) ?? [];
      return fuseSignals(
        candidates.map((name, i) => ({
          name,
          factors: (factors[i] ?? []).map((f) => ({
            id: f.id as never,
            label: f.label,
            score: f.score,
          })),
        })),
        {
          maxAllocationPct: args.maxAllocationPct as number | undefined,
          topN: args.topN as number | undefined,
        },
      );
    },
  );

  register(
    'code-audit',
    'Audit a design or change against the Clean Code principles (SOC, DRY, KISS, DYC, YAGNI) including the trade-off layer',
    {
      type: 'object',
      properties: {
        change: { type: 'string', description: 'The proposed change or design description' },
        intent: { type: 'string', description: 'Task intent (context for YAGNI/DYC)' },
      },
      required: ['change'],
    },
    async (args) => {
      return auditCodePrinciples({
        change: args.change as string,
        intent: (args.intent as string | undefined) ?? '',
      });
    },
  );

  register(
    'framework-stats',
    'Framework usage analytics: usage counts per model/family, dominant framework per problem type, drift over time, and per-model accuracy from the decision journal (which models got reversed). Zero-LLM.',
    {
      type: 'object',
      properties: {
        includeTraces: {
          type: 'boolean',
          description:
            'Include the raw usage-trace stats in addition to journal stats (default true)',
        },
      },
      required: [],
    },
    async (args) => {
      const usage = ctx.frameworkTracer.getStats();
      const journal = ctx.frameworkJournal.getStats();
      return {
        version: FRAMEWORK_CATALOG_VERSION,
        journal: {
          total: journal.total,
          open: journal.open,
          resolved: journal.resolved,
          usageByModel: journal.usageByModel,
          accuracyByModel: journal.accuracyByModel,
          dominantPerProblemType: journal.dominantPerProblemType,
          reversed: journal.reversed,
          drift: journal.drift,
        },
        ...(args.includeTraces === false
          ? {}
          : {
              traces: {
                traceCount: usage.traceCount,
                usageByFramework: usage.usageByFramework,
                usageByFamily: usage.usageByFamily,
                dominantPerProblemType: usage.dominantPerProblemType,
                drift: usage.drift,
              },
            }),
      };
    },
  );

  register(
    'framework-run',
    'Run the full solve pipeline end-to-end: select model → understand (IDEAL) → diagnose (RCA when root-cause needed) → decide (matrix or pros-cons when alternatives given) → pre-mortem risk gate → plan. One call, full trace tree.',
    {
      type: 'object',
      properties: {
        problem: { type: 'string', description: 'The problem or decision to solve' },
        family: { type: 'string', description: 'Optional family filter for model selection' },
        dataAvailability: {
          type: 'number',
          description: '0-1 how much reliable data is available',
        },
        timePressure: { type: 'number', description: '0-1 time pressure' },
        stakeholderInvolvement: {
          type: 'number',
          description: '0-1 stakeholder/group involvement',
        },
        risk: { type: 'number', description: '0-1 risk/uncertainty' },
        complexity: { type: 'number', description: '0-1 complexity' },
        rootCauseNeeded: { type: 'boolean', description: 'Run the RCA diagnose stage' },
        humanCentered: { type: 'boolean' },
        continuousImprovement: { type: 'boolean' },
        speedAdaptability: { type: 'boolean' },
        options: {
          type: 'array',
          items: { type: 'string' },
          description: 'Decide-stage alternatives (with criteria+scores for matrix)',
        },
        criteria: {
          type: 'array',
          items: { type: 'string' },
          description: 'Decision-matrix criteria',
        },
        weights: {
          type: 'array',
          items: { type: 'number' },
          description: 'Decision-matrix weights',
        },
        scores: {
          type: 'array',
          items: { type: 'array', items: { type: 'number' } },
          description: 'Per-option scores aligned with criteria (0-10)',
        },
        pros: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pros & cons mode: advantages',
        },
        cons: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pros & cons mode: disadvantages',
        },
        riskCauses: {
          type: 'array',
          items: { type: 'string' },
          description: 'Pre-mortem failure causes (defaults to standard checklist)',
        },
        riskLikelihood: {
          type: 'array',
          items: { type: 'number' },
          description: 'Pre-mortem likelihood 0-1 per risk cause',
        },
        riskImpact: {
          type: 'array',
          items: { type: 'number' },
          description: 'Pre-mortem impact 0-1 per risk cause',
        },
        evidenceFacts: {
          type: 'array',
          items: { type: 'string' },
          description: 'RCA evidence facts',
        },
      },
      required: ['problem'],
    },
    async (args) => {
      try {
        const composer = new FrameworkComposer(ctx.frameworkTracer);
        const result = composer.solve(args.problem as string, {
          family: args.family as never,
          dataAvailability: args.dataAvailability as number | undefined,
          timePressure: args.timePressure as number | undefined,
          stakeholderInvolvement: args.stakeholderInvolvement as number | undefined,
          risk: args.risk as number | undefined,
          complexity: args.complexity as number | undefined,
          rootCauseNeeded: args.rootCauseNeeded as boolean | undefined,
          humanCentered: args.humanCentered as boolean | undefined,
          continuousImprovement: args.continuousImprovement as boolean | undefined,
          speedAdaptability: args.speedAdaptability as boolean | undefined,
          options: args.options as string[] | undefined,
          criteria: args.criteria as string[] | undefined,
          weights: args.weights as number[] | undefined,
          scores: args.scores as number[][] | undefined,
          pros: args.pros as string[] | undefined,
          cons: args.cons as string[] | undefined,
          riskCauses: args.riskCauses as string[] | undefined,
          riskLikelihood: args.riskLikelihood as number[] | undefined,
          riskImpact: args.riskImpact as number[] | undefined,
          evidenceFacts: args.evidenceFacts as string[] | undefined,
        });
        for (const stage of result.stages) {
          ctx.frameworkJournal.record({
            engine: stage.engine,
            family: stage.family,
            problem: result.problem,
            profile: result.profile,
            verdict: stage.verdict,
            mode: 'deterministic',
          });
        }
        return result;
      } catch (err) {
        ctx.frameworkTracer.recordError({
          engine: 'composer',
          family: 'problems',
          problem: String(args.problem ?? ''),
          message: err instanceof Error ? err.message : String(err),
        });
        return { error: err instanceof Error ? err.message : String(err) };
      }
    },
  );
}
