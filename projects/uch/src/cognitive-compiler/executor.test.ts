import { describe, expect, it } from 'vitest';
import {
  CIR_EXECUTOR_VERSION,
  executePipeline,
  executeStream,
  gateFor,
  streamIdOf,
  traceparentOf,
  type CIRTraceEvent,
  type Delegator,
} from './executor.js';
import { buildInstruction, literal, query, type CIRInstruction, type CIRStream } from './cir.js';
import { compileGoal, compileIntent } from './frontend.js';

function streamOf(instructions: CIRInstruction[], tick = 1): CIRStream {
  return {
    header: { cir: '1.0.0', requires_cp: '^1.0', compiled_by: 'executor-test', compiled_at_tick: tick },
    instructions,
  };
}

function instr(partial: Partial<CIRInstruction> & { id: string; op: CIRInstruction['op'] }): CIRInstruction {
  return buildInstruction({
    id: partial.id,
    op: partial.op,
    operands: partial.operands ?? [],
    scope: partial.scope ?? 'ws:acme',
    ...(partial.depends ? { depends: partial.depends } : {}),
    ...(partial.provenance ? { provenance: partial.provenance } : {}),
    ...(partial.deadline !== undefined ? { deadline: partial.deadline } : {}),
    ...(partial.verify ? { verify: partial.verify } : {}),
  });
}

const TRACEPARENT = '00-abcdefabcdefabcdefabcdefabcdefab-0123456789abcdef-01';

describe('CIR executor', () => {
  it('executes a cognitive stream deterministically — byte-identical records', async () => {
    const stream = streamOf([
      instr({ id: 'r1', op: 'retrieve', operands: [query('how to persist', 'ws:acme')] }),
      instr({ id: 't1', op: 'think', operands: [query('persistence', 'ws:acme')], depends: ['r1'] }),
      instr({ id: 's1', op: 'status', operands: [], depends: ['t1'] }),
    ]);
    const a = await executeStream(stream);
    const b = await executeStream(stream);
    expect(a.accepted).toBe(true);
    expect(b.accepted).toBe(true);
    if (a.accepted && b.accepted) {
      expect(JSON.stringify(a.record)).toBe(JSON.stringify(b.record));
      expect(a.record.streamId).toBe(b.record.streamId);
      expect(a.record.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    }
  });

  it('runs instructions in dependency order', async () => {
    const stream = streamOf([
      instr({ id: 'x1', op: 'execute', operands: [literal({ step: 'first' }, 's')], scope: 's' }),
      instr({ id: 't1', op: 'think', operands: [query('depends on x', 's')], scope: 's', depends: ['x1'] }),
      instr({ id: 'r1', op: 'retrieve', operands: [], scope: 's', depends: ['t1'] }),
    ]);
    const verdict = await executeStream(stream);
    expect(verdict.accepted).toBe(true);
    if (verdict.accepted) {
      expect(verdict.record.outcomes.map((o) => o.id)).toEqual(['x1', 't1', 'r1']);
      expect(verdict.record.ticksUsed).toBe(3);
    }
  });

  it('accounts energy as the sum of executed instruction costs', async () => {
    const stream = streamOf([
      instr({ id: 'r1', op: 'retrieve', operands: [], scope: 's' }),
      instr({ id: 't1', op: 'think', operands: [], scope: 's', depends: ['r1'] }),
    ]);
    const verdict = await executeStream(stream);
    expect(verdict.accepted).toBe(true);
    if (verdict.accepted) {
      expect(verdict.record.energySpent).toBe(1 + 6);
      expect(verdict.record.outcomes.reduce((sum, o) => sum + o.energy, 0)).toBe(7);
    }
  });

  it('rejects out-of-projection instructions at the structural gate', async () => {
    const stream = streamOf([instr({ id: 't1', op: 'think', operands: [], scope: 'ws:other' })]);
    const verdict = await executeStream(stream, { scopeAllow: new Set(['ws:acme']) });
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.rejection.code).toBe('GATE_FAILED');
      expect(verdict.rejection.instructionId).toBe('t1');
      expect(verdict.rejection.reason).toContain('outside projection');
    }
  });

  it('aborts the whole stream when a constitutional gate fails', async () => {
    const stream = streamOf([
      instr({ id: 'r1', op: 'retrieve', operands: [], scope: 's' }),
      instr({ id: 'i1', op: 'infer', operands: [], scope: 's', depends: ['r1'] }),
      instr({ id: 't1', op: 'think', operands: [], scope: 's', depends: ['i1'] }),
    ]);
    const verdict = await executeStream(stream);
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.rejection.code).toBe('GATE_FAILED');
      expect(verdict.rejection.instructionId).toBe('i1');
      expect(verdict.rejection.reason).toContain('provenance');
    }
  });

  it('honors a pluggable constitutional gate', async () => {
    const stream = streamOf([instr({ id: 'i1', op: 'infer', operands: [], scope: 's', provenance: TRACEPARENT })]);
    const verdict = await executeStream(stream, {
      delegators: new Map([['infer', { dispatch: () => ({ payload: { ok: true }, confidence: 0.9, latencyMs: 0 }) }]]),
      constitutionalGate: () => ({ pass: false, reason: 'policy says no' }),
    });
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) expect(verdict.rejection.reason).toBe('policy says no');
  });

  it('lets verify:none instructions execute without gates', async () => {
    const stream = streamOf([instr({ id: 's1', op: 'status', operands: [], scope: 'anywhere', verify: 'none' })]);
    const verdict = await executeStream(stream, { scopeAllow: new Set(['ws:acme']) });
    expect(verdict.accepted).toBe(true);
    if (verdict.accepted) {
      expect(verdict.record.outcomes[0]!.outcome).toBe('executed');
      expect(verdict.record.events.some((e) => e.type === 'cir:gate' && e.payload.pass === false)).toBe(false);
    }
  });

  it('rejects delegated ops with no delegator (not_configured)', async () => {
    const stream = streamOf([instr({ id: 'i1', op: 'infer', operands: [], scope: 's', provenance: TRACEPARENT })]);
    const verdict = await executeStream(stream);
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.rejection.code).toBe('UNSUPPORTED_DELEGATION');
      expect(verdict.rejection.reason).toContain('not_configured');
    }
  });

  it('dispatches delegated ops through configured delegators', async () => {
    const calls: string[] = [];
    const delegator: Delegator = {
      dispatch: (i) => {
        calls.push(i.id);
        return { payload: { verdict: 'approved' }, confidence: 0.8, latencyMs: 5, traceparent: TRACEPARENT };
      },
    };
    const stream = streamOf([instr({ id: 'e1', op: 'evaluate', operands: [literal({ subject: 'migration' }, 's')], scope: 's', provenance: TRACEPARENT })]);
    const verdict = await executeStream(stream, { delegators: new Map([['evaluate', delegator]]) });
    expect(verdict.accepted).toBe(true);
    if (verdict.accepted) {
      expect(calls).toEqual(['e1']);
      expect(verdict.record.outcomes[0]!.outcome).toBe('delegated');
      expect(verdict.record.outcomes[0]!.result).toEqual({ verdict: 'approved' });
      expect(verdict.record.events.some((e) => e.type === 'cir:delegated' && e.payload.profile === 'default')).toBe(true);
    }
  });

  it('substitutes recorded payloads in replay mode (ADR-002), no delegator needed', async () => {
    const stream = streamOf([instr({ id: 'i1', op: 'infer', operands: [query('same question', 's')], scope: 's', provenance: TRACEPARENT })]);
    const replay = { payload: { replay: true, answer: 42 }, confidence: 1, latencyMs: 0 };
    const a = await executeStream(stream, { replayPayloads: new Map([['i1', replay]]) });
    const b = await executeStream(stream, { replayPayloads: new Map([['i1', replay]]) });
    expect(a.accepted).toBe(true);
    if (a.accepted && b.accepted) {
      expect(a.record.outcomes[0]!.outcome).toBe('substituted');
      expect(a.record.outcomes[0]!.result).toEqual({ replay: true, answer: 42 });
      expect(JSON.stringify(a.record.events)).toBe(JSON.stringify(b.record.events));
    }
  });

  it('rejects streams over the energy budget', async () => {
    const stream = streamOf([
      instr({ id: 't1', op: 'think', operands: [], scope: 's' }),
      instr({ id: 't2', op: 'think', operands: [], scope: 's', depends: ['t1'] }),
    ]);
    const verdict = await executeStream(stream, { energyBudget: 6 });
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.rejection.code).toBe('BUDGET_EXCEEDED');
      expect(verdict.rejection.reason).toContain('12 exceeds budget 6');
    }
  });

  it('rejects streams whose requires_cp is unsatisfied (R5)', async () => {
    const bad = streamOf([instr({ id: 's1', op: 'status', operands: [], scope: 's' })]);
    bad.header.requires_cp = '^2.0';
    const verdict = await executeStream(bad);
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) expect(verdict.rejection.code).toBe('UNSUPPORTED_VERSION');
  });

  it('rejects malformed streams (R1 — never silently coerce)', async () => {
    const verdict = await executeStream({ header: { cir: '1.0.0', requires_cp: '^1.0', compiled_by: '', compiled_at_tick: 1 }, instructions: [] });
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) expect(verdict.rejection.code).toBe('INVALID_STREAM');
  });

  it('rejects perceptual/cognitive ops with no handler', async () => {
    const stream = streamOf([instr({ id: 'm1', op: 'merge', operands: [], scope: 's' })]);
    const verdict = await executeStream(stream);
    expect(verdict.accepted).toBe(false);
    if (!verdict.accepted) {
      expect(verdict.rejection.code).toBe('NO_HANDLER');
      expect(verdict.rejection.instructionId).toBe('m1');
    }
  });

  it('emits the full trace contract: compiled, gate, executed, rejected', async () => {
    const events: CIRTraceEvent[] = [];
    const stream = streamOf([
      instr({ id: 't1', op: 'think', operands: [query('q', 's')], scope: 's' }),
      instr({ id: 'i1', op: 'infer', operands: [], scope: 's', depends: ['t1'] }),
    ]);
    const verdict = await executeStream(stream, { onEvent: (e) => events.push(e) });
    expect(verdict.accepted).toBe(false);
    expect(events.map((e) => e.type)).toEqual(['cir:compiled', 'cir:gate', 'cir:executed', 'cir:gate', 'cir:rejected']);
    expect(events.every((e) => e.traceparent === traceparentOf(stream))).toBe(true);
  });

  it('produces deterministic stream ids and traceparents for identical streams', () => {
    const s1 = streamOf([instr({ id: 'a', op: 'ping', operands: [], scope: 's' })]);
    const s2 = streamOf([instr({ id: 'a', op: 'ping', operands: [], scope: 's' })]);
    expect(streamIdOf(s1)).toBe(streamIdOf(s2));
    expect(traceparentOf(s1)).toBe(traceparentOf(s2));
    const s3 = streamOf([instr({ id: 'b', op: 'ping', operands: [], scope: 's' })]);
    expect(streamIdOf(s1)).not.toBe(streamIdOf(s3));
  });

  it('full pipeline: validate → optimize → execute with pass trace events', async () => {
    const events: CIRTraceEvent[] = [];
    const { stream } = compileGoal('Refactor the gateway', { scope: 'ws:acme', compiledBy: 'cli-test', tick: 1 });
    const replay = { payload: { verdict: 'approved', confidence: 1 }, confidence: 1, latencyMs: 0 };
    const result = await executePipeline(stream, {}, { onEvent: (e) => events.push(e), replayPayloads: new Map([['v1', replay]]) });
    expect(result.validationError).toBeUndefined();
    expect(result.optimizer).toBeDefined();
    expect(result.optimizer!.reports.length).toBeGreaterThanOrEqual(17);
    expect(result.verdict.accepted).toBe(true);
    if (result.verdict.accepted) {
      expect(result.verdict.record.outcomes.map((o) => o.id)).toEqual(['r1', 'p1', 'x1', 'v1', 'f1']);
      expect(result.verdict.record.energySpent).toBeGreaterThan(0);
    }
    const passEvents = events.filter((e) => e.type === 'cir:pass');
    expect(passEvents.length).toBeGreaterThanOrEqual(17);
    expect(passEvents[0]!.payload.pass).toBe('normalize');
  });

  it('full pipeline: constitutional evaluate defaults to gate rejection without replay or delegation', async () => {
    const { stream } = compileGoal('Approve the migration', { scope: 'ws:acme', compiledBy: 'cli-test', tick: 1 });
    const result = await executePipeline(stream, {}, { onEvent: () => undefined });
    expect(result.verdict.accepted).toBe(false);
    if (!result.verdict.accepted) {
      expect(result.verdict.rejection.code).toBe('GATE_FAILED');
      expect(result.verdict.rejection.instructionId).toBe('v1');
    }
  });

  it('full pipeline: replay payloads make the compiled pipeline execute deterministically', async () => {
    const { stream } = compileIntent('Ship the release', 'tests are green', { scope: 'ws:acme', compiledBy: 'cli-test', tick: 1 });
    const replay = { payload: { verdict: 'approved', confidence: 1 }, confidence: 1, latencyMs: 0 };
    const options = { replayPayloads: new Map([['v1', replay]]) };
    const a = await executePipeline(stream, {}, options);
    const b = await executePipeline(stream, {}, options);
    expect(a.verdict.accepted).toBe(true);
    if (a.verdict.accepted && b.verdict.accepted) {
      expect(JSON.stringify(a.verdict.record)).toBe(JSON.stringify(b.verdict.record));
    }
  });

  it('gateFor applies the three verification levels', () => {
    const options = { scopeAllow: new Set(['s']) };
    const none = instr({ id: 'a', op: 'status', operands: [], scope: 's', verify: 'none' });
    const structural = instr({ id: 'b', op: 'think', operands: [], scope: 's', verify: 'structural' });
    const constitutional = instr({ id: 'c', op: 'infer', operands: [], scope: 's', verify: 'constitutional' });
    expect(gateFor(none, 'none', options).pass).toBe(true);
    expect(gateFor(structural, 'structural', options).pass).toBe(true);
    expect(gateFor(constitutional, 'constitutional', options).pass).toBe(false);
    const outOfScope = instr({ id: 'd', op: 'status', operands: [], scope: 'elsewhere', verify: 'none' });
    expect(gateFor(outOfScope, 'none', options).pass).toBe(true);
    const outOfScopeStructural = instr({ id: 'e', op: 'status', operands: [], scope: 'elsewhere', verify: 'structural' });
    expect(gateFor(outOfScopeStructural, 'structural', options).pass).toBe(false);
  });

  it('exposes the executor version', () => {
    expect(CIR_EXECUTOR_VERSION).toBe('1.0.0');
  });
});
