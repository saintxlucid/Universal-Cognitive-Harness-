/**
 * Problem-Solving Router — blueprint §3.1.
 *
 * Extension of the Executive System: classifies a problem statement and
 * routes it to a problem-solving framework (IDEAL, Design Thinking,
 * PDCA, OODA, Kepner-Tregoe) from the corpus library.
 *
 * DRY seam: the Kepner-Tregoe framework's "Problem Analysis" phase
 * delegates root-cause work to the Etiology Engine instead of
 * reimplementing causal logic — enforced across organs, not just within
 * one file.
 */

import {
  createFrameworkRegistry,
  FrameworkRegistry,
  type FrameworkRegistry as FrameworkRegistryType,
} from '../cognitive-plane/frameworks/index.js';
import type { EtiologyEngine } from '../etiology/etiology-engine.js';

export type ProblemClass =
  | 'well-defined-fix'
  | 'human-centered'
  | 'continuous-improvement'
  | 'fast-changing'
  | 'complex-ambiguous';

export interface ProblemClassification {
  problem: string;
  class: ProblemClass;
  clarity: number;
  complexity: number;
}

export interface ProblemRouteResult {
  problem: string;
  classification: ProblemClassification;
  framework: string;
  stages: string[];
  rationale: string;
  /** When framework is kepner-tregoe, the delegated root-cause organ handle. */
  delegatedToEtiology: boolean;
}

export class ProblemSolvingRouter {
  /** Blueprint §3.1: the router owns these five frameworks; root-cause
   *  work (five-whys/fishbone) is delegated to the Etiology Engine. */
  static readonly FRAMEWORKS = ['ideal', 'design-thinking', 'pdca', 'ooda', 'kepner-tregoe'] as const;

  private registry: FrameworkRegistryType;
  private etiology: EtiologyEngine | null;
  private routes: ProblemRouteResult[] = [];

  constructor(etiology?: EtiologyEngine, registry?: FrameworkRegistryType) {
    this.etiology = etiology ?? null;
    const source = registry ?? createFrameworkRegistry();
    const scoped = new FrameworkRegistry();
    for (const id of ProblemSolvingRouter.FRAMEWORKS) {
      const def = source.get(id);
      if (!def) {
        throw new Error(`Problem-Solving Router requires framework '${id}' in the registry`);
      }
      scoped.register(def);
    }
    this.registry = scoped;
  }

  /**
   * Classify the problem type from clarity/complexity signals, then
   * select the best-fitting framework.
   */
  route(input: {
    problem: string;
    clarity?: number;
    complexity?: number;
    humanCentered?: boolean;
    continuousImprovement?: boolean;
    speedAdaptability?: boolean;
    rootCauseNeeded?: boolean;
  }): ProblemRouteResult {
    const clarity = input.clarity ?? 0.5;
    const complexity = input.complexity ?? 0.5;
    const problemClass: ProblemClass = this.classifyProblem(
      clarity,
      complexity,
      input.humanCentered,
      input.continuousImprovement,
      input.speedAdaptability,
      input.rootCauseNeeded,
    );

    const selection = this.registry.select({
      problem: input.problem,
      family: 'problems',
      clarity,
      complexity,
      humanCentered: input.humanCentered,
      continuousImprovement: input.continuousImprovement,
      speedAdaptability: input.speedAdaptability,
      rootCauseNeeded: input.rootCauseNeeded,
    });

    const delegatedToEtiology =
      selection.selected.id === 'kepner-tregoe' && this.etiology !== null;

    const result: ProblemRouteResult = {
      problem: input.problem,
      classification: { problem: input.problem, class: problemClass, clarity, complexity },
      framework: selection.selected.id,
      stages: selection.selected.stages.map((s) => s.name),
      rationale: selection.rationale,
      delegatedToEtiology,
    };

    this.routes.push(result);
    return result;
  }

  getRoutes(): ProblemRouteResult[] {
    return [...this.routes];
  }

  getStatus(): Record<string, unknown> {
    return {
      routes: this.routes.length,
      frameworks: this.registry.list('problems').map((f) => f.id),
    };
  }

  private classifyProblem(
    clarity: number,
    complexity: number,
    humanCentered?: boolean,
    continuousImprovement?: boolean,
    speedAdaptability?: boolean,
    rootCauseNeeded?: boolean,
  ): ProblemClass {
    if (speedAdaptability) return 'fast-changing';
    if (continuousImprovement) return 'continuous-improvement';
    if (humanCentered) return 'human-centered';
    if (rootCauseNeeded || complexity >= 0.7) return 'complex-ambiguous';
    return clarity >= 0.6 ? 'well-defined-fix' : 'complex-ambiguous';
  }
}
