/**
 * Root Cause Analysis Engine — the F.O.C.U.S. workflow plus the three
 * core diagnostic tools (Five Whys, Fishbone, Pareto) composed into a
 * single investigation pipeline.
 *
 * Philosophy (from the corpus): a problem is only truly solved when the
 * system that produced it has been corrected. Failure emerges from
 * interactions — evidence → hypotheses → root cause → system correction →
 * verification → prevention.
 */

export type CauseCategory =
  | 'people'
  | 'process'
  | 'technology'
  | 'materials'
  | 'environment'
  | 'management';

export const CAUSE_CATEGORIES: CauseCategory[] = [
  'people',
  'process',
  'technology',
  'materials',
  'environment',
  'management',
];

export interface EvidenceItem {
  fact: string;
  source: string;
}

export interface CauseHypothesis {
  category: CauseCategory;
  cause: string;
  likelihood: number;
  impact: number;
}

export interface RCAInput {
  /** F — Focus: a measurable problem statement. */
  problem: string;
  /** O — Organize: evidence separated from assumptions. */
  evidence: EvidenceItem[];
  /** C — Create: candidate causes across categories. */
  hypotheses?: CauseHypothesis[];
  /** U — Understand: system notes (interactions, constraints). */
  systemNotes?: string[];
}

export interface RCAResult {
  focus: string;
  organize: { facts: EvidenceItem[]; assumptionCount: number; evidenceQuality: string };
  create: { hypotheses: CauseHypothesis[]; ranked: CauseHypothesis[] };
  understand: { notes: string[] };
  rootCause: { cause: string; category: CauseCategory; confidence: number } | null;
  solve: { correctiveActions: string[]; validationStep: string };
  prevention: { documented: boolean; lessons: string[] };
}

export function rcaAnalyze(input: RCAInput): RCAResult {
  const hypotheses = input.hypotheses ?? [];
  const ranked = [...hypotheses].sort(
    (a, b) => b.likelihood * b.impact - a.likelihood * a.impact,
  );
  const rootCause = ranked[0]
    ? {
        cause: ranked[0].cause,
        category: ranked[0].category,
        confidence: round2(ranked[0].likelihood * ranked[0].impact * 100),
      }
    : null;

  return {
    focus: input.problem,
    organize: {
      facts: input.evidence,
      assumptionCount: input.evidence.filter((e) => e.source === 'assumption').length,
      evidenceQuality:
        input.evidence.length === 0
          ? 'no evidence — gather logs, observations, measurements, timelines before diagnosing'
          : input.evidence.length >= 2
            ? 'adequate — facts outnumber assumptions'
            : 'thin — collect more evidence before concluding',
    },
    create: { hypotheses, ranked },
    understand: {
      notes:
        input.systemNotes && input.systemNotes.length > 0
          ? input.systemNotes
          : ['Study interactions between people, process, technology, policy, and incentives'],
    },
    rootCause,
    solve: {
      correctiveActions: rootCause
        ? [
            `Correct the cause, not the symptom: ${rootCause.cause}`,
            `Implement ONE corrective action at a time to preserve causal clarity`,
          ]
        : ['Generate candidate causes first — do not jump to conclusions'],
      validationStep: 'Validate findings: experiment, controlled change, or replication before scaling the fix',
    },
    prevention: {
      documented: false,
      lessons: ['Document the investigation so future diagnosis improves'],
    },
  };
}

/* ── Five Whys (diagnostic tool) ─────────────────────────────────── */

export interface WhysNode {
  why: string;
  answer: string;
}

export interface FiveWhysTrace {
  symptom: string;
  chain: WhysNode[];
  rootCause: string;
  systemCorrection: string;
  mistakeGuard: string;
}

export function traceFiveWhys(symptom: string, answers: string[], maxDepth = 5): FiveWhysTrace {
  const chain: WhysNode[] = [];
  let previous = symptom;
  for (let i = 0; i < Math.min(maxDepth, answers.length); i++) {
    const answer = answers[i];
    if (answer === undefined) break;
    chain.push({ why: `Why: ${previous}?`, answer });
    previous = answer;
  }
  const rootCause = chain[chain.length - 1]?.answer ?? symptom;
  return {
    symptom,
    chain,
    rootCause,
    systemCorrection: `System-level correction for: ${rootCause}`,
    mistakeGuard:
      chain.length < 2
        ? 'warning: stopped too early — the root cause is rarely the first answer'
        : 'root cause reached after ' + chain.length + ' whys',
  };
}

/* ── Fishbone (diagnostic tool) ──────────────────────────────────── */

export interface FishboneInput {
  problem: string;
  causes: Partial<Record<CauseCategory, string[]>>;
}

export interface FishboneResult {
  problem: string;
  categories: { category: CauseCategory; causes: string[] }[];
  coverage: { filled: number; total: number };
  advice: string;
}

export function fishbone(input: FishboneInput): FishboneResult {
  const categories = CAUSE_CATEGORIES.map((category) => ({
    category,
    causes: input.causes[category] ?? [],
  }));
  const filled = categories.filter((c) => c.causes.length > 0).length;
  return {
    problem: input.problem,
    categories,
    coverage: { filled, total: CAUSE_CATEGORIES.length },
    advice:
      filled < 3
        ? 'broaden — teams fixate on a single explanation too early; fill 3+ categories'
        : 'broad coverage — good; now prioritize across categories',
  };
}

/* ── Pareto prioritization (diagnostic tool) ─────────────────────── */

export interface CauseImpact {
  cause: string;
  impact: number;
}

export function paretoPrioritize(causes: CauseImpact[], thresholdPct = 80): {
  ranked: CauseImpact[];
  vitalFew: string[];
  cumulativePct: number;
} {
  const sorted = [...causes].sort((a, b) => b.impact - a.impact);
  const total = sorted.reduce((acc, c) => acc + Math.max(0, c.impact), 0) || 1;
  let cum = 0;
  const vitalFew: string[] = [];
  for (const c of sorted) {
    const share = (Math.max(0, c.impact) / total) * 100;
    // The item that crosses the threshold line is still vital (it completes the 80%).
    if (cum < thresholdPct || vitalFew.length === 0) vitalFew.push(c.cause);
    cum += share;
  }
  return {
    ranked: sorted,
    vitalFew,
    cumulativePct: round2(cum),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
