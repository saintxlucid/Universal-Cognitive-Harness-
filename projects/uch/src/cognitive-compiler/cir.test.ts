import { describe, expect, it } from 'vitest';
import {
  CIR_VERSION,
  buildInstruction,
  composite,
  decodeStream,
  encodeStream,
  energyCostOf,
  instructionClassOf,
  literal,
  query,
  ref,
  satisfiesRequiresCp,
  streamEnergy,
  streamTokenEstimate,
  validateStream,
  type CIRStream,
} from './cir.js';
import { CP_VERSION, type CPOp } from '../protocol/cp.js';

function sampleStream(): CIRStream {
  return {
    header: { cir: CIR_VERSION, requires_cp: '^1.0', compiled_by: 'test-driver', compiled_at_tick: 1 },
    instructions: [
      buildInstruction({ id: 'r1', op: 'retrieve', operands: [query('how does the kernel persist?', 'test')], scope: 'test' }),
      buildInstruction({ id: 't1', op: 'think', operands: [query('persistence architecture', 'test', 'constitutional')], scope: 'test', depends: ['r1'] }),
    ],
  };
}

describe('CIR core', () => {
  it('classifies ops into the three instruction classes', () => {
    expect(instructionClassOf('observe')).toBe('perceptual');
    expect(instructionClassOf('retrieve')).toBe('cognitive');
    expect(instructionClassOf('infer')).toBe('delegated');
    expect(instructionClassOf('evaluate')).toBe('delegated');
    expect(instructionClassOf('predict')).toBe('delegated');
    expect(instructionClassOf('merge')).toBe('cognitive');
  });

  it('assigns catalog energy to CP ops and defaults to extensions', () => {
    expect(energyCostOf('think')).toBe(6);
    expect(energyCostOf('retrieve')).toBe(1);
    expect(energyCostOf('infer')).toBe(6);
    expect(energyCostOf('scan')).toBe(1);
  });

  it('defaults verify levels from the catalog and RFC-0004 §9', () => {
    const think = buildInstruction({ id: 'a', op: 'think', operands: [], scope: 's' });
    expect(think.verify).toBe('structural');
    const evalOp = buildInstruction({ id: 'b', op: 'evaluate', operands: [], scope: 's' });
    expect(evalOp.verify).toBe('constitutional');
    const predict = buildInstruction({ id: 'c', op: 'predict', operands: [], scope: 's' });
    expect(predict.verify).toBe('constitutional');
    const retrieve = buildInstruction({ id: 'd', op: 'retrieve', operands: [], scope: 's' });
    expect(retrieve.verify).toBe('none');
  });

  it('validates a well-formed stream', () => {
    const result = validateStream(sampleStream());
    expect(result.error).toBeUndefined();
    expect(result.stream?.instructions).toHaveLength(2);
  });

  it('rejects unsupported ops', () => {
    const bad = sampleStream();
    (bad.instructions[0] as { op: string }).op = 'teleport';
    const result = validateStream(bad);
    expect(result.error?.code).toBe('INVALID_INSTRUCTION');
    expect(result.error?.message).toContain('teleport');
  });

  it('rejects unsupported CIR versions', () => {
    const bad = sampleStream();
    bad.header.cir = '0.9.0' as typeof CIR_VERSION;
    const result = validateStream(bad);
    expect(result.error?.code).toBe('UNSUPPORTED_VERSION');
  });

  it('rejects streams whose requires_cp is unsatisfied', () => {
    const bad = sampleStream();
    bad.header.requires_cp = '^2.0';
    const result = validateStream(bad);
    expect(result.error?.code).toBe('UNSUPPORTED_VERSION');
  });

  it('rejects duplicate instruction ids and dangling depends', () => {
    const bad = sampleStream();
    bad.instructions.push(buildInstruction({ id: 'r1', op: 'status', operands: [], scope: 'test' }));
    let result = validateStream(bad);
    expect(result.error?.message).toContain('duplicate instruction id: r1');

    const dangling = sampleStream();
    dangling.instructions[1] = buildInstruction({
      id: 't1', op: 'think', operands: [], scope: 'test', depends: ['ghost'],
    });
    result = validateStream(dangling);
    expect(result.error?.message).toContain('depends on unknown instruction: ghost');
  });

  it('rejects query operands without a policy', () => {
    const bad = sampleStream();
    bad.instructions[0]!.operands = [{ kind: 'query', text: 'x' } as never];
    const result = validateStream(bad);
    expect(result.error?.message).toContain('requires a policy');
  });

  it('round-trips JSON encoding deterministically', () => {
    const stream = sampleStream();
    const encoded = encodeStream(stream);
    const decoded = decodeStream(encoded);
    expect(decoded).toEqual(stream);
    expect(encodeStream(decoded)).toBe(encoded);
  });

  it('rejects composite nesting beyond the depth limit with a structured error', () => {
    let stream: CIRStream = {
      header: { cir: CIR_VERSION, requires_cp: '^1.0', compiled_by: 'x', compiled_at_tick: 1 },
      instructions: [buildInstruction({ id: 'n0', op: 'think', operands: [], scope: 'test' })],
    };
    for (let i = 1; i <= 40; i += 1) {
      stream = {
        header: { cir: CIR_VERSION, requires_cp: '^1.0', compiled_by: 'x', compiled_at_tick: 1 },
        instructions: [buildInstruction({ id: `n${i}`, op: 'think', operands: [composite(stream, 'test')], scope: 'test' })],
      };
    }
    const result = validateStream(stream);
    expect(result.error?.code).toBe('INVALID_INSTRUCTION');
    expect(result.error?.message).toContain('composite nesting exceeds');
  });

  it('checks the requires_cp version gate', () => {
    expect(satisfiesRequiresCp('^1.0', CP_VERSION)).toBe(true);
    expect(satisfiesRequiresCp('*', CP_VERSION)).toBe(true);
    expect(satisfiesRequiresCp('^2.0', CP_VERSION)).toBe(false);
    expect(satisfiesRequiresCp('^1.1', '1.0.0')).toBe(false);
    expect(satisfiesRequiresCp('^1.1', '1.2.3')).toBe(true);
    expect(satisfiesRequiresCp('garbage', CP_VERSION)).toBe(false);
  });

  it('estimates tokens and energy for streams including composites', () => {
    const stream: CIRStream = {
      header: { cir: CIR_VERSION, requires_cp: '^1.0', compiled_by: 'x', compiled_at_tick: 2 },
      instructions: [
        buildInstruction({
          id: 'outer',
          op: 'plan',
          operands: [
            composite(
              {
                header: { cir: CIR_VERSION, requires_cp: '^1.0', compiled_by: 'x', compiled_at_tick: 2 },
                instructions: [
                  buildInstruction({ id: 'inner', op: 'retrieve', operands: [query('a long query text '.repeat(10), 's')], scope: 's' }),
                ],
              },
              's',
            ),
            literal(42, 's'),
            ref('belief:1', 's'),
          ],
          scope: 's',
        }),
      ],
    };
    expect(streamEnergy(stream)).toBe(5 + 1);
    expect(streamTokenEstimate(stream)).toBeGreaterThan(10);
  });

  it('treats every CP op as a valid CIR op', () => {
    const ops: CPOp[] = ['observe', 'think', 'retrieve', 'remember', 'learn', 'reflect', 'consolidate', 'dream', 'plan', 'predict', 'simulate', 'evaluate', 'critique', 'execute', 'status', 'list', 'ping'];
    for (const op of ops) {
      const stream: CIRStream = {
        header: { cir: CIR_VERSION, requires_cp: '^1.0', compiled_by: 'x', compiled_at_tick: 3 },
        instructions: [buildInstruction({ id: op, op, operands: [], scope: 's' })],
      };
      expect(validateStream(stream).error).toBeUndefined();
    }
  });
});
