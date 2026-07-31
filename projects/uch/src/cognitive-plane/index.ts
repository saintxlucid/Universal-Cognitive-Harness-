// ── Protocol Layer ─────────────────────────────────────────
export { CognitiveProtocolRegistry, capabilityID } from './protocol/capability-protocol.js';
export type {
  CapabilityProtocol,
  CapabilityHandler,
  CapabilityResult,
  CapabilityID,
  LifecycleStage,
} from './protocol/capability-protocol.js';

// ── Protocol Adapter ───────────────────────────────────────
// Each cognitive module registers as a capability provider.
// No module directly imports another — they communicate via signals.

export {
  TraceLedger,
  TraceRecorder,
  createTrace,
  endTrace,
  addTraceEvent,
} from './trace-engine/index.js';
export type {
  TraceLedgerStats,
  CognitiveTrace,
  TraceEvent,
  TraceEventType,
  TraceAttribute,
  SpanKind,
  TraceStatus,
} from './trace-engine/index.js';
export {
  Conscience,
  MemoryPipeline,
  ExecutiveBrain,
} from './intelligence/index.js';
export type {
  ReflectionReport,
  PredictionResult,
  PipelineReport,
  ExecutiveBrainConfig,
} from './intelligence/index.js';
export {
  EpisodicStore,
  SemanticGraph,
  SkillRegistry,
} from './memory/index.js';
export type {
  SkillDefinition,
  SkillInvocation,
} from './memory/index.js';
export {
  WorkspaceBrain,
  CognitiveKernel,
} from './workspace/index.js';
export type {
  WorkspaceBrainConfig,
  CognitiveKernelStats,
} from './workspace/index.js';
export {
  CognitiveReplay,
} from './replay/index.js';
export type {
  ReplaySnapshot,
  ReplayOptions,
} from './replay/index.js';
