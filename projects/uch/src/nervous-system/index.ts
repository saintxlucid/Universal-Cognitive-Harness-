export { NervousSystem } from './nervous-system.js';
export type { NervousSystemConfig, LayerConfig } from './nervous-system.js';
export {
  createSignal,
  signalPriorityForType,
  layerForPriority,
  priorityForLayer,
} from './signal.js';
export type {
  Signal,
  SignalHandler,
  SignalFilter,
  NervousSystemLayer,
  SignalPriority,
} from './signal.js';
export { SignalLifecycleEngine, freshnessStage, ttlForPriority, lifecycleReport } from './signal-lifecycle.js';
export type {
  FreshnessStage,
  AdmissionDecision,
  SignalLifecycleState,
  AdmissionRecord,
  SignalLifecycleConfig,
  SignalLifecycleInput,
  SignalLifecycleReport,
} from './signal-lifecycle.js';
export { SignalFlowController, flowControlReport } from './flow-control.js';
export type {
  RefusalReason,
  TokenColor,
  BudgetHealth,
  RefusalRecord,
  ConsumedSignal,
  TokenBucketState,
  FlowControlConfig,
  FlowControlSource,
  FlowControlReport,
} from './flow-control.js';
