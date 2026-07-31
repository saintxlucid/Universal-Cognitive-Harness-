/**
 * Critical Thinking Evaluator — the 9-question information evaluation
 * engine. Each question maps onto a cognitive weakness and, where
 * possible, onto an existing Information Integrity law in the
 * constitution (Objectivity, Qualified Source, No Prejudice,
 * No Propaganda, Whole Truth).
 *
 * Verdict model: per-question pass/fail/flags, an aggregate
 * reliability score, and a "trust cautiously / cross-check / reject"
 * verdict. Deterministic; LLM-assisted mode only expands free-text
 * answers when provided.
 */

import type { FrameworkLLMProvider } from '../types.js';

export type CriticalQuestionId =
  | 'needs'
  | 'qualified_source'
  | 'currency'
  | 'prejudice'
  | 'fact_vs_opinion'
  | 'propaganda'
  | 'motivation'
  | 'whole_story'
  | 'better_sources';

export interface QuestionCheck {
  id: CriticalQuestionId;
  question: string;
  law: string | null;
  /** For inverted questions the reliable answer is "no" (no bias, no propaganda). */
  inverted: boolean;
  answered: boolean;
  ok: boolean;
  flag?: string;
}

export interface InformationAssessment {
  target: string;
  checks: QuestionCheck[];
  reliabilityScore: number;
  verdict: 'reliable' | 'cross-check' | 'reject';
  recommendations: string[];
  failures: string[];
}

export interface AssessmentInput {
  target: string;
  answers?: Partial<Record<CriticalQuestionId, string>>;
}

export const QUESTIONS: { id: CriticalQuestionId; question: string; law: string | null; inverted?: boolean }[] = [
  { id: 'needs', question: 'Does this information satisfy my needs (relevance, completeness, purpose)?', law: null },
  { id: 'qualified_source', question: 'Is the source qualified (authority, expertise, credibility)?', law: 'Qualified Source Required' },
  { id: 'currency', question: 'Is it current? Knowledge expires — medicine, tech, AI, law, economics evolve.', law: null },
  { id: 'prejudice', question: 'Is there prejudice or unfairness (bias, agenda, framing, emotional manipulation)?', law: 'No Prejudice as Evidence', inverted: true },
  { id: 'fact_vs_opinion', question: 'Are opinions presented as facts?', law: 'Objectivity Required', inverted: true },
  { id: 'propaganda', question: 'Is this propaganda or advertising?', law: 'No Propaganda as Evidence', inverted: true },
  { id: 'motivation', question: "What is the author's motivation (sell, influence, persuade, educate, recruit, entertain)?", law: null },
  { id: 'whole_story', question: 'Am I hearing the whole story — counterarguments, alternatives, hidden assumptions?', law: 'Whole Truth Requirement' },
  { id: 'better_sources', question: 'Are there better sources? Truth strengthens through convergence.', law: null },
];

/** Alias used by the public API surface. */
export const CRITICAL_QUESTIONS = QUESTIONS;

const POSITIVE = ['yes', 'y', 'qualified', 'credible', 'expert', 'current', 'updated', 'verified', 'trustworthy', 'converges', 'confirmed', 'recent', 'peer-reviewed'];
const NEGATIVE = ['no', 'unknown', 'unclear', 'not sure', 'cannot', 'can\'t', 'biased', 'outdated', 'stale', 'opinion', 'ad', 'propaganda', 'single source', 'unverified', 'missing', 'incomplete', 'conflict', 'anecdotal'];
const DENIAL = ['no', 'not', 'none', 'unbiased', 'objective', 'factual', 'without bias', 'no bias', 'no propaganda', 'no prejudice'];

export function assessInformation(input: AssessmentInput, _llm?: FrameworkLLMProvider): InformationAssessment {
  const answers = input.answers ?? {};
  const checks: QuestionCheck[] = QUESTIONS.map((q) => {
    const answer = (answers[q.id] ?? '').toLowerCase().trim();
    if (!answer) {
      return { ...q, inverted: Boolean(q.inverted), answered: false, ok: false, flag: 'unanswered — cannot accept without evaluation' };
    }
    const inverted = Boolean(q.inverted);
    let ok: boolean;
    if (inverted) {
      // "Is there bias?" — a denial ("no", "not biased") is the reliable answer.
      ok = DENIAL.some((d) => answer.includes(d));
    } else {
      const positiveHits = POSITIVE.filter((p) => answer.includes(p)).length;
      const negativeHits = NEGATIVE.filter((n) => answer.includes(n)).length;
      ok = positiveHits > negativeHits;
    }
    return { ...q, inverted, answered: true, ok, flag: ok ? undefined : 'flag: evaluate critically before relying on this' };
  });

  const passed = checks.filter((c) => c.ok).length;
  const hardFailures = checks.filter((c) => c.answered && !c.ok);
  const unanswered = checks.filter((c) => !c.answered);
  const reliabilityScore = Math.round((passed / checks.length) * 100);

  const verdict: InformationAssessment['verdict'] =
    unanswered.length > 0
      ? 'cross-check'
      : hardFailures.length >= 4
        ? 'reject'
        : reliabilityScore >= 80
          ? 'reliable'
          : 'cross-check';

  const failures = hardFailures.map((c) => `${c.question} (${c.id})`);

  const recommendations: string[] = [];
  if (verdict === 'cross-check') {
    recommendations.push('Cross-check against at least one independent source');
    recommendations.push('Read the opposing viewpoint before concluding');
  }
  if (verdict === 'reject') {
    recommendations.push('Do not rely on this information without independent confirmation');
  }
  if (unanswered.length > 0) {
    recommendations.push(`Answer the ${unanswered.length} unanswered question(s): ${unanswered.map((c) => c.id).join(', ')}`);
  }
  if (checks.some((c) => c.id === 'whole_story' && !c.ok)) {
    recommendations.push('Ask: what would change my conclusion? Look for hidden omissions (partial truth is the most dangerous form)');
  }
  if (checks.some((c) => c.id === 'better_sources' && !c.ok)) {
    recommendations.push('Never stop at one source — knowledge becomes reliable through convergence');
  }
  if (checks.some((c) => c.id === 'motivation' && !c.ok)) {
    recommendations.push('Understanding the incentive changes the interpretation');
  }

  return { target: input.target, checks, reliabilityScore, verdict, recommendations, failures };
}
