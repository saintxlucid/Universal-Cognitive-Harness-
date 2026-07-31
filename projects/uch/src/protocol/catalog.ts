// ─── CP Instruction Catalog ─────────────────────────────────────────────────
// The Cognitive ISA, made concrete: every CP op carries metadata — category,
// owning organ, energy cost, expected output shape, and verification
// requirement. Like an assembly table: opcode → operands → cost → output →
// verification. Pure data, deterministic, forward-compatible (built from
// CP_OPS, so new ops are covered by defaults until catalogued).

import { CP_OPS, type CPOp } from './cp.js';

export type InstructionCategory =
  | 'observe' | 'memory' | 'learning' | 'execution' | 'evaluation'
  | 'planning' | 'status';

export type VerificationRequirement =
  | 'none'        // pure information retrieval / status
  | 'self'        // runtime-internal check (deterministic)
  | 'external'    // requires tool execution / tests / evidence
  | 'constitutional'; // requires constitution / organic-score gate

export interface InstructionMetadata {
  op: CPOp;
  category: InstructionCategory;
  organ: string;
  energyCost: number; // 1–10, deterministic frugality weight
  expectedOutput: string;
  verification: VerificationRequirement;
}

export interface InstructionRecord {
  op: CPOp;
  tick: number; // monotonic cognitive clock, never wall-clock ordering
  wall: Date;
  energyCost: number;
  verification: VerificationRequirement;
}

const CATALOG: Record<CPOp, Omit<InstructionMetadata, 'op'>> = {
  observe: { category: 'observe', organ: 'drivers', energyCost: 1, expectedOutput: 'normalized observation event', verification: 'none' },
  think: { category: 'planning', organ: 'executive-brain', energyCost: 6, expectedOutput: 'synthesized conclusion or hypothesis', verification: 'self' },
  retrieve: { category: 'memory', organ: 'mnemosyne', energyCost: 1, expectedOutput: 'ranked memory/evidence results', verification: 'none' },
  remember: { category: 'memory', organ: 'mnemosyne', energyCost: 2, expectedOutput: 'stored episode (episodic or semantic)', verification: 'self' },
  learn: { category: 'learning', organ: 'mnemosyne', energyCost: 3, expectedOutput: 'claim, pattern, or skill update', verification: 'self' },
  reflect: { category: 'learning', organ: 'cognitive-plane/reflection', energyCost: 3, expectedOutput: 'reflection entry with lessons', verification: 'self' },
  consolidate: { category: 'learning', organ: 'sleep-cycle', energyCost: 5, expectedOutput: 'consolidation report (promotions, prunes)', verification: 'self' },
  dream: { category: 'learning', organ: 'sleep-cycle', energyCost: 4, expectedOutput: 'synthesized pattern or abstraction', verification: 'self' },
  plan: { category: 'planning', organ: 'executive-brain', energyCost: 5, expectedOutput: 'ordered plan with verification steps', verification: 'external' },
  predict: { category: 'planning', organ: 'executive-brain', energyCost: 4, expectedOutput: 'prediction with confidence', verification: 'external' },
  simulate: { category: 'planning', organ: 'digital-twin', energyCost: 7, expectedOutput: 'what-if simulation result', verification: 'external' },
  evaluate: { category: 'evaluation', organ: 'organic-score/engineering-intelligence', energyCost: 2, expectedOutput: 'evaluation report with gate verdict', verification: 'constitutional' },
  critique: { category: 'evaluation', organ: 'executive-brain/critic', energyCost: 3, expectedOutput: 'critique with severity findings', verification: 'constitutional' },
  execute: { category: 'execution', organ: 'agentic', energyCost: 4, expectedOutput: 'tool/action result', verification: 'external' },
  status: { category: 'status', organ: 'exoskeleton', energyCost: 1, expectedOutput: 'organism health snapshot', verification: 'none' },
  list: { category: 'status', organ: 'exoskeleton', energyCost: 1, expectedOutput: 'enumerable entity listing', verification: 'none' },
  ping: { category: 'status', organ: 'transport', energyCost: 1, expectedOutput: 'liveness acknowledgement', verification: 'none' },
};

export function instructionMetadata(op: CPOp): InstructionMetadata {
  return { op, ...CATALOG[op] };
}

/** True if every op in the protocol has catalogue metadata. */
export function catalogIsComplete(ops: readonly CPOp[] = CP_OPS): boolean {
  return ops.every((op) => CATALOG[op] !== undefined);
}

export function opsByCategory(category: InstructionCategory): CPOp[] {
  return CP_OPS.filter((op) => CATALOG[op]?.category === category);
}

/** Energy budget check: sum of costs for a batch of ops. */
export function energyCostOf(ops: readonly CPOp[]): number {
  return ops.reduce((sum, op) => sum + (CATALOG[op]?.energyCost ?? 1), 0);
}

/** Verification gate check: does this op require constitutional review? */
export function requiresConstitutionalGate(op: CPOp): boolean {
  return CATALOG[op]?.verification === 'constitutional';
}

// ─── Monotonic cognitive clock ───────────────────────────────────────────────
// Wall clock is untrustworthy for ordering (NTP, manual changes). The catalog
// issues monotonic ticks for instruction records — the "cognitive clock" of
// the kernel (per engineering-intelligence guidance).

let tickCounter = 0;

export function nextCognitiveTick(): number {
  tickCounter += 1;
  return tickCounter;
}

export function instructionRecord(op: CPOp, wall: Date = new Date()): InstructionRecord {
  const meta = CATALOG[op];
  return {
    op,
    tick: nextCognitiveTick(),
    wall,
    energyCost: meta?.energyCost ?? 1,
    verification: meta?.verification ?? 'self',
  };
}

/** Ordering comparator for instruction records — tick-based, never wall. */
export function compareRecords(a: InstructionRecord, b: InstructionRecord): number {
  return a.tick - b.tick;
}
