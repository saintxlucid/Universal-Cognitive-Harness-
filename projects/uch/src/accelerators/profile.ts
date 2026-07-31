/**
 * Cognitive Profile — the serializable contract the Cognitive Scheduler
 * uses to decide HOW a request should be computed.
 *
 * Analogous to a process's resource profile in an operating system:
 * complexity, urgency, budgets, and the cognitive dimensions each task
 * requires. Profiles never touch the workspace (see constitution law
 * 'Coprocessor Workspace Isolation').
 */

export type Urgency = 'low' | 'medium' | 'high';

export interface CognitiveProfile {
  /** 0-1 — intrinsic difficulty of the task */
  complexity: number;
  /** Urgency of the request (drives latency budget prioritization) */
  urgency: Urgency;
  /** USD cost cap for inference on this request; 0 = unlimited */
  costBudget: number;
  /** Max acceptable latency in ms; 0 = unlimited */
  latencyBudgetMs: number;
  /** 0-1 — how confident the answer must be */
  confidenceNeeded: number;
  /** 0-1 — how much deep chain-of-thought is required */
  reasoningNeeded: number;
  /** 0-1 — how much knowledge retrieval is required */
  knowledgeNeeded: number;
  /** 0-1 — how much divergent/creative generation is required */
  creativityNeeded: number;
  /** 0-1 — how much independent verification is required */
  verificationNeeded: number;
  /** 0-1 — consequence severity; >= 0.8 forces human approval */
  risk: number;
}

export const DEFAULT_PROFILE: CognitiveProfile = {
  complexity: 0.4,
  urgency: 'medium',
  costBudget: 0,
  latencyBudgetMs: 0,
  confidenceNeeded: 0.6,
  reasoningNeeded: 0.3,
  knowledgeNeeded: 0.3,
  creativityNeeded: 0.2,
  verificationNeeded: 0.2,
  risk: 0.2,
};

function clamp(value: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, value));
}

export function normalizeProfile(partial: Partial<CognitiveProfile> = {}): CognitiveProfile {
  return {
    complexity: clamp(partial.complexity ?? DEFAULT_PROFILE.complexity),
    urgency: partial.urgency ?? DEFAULT_PROFILE.urgency,
    costBudget: partial.costBudget ?? DEFAULT_PROFILE.costBudget,
    latencyBudgetMs: partial.latencyBudgetMs ?? DEFAULT_PROFILE.latencyBudgetMs,
    confidenceNeeded: clamp(partial.confidenceNeeded ?? DEFAULT_PROFILE.confidenceNeeded),
    reasoningNeeded: clamp(partial.reasoningNeeded ?? DEFAULT_PROFILE.reasoningNeeded),
    knowledgeNeeded: clamp(partial.knowledgeNeeded ?? DEFAULT_PROFILE.knowledgeNeeded),
    creativityNeeded: clamp(partial.creativityNeeded ?? DEFAULT_PROFILE.creativityNeeded),
    verificationNeeded: clamp(partial.verificationNeeded ?? DEFAULT_PROFILE.verificationNeeded),
    risk: clamp(partial.risk ?? DEFAULT_PROFILE.risk),
  };
}
