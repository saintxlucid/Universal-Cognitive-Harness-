/**
 * Cognitive Frameworks Library — shared types.
 *
 * A framework is a codified reasoning/decision/productivity/research
 * strategy with a stable methodology. Frameworks are grouped into
 * families; each family is implemented by a deterministic engine that
 * may optionally accept an LLM-assisted mode behind the same interface.
 *
 * Core invariant (matching the corpus this library was built from):
 * "There is no one best model, only the right model for the moment."
 * Model selection itself is a decision — hence the registry's `select`.
 */

export type FrameworkFamily =
  | 'decisions'
  | 'problems'
  | 'rca'
  | 'strategy'
  | 'productivity'
  | 'research'
  | 'critical'
  | 'knowledge'
  | 'signals'
  | 'code';

export type DecisionContext =
  | 'analytical'
  | 'experience-based'
  | 'strategic'
  | 'uncertainty'
  | 'group'
  | 'rapid';

export interface FrameworkStage {
  name: string;
  description: string;
}

export interface FrameworkDefinition {
  id: string;
  family: FrameworkFamily;
  name: string;
  purpose: string;
  bestFor: string[];
  whenNotToUse: string[];
  stages: FrameworkStage[];
  /** Selection metadata used by the registry's model-selection layer. */
  selection: {
    contexts: DecisionContext[];
    dataRich?: boolean;
    timeCritical?: boolean;
    groupNeeded?: boolean;
    rootCauseNeeded?: boolean;
    humanCentered?: boolean;
    continuousImprovement?: boolean;
    speedAdaptability?: boolean;
    comprehensiveRigor?: boolean;
  };
  source: string;
}

/** Optional LLM-assisted mode: engines stay deterministic without it. */
export interface FrameworkLLMProvider {
  generate(prompt: string, hint?: string): Promise<string>;
}

export interface FrameworkSelectionInput {
  problem: string;
  family?: FrameworkFamily;
  /** 0-1 — how clear/well-defined the problem is. */
  clarity?: number;
  /** 0-1 — how much reliable data is available. */
  dataAvailability?: number;
  /** 0-1 — time pressure (1 = act now). */
  timePressure?: number;
  /** 0-1 — how many stakeholders/people are involved. */
  stakeholderInvolvement?: number;
  /** 0-1 — risk/uncertainty level. */
  risk?: number;
  /** 0-1 — how complex the problem is. */
  complexity?: number;
  /** Explicit signal: is root-cause diagnosis required? */
  rootCauseNeeded?: boolean;
  /** Explicit signal: is the problem human-centered (users involved)? */
  humanCentered?: boolean;
  /** Explicit signal: is continuous improvement the goal? */
  continuousImprovement?: boolean;
  /** Explicit signal: must the approach adapt fast to change? */
  speedAdaptability?: boolean;
}

export interface FrameworkSelectionResult {
  selected: FrameworkDefinition;
  family: FrameworkFamily;
  runnerUp: FrameworkDefinition | null;
  rationale: string;
  alternatives: string[];
}
