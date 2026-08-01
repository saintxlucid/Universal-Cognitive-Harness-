// ─── CIR Core: Cognitive Intermediate Representation ─────────────────────────
// The instruction stream of the Cognitive OS (RFC-0004). Types, JSON
// encoding, validation, and versioning. The kernel never sees English —
// everything compiles to CIR before execution.

import { CP_OPS, CP_VERSION, CP_MAJOR, type CPOp } from '../protocol/cp.js';
import { instructionMetadata, type VerificationRequirement } from '../protocol/catalog.js';

export const CIR_PROTOCOL_ID = 'uch-cir';
export const CIR_VERSION = '1.0.0';

/** Composite operand nesting cap — unbounded recursion on adversarial input
 *  would overflow the stack instead of producing a structured error (R1). */
export const MAX_COMPOSITE_DEPTH = 32;

export type VerifyLevel = 'none' | 'structural' | 'constitutional';
export type InstructionClass = 'perceptual' | 'cognitive' | 'delegated';

/** CIR-level extension ops — additive beyond the CP vocabulary. */
export const CIR_EXTENSION_OPS = ['infer', 'ingest', 'diff', 'scan', 'merge', 'prune', 'generalize'] as const;
export type CIRExtensionOp = (typeof CIR_EXTENSION_OPS)[number];
export type CIROp = CPOp | CIRExtensionOp;

export const CIR_OPS: readonly CIROp[] = [...CP_OPS, ...CIR_EXTENSION_OPS];

export interface QueryPolicy {
  scope: string;
  verify: VerifyLevel;
}

export type Operand =
  | { kind: 'literal'; value: unknown }
  | { kind: 'ref'; key: string }
  | { kind: 'query'; text: string; policy: QueryPolicy }
  | { kind: 'composite'; stream: CIRStream };

export interface CIRInstruction {
  id: string;
  op: CIROp;
  operands: Operand[];
  verify: VerifyLevel;
  provenance?: string;
  scope: string;
  deadline?: number;
  depends?: string[];
}

export interface CIRStreamHeader {
  cir: typeof CIR_VERSION;
  requires_cp: string;
  compiled_by: string;
  compiled_at_tick: number;
}

export interface CIRStream {
  header: CIRStreamHeader;
  instructions: CIRInstruction[];
}

export interface StreamError {
  code: 'BAD_STREAM' | 'UNSUPPORTED_OP' | 'UNSUPPORTED_VERSION' | 'INVALID_INSTRUCTION';
  message: string;
  instructionId?: string;
}

export interface CompiledIntent {
  goal: string;
  context?: string;
  scope: string;
  compiledBy: string;
}

const DEFAULT_EXTENSION_META: Record<CIRExtensionOp, { energy: number; verify: VerifyLevel }> = {
  infer: { energy: 6, verify: 'constitutional' },
  ingest: { energy: 1, verify: 'structural' },
  diff: { energy: 1, verify: 'structural' },
  scan: { energy: 1, verify: 'none' },
  merge: { energy: 2, verify: 'structural' },
  prune: { energy: 2, verify: 'structural' },
  generalize: { energy: 3, verify: 'structural' },
};

const CLASS_OF: Partial<Record<CIROp, InstructionClass>> = {
  observe: 'perceptual',
  ingest: 'perceptual',
  diff: 'perceptual',
  scan: 'perceptual',
  think: 'cognitive',
  retrieve: 'cognitive',
  remember: 'cognitive',
  learn: 'cognitive',
  reflect: 'cognitive',
  consolidate: 'cognitive',
  dream: 'cognitive',
  plan: 'cognitive',
  simulate: 'cognitive',
  merge: 'cognitive',
  prune: 'cognitive',
  generalize: 'cognitive',
  status: 'cognitive',
  list: 'cognitive',
  ping: 'cognitive',
  infer: 'delegated',
  evaluate: 'delegated',
  critique: 'delegated',
  predict: 'delegated',
};

const VERIFY_MAP: Record<VerificationRequirement, VerifyLevel> = {
  none: 'none',
  self: 'structural',
  external: 'structural',
  constitutional: 'constitutional',
};

export function instructionClassOf(op: CIROp): InstructionClass {
  return CLASS_OF[op] ?? 'cognitive';
}

export function energyCostOf(op: CIROp): number {
  if (CP_OPS.includes(op as CPOp)) return instructionMetadata(op as CPOp).energyCost;
  return DEFAULT_EXTENSION_META[op as CIRExtensionOp]?.energy ?? 1;
}

export function defaultVerifyFor(op: CIROp): VerifyLevel {
  if (op === 'predict') return 'constitutional';
  if (CP_OPS.includes(op as CPOp)) {
    return VERIFY_MAP[instructionMetadata(op as CPOp).verification] ?? 'structural';
  }
  return DEFAULT_EXTENSION_META[op as CIRExtensionOp]?.verify ?? 'structural';
}

// ── Encoding ────────────────────────────────────────────────────────────────

function stableStringify(value: unknown): string {
  const seen = new Set<unknown>();
  const replacer = (_key: string, val: unknown): unknown => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) throw new Error('circular reference');
      seen.add(val);
      if (Array.isArray(val)) return val;
      return Object.fromEntries(Object.keys(val as Record<string, unknown>).sort().map((k) => [k, (val as Record<string, unknown>)[k]]));
    }
    return val;
  };
  return JSON.stringify(value, replacer, 0);
}

export function encodeStream(stream: CIRStream): string {
  return stableStringify(stream);
}

export function decodeStream(text: string): CIRStream {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('CIR stream is not valid JSON');
  }
  const validated = validateStream(parsed);
  if (validated.error || !validated.stream) throw new Error(validated.error?.message ?? 'Invalid CIR stream');
  return validated.stream;
}

// ── Version gate ────────────────────────────────────────────────────────────

function majorOf(version: string): number | null {
  const major = version.trim().split('.')[0] ?? '';
  return /^\d+$/.test(major) ? Number(major) : null;
}

function parseCaretRange(range: string): { major: number; minMinor: number } | null {
  const trimmed = range.trim();
  if (trimmed === '*') return { major: -1, minMinor: 0 };
  if (!trimmed.startsWith('^')) return null;
  const parts = trimmed.slice(1).split('.');
  const major = majorOf(parts[0] ?? '');
  const minMinor = majorOf(parts[1] ?? '0') ?? 0;
  return major === null ? null : { major, minMinor };
}

export function satisfiesRequiresCp(range: string, hostVersion: string = CP_VERSION): boolean {
  const rangeSpec = parseCaretRange(range);
  if (!rangeSpec) return false;
  if (rangeSpec.major < 0) return true;
  const hostMajor = majorOf(hostVersion) ?? -1;
  if (hostMajor !== rangeSpec.major) return false;
  if (rangeSpec.minMinor === 0) return true;
  const hostMinor = majorOf(hostVersion.split('.')[1] ?? '0') ?? 0;
  return hostMinor >= rangeSpec.minMinor;
}

export function createHeader(compiledBy: string, compiledAtTick: number, requiresCp = `^${CP_MAJOR}.0`): CIRStreamHeader {
  return { cir: CIR_VERSION, requires_cp: requiresCp, compiled_by: compiledBy, compiled_at_tick: compiledAtTick };
}

// ── Validation ──────────────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateOperand(value: unknown, instructionId: string, errors: string[], idUniverse: ReadonlySet<string>, depth: number): void {
  if (!isObject(value)) {
    errors.push(`${instructionId}: operand must be an object`);
    return;
  }
  switch (value.kind) {
    case 'literal':
      if (!('value' in value)) errors.push(`${instructionId}: literal operand requires value`);
      return;
    case 'ref':
      if (typeof value.key !== 'string' || !value.key) errors.push(`${instructionId}: ref operand requires a key`);
      return;
    case 'query': {
      if (typeof value.text !== 'string' || !value.text.trim()) errors.push(`${instructionId}: query operand requires text`);
      if (!isObject(value.policy)) errors.push(`${instructionId}: query operand requires a policy`);
      else {
        if (typeof value.policy.scope !== 'string') errors.push(`${instructionId}: query policy requires scope`);
        if (!['none', 'structural', 'constitutional'].includes(String(value.policy.verify))) {
          errors.push(`${instructionId}: query policy has invalid verify level`);
        }
      }
      return;
    }
    case 'composite':
      if (!isObject(value.stream)) errors.push(`${instructionId}: composite operand requires a stream`);
      else if (depth >= MAX_COMPOSITE_DEPTH) {
        errors.push(`${instructionId}: composite nesting exceeds the depth limit (${MAX_COMPOSITE_DEPTH})`);
      } else {
        validateInstructionList(value.stream, errors, idUniverse, depth + 1);
      }
      return;
    default:
      errors.push(`${instructionId}: unknown operand kind: ${String((value as { kind?: unknown }).kind)}`);
  }
}

function validateInstructionList(raw: unknown, errors: string[], idUniverse?: ReadonlySet<string>, depth = 0): void {
  if (!isObject(raw) || !Array.isArray(raw.instructions)) {
    errors.push('stream: instructions must be an array');
    return;
  }
  const ids = new Set<string>();
  // Composite operands are inlined sub-streams: their depends may reference
  // outer instructions, so the id universe is accumulated over the whole
  // stream (one top-level pass) instead of being rebuilt per nested list.
  const allIds = idUniverse ?? (() => {
    const collected = new Set<string>();
    const collect = (list: unknown[], level: number): void => {
      if (level > MAX_COMPOSITE_DEPTH) return;
      for (const instr of list) {
        if (isObject(instr) && typeof instr.id === 'string') {
          collected.add(instr.id);
          if (Array.isArray(instr.operands)) {
            for (const op of instr.operands) {
              if (isObject(op) && op.kind === 'composite' && isObject(op.stream) && Array.isArray(op.stream.instructions)) {
                collect(op.stream.instructions as unknown[], level + 1);
              }
            }
          }
        }
      }
    };
    collect(raw.instructions as unknown[], 0);
    return collected;
  })();

  for (const instr of raw.instructions as unknown[]) {
    if (!isObject(instr)) {
      errors.push('stream: instruction must be an object');
      continue;
    }
    const id = String(instr.id ?? '');
    if (!id) {
      errors.push('stream: instruction requires an id');
      continue;
    }
    if (ids.has(id)) errors.push(`stream: duplicate instruction id: ${id}`);
    ids.add(id);

    const op = String(instr.op ?? '');
    if (!CIR_OPS.includes(op as CIROp)) errors.push(`${id}: unsupported op: ${op}`);
    if (instr.verify !== undefined && !['none', 'structural', 'constitutional'].includes(String(instr.verify))) {
      errors.push(`${id}: invalid verify level: ${String(instr.verify)}`);
    }
    if (typeof instr.scope !== 'string' || !instr.scope) errors.push(`${id}: requires a scope`);
    if (!Array.isArray(instr.operands)) errors.push(`${id}: requires operands array`);
    else for (const operand of instr.operands) validateOperand(operand, id, errors, allIds, depth);

    if (Array.isArray(instr.depends)) {
      for (const dep of instr.depends) {
        if (!allIds.has(String(dep))) errors.push(`${id}: depends on unknown instruction: ${String(dep)}`);
      }
    }
  }
}

export function validateStream(raw: unknown): { stream?: CIRStream; error?: StreamError } {
  if (!isObject(raw)) return { error: { code: 'BAD_STREAM', message: 'Stream must be a JSON object' } };
  if (!isObject(raw.header)) return { error: { code: 'BAD_STREAM', message: 'Stream requires a header' } };
  if (raw.header.cir !== CIR_VERSION) {
    return { error: { code: 'UNSUPPORTED_VERSION', message: `Unsupported CIR version: ${String(raw.header.cir)} (host speaks ${CIR_VERSION})` } };
  }
  if (typeof raw.header.requires_cp !== 'string' || !satisfiesRequiresCp(raw.header.requires_cp)) {
    return {
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `Host CP ${CP_VERSION} does not satisfy requires_cp: ${String(raw.header.requires_cp)}`,
      },
    };
  }
  if (typeof raw.header.compiled_by !== 'string' || !raw.header.compiled_by) {
    return { error: { code: 'BAD_STREAM', message: 'Stream requires compiled_by' } };
  }
  if (typeof raw.header.compiled_at_tick !== 'number') {
    return { error: { code: 'BAD_STREAM', message: 'Stream requires compiled_at_tick' } };
  }

  const errors: string[] = [];
  validateInstructionList(raw, errors);
  if (errors.length > 0) {
    return {
      error: {
        code: 'INVALID_INSTRUCTION',
        message: errors.join('; '),
        ...(errors[0]?.match(/^([^:]+):/) ? { instructionId: errors[0].match(/^([^:]+):/)?.[1] } : {}),
      },
    };
  }
  return { stream: raw as unknown as CIRStream };
}

// ── Builders ────────────────────────────────────────────────────────────────

let instructionCounter = 0;

export function buildInstruction(input: Omit<CIRInstruction, 'verify'> & { verify?: VerifyLevel }): CIRInstruction {
  instructionCounter += 1;
  return {
    id: input.id ?? `i${instructionCounter}`,
    op: input.op,
    operands: input.operands,
    verify: input.verify ?? defaultVerifyFor(input.op),
    ...(input.provenance ? { provenance: input.provenance } : {}),
    scope: input.scope,
    ...(input.deadline !== undefined ? { deadline: input.deadline } : {}),
    ...(input.depends ? { depends: input.depends } : {}),
  };
}

export function literal(value: unknown, _scope: string): Operand {
  return { kind: 'literal', value };
}

export function ref(key: string, _scope: string): Operand {
  return { kind: 'ref', key };
}

export function query(text: string, scope: string, verify: VerifyLevel = 'structural'): Operand {
  return { kind: 'query', text, policy: { scope, verify } };
}

export function composite(stream: CIRStream, _scope: string): Operand {
  return { kind: 'composite', stream };
}

export function streamTokenEstimate(stream: CIRStream): number {
  let total = 0;
  const walk = (instrs: CIRInstruction[]): void => {
    for (const instr of instrs) {
      total += 4 + instr.op.length;
      for (const operand of instr.operands) {
        if (operand.kind === 'literal') total += 2;
        else if (operand.kind === 'ref') total += 3;
        else if (operand.kind === 'query') total += Math.ceil(operand.text.length / 4) + 2;
        else if (operand.kind === 'composite') walk(operand.stream.instructions);
      }
    }
  };
  walk(stream.instructions);
  return total;
}

export function streamEnergy(stream: CIRStream): number {
  let total = 0;
  const walk = (instrs: CIRInstruction[]): void => {
    for (const instr of instrs) {
      total += energyCostOf(instr.op);
      for (const operand of instr.operands) {
        if (operand.kind === 'composite') walk(operand.stream.instructions);
      }
    }
  };
  walk(stream.instructions);
  return total;
}
