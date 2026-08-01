// ─── CIR: Cognitive Intermediate Representation module (RFC-0004) ───────────
// The instruction stream of the Cognitive OS: types/validation (cir),
// Intent→CIR frontend (frontend), 17-pass optimizer (passes), executor with
// verification gates (executor), and the deterministic benchmark corpus +
// runner asserting the RFC-0004 §14 contracts (benchmark/).
//
// Explicit exports only: executor's re-export of CIR_VERSION would make a
// blanket `export *` ambiguous (cir.js also exports it).

export * from './cir.js';
export * from './frontend.js';
export * from './passes.js';
export {
  CIR_EXECUTOR_VERSION,
  executePipeline,
  executeStream,
  gateFor,
  streamIdOf,
  traceparentOf,
} from './executor.js';
export type {
  CIRTraceEvent,
  CIRTraceEventType,
  DelegatedResult,
  Delegator,
  ExecutionOutcomeKind,
  ExecutionRecord,
  ExecutionVerdict,
  ExecutorOptions,
  GateVerdict,
  InstructionHandler,
  InstructionOutcome,
  PipelineResult,
  RejectionCode,
  StreamRejection,
} from './executor.js';
export * from './benchmark/corpus.js';
export * from './benchmark/runner.js';
