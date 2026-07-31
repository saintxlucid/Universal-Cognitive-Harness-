/**
 * Problem-Solving Framework Engines — IDEAL, Five Whys, Design Thinking,
 * PDCA, OODA, Kepner-Tregoe.
 *
 * All deterministic: given structured inputs they produce stage-by-stage
 * outputs, hypotheses, cycles, and recommendations. The frameworks differ
 * in where they place emphasis (diagnosis / empathy / iteration / speed /
 * rigor) — the registry selector matches the problem to the framework.
 */

import type { FrameworkLLMProvider } from '../types.js';

/* ── IDEAL ───────────────────────────────────────────────────────── */

export interface IdealInput {
  problem: string;
  context?: string;
  solutions?: string[];
}

export interface IdealResult {
  identified: string;
  defined: string;
  explored: string[];
  acted: string | null;
  lookedBack: string[];
}

export function ideal(input: IdealInput): IdealResult {
  return {
    identified: input.problem,
    defined: `Boundaries: ${input.context ?? 'not specified — clarify scope, constraints, and success criteria'}`,
    explored: input.solutions ?? ['Generate 3+ candidate solutions before acting'],
    acted: input.solutions?.[0] ?? null,
    lookedBack: [
      'What outcome did the action produce?',
      'What lessons transfer to future problems?',
    ],
  };
}

/* ── Five Whys ───────────────────────────────────────────────────── */

export interface FiveWhysInput {
  symptom: string;
  whyAnswers: string[];
}

export interface FiveWhysResult {
  symptom: string;
  chain: { depth: number; question: string; answer: string }[];
  rootCause: string;
  correction: string;
}

export function fiveWhys(input: FiveWhysInput, maxDepth = 5): FiveWhysResult {
  const chain = input.whyAnswers.slice(0, maxDepth).map((answer, i) => ({
    depth: i + 1,
    question: i === 0 ? `Why: ${input.symptom}?` : `Why: ${input.whyAnswers[i - 1]}?`,
    answer,
  }));
  const last = chain[chain.length - 1];
  return {
    symptom: input.symptom,
    chain,
    rootCause: last?.answer ?? input.symptom,
    correction: `Design a system-level correction for: ${last?.answer ?? input.symptom} — do not stop at symptom treatment`,
  };
}

/* ── Design Thinking ─────────────────────────────────────────────── */

export interface DesignThinkingInput {
  problem: string;
  userContext?: string;
  empathyNotes?: string[];
  ideas?: string[];
}

export interface DesignThinkingResult {
  empathize: string[];
  define: string;
  ideate: string[];
  prototype: string[];
  test: string[];
}

export function designThinking(input: DesignThinkingInput, llm?: FrameworkLLMProvider): Promise<DesignThinkingResult> | DesignThinkingResult {
  const base: DesignThinkingResult = {
    empathize: input.empathyNotes ?? ['Interview/observe 3+ users experiencing the problem'],
    define: `User-centered problem: ${input.userContext ? `${input.userContext} — ` : ''}${input.problem}`,
    ideate: input.ideas ?? ['Ideate 10+ divergent solutions; defer judgment'],
    prototype: ['Build the cheapest prototype that tests the riskiest assumption'],
    test: ['Test with real users; iterate on feedback'],
  };
  if (!llm) return base;
  return (async () => ({
    ...base,
    empathize: base.empathize.length === 1
      ? (await llm.generate('Design Thinking — empathy notes', `${input.userContext ?? ''} ${input.problem}`)).split('\n').filter(Boolean)
      : base.empathize,
    ideate: base.ideate.length === 1
      ? (await llm.generate('Design Thinking — ideate', input.problem)).split('\n').filter(Boolean)
      : base.ideate,
  }))();
}

/* ── PDCA ────────────────────────────────────────────────────────── */

export interface PDCACycle {
  plan: string;
  do: string;
  check: string;
  act: string;
}

export function pdcaPlan(input: { objective: string; plannedChange?: string; checkCriteria?: string[] }): PDCACycle & { loops: number } {
  return {
    plan: input.plannedChange ?? `Plan the smallest change that moves: ${input.objective}`,
    do: `Execute the planned change on a pilot scope for: ${input.objective}`,
    check: `Check against criteria: ${input.checkCriteria?.join(', ') ?? 'expected outcome vs actual; measure the delta'}`,
    act: `Standardize if it worked; adjust and loop if not — feed results into the next ${input.objective} cycle`,
    loops: 1,
  };
}

/* ── OODA ────────────────────────────────────────────────────────── */

export interface OODAInput {
  observations: string[];
  orientationContext?: string[];
  options?: string[];
}

export interface OODAResult {
  observe: string[];
  orient: string[];
  decide: string | null;
  act: string;
  loopAdvice: string;
}

export function ooda(input: OODAInput): OODAResult {
  return {
    observe: input.observations,
    orient: input.orientationContext ?? [
      'Interpret observations against experience, culture, and changing conditions',
    ],
    decide: input.options?.[0] ?? null,
    act: 'Act; observe the reaction; re-enter the loop faster than the environment changes',
    loopAdvice: 'If the environment is changing faster than your loop, shorten Observe→Orient latency',
  };
}

/* ── Kepner-Tregoe ───────────────────────────────────────────────── */

export interface KTInput {
  issues: { description: string; priority?: number }[];
  rootCauseHypothesis?: string;
  alternatives?: { name: string; criteria: Record<string, number> }[];
  criteria?: string[];
  futureRisks?: string[];
}

export interface KTResult {
  situationAppraisal: { issue: string; priority: number }[];
  problemAnalysis: { hypothesis: string; nextStep: string };
  decisionAnalysis: { alternative: string; total: number }[] | null;
  potentialProblemAnalysis: { risk: string; preventiveAction: string }[];
}

export function kepnerTregoe(input: KTInput): KTResult {
  const appraised = [...input.issues]
    .map((i) => ({ issue: i.description, priority: i.priority ?? 0.5 }))
    .sort((a, b) => b.priority - a.priority);

  const decisionAnalysis = input.alternatives && input.alternatives.length > 0 && input.criteria
    ? input.alternatives
        .map((alt) => ({
          alternative: alt.name,
          total: round2(
            input.criteria!.reduce((acc, c) => acc + (alt.criteria[c] ?? 0), 0) /
              Math.max(1, input.criteria!.length),
          ),
        }))
        .sort((a, b) => b.total - a.total)
    : null;

  return {
    situationAppraisal: appraised,
    problemAnalysis: {
      hypothesis: input.rootCauseHypothesis ?? 'Identify the root cause before deciding — treat as a hypothesis, validate with evidence',
      nextStep: 'Validate the hypothesis with controlled evidence before implementing',
    },
    decisionAnalysis,
    potentialProblemAnalysis: (input.futureRisks ?? ['Unforeseen side effects of the solution']).map(
      (risk) => ({ risk, preventiveAction: `Plan preventive/mitigating action for: ${risk}` }),
    ),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
