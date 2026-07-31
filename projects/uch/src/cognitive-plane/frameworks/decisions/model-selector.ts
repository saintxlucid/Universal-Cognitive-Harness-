/**
 * Model Selector — the "decision-about-decisions" layer.
 *
 * Before choosing a framework, evaluate: problem clarity, time available,
 * data availability, complexity, risk, stakeholders. Then select a model
 * using the corpus quick guide:
 *
 * - Need a fast decision?  → intuitive, PMI, lean
 * - Lots of reliable data? → rational, decision matrix, cost-benefit, pareto
 * - Making a group decision? → delphi, nominal-group, stepladder, multi-voting
 * - High uncertainty/risk?  → decision-tree, pre-mortem
 * - Strategic choice?       → swot, strategy-wheel
 * - Root cause?             → five-whys, fishbone, rca-focus
 */

import type { FrameworkSelectionInput } from '../types.js';

export interface ModelSelectionCriteria {
  needSpeed?: boolean;
  hasReliableData?: boolean;
  isGroupDecision?: boolean;
  highUncertainty?: boolean;
  isStrategic?: boolean;
  needsRootCause?: boolean;
}

export interface ModelSelection {
  primary: string;
  alternatives: string[];
  rationale: string;
}

export function selectDecisionModel(criteria: ModelSelectionCriteria): ModelSelection {
  const picks: string[] = [];
  const rationale: string[] = [];

  if (criteria.needsRootCause) {
    picks.push('five-whys', 'fishbone');
    rationale.push('root-cause diagnosis required');
  }
  if (criteria.isStrategic) {
    picks.push('swot', 'strategy-wheel');
    rationale.push('strategic choice — position and direction matter');
  }
  if (criteria.highUncertainty) {
    picks.push('decision-tree', 'pre-mortem');
    rationale.push('high uncertainty or risk — map futures and assume failure');
  }
  if (criteria.isGroupDecision) {
    picks.push('nominal-group', 'delphi');
    rationale.push('group decision — balance participation and reduce social pressure');
  }
  if (criteria.hasReliableData && !criteria.needsRootCause) {
    picks.push('decision-matrix', 'cost-benefit');
    rationale.push('reliable data available — analytical models apply');
  }
  if (criteria.needSpeed) {
    picks.push('pmi', 'lean-decision');
    rationale.push('time-critical — rapid structured reflection beats analysis paralysis');
  }

  const unique = [...new Set(picks)];
  const primary = unique[0] ?? 'rational';
  if (unique.length === 0) {
    rationale.push('no dominant signal — fall back to the rational model');
    unique.push('rational');
  }
  return {
    primary,
    alternatives: unique.slice(1),
    rationale: `Selected '${primary}' because ${rationale.join('; ')}.`,
  };
}

/** Structured entry point mirroring the registry's selection input shape. */
export function classifyDecision(input: FrameworkSelectionInput): ModelSelection {
  return selectDecisionModel({
    needSpeed: (input.timePressure ?? 0) >= 0.7,
    hasReliableData: (input.dataAvailability ?? 0) >= 0.6,
    isGroupDecision: (input.stakeholderInvolvement ?? 0) >= 0.6,
    highUncertainty: (input.risk ?? 0) >= 0.6,
    isStrategic: input.family === 'strategy',
    needsRootCause: input.rootCauseNeeded,
  });
}
