/**
 * FrameworkComposer — the corpus's universal lifecycle codified as a
 * deterministic end-to-end chain (blueprint §5.6):
 *
 *   Observe → Understand → Analyze → Generate → Choose → Implement →
 *   Evaluate → Learn
 *
 * Implemented as: select (choose model) → analyze-problem (understand) →
 * rca (diagnose, only when root cause is needed) → decide (choose, only
 * when alternatives are supplied) → premortem (risk-gate) → plan output.
 *
 * Every stage emits a framework trace (selection + completions) so one
 * solve produces one trace tree. Engines stay fully deterministic; the
 * composer is the wiring layer, not a new reasoning engine.
 */

import { createFrameworkRegistry, FrameworkRegistry } from '../registry.js';
import type { FrameworkSelectionInput } from '../types.js';
import { FrameworkTraceRecorder } from '../tracing/trace-recorder.js';
import { ideal } from '../problems/problem-solver.js';
import { rcaAnalyze } from '../rca/rca.js';
import { decisionMatrix, premortem, prosCons } from '../decisions/decision-models.js';

export interface SolveProfile extends Omit<FrameworkSelectionInput, 'problem'> {
  /** Decide-stage alternatives (option names). */
  options?: string[];
  /** Decision-matrix criteria. */
  criteria?: string[];
  /** Decision-matrix criterion weights (aligned with criteria). */
  weights?: number[];
  /** Decision-matrix scores per option, aligned with criteria (0-10). */
  scores?: number[][];
  /** Pros & cons input (used when options/criteria are absent). */
  pros?: string[];
  cons?: string[];
  /** Pre-mortem failure causes (defaults to the standard checklist). */
  riskCauses?: string[];
  /** Pre-mortem likelihood per cause (0-1, aligned with riskCauses). */
  riskLikelihood?: number[];
  /** Pre-mortem impact per cause (0-1, aligned with riskCauses). */
  riskImpact?: number[];
  /** RCA evidence facts (used when root-cause diagnosis is needed). */
  evidenceFacts?: string[];
}

export interface SolveStageResult {
  stage: string;
  engine: string;
  family: string;
  verdict: string | null;
  output: Record<string, unknown>;
}

export interface SolveResult {
  problem: string;
  profile: Record<string, unknown>;
  model: { id: string; name: string; family: string; rationale: string } | null;
  stages: SolveStageResult[];
  plan: {
    goal: string;
    steps: string[];
    risks: string[];
  };
  verdict: 'ready' | 'review';
}

const DEFAULT_RISK_CAUSES = [
  'scope creep beyond the defined boundary',
  'verification gap — the plan lands without checks',
  'unclear requirements — the goal is ambiguous',
  'timeline slippage — effort underestimated',
  'resource contention — dependencies are unavailable',
];

/** Matches the Executive Brain's pre-commit gate threshold (risk %). */
const RISK_THRESHOLD_PCT = 60;

export class FrameworkComposer {
  private registry: FrameworkRegistry;
  private tracer: FrameworkTraceRecorder | null;

  constructor(tracer?: FrameworkTraceRecorder | null, registry?: FrameworkRegistry | null) {
    this.tracer = tracer ?? null;
    this.registry = registry ?? createFrameworkRegistry(tracer);
  }

  solve(problem: string, profile: SolveProfile = {}): SolveResult {
    const cleanProblem = problem.trim();
    if (!cleanProblem) {
      throw new Error('solve requires a problem description');
    }
    const stages: SolveStageResult[] = [];
    const {
      options, criteria, weights, scores, pros, cons,
      riskCauses, riskLikelihood, riskImpact, evidenceFacts,
      ...selectionProfile
    } = profile;

    // 1. Select — decision-about-decisions (emits framework:selected).
    const selection = this.registry.select({
      problem: cleanProblem,
      ...selectionProfile,
    });

    // 2. Understand — IDEAL problem framing.
    const understanding = ideal({ problem: cleanProblem });
    stages.push(this.stage('understand', 'ideal', 'problems', cleanProblem, understanding));

    // 3. Diagnose — RCA when a root cause is required.
    if (selectionProfile.rootCauseNeeded) {
      const diagnosis = rcaAnalyze({
        problem: cleanProblem,
        evidence: (evidenceFacts ?? []).map((fact, i) => ({ fact, source: `evidence ${i + 1}` })),
      });
      stages.push(this.stage('diagnose', 'rca-focus', 'rca', cleanProblem, diagnosis));
    }

    // 4. Choose — decision matrix when alternatives + criteria exist,
    //    otherwise pros & cons when sides are given; skipped otherwise.
    if ((options?.length ?? 0) > 0 && (criteria?.length ?? 0) > 0) {
      const matrix = decisionMatrix(
        (criteria ?? []).map((name, i) => ({ name, weight: (weights ?? [])[i] ?? 1 })),
        (options ?? []).map((name, i) => ({ name, scores: (scores ?? [])[i] ?? [] })),
      );
      stages.push(this.stage('decide', 'decision-matrix', 'decisions', cleanProblem, matrix, matrix.winner?.option ?? null));
    } else if ((pros?.length ?? 0) > 0 || (cons?.length ?? 0) > 0) {
      const verdict = prosCons({ pros: pros ?? [], cons: cons ?? [] });
      stages.push(this.stage('decide', 'pros-cons', 'decisions', cleanProblem, verdict, verdict.verdict));
    }

    // 5. Risk-gate — pre-mortem on the plan (assume it failed; why?).
    const gate = premortem({
      plan: cleanProblem,
      possibleCauses: riskCauses ?? DEFAULT_RISK_CAUSES,
      likelihood: riskLikelihood,
      impact: riskImpact,
    });
    const risks = gate.rankedCauses
      .filter((c) => c.riskScore >= RISK_THRESHOLD_PCT)
      .map((c) => c.cause);
    stages.push(this.stage('risk-gate', 'pre-mortem', 'decisions', cleanProblem, gate, risks.length === 0 ? 'pass' : 'review'));

    const steps = [...selection.selected.stages.map((s) => s.name), ...gate.topMitigations.slice(0, 2)];

    return {
      problem: cleanProblem,
      profile: this.profileToRecord(profile),
      model: {
        id: selection.selected.id,
        name: selection.selected.name,
        family: selection.selected.family,
        rationale: selection.rationale,
      },
      stages,
      plan: {
        goal: cleanProblem,
        steps,
        risks,
      },
      verdict: risks.length === 0 ? 'ready' : 'review',
    };
  }

  private stage(
    name: string,
    engine: string,
    family: string,
    problem: string,
    output: object,
    verdict: string | null = null,
  ): SolveStageResult {
    this.tracer?.recordCompletion({
      engine,
      family,
      problem,
      profile: {},
      result: output as Record<string, unknown>,
      verdict: verdict ?? undefined,
    });
    return { stage: name, engine, family, verdict, output: output as Record<string, unknown> };
  }

  private profileToRecord(profile: SolveProfile): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(profile)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
}
