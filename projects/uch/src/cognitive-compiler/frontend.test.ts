import { describe, expect, it } from 'vitest';
import { compileGoal, compileIntent } from './frontend.js';
import { encodeStream, validateStream } from './cir.js';

const OPTS = { scope: 'ws:acme', compiledBy: 'test-driver', tick: 7 };

describe('CIR frontend', () => {
  it('compiles an intent into a valid CIR stream', () => {
    const { stream } = compileIntent('Refactor the gateway', 'the gateway has a monolith controller', OPTS);
    const validation = validateStream(stream);
    expect(validation.error).toBeUndefined();
    expect(validation.stream?.instructions).toHaveLength(5);
    expect(stream.instructions.map((i) => i.op)).toEqual(['retrieve', 'plan', 'execute', 'evaluate', 'reflect']);
  });

  it('compilation is deterministic — identical inputs yield identical streams', () => {
    const a = compileIntent('Ship the release', 'tests are green', OPTS);
    const b = compileIntent('Ship the release', 'tests are green', OPTS);
    expect(encodeStream(a.stream)).toBe(encodeStream(b.stream));
    expect(a.report).toEqual(b.report);
  });

  it('wires dependencies in program order', () => {
    const { stream } = compileGoal('Audit the ledger', OPTS);
    for (let i = 1; i < stream.instructions.length; i += 1) {
      expect(stream.instructions[i]!.depends).toEqual([stream.instructions[i - 1]!.id]);
    }
  });

  it('emits a constitutional gate for evaluate by default', () => {
    const { stream, report } = compileGoal('Approve the migration', OPTS);
    const evaluate = stream.instructions.find((i) => i.op === 'evaluate');
    expect(evaluate?.verify).toBe('constitutional');
    expect(report.gates).toBe(1);
  });

  it('uses context as the retrieval query when present', () => {
    const withContext = compileIntent('Fix the bug', 'the retry loop never exits', OPTS);
    const noContext = compileIntent('Fix the bug', undefined, OPTS);
    const q1 = withContext.stream.instructions[0]!.operands[0]!;
    const q2 = noContext.stream.instructions[0]!.operands[0]!;
    expect(q1.kind).toBe('query');
    expect(q2.kind).toBe('query');
    if (q1.kind === 'query' && q2.kind === 'query') {
      expect(q1.text).toContain('retry loop');
      expect(q2.text).toBe('Fix the bug');
    }
  });

  it('reports energy and token estimates per compile', () => {
    const { report } = compileGoal('Summarize the quarter', OPTS);
    expect(report.instructions).toBe(5);
    expect(report.energy).toBeGreaterThanOrEqual(1 + 5 + 4 + 2 + 3);
    expect(report.tokenEstimate).toBeGreaterThan(0);
    expect(report.gates).toBe(1);
  });

  it('scopes every instruction to the compile scope', () => {
    const { stream } = compileGoal('List open risks', OPTS);
    for (const instr of stream.instructions) {
      expect(instr.scope).toBe(OPTS.scope);
    }
  });
});
