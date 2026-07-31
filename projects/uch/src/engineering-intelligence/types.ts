/**
 * Engineering Intelligence Layer — shared types.
 *
 * The layer installs engineering domains (not prompt packs) into the
 * harness. Each tier is a typed registry of engineering concepts that
 * the EngineeringEvaluator can activate and agents can be enriched
 * with. Laws are first-class reasoning primitives with applicability
 * predicates and trigger checks, not text.
 *
 * Core invariant: everything here is deterministic data + activation
 * logic. No LLM call is required for any gate; LLM-assisted extensions
 * (product thinking, economics estimates) are optional additions that
 * record explicit findings only (ADR-002 observable/private boundary).
 */

export type TierId =
  | 'tier-01-cs'
  | 'tier-02-se'
  | 'tier-03-systems'
  | 'tier-04-product'
  | 'tier-05-economics'
  | 'tier-06-laws'
  | 'tier-07-patterns'
  | 'tier-08-failure'
  | 'tier-09-taste'
  | 'tier-10-unknown';

export const TIER_ORDER: TierId[] = [
  'tier-01-cs',
  'tier-02-se',
  'tier-03-systems',
  'tier-04-product',
  'tier-05-economics',
  'tier-06-laws',
  'tier-07-patterns',
  'tier-08-failure',
  'tier-09-taste',
  'tier-10-unknown',
];

export interface EngineeringConcept {
  id: string;
  tier: TierId;
  name: string;
  family: string;
  definition: string;
  /** Code/design patterns that indicate this concept is relevant. */
  signals: string[];
  /** Conditions that activate the concept for evaluation/enrichment. */
  triggers: string[];
  /** What an evaluator should check when the concept is activated. */
  guidance: string[];
  /** Violations to flag when the concept applies. */
  antiPatterns: string[];
  /** Learned relevance weight (connectome feedback). */
  weight: number;
  provenance: string[];
}

/* ------------------------------------------------------------------ */
/* Judgment context — deterministic facts extracted from a target.     */
/* ------------------------------------------------------------------ */

export type EvaluationTarget =
  | { kind: 'code'; diff: string; paths: string[] }
  | { kind: 'design'; text: string }
  | { kind: 'plan'; text: string }
  | { kind: 'architecture'; text: string };

export interface DiffStats {
  filesTouched: number;
  linesAdded: number;
  linesRemoved: number;
  newFiles: number;
}

export interface CodeFacts {
  maxNestingDepth: number;
  loopCount: number;
  nestedLoopPairs: number;
  arrayScansInLoop: number;
  shiftUnshiftCount: number;
  stringConcatInLoop: number;
  rawIoCount: number;
  parallelCalls: number;
  retryCount: number;
  fileSystemAccess: boolean;
  networkAccess: boolean;
  databaseAccess: boolean;
  clockAccess: boolean;
  importCount: number;
  externalImports: number;
}

export interface JudgmentContext {
  kind: EvaluationTarget['kind'];
  /** Full target text (diff or prose), lower-cased token stream. */
  text: string;
  tokens: string[];
  diffStats: DiffStats;
  codeFacts: CodeFacts;
}

/* ------------------------------------------------------------------ */
/* Findings and review                                                 */
/* ------------------------------------------------------------------ */

export type Severity = 'info' | 'warning' | 'blocking';

export interface EngineeringFinding {
  tier: TierId;
  severity: Severity;
  conceptId: string;
  message: string;
  evidence: string[];
  suggestion: string[];
  /** veto findings hard-reject through the organic-score gate. */
  gate: 'veto' | 'advisory';
}

export interface EngineeringReview {
  targetId: string;
  findings: EngineeringFinding[];
  /** Tier-weighted aggregate, 0-100. Advisory; vetoes apply separately. */
  score: number;
  summary: string;
}

/* ------------------------------------------------------------------ */
/* Laws — first-class reasoning primitives                             */
/* ------------------------------------------------------------------ */

export interface LawFinding {
  lawId: string;
  severity: Severity;
  message: string;
  evidence: string[];
  /** Conditions under which knowingly violating the law is rational. */
  tradeoffs: string[];
}

export interface EngineeringLaw {
  id: string;
  name: string;
  statement: string;
  domain: 'project' | 'team' | 'system' | 'code' | 'schedule';
  /** Predicate: is this law relevant to the situation at all? */
  applicability: (ctx: JudgmentContext) => boolean;
  /** Trigger check: what does the law say about this situation? */
  check: (ctx: JudgmentContext) => LawFinding[];
  tradeoffs: string[];
  provenance: string[];
}
