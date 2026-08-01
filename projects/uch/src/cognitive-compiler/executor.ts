// ─── CIR Executor: dispatch, verification gates, trace contract ────────────
// RFC-0004 §6 stages 5-6, §7 determinism, §8 delegation, §9 gates, §12 trace.
// Perceptual + Cognitive classes run deterministic handlers; Delegated class
// runs only through delegators or replay substitution — a system with zero
// delegators executes a fully deterministic organism subset.

import {
  CIR_VERSION,
  encodeStream,
  energyCostOf,
  instructionClassOf,
  streamEnergy,
  streamTokenEstimate,
  validateStream,
  type CIRInstruction,
  type CIRStream,
  type CIROp,
  type InstructionClass,
  type Operand,
  type StreamError,
  type VerifyLevel,
} from './cir.js';
import { runPasses, type OptimizerResult, type PassContext } from './passes.js';

export type ExecutionOutcomeKind = 'executed' | 'delegated' | 'substituted';
export type RejectionCode =
  | 'INVALID_STREAM'
  | 'UNSUPPORTED_VERSION'
  | 'GATE_FAILED'
  | 'UNSUPPORTED_DELEGATION'
  | 'BUDGET_EXCEEDED'
  | 'NO_HANDLER';

export interface GateVerdict {
  pass: boolean;
  reason?: string;
}

export interface DelegatedResult {
  payload: unknown;
  confidence: number;
  latencyMs: number;
  traceparent?: string;
}

export interface Delegator {
  dispatch(instr: CIRInstruction, profile: string): Promise<DelegatedResult> | DelegatedResult;
}

export type InstructionHandler = (instr: CIRInstruction) => unknown;

export type CIRTraceEventType = 'cir:compiled' | 'cir:pass' | 'cir:gate' | 'cir:executed' | 'cir:delegated' | 'cir:rejected';

export interface CIRTraceEvent {
  type: CIRTraceEventType;
  tick: number;
  traceparent: string;
  payload: Record<string, unknown>;
}

export interface ExecutorOptions {
  /** Projection (ADR-001): scopes the stream may execute in. Absent = no scope restriction. */
  scopeAllow?: ReadonlySet<string>;
  /** Per-stream energy budget; enforcement is a hard gate (Law 21). */
  energyBudget?: number;
  /** Delegated-class dispatchers keyed by op. Absent op = not_configured. */
  delegators?: ReadonlyMap<CIROp, Delegator>;
  /** Recorded payloads for ADR-002 replay: per-instruction substitution. */
  replayPayloads?: ReadonlyMap<string, DelegatedResult>;
  /** Perceptual/cognitive handler overrides. */
  handlers?: Partial<Record<CIROp, InstructionHandler>>;
  /** Pluggable constitutional gate (IDEA-0053 hookup); runs on verify=constitutional. */
  constitutionalGate?: (instr: CIRInstruction) => GateVerdict;
  /** Trace sink; every event is also recorded in the execution record. */
  onEvent?: (event: CIRTraceEvent) => void;
  /** First cognitive tick of the stream (wall clock is banned, §7). */
  startTick?: number;
}

export interface InstructionOutcome {
  id: string;
  op: CIROp;
  class: InstructionClass;
  tick: number;
  energy: number;
  outcome: ExecutionOutcomeKind;
  result?: unknown;
}

export interface ExecutionRecord {
  streamId: string;
  traceparent: string;
  outcomes: InstructionOutcome[];
  energySpent: number;
  ticksUsed: number;
  events: CIRTraceEvent[];
}

export interface StreamRejection {
  code: RejectionCode;
  instructionId?: string;
  reason: string;
  traceparent: string;
  events: CIRTraceEvent[];
}

export type ExecutionVerdict =
  | { accepted: true; record: ExecutionRecord }
  | { accepted: false; rejection: StreamRejection };

export interface PipelineResult {
  verdict: ExecutionVerdict;
  optimizer?: OptimizerResult;
  validationError?: StreamError;
}

// ── Deterministic identifiers (FNV-1a; wall clock is banned) ───────────────

function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hashHex(input: string, width: number): string {
  let out = '';
  let seed = input;
  while (out.length < width) {
    out += fnv1a(seed).toString(16).padStart(8, '0');
    seed += ':';
  }
  return out.slice(0, width);
}

export function streamIdOf(stream: CIRStream): string {
  return hashHex(encodeStream(stream), 32);
}

export function traceparentOf(stream: CIRStream): string {
  return `00-${hashHex(encodeStream(stream), 32)}-${hashHex(`span:${streamIdOf(stream)}`, 16)}-01`;
}

// ── Default deterministic handlers (perceptual + cognitive classes) ─────────

function literalValues(instr: CIRInstruction): unknown[] {
  return instr.operands.filter((o): o is Extract<Operand, { kind: 'literal' }> => o.kind === 'literal').map((o) => o.value);
}

function queryTexts(instr: CIRInstruction): string[] {
  return instr.operands.filter((o): o is Extract<Operand, { kind: 'query' }> => o.kind === 'query').map((o) => o.text);
}

const DEFAULT_HANDLERS: Readonly<Record<string, InstructionHandler>> = {
  observe: (i) => ({ observed: literalValues(i) }),
  retrieve: (i) => ({ results: queryTexts(i).map((text) => ({ text, score: 0 })) }),
  think: (i) => ({ conclusion: literalValues(i)[0] ?? queryTexts(i)[0] ?? null }),
  plan: (i) => ({ plan: queryTexts(i) }),
  execute: (i) => ({ executed: literalValues(i)[0] ?? null }),
  reflect: (i) => ({ reflection: queryTexts(i)[0] ?? null }),
  remember: () => ({ stored: true }),
  learn: () => ({ learned: true }),
  consolidate: () => ({ consolidated: true }),
  dream: () => ({ dream: [] }),
  simulate: (i) => ({ simulation: queryTexts(i) }),
  status: () => ({ status: 'ok' }),
  list: () => ({ items: [] }),
  ping: () => ({ pong: true }),
};

function defaultHandlerFor(op: CIROp): InstructionHandler | undefined {
  return DEFAULT_HANDLERS[op];
}

// ── Verification gates (RFC-0004 §9) ────────────────────────────────────────

function structuralGate(instr: CIRInstruction, options: ExecutorOptions): GateVerdict {
  if (options.scopeAllow && !options.scopeAllow.has(instr.scope)) {
    return { pass: false, reason: `scope ${instr.scope} outside projection` };
  }
  for (const operand of instr.operands) {
    if (operand.kind === 'ref' && !operand.key) return { pass: false, reason: 'ref operand missing key' };
    if (operand.kind === 'query' && !operand.policy) return { pass: false, reason: 'query operand missing policy' };
  }
  return { pass: true };
}

function defaultConstitutionalGate(instr: CIRInstruction, options: ExecutorOptions): GateVerdict {
  if (instructionClassOf(instr.op) === 'delegated' && !instr.provenance && !options.replayPayloads?.has(instr.id)) {
    return { pass: false, reason: 'delegated instruction lacks provenance (Law 3)' };
  }
  return { pass: true };
}

export function gateFor(instr: CIRInstruction, level: VerifyLevel, options: ExecutorOptions): GateVerdict {
  if (level === 'none') return { pass: true };
  const structural = structuralGate(instr, options);
  if (!structural.pass) return structural;
  if (level === 'structural') return { pass: true };
  const constitutional = options.constitutionalGate
    ? options.constitutionalGate(instr)
    : defaultConstitutionalGate(instr, options);
  if (!constitutional.pass) return constitutional;
  return { pass: true };
}

// ── Execution ───────────────────────────────────────────────────────────────

function orderInstructions(instructions: CIRInstruction[]): CIRInstruction[] {
  const byId = new Map(instructions.map((i) => [i.id, i]));
  const ordered: CIRInstruction[] = [];
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    const instr = byId.get(id);
    if (instr) {
      for (const dep of instr.depends ?? []) visit(dep);
      ordered.push(instr);
    }
  };
  for (const instr of instructions) visit(instr.id);
  return ordered;
}

export async function executeStream(stream: CIRStream, options: ExecutorOptions = {}): Promise<ExecutionVerdict> {
  const traceparent = traceparentOf(stream);
  const startTick = options.startTick ?? 1;
  const events: CIRTraceEvent[] = [];
  const emit = (event: CIRTraceEvent): void => {
    events.push(event);
    options.onEvent?.(event);
  };

  const validation = validateStream(stream);
  if (validation.error) {
    const rejection: StreamRejection = {
      code: validation.error.code === 'UNSUPPORTED_VERSION' ? 'UNSUPPORTED_VERSION' : 'INVALID_STREAM',
      reason: validation.error.message,
      traceparent,
      events,
    };
    emit({ type: 'cir:rejected', tick: startTick, traceparent, payload: { code: rejection.code, reason: rejection.reason } });
    return { accepted: false, rejection };
  }

  const budget = options.energyBudget;
  const energyEstimate = streamEnergy(stream);
  emit({
    type: 'cir:compiled',
    tick: startTick,
    traceparent,
    payload: {
      stream_id: streamIdOf(stream),
      instruction_count: stream.instructions.length,
      energy_estimate: energyEstimate,
      token_estimate: streamTokenEstimate(stream),
    },
  });

  if (budget !== undefined && energyEstimate > budget) {
    const rejection: StreamRejection = {
      code: 'BUDGET_EXCEEDED',
      reason: `stream energy ${energyEstimate} exceeds budget ${budget}`,
      traceparent,
      events,
    };
    emit({ type: 'cir:rejected', tick: startTick, traceparent, payload: { code: rejection.code, reason: rejection.reason } });
    return { accepted: false, rejection };
  }

  const outcomes: InstructionOutcome[] = [];
  let energySpent = 0;
  let tick = startTick;

  for (const instr of orderInstructions(stream.instructions)) {
    const op = instr.op;
    const cls = instructionClassOf(op);
    const gate = gateFor(instr, instr.verify, options);
    emit({ type: 'cir:gate', tick, traceparent, payload: { instruction_id: instr.id, op, verify: instr.verify, pass: gate.pass, ...(gate.reason ? { reason: gate.reason } : {}) } });
    if (!gate.pass) {
      const rejection: StreamRejection = {
        code: 'GATE_FAILED',
        instructionId: instr.id,
        reason: gate.reason ?? `verification gate failed for ${instr.id}`,
        traceparent,
        events,
      };
      emit({ type: 'cir:rejected', tick, traceparent, payload: { code: rejection.code, instruction_id: instr.id, reason: rejection.reason } });
      return { accepted: false, rejection };
    }

    const energy = energyCostOf(op);
    energySpent += energy;

    if (cls === 'delegated') {
      const replay = options.replayPayloads?.get(instr.id);
      if (replay) {
        outcomes.push({ id: instr.id, op, class: cls, tick, energy, outcome: 'substituted', result: replay.payload });
        emit({ type: 'cir:executed', tick, traceparent, payload: { instruction_id: instr.id, op, class: cls, tick, energy, outcome: 'substituted' } });
        emit({ type: 'cir:delegated', tick, traceparent, payload: { instruction_id: instr.id, op, profile: 'replay', result: { confidence: replay.confidence, latency_ms: replay.latencyMs } } });
      } else {
        const delegator = options.delegators?.get(op);
        if (!delegator) {
          const rejection: StreamRejection = {
            code: 'UNSUPPORTED_DELEGATION',
            instructionId: instr.id,
            reason: `no delegator configured for ${op} (not_configured)`,
            traceparent,
            events,
          };
          emit({ type: 'cir:rejected', tick, traceparent, payload: { code: rejection.code, instruction_id: instr.id, reason: rejection.reason } });
          return { accepted: false, rejection };
        }
        const delegated = await delegator.dispatch(instr, 'default');
        outcomes.push({ id: instr.id, op, class: cls, tick, energy, outcome: 'delegated', result: delegated.payload });
        emit({ type: 'cir:executed', tick, traceparent, payload: { instruction_id: instr.id, op, class: cls, tick, energy, outcome: 'delegated' } });
        emit({ type: 'cir:delegated', tick, traceparent, payload: { instruction_id: instr.id, op, profile: 'default', result: { confidence: delegated.confidence, latency_ms: delegated.latencyMs } } });
      }
    } else {
      const handler = options.handlers?.[op] ?? defaultHandlerFor(op);
      if (!handler) {
        const rejection: StreamRejection = {
          code: 'NO_HANDLER',
          instructionId: instr.id,
          reason: `no handler for ${op}`,
          traceparent,
          events,
        };
        emit({ type: 'cir:rejected', tick, traceparent, payload: { code: rejection.code, instruction_id: instr.id, reason: rejection.reason } });
        return { accepted: false, rejection };
      }
      const result = handler(instr);
      outcomes.push({ id: instr.id, op, class: cls, tick, energy, outcome: 'executed', result });
      emit({ type: 'cir:executed', tick, traceparent, payload: { instruction_id: instr.id, op, class: cls, tick, energy, outcome: 'executed', result } });
    }
    tick += 1;
  }

  return {
    accepted: true,
    record: {
      streamId: streamIdOf(stream),
      traceparent,
      outcomes,
      energySpent,
      ticksUsed: tick - startTick,
      events,
    },
  };
}

// ── Full pipeline: validate → optimize → execute (RFC-0004 §6) ─────────────

export async function executePipeline(
  stream: CIRStream,
  passContext: PassContext = {},
  options: ExecutorOptions = {},
): Promise<PipelineResult> {
  const validation = validateStream(stream);
  if (validation.error) {
    const events: CIRTraceEvent[] = [];
    const traceparent = traceparentOf(stream);
    if (options.onEvent) {
      options.onEvent({
        type: 'cir:rejected',
        tick: options.startTick ?? 1,
        traceparent,
        payload: { code: validation.error.code, reason: validation.error.message },
      });
    }
    return {
      verdict: {
        accepted: false,
        rejection: {
          code: validation.error.code === 'UNSUPPORTED_VERSION' ? 'UNSUPPORTED_VERSION' : 'INVALID_STREAM',
          reason: validation.error.message,
          traceparent,
          events,
        },
      },
      validationError: validation.error,
    };
  }

  const optimizer = runPasses(stream, passContext);
  const passEvents: CIRTraceEvent[] = optimizer.reports.map((report) => ({
    type: 'cir:pass' as const,
    tick: options.startTick ?? 1,
    traceparent: traceparentOf(stream),
    payload: {
      pass: report.pass,
      changed: report.changed,
      energy_delta: report.energyDelta,
      token_delta: report.tokenDelta,
      ...(report.rationale ? { rationale: report.rationale } : {}),
    },
  }));
  if (options.onEvent) for (const event of passEvents) options.onEvent(event);

  const verdict = await executeStream(optimizer.stream, { ...options, startTick: (options.startTick ?? 1) + optimizer.reports.length });
  return { verdict, optimizer };
}

export const CIR_EXECUTOR_VERSION = '1.0.0';
export { CIR_VERSION };
