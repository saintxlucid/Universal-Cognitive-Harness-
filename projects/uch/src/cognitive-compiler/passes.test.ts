import { describe, expect, it } from 'vitest';
import {
  PASSES,
  PASS_ORDER,
  runPasses,
  type PassContext,
  type PassId,
  type PassResult,
} from './passes.js';
import {
  CIR_VERSION,
  buildInstruction,
  composite,
  literal,
  query,
  ref,
  streamEnergy,
  streamTokenEstimate,
  type CIRInstruction,
  type CIRStream,
  type Operand,
} from './cir.js';

function header(overrides: Partial<CIRStream['header']> = {}): CIRStream['header'] {
  return { cir: CIR_VERSION, requires_cp: '^1.0', compiled_by: 'passes-test', compiled_at_tick: 1, ...overrides };
}

function stream(instructions: CIRInstruction[]): CIRStream {
  return { header: header(), instructions };
}

function instr(partial: Omit<CIRInstruction, 'operands' | 'verify'> & { operands?: Operand[] }): CIRInstruction {
  return buildInstruction({
    id: partial.id,
    op: partial.op,
    operands: partial.operands ?? [],
    scope: partial.scope,
    ...(partial.depends ? { depends: partial.depends } : {}),
    ...(partial.provenance ? { provenance: partial.provenance } : {}),
    ...(partial.deadline !== undefined ? { deadline: partial.deadline } : {}),
  });
}

function runPass(pass: PassId, input: CIRStream, ctx: PassContext = {}): PassResult {
  const spec = PASSES.find((p) => p.id === pass);
  expect(spec).toBeDefined();
  return spec!.run(input, ctx);
}

describe('CIR optimizer: all 17 passes', () => {
  it('registers all 17 passes in the normative fixed order', () => {
    expect(PASS_ORDER).toEqual([
      'normalize', 'deduplicate', 'inject-context', 'memory-entropy-reduction',
      'contradiction-elimination', 'context-compression', 'knowledge-promotion',
      'evidence-verification', 'hallucination-detection', 'goal-simplification',
      'architecture-validation', 'task-fusion', 'skill-injection',
      'reasoning-depth', 'context-window-packing', 'energy-optimization',
      'trust-reweighting',
    ]);
  });

  // ── P1 Normalize ─────────────────────────────────────────────────────────

  it('P1 normalize: reorders operands into canonical form', () => {
    const input = stream([instr({ id: 'a', op: 'think', operands: [literal(2, 's'), ref('k:1', 's'), literal(1, 's')], scope: 's' })]);
    const { stream: out, report } = runPass('normalize', input);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.map((o) => JSON.stringify(o))).toEqual(
      [literal(1, 's'), literal(2, 's'), ref('k:1', 's')].map((o) => JSON.stringify(o)),
    );
  });

  it('P1 normalize: dedupes and sorts depends', () => {
    const input = stream([
      instr({ id: 'a', op: 'plan', operands: [], scope: 's', depends: ['b', 'a', 'b'] }),
      instr({ id: 'b', op: 'retrieve', operands: [], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('normalize', input);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.depends).toEqual(['a', 'b']);
  });

  it('P1 normalize: leaves canonical streams unchanged', () => {
    const input = stream([instr({ id: 'a', op: 'think', operands: [literal(1, 's')], scope: 's' })]);
    const { stream: out, report } = runPass('normalize', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P2 Deduplicate ───────────────────────────────────────────────────────

  it('P2 deduplicate: merges identical instructions and rewires depends', () => {
    const input = stream([
      instr({ id: 'r1', op: 'retrieve', operands: [query('same', 's')], scope: 's' }),
      instr({ id: 'r2', op: 'retrieve', operands: [query('same', 's')], scope: 's' }),
      instr({ id: 't1', op: 'think', operands: [], scope: 's', depends: ['r2'] }),
    ]);
    const { stream: out, report } = runPass('deduplicate', input);
    expect(report.changed).toBe(true);
    expect(out.instructions.map((i) => i.id)).toEqual(['r1', 't1']);
    expect(out.instructions[1]!.depends).toEqual(['r1']);
  });

  it('P2 deduplicate: merges a second identical triple', () => {
    const input = stream([
      instr({ id: 'x1', op: 'status', operands: [literal({ x: 1 }, 's')], scope: 's' }),
      instr({ id: 'x2', op: 'status', operands: [literal({ x: 1 }, 's')], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('deduplicate', input);
    expect(report.changed).toBe(true);
    expect(out.instructions).toHaveLength(1);
  });

  it('P2 deduplicate: leaves distinct instructions unchanged', () => {
    const input = stream([
      instr({ id: 'r1', op: 'retrieve', operands: [query('one', 's')], scope: 's' }),
      instr({ id: 'r2', op: 'retrieve', operands: [query('two', 's')], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('deduplicate', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P3 Inject Context ────────────────────────────────────────────────────

  it('P3 inject-context: attaches verified memory operands to queries', () => {
    const input = stream([instr({ id: 'r1', op: 'retrieve', operands: [query('how to persist', 's')], scope: 's' })]);
    const ctx: PassContext = {
      provideVerified: () => [literal({ fact: 'use .uccp/persist' }, 's')],
    };
    const { stream: out, report } = runPass('inject-context', input, ctx);
    expect(report.changed).toBe(true);
    const operandKinds = out.instructions[0]!.operands.map((o) => o.kind);
    expect(operandKinds).toContain('literal');
  });

  it('P3 inject-context: injects a second different memory payload', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [query('migrate', 's')], scope: 's' })]);
    const ctx: PassContext = { provideVerified: () => [ref('memory:verified', 's')] };
    const { stream: out, report } = runPass('inject-context', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'ref' && o.key === 'memory:verified')).toBe(true);
  });

  it('P3 inject-context: unchanged when no provider or nothing to inject', () => {
    const input = stream([instr({ id: 'a', op: 'think', operands: [], scope: 's' })]);
    const { stream: out, report } = runPass('inject-context', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);

    const empty = runPass('inject-context', input, { provideVerified: () => [] });
    expect(empty.report.changed).toBe(false);
  });

  // ── P4 Memory Entropy Reduction ──────────────────────────────────────────

  it('P4 memory-entropy-reduction: collapses redundant retrievals to one source', () => {
    const input = stream([
      instr({ id: 'r1', op: 'retrieve', operands: [query('the gateway', 's')], scope: 's' }),
      instr({ id: 'r2', op: 'retrieve', operands: [query('THE GATEWAY ', 's')], scope: 's' }),
      instr({ id: 't1', op: 'think', operands: [], scope: 's', depends: ['r2'] }),
    ]);
    const { stream: out, report } = runPass('memory-entropy-reduction', input);
    expect(report.changed).toBe(true);
    expect(out.instructions.map((i) => i.id)).toEqual(['r1', 't1']);
    expect(out.instructions[1]!.depends).toEqual(['r1']);
  });

  it('P4 memory-entropy-reduction: collapses a second redundant pair', () => {
    const input = stream([
      instr({ id: 'a', op: 'retrieve', operands: [query('ledger', 's')], scope: 's' }),
      instr({ id: 'b', op: 'retrieve', operands: [query(' ledger', 's')], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('memory-entropy-reduction', input);
    expect(report.changed).toBe(true);
    expect(out.instructions).toHaveLength(1);
  });

  it('P4 memory-entropy-reduction: unchanged when retrievals differ', () => {
    const input = stream([
      instr({ id: 'r1', op: 'retrieve', operands: [query('alpha', 's')], scope: 's' }),
      instr({ id: 'r2', op: 'retrieve', operands: [query('beta', 's')], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('memory-entropy-reduction', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P5 Contradiction Elimination ─────────────────────────────────────────

  it('P5 contradiction-elimination: quarantines conflicting beliefs', () => {
    const input = stream([instr({ id: 't1', op: 'think', operands: [ref('belief:hot', 's')], scope: 's' })]);
    const ctx: PassContext = { contradictions: (key) => key === 'belief:hot' };
    const { stream: out, report } = runPass('contradiction-elimination', input, ctx);
    expect(report.changed).toBe(true);
    const operand = out.instructions[0]!.operands[0]!;
    expect(operand.kind).toBe('literal');
    if (operand.kind === 'literal') {
      expect(operand.value).toEqual({ quarantined: true, key: 'belief:hot' });
    }
  });

  it('P5 contradiction-elimination: quarantines a second conflicting key', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [ref('graph:stale', 's')], scope: 's' })]);
    const ctx: PassContext = { contradictions: (key) => key === 'graph:stale' };
    const { stream: out, report } = runPass('contradiction-elimination', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands[0]).toEqual({ kind: 'literal', value: { quarantined: true, key: 'graph:stale' } });
  });

  it('P5 contradiction-elimination: unchanged without a contradictions provider', () => {
    const input = stream([instr({ id: 'a', op: 'think', operands: [ref('belief:hot', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('contradiction-elimination', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P6 Context Compression ───────────────────────────────────────────────

  it('P6 context-compression: merges multiple literals into one context object', () => {
    const input = stream([
      instr({ id: 'x1', op: 'execute', operands: [literal({ a: 1 }, 's'), literal({ b: 2 }, 's')], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('context-compression', input);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.filter((o) => o.kind === 'literal')).toHaveLength(1);
    const merged = out.instructions[0]!.operands.find((o) => o.kind === 'literal');
    if (merged?.kind === 'literal') expect(merged.value).toEqual({ a: 1, b: 2 });
  });

  it('P6 context-compression: merges a second literal pair', () => {
    const input = stream([
      instr({ id: 't1', op: 'think', operands: [literal({ x: 'left' }, 's'), literal({ y: 'right' }, 's')], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('context-compression', input);
    expect(report.changed).toBe(true);
    const merged = out.instructions[0]!.operands.find((o) => o.kind === 'literal');
    if (merged?.kind === 'literal') expect(merged.value).toEqual({ x: 'left', y: 'right' });
  });

  it('P6 context-compression: unchanged with fewer than two literals', () => {
    const input = stream([instr({ id: 'a', op: 'think', operands: [literal(1, 's'), query('q', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('context-compression', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P7 Knowledge Promotion ───────────────────────────────────────────────

  it('P7 knowledge-promotion: promotes verified facts into operands', () => {
    const input = stream([instr({ id: 't1', op: 'think', operands: [ref('belief:gravity', 's')], scope: 's' })]);
    const ctx: PassContext = { verifiedFacts: (key) => (key === 'belief:gravity' ? { g: 9.81 } : undefined) };
    const { stream: out, report } = runPass('knowledge-promotion', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value) === JSON.stringify({ verified_fact: { g: 9.81 } }))).toBe(true);
  });

  it('P7 knowledge-promotion: promotes a second verified key', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [ref('knowledge:api', 's')], scope: 's' })]);
    const ctx: PassContext = { verifiedFacts: (key) => (key === 'knowledge:api' ? { endpoint: '/v1' } : undefined) };
    const { stream: out, report } = runPass('knowledge-promotion', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value) === JSON.stringify({ verified_fact: { endpoint: '/v1' } }))).toBe(true);
  });

  it('P7 knowledge-promotion: unchanged without a verified-facts provider', () => {
    const input = stream([instr({ id: 'a', op: 'think', operands: [ref('belief:x', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('knowledge-promotion', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P8 Evidence Verification ─────────────────────────────────────────────

  it('P8 evidence-verification: flags refs with no evidence chain', () => {
    const input = stream([instr({ id: 't1', op: 'think', operands: [ref('belief:unverified', 's')], scope: 's' })]);
    const ctx: PassContext = { evidenceChain: () => 0 };
    const { stream: out, report } = runPass('evidence-verification', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('evidence_gap'))).toBe(true);
  });

  it('P8 evidence-verification: flags a second gap', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [ref('memory:raw', 's')], scope: 's' })]);
    const ctx: PassContext = { evidenceChain: () => 0 };
    const { stream: out, report } = runPass('evidence-verification', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('evidence_gap'))).toBe(true);
  });

  it('P8 evidence-verification: unchanged when every ref has an evidence chain', () => {
    const input = stream([instr({ id: 'a', op: 'think', operands: [ref('belief:proven', 's')], scope: 's' })]);
    const ctx: PassContext = { evidenceChain: () => 3 };
    const { stream: out, report } = runPass('evidence-verification', input, ctx);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P9 Hallucination Detection ───────────────────────────────────────────

  it('P9 hallucination-detection: flags delegated instructions without provenance', () => {
    const input = stream([instr({ id: 'i1', op: 'infer', operands: [query('conclusion', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('hallucination-detection', input);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('hallucination_risk'))).toBe(true);
  });

  it('P9 hallucination-detection: flags a second delegated op without provenance', () => {
    const input = stream([instr({ id: 'c1', op: 'critique', operands: [], scope: 's' })]);
    const { stream: out, report } = runPass('hallucination-detection', input);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('hallucination_risk'))).toBe(true);
  });

  it('P9 hallucination-detection: unchanged for provenance-carrying or cognitive ops', () => {
    const input = stream([
      instr({ id: 'i1', op: 'infer', operands: [], scope: 's', provenance: '00-abcdefabcdefabcdefabcdefabcdefab-0123456789abcdef-01' }),
      instr({ id: 't1', op: 'think', operands: [], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('hallucination-detection', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P10 Goal Simplification ──────────────────────────────────────────────

  it('P10 goal-simplification: splits compound goals into primitives', () => {
    const input = stream([
      instr({ id: 'p1', op: 'plan', operands: [query('refactor AND test', 's')], scope: 's' }),
      instr({ id: 'x1', op: 'execute', operands: [], scope: 's', depends: ['p1'] }),
    ]);
    const { stream: out, report } = runPass('goal-simplification', input);
    expect(report.changed).toBe(true);
    const plans = out.instructions.filter((i) => i.op === 'plan');
    expect(plans).toHaveLength(2);
    expect(plans.map((p) => (p.operands[0]!.kind === 'query' ? p.operands[0]!.text : ''))).toEqual(['refactor', 'test']);
    expect(out.instructions.find((i) => i.id === 'x1')!.depends).toEqual(['p1.g1']);
  });

  it('P10 goal-simplification: splits a comma-separated goal', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [query('ship, review', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('goal-simplification', input);
    expect(report.changed).toBe(true);
    expect(out.instructions.filter((i) => i.op === 'plan')).toHaveLength(2);
  });

  it('P10 goal-simplification: unchanged for atomic goals', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [query('ship the release', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('goal-simplification', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P11 Architecture Validation ──────────────────────────────────────────

  it('P11 architecture-validation: rejects instructions outside the projection scope', () => {
    const input = stream([
      instr({ id: 'a1', op: 'retrieve', operands: [], scope: 'ws:acme' }),
      instr({ id: 'b1', op: 'status', operands: [], scope: 'ws:other' }),
    ]);
    const ctx: PassContext = { allowScopes: new Set(['ws:acme']) };
    const { stream: out, report } = runPass('architecture-validation', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions.map((i) => i.id)).toEqual(['a1']);
  });

  it('P11 architecture-validation: drops a second out-of-scope instruction', () => {
    const input = stream([
      instr({ id: 'a1', op: 'think', operands: [], scope: 'ws:acme' }),
      instr({ id: 'b1', op: 'think', operands: [], scope: 'ws:acme' }),
      instr({ id: 'c1', op: 'think', operands: [], scope: 'ws:nope' }),
    ]);
    const ctx: PassContext = { allowScopes: new Set(['ws:acme']) };
    const { stream: out, report } = runPass('architecture-validation', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions.map((i) => i.id)).toEqual(['a1', 'b1']);
  });

  it('P11 architecture-validation: unchanged when everything is in scope', () => {
    const input = stream([instr({ id: 'a1', op: 'think', operands: [], scope: 'ws:acme' })]);
    const ctx: PassContext = { allowScopes: new Set(['ws:acme']) };
    const { stream: out, report } = runPass('architecture-validation', input, ctx);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P12 Task Fusion ──────────────────────────────────────────────────────

  it('P12 task-fusion: fuses adjacent plans into a composite instruction', () => {
    const input = stream([
      instr({ id: 'p1', op: 'plan', operands: [query('build', 's')], scope: 's' }),
      instr({ id: 'p2', op: 'plan', operands: [query('deploy', 's')], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('task-fusion', input);
    expect(report.changed).toBe(true);
    expect(out.instructions).toHaveLength(1);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'composite')).toBe(true);
  });

  it('P12 task-fusion: fuses a second adjacent plan run', () => {
    const input = stream([
      instr({ id: 'p1', op: 'plan', operands: [], scope: 's' }),
      instr({ id: 'p2', op: 'plan', operands: [], scope: 's' }),
      instr({ id: 'p3', op: 'plan', operands: [], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('task-fusion', input);
    expect(report.changed).toBe(true);
    expect(out.instructions).toHaveLength(1);
    const compositeOperand = out.instructions[0]!.operands.find((o) => o.kind === 'composite');
    if (compositeOperand?.kind === 'composite') {
      expect(compositeOperand.stream.instructions).toHaveLength(3);
    }
  });

  it('P12 task-fusion: unchanged when plans are not adjacent', () => {
    const input = stream([
      instr({ id: 'p1', op: 'plan', operands: [], scope: 's' }),
      instr({ id: 'r1', op: 'retrieve', operands: [], scope: 's' }),
      instr({ id: 'p2', op: 'plan', operands: [], scope: 's' }),
    ]);
    const { stream: out, report } = runPass('task-fusion', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P13 Skill Injection ──────────────────────────────────────────────────

  it('P13 skill-injection: binds proven skills to matching instructions', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [], scope: 's' })]);
    const ctx: PassContext = { skillsFor: (op) => (op === 'plan' ? ['plan-granular'] : []) };
    const { stream: out, report } = runPass('skill-injection', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('plan-granular'))).toBe(true);
  });

  it('P13 skill-injection: binds skills for a second op', () => {
    const input = stream([instr({ id: 'r1', op: 'retrieve', operands: [], scope: 's' })]);
    const ctx: PassContext = { skillsFor: (op) => (op === 'retrieve' ? ['retrieval-rerank'] : []) };
    const { stream: out, report } = runPass('skill-injection', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('retrieval-rerank'))).toBe(true);
  });

  it('P13 skill-injection: unchanged without a skills provider or match', () => {
    const input = stream([instr({ id: 'a', op: 'think', operands: [], scope: 's' })]);
    const { stream: out, report } = runPass('skill-injection', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
    const noMatch = runPass('skill-injection', input, { skillsFor: () => [] });
    expect(noMatch.report.changed).toBe(false);
  });

  // ── P14 Reasoning Depth ──────────────────────────────────────────────────

  it('P14 reasoning-depth: allocates depth by stake', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [query('migrate prod', 's')], scope: 's' })]);
    const ctx: PassContext = { stakeOf: () => 'high' };
    const { stream: out, report } = runPass('reasoning-depth', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.deadline).toBe(3);
  });

  it('P14 reasoning-depth: medium stake gets depth 2', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [query('refactor', 's')], scope: 's' })]);
    const ctx: PassContext = { stakeOf: () => 'medium' };
    const { stream: out, report } = runPass('reasoning-depth', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.deadline).toBe(2);
  });

  it('P14 reasoning-depth: unchanged for low-stake plans', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [query('list', 's')], scope: 's' })]);
    const ctx: PassContext = { stakeOf: () => 'low' };
    const { stream: out, report } = runPass('reasoning-depth', input, ctx);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P15 Context Window Packing ───────────────────────────────────────────

  it('P15 context-window-packing: collapses whitespace in query text', () => {
    const input = stream([instr({ id: 'r1', op: 'retrieve', operands: [query('a   very   wide   query', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('context-window-packing', input);
    expect(report.changed).toBe(true);
    const q = out.instructions[0]!.operands[0]!;
    if (q.kind === 'query') expect(q.text).toBe('a very wide query');
  });

  it('P15 context-window-packing: trims leading and trailing space', () => {
    const input = stream([instr({ id: 'r1', op: 'retrieve', operands: [query('  padded  ', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('context-window-packing', input);
    expect(report.changed).toBe(true);
    const q = out.instructions[0]!.operands[0]!;
    if (q.kind === 'query') expect(q.text).toBe('padded');
  });

  it('P15 context-window-packing: unchanged for already-tight text', () => {
    const input = stream([instr({ id: 'r1', op: 'retrieve', operands: [query('tight query', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('context-window-packing', input);
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
  });

  // ── P16 Energy Optimization ──────────────────────────────────────────────

  it('P16 energy-optimization: drops housekeeping instructions to meet budget', () => {
    const input = stream([
      instr({ id: 's1', op: 'status', operands: [], scope: 's' }),
      instr({ id: 'p1', op: 'ping', operands: [], scope: 's' }),
      instr({ id: 't1', op: 'think', operands: [query('deep', 's')], scope: 's' }),
    ]);
    const ctx: PassContext = { energyBudget: 6 };
    const { stream: out, report } = runPass('energy-optimization', input, ctx);
    expect(report.changed).toBe(true);
    expect(streamEnergy(out)).toBeLessThanOrEqual(6);
    expect(out.instructions.some((i) => i.id === 't1')).toBe(true);
  });

  it('P16 energy-optimization: drops housekeeping below a second budget', () => {
    const input = stream([
      instr({ id: 'l1', op: 'list', operands: [], scope: 's' }),
      instr({ id: 't1', op: 'think', operands: [], scope: 's' }),
    ]);
    const ctx: PassContext = { energyBudget: 6 };
    const { stream: out, report } = runPass('energy-optimization', input, ctx);
    expect(report.changed).toBe(true);
    expect(streamEnergy(out)).toBe(6);
  });

  it('P16 energy-optimization: unchanged when within budget or no budget set', () => {
    const input = stream([instr({ id: 't1', op: 'think', operands: [], scope: 's' })]);
    const { stream: out, report } = runPass('energy-optimization', input, { energyBudget: 6 });
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
    const noBudget = runPass('energy-optimization', input);
    expect(noBudget.report.changed).toBe(false);
  });

  // ── P17 Trust Reweighting ────────────────────────────────────────────────

  it('P17 trust-reweighting: scales authority of low-trust operands', () => {
    const input = stream([instr({ id: 't1', op: 'think', operands: [ref('belief:rumor', 's')], scope: 's' })]);
    const ctx: PassContext = { trustOf: (key) => (key === 'belief:rumor' ? 0.2 : 1) };
    const { stream: out, report } = runPass('trust-reweighting', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value) === JSON.stringify({ trust: 0.2, low_trust: true }))).toBe(true);
  });

  it('P17 trust-reweighting: flags a second low-trust key', () => {
    const input = stream([instr({ id: 'p1', op: 'plan', operands: [ref('graph:hearsay', 's')], scope: 's' })]);
    const ctx: PassContext = { trustOf: () => 0.1 };
    const { stream: out, report } = runPass('trust-reweighting', input, ctx);
    expect(report.changed).toBe(true);
    expect(out.instructions[0]!.operands.some((o) => o.kind === 'literal' && JSON.stringify(o.value).includes('low_trust'))).toBe(true);
  });

  it('P17 trust-reweighting: unchanged for high-trust operands or no provider', () => {
    const input = stream([instr({ id: 't1', op: 'think', operands: [ref('belief:proven', 's')], scope: 's' })]);
    const { stream: out, report } = runPass('trust-reweighting', input, { trustOf: () => 0.9 });
    expect(report.changed).toBe(false);
    expect(out).toEqual(input);
    const noProvider = runPass('trust-reweighting', input);
    expect(noProvider.report.changed).toBe(false);
  });

  // ── Pipeline behavior ────────────────────────────────────────────────────

  it('runs the full pipeline deterministically — identical inputs yield identical streams and reports', () => {
    const input = stream([
      instr({ id: 'r1', op: 'retrieve', operands: [query('  the   gateway  ', 's')], scope: 's' }),
      instr({ id: 'r2', op: 'retrieve', operands: [query('the gateway', 's')], scope: 's' }),
      instr({ id: 'p1', op: 'plan', operands: [query('refactor AND deploy', 's')], scope: 's', depends: ['r1'] }),
      instr({ id: 'x1', op: 'execute', operands: [literal({ action: 'go' }, 's')], scope: 's', depends: ['p1'] }),
      instr({ id: 'i1', op: 'infer', operands: [query('conclude', 's')], scope: 's', depends: ['x1'] }),
    ]);
    const ctx: PassContext = {
      allowScopes: new Set(['s']),
      energyBudget: 100,
      stakeOf: () => 'high',
      contradictions: () => false,
      evidenceChain: () => 2,
      verifiedFacts: () => undefined,
      skillsFor: () => [],
      trustOf: () => 1,
      provideVerified: () => [],
    };
    const a = runPasses(input, ctx);
    const b = runPasses(input, ctx);
    expect(JSON.stringify(a.stream)).toBe(JSON.stringify(b.stream));
    expect(a.reports).toEqual(b.reports);
    expect(a.reports.length).toBeGreaterThanOrEqual(PASS_ORDER.length);
    const order = a.reports.map((r) => r.pass);
    const firstOccurrence = PASS_ORDER.map((p) => order.indexOf(p));
    expect(firstOccurrence).toEqual([...firstOccurrence].sort((x, y) => x - y));
    for (const report of a.reports) {
      expect(report.energyDelta).toBeTypeOf('number');
      expect(report.tokenDelta).toBeTypeOf('number');
    }
  });

  it('peephole passes iterate until fixpoint but never loop past 4 iterations', () => {
    let iterations = 0;
    const ctx: PassContext = {
      provideVerified: () => {
        iterations += 1;
        return [literal({ injected: iterations }, 's')];
      },
    };
    const input = stream([instr({ id: 'r1', op: 'retrieve', operands: [query('q', 's')], scope: 's' })]);
    const result = runPasses(input, ctx);
    const packingReports = result.reports.filter((r) => r.pass === 'context-window-packing');
    expect(packingReports.length).toBeLessThanOrEqual(5);
  });

  it('reports energy and token deltas across the pipeline', () => {
    const input = stream([
      instr({ id: 's1', op: 'status', operands: [], scope: 's' }),
      instr({ id: 'p1', op: 'plan', operands: [query('  build   it  ', 's')], scope: 's' }),
    ]);
    const result = runPasses(input, { energyBudget: 3 });
    expect(result.energyAfter).toBeLessThanOrEqual(result.energyBefore);
    expect(result.tokenAfter).toBeLessThanOrEqual(result.tokenBefore);
  });

  it('negative control: streams with no pass firing stay byte-identical', () => {
    const input = stream([
      instr({ id: 'a1', op: 'think', operands: [literal(1, 's')], scope: 's' }),
      instr({ id: 'a2', op: 'retrieve', operands: [query('distinct', 's')], scope: 's' }),
    ]);
    const before = JSON.stringify(input);
    const result = runPasses(input);
    expect(JSON.stringify(result.stream)).toBe(before);
    expect(result.reports.every((r) => !r.changed)).toBe(true);
  });

  it('composite operands survive the pipeline intact', () => {
    const inner = stream([instr({ id: 'inner', op: 'retrieve', operands: [query('nested', 's')], scope: 's' })]);
    const input = stream([
      instr({
        id: 'outer',
        op: 'plan',
        operands: [composite(inner, 's')],
        scope: 's',
      }),
    ]);
    const result = runPasses(input);
    const outer = result.stream.instructions[0]!;
    const comp = outer.operands.find((o) => o.kind === 'composite');
    expect(comp?.kind).toBe('composite');
    if (comp?.kind === 'composite') {
      expect(comp.stream.instructions[0]!.id).toBe('inner');
    }
    expect(streamTokenEstimate(result.stream)).toBeGreaterThan(0);
  });
});
