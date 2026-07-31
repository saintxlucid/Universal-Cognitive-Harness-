/**
 * Strategy Framework Engines — Strategy Wheel (20 questions, 4 quadrants)
 * and Strategy vs Plan (separating direction from execution).
 *
 * Strategy is a continuous operating system, not a document: the wheel
 * asks WHY → WHO → WHAT → HOW and loops through results → review → purpose.
 */

export type StrategyQuadrant = 'purpose' | 'market' | 'goals' | 'actions';

export interface StrategyAnswer {
  question: string;
  answer?: string;
}

export interface StrategyWheelInput {
  answers: Partial<Record<StrategyQuadrant, StrategyAnswer[]>>;
}

export interface StrategyWheelResult {
  quadrants: {
    quadrant: StrategyQuadrant;
    label: string;
    driverQuestion: string;
    questions: { question: string; answered: boolean }[];
    gaps: string[];
  }[];
  hiddenFlow: string[];
  completenessPct: number;
}

const WHEEL: Record<StrategyQuadrant, { label: string; driver: string; questions: string[] }> = {
  purpose: {
    label: 'Purpose & Direction',
    driver: 'Why do we exist?',
    questions: [
      'Why do we exist?',
      'What is our mission in one clear sentence?',
      'What do we believe that drives how we operate?',
      'Where do we want to be in three years?',
      'What would success look like if nothing held us back?',
    ],
  },
  market: {
    label: 'Market & Advantage',
    driver: 'Why should anyone care?',
    questions: [
      'Who is our highest-value customer?',
      'What pain do they feel every day?',
      "What's changing in our industry?",
      'Why do people choose us instead of competitors?',
      'What can we offer that is difficult to copy?',
    ],
  },
  goals: {
    label: 'Goals & Metrics',
    driver: 'What does success look like, measured?',
    questions: [
      'What are our top three priorities?',
      'What does success look like this quarter?',
      "What's the one number that matters today?",
      'How often should we review progress?',
      'What milestone tells us we are winning?',
    ],
  },
  actions: {
    label: 'Actions & Tactics',
    driver: 'How do we execute and adapt?',
    questions: [
      'When and how will we review and adjust?',
      'What quick wins create momentum?',
      "What's blocking progress?",
      'Who owns each outcome?',
      'What must we deliver within the next 90 days?',
    ],
  },
};

export function strategyWheel(input?: StrategyWheelInput): StrategyWheelResult {
  const answers = input?.answers ?? {};
  let total = 0;
  let answeredCount = 0;
  const quadrants = (Object.keys(WHEEL) as StrategyQuadrant[]).map((quadrant) => {
    const spec = WHEEL[quadrant];
    const provided = answers[quadrant] ?? [];
    const providedByQuestion = new Map(provided.map((a) => [a.question, a]));
    const questions = spec.questions.map((q) => {
      const has = providedByQuestion.has(q) && Boolean(providedByQuestion.get(q)?.answer?.trim());
      total += 1;
      if (has) answeredCount += 1;
      return { question: q, answered: has };
    });
    return {
      quadrant,
      label: spec.label,
      driverQuestion: spec.driver,
      questions,
      gaps: questions.filter((q) => !q.answered).map((q) => q.question),
    };
  });

  return {
    quadrants,
    hiddenFlow: [
      'Purpose → Market → Goals → Actions → Results → Review → Purpose',
      'Strategy is maintained by repeatedly asking the right questions as conditions change',
    ],
    completenessPct: total === 0 ? 0 : Math.round((answeredCount / total) * 100),
  };
}

/* ── Strategy vs Plan ────────────────────────────────────────────── */

export interface StrategicPillar {
  pillar: string;
  question: string;
  answer?: string;
}

export interface StrategyVsPlanInput {
  strategy?: { purpose?: string; arena?: string; advantage?: string; capabilities?: string; revenueLogic?: string };
  plan?: { goals?: string; ownership?: string; resources?: string; timeline?: string; tracking?: string };
}

export interface StrategyVsPlanResult {
  strategyLayer: StrategicPillar[];
  planLayer: StrategicPillar[];
  strategyGaps: string[];
  planGaps: string[];
  dependencyChain: string[];
  diagnosis: string;
  timeHorizons: { strategy: string; plan: string };
}

export function strategyVsPlan(input: StrategyVsPlanInput): StrategyVsPlanResult {
  const strategyPillars: StrategicPillar[] = [
    { pillar: 'Purpose', question: 'Why do we exist?', answer: input.strategy?.purpose },
    { pillar: 'Arena', question: 'Where do we compete (market, customers, geography, products)?', answer: input.strategy?.arena },
    { pillar: 'Advantage', question: 'Why will customers choose us?', answer: input.strategy?.advantage },
    { pillar: 'Capabilities', question: 'What strengths allow us to execute?', answer: input.strategy?.capabilities },
    { pillar: 'Revenue Logic', question: 'How is value created, captured, and sustained?', answer: input.strategy?.revenueLogic },
  ];
  const planItems: StrategicPillar[] = [
    { pillar: 'Goals', question: 'What specific outcomes?', answer: input.plan?.goals },
    { pillar: 'Ownership', question: 'Who is responsible?', answer: input.plan?.ownership },
    { pillar: 'Resources', question: 'Time, budget, people, tools?', answer: input.plan?.resources },
    { pillar: 'Timeline', question: 'Deadlines, milestones, checkpoints?', answer: input.plan?.timeline },
    { pillar: 'Tracking', question: 'How do we measure, monitor, adjust?', answer: input.plan?.tracking },
  ];

  const strategyGaps = strategyPillars.filter((p) => !p.answer?.trim()).map((p) => p.pillar);
  const planGaps = planItems.filter((p) => !p.answer?.trim()).map((p) => p.pillar);

  const hasStrategy = strategyGaps.length === 0;
  const hasPlan = planGaps.length === 0;
  const diagnosis = !hasStrategy
    ? `strategy gaps detected (${strategyGaps.join(', ')}) — a plan without strategy is organized activity without direction`
    : !hasPlan
      ? `strategy is defined but plan gaps remain (${planGaps.join(', ')}) — brilliant strategy fails without disciplined planning`
      : 'strategy and plan are aligned — direction and execution are both defined';

  return {
    strategyLayer: strategyPillars,
    planLayer: planItems,
    strategyGaps,
    planGaps,
    dependencyChain: [
      'Purpose → Strategy → Objectives → Planning → Execution → Measurement → Learning → Strategy',
      'Strategy decides the destination; the plan designs the route; execution drives the vehicle',
    ],
    diagnosis,
    timeHorizons: {
      strategy: '3-5 years — changes rarely, evolves continuously',
      plan: 'days to months — changes frequently',
    },
  };
}
