// ─── CIR Benchmark Corpus (RFC-0004 §14) ────────────────────────────────────
// Deterministic cases, zero model calls. The runner asserts the six contract
// requirements: determinism (every case, 3 runs), pass effects (per pass ≥ 2
// changing + 1 non-changing with transformation assertions), energy
// accounting, gate enforcement, version gate, negative controls.

import { CIR_VERSION, buildInstruction, literal, query, ref, type CIRInstruction, type CIRStream, type Operand, type VerifyLevel } from '../cir.js';
import type { PassContext, PassId } from '../passes.js';
import type { ExecutorOptions, RejectionCode } from '../executor.js';

export const CORPUS_VERSION = '0.1.0';

// ── Case kinds ──────────────────────────────────────────────────────────────

export interface PassEffectCase {
  kind: 'pass-effect';
  id: string;
  description: string;
  pass: PassId;
  /** true = the pass MUST change the stream; false = MUST leave it identical */
  changes: boolean;
  stream: CIRStream;
  ctx?: PassContext;
  /** Specific transformation assertion on the single-pass output. */
  assert?: (after: CIRStream) => boolean;
}

export interface DeterminismCase {
  kind: 'determinism';
  id: string;
  description: string;
  stream: CIRStream;
  ctx?: PassContext;
  options?: ExecutorOptions;
}

export interface EnergyCase {
  kind: 'energy';
  id: string;
  description: string;
  stream: CIRStream;
  ctx?: PassContext;
  options?: ExecutorOptions;
}

export interface GateCase {
  kind: 'gate';
  id: string;
  description: string;
  stream: CIRStream;
  options?: ExecutorOptions;
  expectRejected: boolean;
  rejectionCode?: RejectionCode;
}

export interface VersionGateCase {
  kind: 'version-gate';
  id: string;
  description: string;
  stream: CIRStream;
  /** Mutate header requires_cp before running; undefined = leave as-is. */
  requiresCp?: string;
  expectAccepted: boolean;
}

export interface NegativeControlCase {
  kind: 'negative-control';
  id: string;
  description: string;
  stream: CIRStream;
  ctx?: PassContext;
}

export type CorpusCase = PassEffectCase | DeterminismCase | EnergyCase | GateCase | VersionGateCase | NegativeControlCase;

// ── Builders ────────────────────────────────────────────────────────────────

function header(tick = 1): CIRStream['header'] {
  return { cir: CIR_VERSION, requires_cp: '^1.0', compiled_by: 'benchmark-corpus', compiled_at_tick: tick };
}

function stream(instructions: CIRInstruction[], tick = 1): CIRStream {
  return { header: header(tick), instructions };
}

function instr(partial: Omit<CIRInstruction, 'operands' | 'verify'> & { operands?: Operand[]; verify?: VerifyLevel }): CIRInstruction {
  return buildInstruction({
    id: partial.id,
    op: partial.op,
    operands: partial.operands ?? [],
    scope: partial.scope,
    ...(partial.verify !== undefined ? { verify: partial.verify } : {}),
    ...(partial.depends ? { depends: partial.depends } : {}),
    ...(partial.provenance ? { provenance: partial.provenance } : {}),
    ...(partial.deadline !== undefined ? { deadline: partial.deadline } : {}),
  });
}

const S = 'ws:corpus';

const PE_CTX: PassContext = {
  provideVerified: () => [literal({ fact: 'verified memory' }, S)],
  contradictions: (key) => key === 'belief:contradicted',
  verifiedFacts: (key) => (key === 'belief:fact' ? { value: 1 } : undefined),
  evidenceChain: (key) => (key.startsWith('belief:') ? 0 : 2),
  allowScopes: new Set([S]),
  skillsFor: (op) => (op === 'plan' ? ['plan-granular'] : []),
  stakeOf: (goal) => (goal.includes('prod') ? 'high' : 'low'),
  // Budget 6: below P16a/b streams (status+ping+think = 8, list+think = 7) so
  // energy-optimization fires; at or above think's own cost (6) so P16c stays.
  energyBudget: 6,
  trustOf: (key) => (key === 'belief:rumor' ? 0.2 : 0.9),
};

// ── Pass-effect triples (P1..P17: 2 changing + 1 non-changing each) ─────────

export const PASS_EFFECT_CASES: PassEffectCase[] = [
  // P1 Normalize
  { kind: 'pass-effect', id: 'P1a', description: 'P1 normalize: reorders operands canonically', pass: 'normalize', changes: true, stream: stream([instr({ id: 'a', op: 'think', operands: [literal(2, S), ref('belief:1', S), literal(1, S)], scope: S })], 1), assert: (a) => JSON.stringify(a.instructions[0]!.operands.map((o) => JSON.stringify(o)).sort()) === JSON.stringify([JSON.stringify(literal(1, S)), JSON.stringify(literal(2, S)), JSON.stringify(ref('belief:1', S))].sort()) },
  { kind: 'pass-effect', id: 'P1b', description: 'P1 normalize: dedupes and sorts depends', pass: 'normalize', changes: true, stream: stream([instr({ id: 'a', op: 'plan', operands: [], scope: S, depends: ['b', 'a', 'b'] }), instr({ id: 'b', op: 'retrieve', operands: [], scope: S })], 1), assert: (a) => JSON.stringify(a.instructions[0]!.depends) === JSON.stringify(['a', 'b']) },
  { kind: 'pass-effect', id: 'P1c', description: 'P1 normalize: canonical streams unchanged', pass: 'normalize', changes: false, stream: stream([instr({ id: 'a', op: 'think', operands: [literal(1, S)], scope: S })], 1) },
  // P2 Deduplicate
  { kind: 'pass-effect', id: 'P2a', description: 'P2 deduplicate: merges identical retrieves, rewires depends', pass: 'deduplicate', changes: true, stream: stream([instr({ id: 'r1', op: 'retrieve', operands: [query('same', S)], scope: S }), instr({ id: 'r2', op: 'retrieve', operands: [query('same', S)], scope: S }), instr({ id: 't1', op: 'think', operands: [], scope: S, depends: ['r2'] })], 1), assert: (a) => a.instructions.map((i) => i.id).join(',') === 'r1,t1' && JSON.stringify(a.instructions[1]!.depends) === JSON.stringify(['r1']) },
  { kind: 'pass-effect', id: 'P2b', description: 'P2 deduplicate: merges identical status pairs', pass: 'deduplicate', changes: true, stream: stream([instr({ id: 's1', op: 'status', operands: [literal({ x: 1 }, S)], scope: S }), instr({ id: 's2', op: 'status', operands: [literal({ x: 1 }, S)], scope: S })], 1), assert: (a) => a.instructions.length === 1 },
  { kind: 'pass-effect', id: 'P2c', description: 'P2 deduplicate: distinct instructions unchanged', pass: 'deduplicate', changes: false, stream: stream([instr({ id: 'r1', op: 'retrieve', operands: [query('one', S)], scope: S }), instr({ id: 'r2', op: 'retrieve', operands: [query('two', S)], scope: S })], 1) },
  // P3 Inject Context
  { kind: 'pass-effect', id: 'P3a', description: 'P3 inject-context: attaches verified memory to a query', pass: 'inject-context', changes: true, stream: stream([instr({ id: 'r1', op: 'retrieve', operands: [query('how to persist', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal') },
  { kind: 'pass-effect', id: 'P3b', description: 'P3 inject-context: attaches memory to a plan query', pass: 'inject-context', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('migrate', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal') },
  { kind: 'pass-effect', id: 'P3c', description: 'P3 inject-context: unchanged without a provider', pass: 'inject-context', changes: false, stream: stream([instr({ id: 't1', op: 'think', operands: [query('q', S)], scope: S })], 1) },
  // P4 Memory Entropy Reduction
  { kind: 'pass-effect', id: 'P4a', description: 'P4 memory-entropy: collapses redundant retrieves', pass: 'memory-entropy-reduction', changes: true, stream: stream([instr({ id: 'r1', op: 'retrieve', operands: [query('the gateway', S)], scope: S }), instr({ id: 'r2', op: 'retrieve', operands: [query('THE GATEWAY ', S)], scope: S }), instr({ id: 't1', op: 'think', operands: [], scope: S, depends: ['r2'] })], 1), assert: (a) => a.instructions.map((i) => i.id).join(',') === 'r1,t1' && JSON.stringify(a.instructions[1]!.depends) === JSON.stringify(['r1']) },
  { kind: 'pass-effect', id: 'P4b', description: 'P4 memory-entropy: collapses a second pair', pass: 'memory-entropy-reduction', changes: true, stream: stream([instr({ id: 'a', op: 'retrieve', operands: [query('ledger', S)], scope: S }), instr({ id: 'b', op: 'retrieve', operands: [query(' ledger', S)], scope: S })], 1), assert: (a) => a.instructions.length === 1 },
  { kind: 'pass-effect', id: 'P4c', description: 'P4 memory-entropy: leaves plan queries alone', pass: 'memory-entropy-reduction', changes: false, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('build', S)], scope: S }), instr({ id: 'r1', op: 'retrieve', operands: [query('build', S)], scope: S })], 1) },
  // P5 Contradiction Elimination
  { kind: 'pass-effect', id: 'P5a', description: 'P5 contradiction: quarantines a conflicting belief', pass: 'contradiction-elimination', changes: true, stream: stream([instr({ id: 't1', op: 'think', operands: [ref('belief:contradicted', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands[0]!.kind === 'literal' },
  { kind: 'pass-effect', id: 'P5b', description: 'P5 contradiction: quarantines a second key', pass: 'contradiction-elimination', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [ref('belief:contradicted', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => JSON.stringify(a.instructions[0]!.operands[0]) === JSON.stringify({ kind: 'literal', value: { quarantined: true, key: 'belief:contradicted' } }) },
  { kind: 'pass-effect', id: 'P5c', description: 'P5 contradiction: unchanged without provider', pass: 'contradiction-elimination', changes: false, stream: stream([instr({ id: 't1', op: 'think', operands: [ref('belief:x', S)], scope: S })], 1) },
  // P6 Context Compression
  { kind: 'pass-effect', id: 'P6a', description: 'P6 context-compression: merges literal operands', pass: 'context-compression', changes: true, stream: stream([instr({ id: 'x1', op: 'execute', operands: [literal({ a: 1 }, S), literal({ b: 2 }, S)], scope: S })], 1), assert: (a) => a.instructions[0]!.operands.filter((o) => o.kind === 'literal').length === 1 },
  { kind: 'pass-effect', id: 'P6b', description: 'P6 context-compression: merges a second pair', pass: 'context-compression', changes: true, stream: stream([instr({ id: 't1', op: 'think', operands: [literal({ x: 'l' }, S), literal({ y: 'r' }, S)], scope: S })], 1), assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value) === JSON.stringify({ x: 'l', y: 'r' })) },
  { kind: 'pass-effect', id: 'P6c', description: 'P6 context-compression: unchanged with one literal', pass: 'context-compression', changes: false, stream: stream([instr({ id: 't1', op: 'think', operands: [literal(1, S), query('q', S)], scope: S })], 1) },
  // P7 Knowledge Promotion
  { kind: 'pass-effect', id: 'P7a', description: 'P7 knowledge-promotion: promotes a verified fact', pass: 'knowledge-promotion', changes: true, stream: stream([instr({ id: 't1', op: 'think', operands: [ref('belief:fact', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value) === JSON.stringify({ verified_fact: { value: 1 } })) },
  { kind: 'pass-effect', id: 'P7b', description: 'P7 knowledge-promotion: promotes into a plan', pass: 'knowledge-promotion', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [ref('belief:fact', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal') },
  { kind: 'pass-effect', id: 'P7c', description: 'P7 knowledge-promotion: unchanged without provider', pass: 'knowledge-promotion', changes: false, stream: stream([instr({ id: 't1', op: 'think', operands: [ref('belief:x', S)], scope: S })], 1) },
  // P8 Evidence Verification
  { kind: 'pass-effect', id: 'P8a', description: 'P8 evidence: flags a ref with zero evidence chain', pass: 'evidence-verification', changes: true, stream: stream([instr({ id: 't1', op: 'think', operands: [ref('belief:unverified', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('evidence_gap')) },
  { kind: 'pass-effect', id: 'P8b', description: 'P8 evidence: flags a second gap', pass: 'evidence-verification', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [ref('belief:raw', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('evidence_gap')) },
  { kind: 'pass-effect', id: 'P8c', description: 'P8 evidence: unchanged with chains', pass: 'evidence-verification', changes: false, stream: stream([instr({ id: 't1', op: 'think', operands: [ref('graph:proven', S)], scope: S })], 1), ctx: PE_CTX },
  // P9 Hallucination Detection
  { kind: 'pass-effect', id: 'P9a', description: 'P9 hallucination: flags infer without provenance', pass: 'hallucination-detection', changes: true, stream: stream([instr({ id: 'i1', op: 'infer', operands: [query('conclude', S)], scope: S })], 1), assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('hallucination_risk')) },
  { kind: 'pass-effect', id: 'P9b', description: 'P9 hallucination: flags critique without provenance', pass: 'hallucination-detection', changes: true, stream: stream([instr({ id: 'c1', op: 'critique', operands: [], scope: S })], 1), assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('hallucination_risk')) },
  { kind: 'pass-effect', id: 'P9c', description: 'P9 hallucination: unchanged with provenance or cognitive ops', pass: 'hallucination-detection', changes: false, stream: stream([instr({ id: 'i1', op: 'infer', operands: [], scope: S, provenance: '00-aaaa'.padEnd(32, 'a') + '-' + 'bbbb'.padEnd(16, 'b') + '-01' }), instr({ id: 't1', op: 'think', operands: [], scope: S })], 1) },
  // P10 Goal Simplification
  { kind: 'pass-effect', id: 'P10a', description: 'P10 goal-simplification: splits a compound goal', pass: 'goal-simplification', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('refactor AND test', S)], scope: S }), instr({ id: 'x1', op: 'execute', operands: [], scope: S, depends: ['p1'] })], 1), assert: (a) => a.instructions.filter((i) => i.op === 'plan').length === 2 },
  { kind: 'pass-effect', id: 'P10b', description: 'P10 goal-simplification: splits a comma goal', pass: 'goal-simplification', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('ship, review', S)], scope: S })], 1), assert: (a) => a.instructions.filter((i) => i.op === 'plan').length === 2 },
  { kind: 'pass-effect', id: 'P10c', description: 'P10 goal-simplification: unchanged for atomic goals', pass: 'goal-simplification', changes: false, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('ship the release', S)], scope: S })], 1) },
  // P11 Architecture Validation
  { kind: 'pass-effect', id: 'P11a', description: 'P11 architecture: drops out-of-projection instructions', pass: 'architecture-validation', changes: true, stream: stream([instr({ id: 'a1', op: 'retrieve', operands: [], scope: S }), instr({ id: 'b1', op: 'status', operands: [], scope: 'ws:other' })], 1), ctx: PE_CTX, assert: (a) => a.instructions.map((i) => i.id).join(',') === 'a1' },
  { kind: 'pass-effect', id: 'P11b', description: 'P11 architecture: drops a second stray scope', pass: 'architecture-validation', changes: true, stream: stream([instr({ id: 'a1', op: 'think', operands: [], scope: S }), instr({ id: 'b1', op: 'think', operands: [], scope: S }), instr({ id: 'c1', op: 'think', operands: [], scope: 'ws:nope' })], 1), ctx: PE_CTX, assert: (a) => a.instructions.length === 2 },
  { kind: 'pass-effect', id: 'P11c', description: 'P11 architecture: unchanged when all in scope', pass: 'architecture-validation', changes: false, stream: stream([instr({ id: 'a1', op: 'think', operands: [], scope: S })], 1), ctx: PE_CTX },
  // P12 Task Fusion
  { kind: 'pass-effect', id: 'P12a', description: 'P12 task-fusion: fuses adjacent plans', pass: 'task-fusion', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('build', S)], scope: S }), instr({ id: 'p2', op: 'plan', operands: [query('deploy', S)], scope: S })], 1), assert: (a) => a.instructions.length === 1 && a.instructions[0]!.operands.some((o) => o.kind === 'composite') },
  { kind: 'pass-effect', id: 'P12b', description: 'P12 task-fusion: fuses a triple run', pass: 'task-fusion', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [], scope: S }), instr({ id: 'p2', op: 'plan', operands: [], scope: S }), instr({ id: 'p3', op: 'plan', operands: [], scope: S })], 1), assert: (a) => a.instructions.length === 1 },
  { kind: 'pass-effect', id: 'P12d', description: 'P12 task-fusion: rewires external dependents of fused plans', pass: 'task-fusion', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('build', S)], scope: S }), instr({ id: 'p2', op: 'plan', operands: [query('deploy', S)], scope: S }), instr({ id: 'x1', op: 'execute', operands: [], scope: S, depends: ['p2'] })], 1), assert: (a) => a.instructions.length === 2 && JSON.stringify(a.instructions[1]!.depends) === JSON.stringify(['p1']) && a.instructions[0]!.operands.some((o) => o.kind === 'composite') },
  { kind: 'pass-effect', id: 'P12c', description: 'P12 task-fusion: unchanged when plans not adjacent', pass: 'task-fusion', changes: false, stream: stream([instr({ id: 'p1', op: 'plan', operands: [], scope: S }), instr({ id: 'r1', op: 'retrieve', operands: [], scope: S }), instr({ id: 'p2', op: 'plan', operands: [], scope: S })], 1) },
  // P13 Skill Injection
  { kind: 'pass-effect', id: 'P13a', description: 'P13 skill-injection: binds a skill to plan', pass: 'skill-injection', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('plan-granular')) },
  { kind: 'pass-effect', id: 'P13b', description: 'P13 skill-injection: binds a skill to retrieve', pass: 'skill-injection', changes: true, stream: stream([instr({ id: 'r1', op: 'retrieve', operands: [], scope: S })], 1), ctx: { skillsFor: (op) => (op === 'retrieve' ? ['retrieval-rerank'] : []) }, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('retrieval-rerank')) },
  { kind: 'pass-effect', id: 'P13c', description: 'P13 skill-injection: unchanged without match', pass: 'skill-injection', changes: false, stream: stream([instr({ id: 't1', op: 'think', operands: [], scope: S })], 1), ctx: PE_CTX },
  // P14 Reasoning Depth
  { kind: 'pass-effect', id: 'P14a', description: 'P14 reasoning-depth: high stake gets depth 3', pass: 'reasoning-depth', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('migrate prod', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.deadline === 3 },
  { kind: 'pass-effect', id: 'P14b', description: 'P14 reasoning-depth: medium stake gets depth 2', pass: 'reasoning-depth', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('refactor', S)], scope: S })], 1), ctx: { stakeOf: () => 'medium' }, assert: (a) => a.instructions[0]!.deadline === 2 },
  { kind: 'pass-effect', id: 'P14c', description: 'P14 reasoning-depth: low stake unchanged', pass: 'reasoning-depth', changes: false, stream: stream([instr({ id: 'p1', op: 'plan', operands: [query('list', S)], scope: S })], 1), ctx: PE_CTX },
  // P15 Context Window Packing
  { kind: 'pass-effect', id: 'P15a', description: 'P15 context-window-packing: collapses whitespace', pass: 'context-window-packing', changes: true, stream: stream([instr({ id: 'r1', op: 'retrieve', operands: [query('a   very   wide   query', S)], scope: S })], 1), assert: (a) => (a.instructions[0]!.operands[0] as { text: string }).text === 'a very wide query' },
  { kind: 'pass-effect', id: 'P15b', description: 'P15 context-window-packing: trims edges', pass: 'context-window-packing', changes: true, stream: stream([instr({ id: 'r1', op: 'retrieve', operands: [query('  padded  ', S)], scope: S })], 1), assert: (a) => (a.instructions[0]!.operands[0] as { text: string }).text === 'padded' },
  { kind: 'pass-effect', id: 'P15c', description: 'P15 context-window-packing: unchanged when tight', pass: 'context-window-packing', changes: false, stream: stream([instr({ id: 'r1', op: 'retrieve', operands: [query('tight query', S)], scope: S })], 1) },
  // P16 Energy Optimization
  { kind: 'pass-effect', id: 'P16a', description: 'P16 energy-optimization: drops housekeeping under budget', pass: 'energy-optimization', changes: true, stream: stream([instr({ id: 's1', op: 'status', operands: [], scope: S }), instr({ id: 'p1', op: 'ping', operands: [], scope: S }), instr({ id: 't1', op: 'think', operands: [query('deep', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions.every((i) => i.id !== 's1') && a.instructions.some((i) => i.id === 't1') },
  { kind: 'pass-effect', id: 'P16b', description: 'P16 energy-optimization: drops list under a second budget', pass: 'energy-optimization', changes: true, stream: stream([instr({ id: 'l1', op: 'list', operands: [], scope: S }), instr({ id: 't1', op: 'think', operands: [], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions.map((i) => i.id).join(',') === 't1' },
  { kind: 'pass-effect', id: 'P16c', description: 'P16 energy-optimization: unchanged within budget', pass: 'energy-optimization', changes: false, stream: stream([instr({ id: 't1', op: 'think', operands: [], scope: S })], 1), ctx: PE_CTX },
  // P17 Trust Reweighting
  { kind: 'pass-effect', id: 'P17a', description: 'P17 trust-reweighting: flags a low-trust ref', pass: 'trust-reweighting', changes: true, stream: stream([instr({ id: 't1', op: 'think', operands: [ref('belief:rumor', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value) === JSON.stringify({ trust: 0.2, low_trust: true })) },
  { kind: 'pass-effect', id: 'P17b', description: 'P17 trust-reweighting: flags a second key', pass: 'trust-reweighting', changes: true, stream: stream([instr({ id: 'p1', op: 'plan', operands: [ref('belief:rumor', S)], scope: S })], 1), ctx: PE_CTX, assert: (a) => a.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('low_trust')) },
  { kind: 'pass-effect', id: 'P17c', description: 'P17 trust-reweighting: unchanged for high trust', pass: 'trust-reweighting', changes: false, stream: stream([instr({ id: 't1', op: 'think', operands: [ref('belief:proven', S)], scope: S })], 1), ctx: PE_CTX },
];

// ── Determinism cases ───────────────────────────────────────────────────────

const REPLAY_OK = { payload: { verdict: 'approved', confidence: 1 }, confidence: 1, latencyMs: 0 };

export const DETERMINISM_CASES: DeterminismCase[] = [
  {
    kind: 'determinism',
    id: 'DET-1',
    description: 'compiled cognitive stream executes with replay for the delegated evaluate',
    stream: stream([
      instr({ id: 'r1', op: 'retrieve', operands: [query('how does the kernel persist', S)], scope: S }),
      instr({ id: 'p1', op: 'plan', operands: [query('design the persistence layer', S)], scope: S, depends: ['r1'] }),
      instr({ id: 'x1', op: 'execute', operands: [literal({ action: 'pursue' }, S)], scope: S, depends: ['p1'] }),
      instr({ id: 'v1', op: 'evaluate', operands: [literal({ subject: 'persistence' }, S)], scope: S, depends: ['x1'] }),
      instr({ id: 'f1', op: 'reflect', operands: [query('persistence', S, 'none')], scope: S, depends: ['v1'] }),
    ]),
    options: { replayPayloads: new Map([['v1', REPLAY_OK]]) },
  },
  {
    kind: 'determinism',
    id: 'DET-2',
    description: 'perceptual + cognitive-only stream (fully deterministic subset, zero delegation)',
    stream: stream([
      instr({ id: 'o1', op: 'observe', operands: [literal({ event: 'file:saved' }, S)], scope: S }),
      instr({ id: 'r1', op: 'retrieve', operands: [query('related memories', S)], scope: S, depends: ['o1'] }),
      instr({ id: 't1', op: 'think', operands: [query('what changed', S)], scope: S, depends: ['r1'] }),
      instr({ id: 's1', op: 'status', operands: [], scope: S, depends: ['t1'] }),
    ]),
  },
  {
    kind: 'determinism',
    id: 'DET-3',
    description: 'gate-rejected stream (rejection record is deterministic too)',
    stream: stream([
      instr({ id: 'r1', op: 'retrieve', operands: [query('x', S)], scope: S }),
      instr({ id: 'i1', op: 'infer', operands: [], scope: S, depends: ['r1'] }),
    ]),
  },
  {
    kind: 'determinism',
    id: 'DET-4',
    description: 'delegated stream via configured delegator (payload fixed by the corpus)',
    stream: stream([
      instr({ id: 'e1', op: 'evaluate', operands: [literal({ subject: 'migration' }, S)], scope: S, provenance: '00-'.padEnd(34, 'a') + '01' }),
      instr({ id: 't1', op: 'think', operands: [query('aftermath', S)], scope: S, depends: ['e1'] }),
    ]),
    options: {
      delegators: new Map([['evaluate', { dispatch: () => ({ payload: { verdict: 'approved' }, confidence: 0.9, latencyMs: 1 }) }]]),
    },
  },
  {
    kind: 'determinism',
    id: 'DET-5',
    description: 'fused plans with an external dependent stay valid and deterministic through the pipeline',
    stream: stream([
      instr({ id: 'p1', op: 'plan', operands: [query('build the release', S)], scope: S }),
      instr({ id: 'p2', op: 'plan', operands: [query('deploy the release', S)], scope: S }),
      instr({ id: 'x1', op: 'execute', operands: [], scope: S, depends: ['p2'] }),
      instr({ id: 's1', op: 'status', operands: [], scope: S, depends: ['x1'] }),
    ]),
  },
];

// ── Energy cases (P16 budget compliance + exact cost accounting) ────────────

export const ENERGY_CASES: EnergyCase[] = [
  {
    kind: 'energy',
    id: 'EN-1',
    description: 'stream under budget executes with exact cost accounting',
    stream: stream([
      instr({ id: 'r1', op: 'retrieve', operands: [query('a', S)], scope: S }),
      instr({ id: 't1', op: 'think', operands: [query('b', S)], scope: S, depends: ['r1'] }),
      instr({ id: 'p1', op: 'ping', operands: [], scope: S, depends: ['t1'] }),
    ]),
    ctx: { energyBudget: 20 },
  },
  {
    kind: 'energy',
    id: 'EN-2',
    description: 'P16 drops housekeeping until the stream fits the budget',
    stream: stream([
      instr({ id: 's1', op: 'status', operands: [], scope: S }),
      instr({ id: 'l1', op: 'list', operands: [], scope: S }),
      instr({ id: 'p1', op: 'ping', operands: [], scope: S }),
      instr({ id: 't1', op: 'think', operands: [query('deep thought', S)], scope: S, depends: ['s1'] }),
    ]),
    ctx: { energyBudget: 6 },
  },
];

// ── Gate cases ──────────────────────────────────────────────────────────────

export const GATE_CASES: GateCase[] = [
  {
    kind: 'gate',
    id: 'GT-1',
    description: 'delegated instruction without provenance fails the constitutional gate',
    stream: stream([instr({ id: 'i1', op: 'infer', operands: [query('q', S)], scope: S })]),
    expectRejected: true,
    rejectionCode: 'GATE_FAILED',
  },
  {
    kind: 'gate',
    id: 'GT-2',
    description: 'replay substitution passes the constitutional gate deterministically',
    stream: stream([instr({ id: 'v1', op: 'evaluate', operands: [literal({ s: 1 }, S)], scope: S })]),
    options: { replayPayloads: new Map([['v1', REPLAY_OK]]) },
    expectRejected: false,
  },
  {
    kind: 'gate',
    id: 'GT-3',
    description: 'out-of-projection structural instruction is rejected',
    stream: stream([instr({ id: 't1', op: 'think', operands: [], scope: 'ws:other' })]),
    options: { scopeAllow: new Set([S]) },
    expectRejected: true,
    rejectionCode: 'GATE_FAILED',
  },
  {
    kind: 'gate',
    id: 'GT-4',
    description: 'verify:none never hits gates, even outside the projection',
    stream: stream([instr({ id: 's1', op: 'status', operands: [], scope: 'ws:anywhere', verify: 'none' })]),
    options: { scopeAllow: new Set([S]) },
    expectRejected: false,
  },
  {
    kind: 'gate',
    id: 'GT-5',
    description: 'no delegator configured yields not_configured rejection',
    stream: stream([instr({ id: 'i1', op: 'infer', operands: [], scope: S, provenance: '00-' + 'a'.repeat(32) + '-' + 'b'.repeat(16) + '-01' })]),
    expectRejected: true,
    rejectionCode: 'UNSUPPORTED_DELEGATION',
  },
  {
    kind: 'gate',
    id: 'GT-6',
    description: 'stream over the energy budget is rejected',
    stream: stream([
      instr({ id: 't1', op: 'think', operands: [], scope: S }),
      instr({ id: 't2', op: 'think', operands: [], scope: S, depends: ['t1'] }),
    ]),
    options: { energyBudget: 6 },
    expectRejected: true,
    rejectionCode: 'BUDGET_EXCEEDED',
  },
];

// ── Version gate cases (R5) ─────────────────────────────────────────────────

export const VERSION_GATE_CASES: VersionGateCase[] = [
  {
    kind: 'version-gate',
    id: 'VG-1',
    description: 'stream requiring CP ^2.0 is rejected by a CP 1.0 host',
    stream: stream([instr({ id: 's1', op: 'status', operands: [], scope: S })]),
    requiresCp: '^2.0',
    expectAccepted: false,
  },
  {
    kind: 'version-gate',
    id: 'VG-2',
    description: 'stream requiring CP ^1.1 is accepted by a CP 1.0 host',
    stream: stream([instr({ id: 's1', op: 'status', operands: [], scope: S })]),
    requiresCp: '^1.0',
    expectAccepted: true,
  },
  {
    kind: 'version-gate',
    id: 'VG-3',
    description: 'stream with an unparsable requires_cp is rejected',
    stream: stream([instr({ id: 's1', op: 'status', operands: [], scope: S })]),
    requiresCp: 'garbage',
    expectAccepted: false,
  },
];

// ── Negative controls ───────────────────────────────────────────────────────

export const NEGATIVE_CONTROL_CASES: NegativeControlCase[] = [
  {
    kind: 'negative-control',
    id: 'NC-1',
    description: 'canonical cognitive stream with no pass firing stays byte-identical',
    stream: stream([
      instr({ id: 't1', op: 'think', operands: [literal(1, S)], scope: S }),
      instr({ id: 'r1', op: 'retrieve', operands: [query('distinct query', S)], scope: S, depends: ['t1'] }),
    ]),
  },
  {
    kind: 'negative-control',
    id: 'NC-2',
    description: 'single-instruction stream stays byte-identical',
    stream: stream([instr({ id: 'p1', op: 'ping', operands: [], scope: S })]),
  },
  {
    kind: 'negative-control',
    id: 'NC-3',
    description: 'stream with provider context that has nothing to inject stays identical',
    stream: stream([instr({ id: 't1', op: 'think', operands: [], scope: S })]),
    ctx: PE_CTX,
  },
];

// ── Full corpus ─────────────────────────────────────────────────────────────

export const BENCHMARK_CORPUS: readonly CorpusCase[] = [
  ...PASS_EFFECT_CASES,
  ...DETERMINISM_CASES,
  ...ENERGY_CASES,
  ...GATE_CASES,
  ...VERSION_GATE_CASES,
  ...NEGATIVE_CONTROL_CASES,
];

export function corpusCaseCount(): number {
  return BENCHMARK_CORPUS.length;
}
