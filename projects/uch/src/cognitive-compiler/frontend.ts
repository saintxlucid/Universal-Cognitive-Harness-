// ─── CIR Frontend: Intent → CIR builder (RFC-0004 §6 stage 2) ───────────────
// The substrate-side compiler contract: drivers produce a normalized
// CompiledIntent; the builder emits a deterministic CIR stream. The substrate
// never parses English — the driver owns stage 1.

import { CIR_VERSION, buildInstruction, query, literal, streamEnergy, streamTokenEstimate, createHeader, type CIRStream } from './cir.js';

export interface CompileOptions {
  scope: string;
  compiledBy: string;
  tick: number;
  verifyDelegated?: boolean;
}

export interface CompileReport {
  instructions: number;
  energy: number;
  tokenEstimate: number;
  gates: number;
}

export interface CompileResult {
  stream: CIRStream;
  report: CompileReport;
}

export function compileIntent(goal: string, context: string | undefined, options: CompileOptions): CompileResult {
  const scope = options.scope;
  const stream: CIRStream = {
    header: createHeader(options.compiledBy, options.tick),
    instructions: [],
  };

  stream.instructions.push(
    buildInstruction({
      id: 'r1',
      op: 'retrieve',
      operands: [query(context && context.trim() ? context : goal, scope, 'structural')],
      scope,
    }),
    buildInstruction({
      id: 'p1',
      op: 'plan',
      operands: [query(goal, scope, 'structural')],
      scope,
      depends: ['r1'],
    }),
    buildInstruction({
      id: 'x1',
      op: 'execute',
      operands: [literal({ action: 'pursue-goal', goal }, scope)],
      scope,
      depends: ['p1'],
    }),
    buildInstruction({
      id: 'v1',
      op: 'evaluate',
      operands: [literal({ subject: goal }, scope)],
      scope,
      depends: ['x1'],
    }),
    buildInstruction({
      id: 'f1',
      op: 'reflect',
      operands: [query(goal, scope, 'none')],
      scope,
      depends: ['v1'],
    }),
  );

  const gates = stream.instructions.filter((instr) => instr.verify === 'constitutional').length;
  return {
    stream,
    report: {
      instructions: stream.instructions.length,
      energy: streamEnergy(stream),
      tokenEstimate: streamTokenEstimate(stream),
      gates,
    },
  };
}

export function compileGoal(goal: string, options: CompileOptions): CompileResult {
  return compileIntent(goal, undefined, options);
}

export function encodeCompiled(result: CompileResult): string {
  return JSON.stringify({ stream: result.stream, report: result.report, cir: CIR_VERSION });
}
