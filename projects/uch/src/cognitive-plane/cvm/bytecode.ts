import type { CVMExecutionInput } from './cognitive-vm.js';

export type CVMInstructionClass = 'perceptual' | 'cognitive' | 'delegated';

export interface DecodedInstruction {
  id: string;
  op: string;
  class: CVMInstructionClass;
  operands: CVMExecutionInput['instructions'][number]['operands'];
  verify: 'none' | 'structural' | 'constitutional';
  scope: string;
  depends: string[];
}

export interface DecodedProgram {
  header: CVMExecutionInput['header'];
  instructions: DecodedInstruction[];
}

export class CVMDecodeError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`CVM decode failed: ${violations.join('; ')}`);
    this.name = 'CVMDecodeError';
    this.violations = violations;
  }
}

export const PERCEPTUAL_OPS = ['observe'] as const;

export const COGNITIVE_OPS = [
  'ping',
  'list',
  'status',
  'think',
  'retrieve',
  'remember',
  'learn',
  'reflect',
  'consolidate',
  'dream',
  'plan',
  'predict',
  'simulate',
  'evaluate',
  'critique',
  'execute',
] as const;

export const DELEGATED_OPS = ['generate', 'summarize', 'translate'] as const;

export const DETERMINISTIC_OPS = [...PERCEPTUAL_OPS, ...COGNITIVE_OPS] as const;

const CLASS_BY_OP = new Map<string, CVMInstructionClass>([
  ...PERCEPTUAL_OPS.map((op) => [op, 'perceptual'] as const),
  ...COGNITIVE_OPS.map((op) => [op, 'cognitive'] as const),
  ...DELEGATED_OPS.map((op) => [op, 'delegated'] as const),
]);

export const VALID_VERIFY = ['none', 'structural', 'constitutional'] as const;

export const PAYLOAD_REQUIRED_OPS = [
  'observe',
  'think',
  'retrieve',
  'remember',
  'learn',
  'plan',
  'predict',
  'simulate',
  'critique',
  'execute',
] as const;

export function classifyOp(op: string): CVMInstructionClass | null {
  return CLASS_BY_OP.get(op) ?? null;
}

export function isDeterministicOp(op: string): boolean {
  return (DETERMINISTIC_OPS as readonly string[]).includes(op);
}

export function isDelegatedOp(op: string): boolean {
  return (DELEGATED_OPS as readonly string[]).includes(op);
}

export function decodeProgram(input: CVMExecutionInput): DecodedProgram {
  const violations: string[] = [];
  const seen = new Set<string>();

  if (typeof input.header.requires_cp !== 'string' || !input.header.requires_cp.startsWith('^1')) {
    violations.push(`requires_cp must target CP major 1, got ${String(input.header.requires_cp)}`);
  }
  if (!Array.isArray(input.instructions) || input.instructions.length === 0) {
    violations.push('program must contain at least one instruction');
    throw new CVMDecodeError(violations);
  }

  for (const instruction of input.instructions) {
    if (seen.has(instruction.id)) {
      violations.push(`duplicate instruction id ${instruction.id}`);
    }
    seen.add(instruction.id);

    const cls = classifyOp(instruction.op);
    if (!cls) {
      violations.push(`unknown op ${instruction.op} (no instruction class)`);
    }

    if (!(VALID_VERIFY as readonly string[]).includes(instruction.verify)) {
      violations.push(
        `invalid verify requirement ${String(instruction.verify)} on ${instruction.id}`,
      );
    }

    if ((PAYLOAD_REQUIRED_OPS as readonly string[]).includes(instruction.op)) {
      if (!Array.isArray(instruction.operands) || instruction.operands.length === 0) {
        violations.push(`op ${instruction.op} (${instruction.id}) requires at least one operand`);
      }
    }
  }

  for (const instruction of input.instructions) {
    for (const dep of instruction.depends ?? []) {
      if (!seen.has(dep)) {
        violations.push(`instruction ${instruction.id} depends on unknown ${dep}`);
      }
    }
  }

  if (violations.length > 0) {
    throw new CVMDecodeError(violations);
  }

  return {
    header: input.header,
    instructions: input.instructions.map((instruction) => ({
      id: instruction.id,
      op: instruction.op,
      class: CLASS_BY_OP.get(instruction.op) ?? 'delegated',
      operands: instruction.operands,
      verify: instruction.verify as DecodedInstruction['verify'],
      scope: instruction.scope,
      depends: instruction.depends ?? [],
    })),
  };
}
