/**
 * Belief — the belief-semantic layer over the causal graph
 * (IDEA-0086 prototype).
 */
export {
  BeliefEngine,
  evidenceAnchorOf,
  instabilityOf,
  isUnstable,
  beliefReport,
} from './belief-engine.js';
export type {
  BeliefEdgeKind,
  BeliefChangeCause,
  BeliefNodeInput,
  BeliefNode,
  BeliefEdge,
  BeliefChange,
  BeliefEngineConfig,
  RippleResult,
  BeliefNodeState,
  BeliefReport,
} from './belief-engine.js';
