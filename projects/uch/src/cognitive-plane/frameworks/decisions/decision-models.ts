/**
 * Decision Model Engines — deterministic implementations of the
 * quantitative/structured decision models from the corpus.
 *
 * Every engine is pure and LLM-free: given options and criteria it
 * produces scores, rankings, and rationale. Qualitative models
 * (SWOT, six hats, pre-mortem) are exposed as structured templates
 * with optional LLM-assisted elaboration behind `FrameworkLLMProvider`.
 */

import type { FrameworkLLMProvider } from '../types.js';

/* ── Decision Matrix ─────────────────────────────────────────────── */

export interface MatrixCriterion {
  name: string;
  weight: number;
}

export interface MatrixOption {
  name: string;
  /** Scores per criterion, same order as criteria. 0-10. */
  scores: number[];
}

export interface MatrixResult {
  option: string;
  weightedScore: number;
  maxPossible: number;
  normalized: number;
}

export function decisionMatrix(
  criteria: MatrixCriterion[],
  options: MatrixOption[],
): { results: MatrixResult[]; winner: MatrixResult | null } {
  const maxPossible = criteria.reduce((acc, c) => acc + Math.max(0, c.weight) * 10, 0) || 10;
  const results: MatrixResult[] = options.map((opt) => {
    const raw = opt.scores.reduce(
      (acc, score, i) => acc + score * Math.max(0, criteria[i]?.weight ?? 0),
      0,
    );
    return {
      option: opt.name,
      weightedScore: round2(raw),
      maxPossible: round2(maxPossible),
      normalized: round2((raw / maxPossible) * 100),
    };
  });
  results.sort((a, b) => b.weightedScore - a.weightedScore);
  return { results, winner: results[0] ?? null };
}

/* ── Cost-Benefit ────────────────────────────────────────────────── */

export interface CostBenefitInput {
  name: string;
  costs: number[];
  benefits: number[];
}

export interface CostBenefitResult {
  option: string;
  totalCost: number;
  totalBenefit: number;
  netValue: number;
  ratio: number;
  verdict: 'adopt' | 'reject' | 'review';
}

export function costBenefit(items: CostBenefitInput[]): CostBenefitResult[] {
  return items.map((it) => {
    const totalCost = round2(it.costs.reduce((a, b) => a + b, 0));
    const totalBenefit = round2(it.benefits.reduce((a, b) => a + b, 0));
    const netValue = round2(totalBenefit - totalCost);
    const ratio = totalCost === 0 ? (totalBenefit > 0 ? Infinity : 0) : round2(totalBenefit / totalCost);
    const verdict: CostBenefitResult['verdict'] =
      netValue <= 0 ? 'reject' : ratio >= 1.5 ? 'adopt' : 'review';
    return { option: it.name, totalCost, totalBenefit, netValue, ratio, verdict };
  });
}

/* ── Pareto Analysis ─────────────────────────────────────────────── */

export interface ParetoItem {
  name: string;
  impact: number;
}

export interface ParetoResult {
  items: { name: string; impact: number; sharePct: number; cumulativePct: number; vital: boolean }[];
  vitalFew: string[];
  /** Cumulative share captured by the vital few. */
  vitalSharePct: number;
}

export function paretoAnalysis(items: ParetoItem[], vitalThresholdPct = 80): ParetoResult {
  const sorted = [...items].sort((a, b) => b.impact - a.impact);
  const total = sorted.reduce((acc, it) => acc + Math.max(0, it.impact), 0) || 1;
  let cumulative = 0;
  const mapped = sorted.map((it) => {
    const share = round2((Math.max(0, it.impact) / total) * 100);
    cumulative += share;
    return {
      name: it.name,
      impact: it.impact,
      sharePct: share,
      cumulativePct: round2(cumulative),
      vital: false,
    };
  });
  for (const item of mapped) {
    // The item that crosses the threshold line is still vital (it completes the 80%).
    item.vital = item.cumulativePct - item.sharePct < vitalThresholdPct || item === mapped[0];
  }
  const vital = mapped.filter((m) => m.vital);
  return {
    items: mapped,
    vitalFew: vital.map((v) => v.name),
    vitalSharePct: round2(vital.reduce((acc, v) => acc + v.sharePct, 0)),
  };
}

/* ── Decision Tree (expected value rollback) ─────────────────────── */

export interface TreeBranch {
  label: string;
  probability: number;
  value: number;
}

export interface TreeOption {
  name: string;
  branches: TreeBranch[];
}

export interface TreeResult {
  option: string;
  expectedValue: number;
  worstCase: number;
  bestCase: number;
  spread: number;
}

export function decisionTree(options: TreeOption[]): {
  results: TreeResult[];
  best: TreeResult | null;
} {
  const results: TreeResult[] = options.map((opt) => {
    const pSum = opt.branches.reduce((a, b) => a + Math.max(0, b.probability), 0) || 1;
    const expectedValue = round2(
      opt.branches.reduce((acc, b) => acc + (b.value * Math.max(0, b.probability)) / pSum, 0),
    );
    const values = opt.branches.map((b) => b.value);
    const worstCase = Math.min(...values, 0);
    const bestCase = Math.max(...values, 0);
    return { option: opt.name, expectedValue, worstCase, bestCase, spread: round2(bestCase - worstCase) };
  });
  results.sort((a, b) => b.expectedValue - a.expectedValue);
  return { results, best: results[0] ?? null };
}

/* ── Pros & Cons ──────────────────────────────────────────────────── */

export interface ProsConsInput {
  pros: string[];
  cons: string[];
}

export interface ProsConsResult {
  pros: string[];
  cons: string[];
  proCount: number;
  conCount: number;
  /** -1 (all cons) … +1 (all pros). */
  weightedScore: number;
  verdict: 'adopt' | 'balanced' | 'reject';
}

export function prosCons(input: ProsConsInput): ProsConsResult {
  const pros = input.pros ?? [];
  const cons = input.cons ?? [];
  const proCount = pros.length;
  const conCount = cons.length;
  const total = proCount + conCount;
  const weightedScore = total === 0 ? 0 : round2((proCount - conCount) / total);
  const verdict: ProsConsResult['verdict'] =
    weightedScore >= 0.34 ? 'adopt' : weightedScore <= -0.34 ? 'reject' : 'balanced';
  return { pros, cons, proCount, conCount, weightedScore, verdict };
}

/* ── Qualitative templates (SWOT / six hats / pre-mortem) ────────── */

export interface SwotInput {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
}

export interface SwotResult extends SwotInput {
  /** Cross-product synthesis (S-O, W-O, S-T, W-T). */
  synthesis: { so: string[]; wo: string[]; st: string[]; wt: string[] };
}

export function swotAnalysis(input: SwotInput): SwotResult {
  const pairs = (a: string[], b: string[]): string[] =>
    a.slice(0, 3).map((x, i) => `${x} → ${b[i % Math.max(1, b.length)] ?? b[0] ?? 'exploit'}`);
  return {
    ...input,
    synthesis: {
      so: pairs(input.strengths, input.opportunities),
      wo: pairs(input.weaknesses, input.opportunities),
      st: pairs(input.strengths, input.threats),
      wt: pairs(input.weaknesses, input.threats),
    },
  };
}

export interface PremortemInput {
  plan: string;
  possibleCauses: string[];
  likelihood?: number[];
  impact?: number[];
}

export interface PremortemResult {
  plan: string;
  rankedCauses: { cause: string; riskScore: number; mitigation: string }[];
  topMitigations: string[];
}

export function premortem(input: PremortemInput): PremortemResult {
  const ranked = input.possibleCauses
    .map((cause, i) => {
      const likelihood = input.likelihood?.[i] ?? 0.5;
      const impact = input.impact?.[i] ?? 0.5;
      return {
        cause,
        riskScore: round2(likelihood * impact * 100),
        mitigation: `Design mitigation for: ${cause}`,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
  return {
    plan: input.plan,
    rankedCauses: ranked,
    topMitigations: ranked.slice(0, 3).map((r) => r.mitigation),
  };
}

export interface HatsResult {
  white: string[];
  red: string[];
  black: string[];
  yellow: string[];
  green: string[];
  blue: string[];
}

/**
 * Six Thinking Hats — deterministic scaffold returns the lens prompts;
 * with an LLM provider it elaborates each lens for the given question.
 */
export async function sixHats(
  question: string,
  llm?: FrameworkLLMProvider,
): Promise<HatsResult> {
  const lens = {
    white: 'Facts and data about: ',
    red: 'Emotions, gut reactions, intuition about: ',
    black: 'Risks, cautions, downsides of: ',
    yellow: 'Benefits, values, upside of: ',
    green: 'Creative alternatives, new angles for: ',
    blue: 'Process control, synthesis, next steps for: ',
  };
  if (!llm) {
    return {
      white: [`${lens.white}${question}`],
      red: [`${lens.red}${question}`],
      black: [`${lens.black}${question}`],
      yellow: [`${lens.yellow}${question}`],
      green: [`${lens.green}${question}`],
      blue: [`${lens.blue}${question}`],
    };
  }
  const entries = await Promise.all(
    (Object.keys(lens) as (keyof typeof lens)[]).map(async (key) => {
      const text = await llm.generate(`Six Thinking Hats — ${key} lens`, `${lens[key]}${question}`);
      return [key, text.split('\n').map((l) => l.trim()).filter(Boolean)] as const;
    }),
  );
  return Object.fromEntries(entries) as unknown as HatsResult;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
