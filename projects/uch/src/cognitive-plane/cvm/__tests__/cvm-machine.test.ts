import { describe, expect, it } from 'vitest';

import type { CVMExecutionInput } from '../cognitive-vm.js';
import { CVMDecodeError } from '../bytecode.js';
import { certifyDevice, hasCapability } from '../device.js';
import { CvmMachine, type CvmTraceEntry } from '../machine.js';

function program(instructions: CVMExecutionInput['instructions'], tick = 1): CVMExecutionInput {
  return {
    header: { cir: '1.0.0', requires_cp: '^1.0', compiled_by: 'test', compiled_at_tick: tick },
    instructions,
  };
}

const observe = (id: string, value: unknown, depends: string[] = [], verify = 'none') => ({
  id,
  op: 'observe',
  operands: [{ kind: 'literal', value }],
  verify,
  scope: 'session',
  depends,
});

const think = (id: string, key: string, depends: string[], verify = 'structural') => ({
  id,
  op: 'think',
  operands: [{ kind: 'ref', key }],
  verify,
  scope: 'session',
  depends,
});

describe('CVM decode (Law enforcement at decode point)', () => {
  it('accepts a valid program and classifies instructions', async () => {
    const machine = new CvmMachine();
    const result = await machine.execute(program([observe('a', 'hello'), think('b', 'a', ['a'])]));
    expect(result.status).toBe('completed');
    expect(result.order).toEqual(['a', 'b']);
  });

  it('rejects unknown ops with a structured decode error', async () => {
    const machine = new CvmMachine();
    await expect(
      machine.execute(program([{ ...observe('a', 1), op: 'teleport' }])),
    ).rejects.toThrow(CVMDecodeError);
  });

  it('rejects duplicate instruction ids', async () => {
    const machine = new CvmMachine();
    await expect(machine.execute(program([observe('a', 1), observe('a', 2)]))).rejects.toThrow(
      /duplicate instruction id a/,
    );
  });

  it('rejects dependencies on unknown nodes', async () => {
    const machine = new CvmMachine();
    await expect(machine.execute(program([think('b', 'missing', ['missing'])]))).rejects.toThrow(
      /depends on unknown missing/,
    );
  });

  it('rejects invalid verify requirements', async () => {
    const machine = new CvmMachine();
    await expect(
      machine.execute(program([{ ...observe('a', 1), verify: 'secret' }])),
    ).rejects.toThrow(/invalid verify requirement/);
  });

  it('rejects payload-required ops without operands', async () => {
    const machine = new CvmMachine();
    await expect(
      machine.execute(
        program([{ id: 'a', op: 'observe', operands: [], verify: 'none', scope: 's' }]),
      ),
    ).rejects.toThrow(/requires at least one operand/);
  });

  it('rejects programs targeting a foreign CP major', async () => {
    const machine = new CvmMachine();
    const bad = program([observe('a', 1)]);
    bad.header.requires_cp = '^2.0';
    await expect(machine.execute(bad)).rejects.toThrow(/CP major 1/);
  });
});

describe('CVM deterministic execution', () => {
  it('executes a perceptual + cognitive pipeline in dependency order', async () => {
    const machine = new CvmMachine();
    const result = await machine.execute(
      program([
        observe('a', 'hello'),
        think('b', 'a', ['a']),
        {
          id: 'c',
          op: 'remember',
          operands: [{ kind: 'ref', key: 'b' }],
          verify: 'none',
          scope: 'session',
          depends: ['b'],
        },
      ]),
    );
    expect(result.status).toBe('completed');
    expect(result.results.a).toEqual({ observed: ['hello'] });
    expect(result.results.b).toEqual({
      trace: [{ observed: ['hello'] }],
      conclusion: { observed: ['hello'] },
    });
    expect(result.results.c).toEqual({
      stored: true,
      content: [{ trace: [{ observed: ['hello'] }], conclusion: { observed: ['hello'] } }],
    });
  });

  it('records a tick-ordered trace with instruction classes', async () => {
    const machine = new CvmMachine();
    const result = await machine.execute(program([observe('a', 1), think('b', 'a', ['a'])]));
    expect(result.trace.map((entry) => entry.nodeId)).toEqual(['a', 'b']);
    expect(result.trace[0]).toMatchObject({ op: 'observe', class: 'perceptual' });
    expect(result.trace[1]).toMatchObject({ op: 'think', class: 'cognitive' });
    expect(result.trace[0].tick).toBeLessThan(result.trace[1].tick);
  });

  it('honors structural verify requirements', async () => {
    const machine = new CvmMachine();
    const result = await machine.execute(program([think('a', 'x', [])]));
    expect(result.status).toBe('completed');
  });
});

describe('CVM delegated class (models as processors)', () => {
  const generator = {
    id: 'gen-1',
    tier: 'standard',
    capabilities: ['generate'],
    energyPerCall: 1,
    latencyProfile: { p50: 5, p95: 10 },
    invoke: async (op: string, operands: unknown[]) => ({
      text: `${op}:${JSON.stringify(operands)}`,
    }),
  };

  it('dispatches delegated ops to a certified device', async () => {
    const machine = new CvmMachine({ devices: [generator] });
    const result = await machine.execute(
      program([
        {
          id: 'g1',
          op: 'generate',
          operands: [{ kind: 'literal', value: 'poem' }],
          verify: 'none',
          scope: 'session',
        },
      ]),
    );
    expect(result.status).toBe('completed');
    expect(result.results.g1).toEqual({ text: 'generate:["poem"]' });
    expect(result.trace[0].class).toBe('delegated');
  });

  it('fails the graph when no device is certified for the op', async () => {
    const machine = new CvmMachine({ devices: [generator] });
    const result = await machine.execute(
      program([
        {
          id: 'g1',
          op: 'summarize',
          operands: [{ kind: 'literal', value: 'doc' }],
          verify: 'none',
          scope: 'session',
        },
      ]),
    );
    expect(result.status).toBe('failed');
    expect(result.failed).toContain('g1');
    expect(result.rolledBack).toContain('g1');
  });

  it('certifies devices by declared capability and valid profile', () => {
    expect(certifyDevice(generator, 'generate').certified).toBe(true);
    expect(certifyDevice(generator, 'summarize').certified).toBe(false);
    expect(hasCapability(generator, 'generate')).toBe(true);
    expect(
      certifyDevice({ ...generator, latencyProfile: { p50: 10, p95: 5 } }, 'generate').certified,
    ).toBe(false);
  });
});

describe('CVM constitutional verify (WS-D propose -> verify -> commit)', () => {
  const deny = [{ id: 'deny', verify: () => ({ gateId: 'deny', pass: false, reason: 'denied' }) }];

  it('rolls back a node when a gate fails and keeps prior commits', async () => {
    const machine = new CvmMachine({ gates: deny });
    const result = await machine.execute(
      program([observe('a', 'ok'), think('b', 'a', ['a'], 'constitutional')]),
    );
    expect(result.status).toBe('failed');
    expect(result.rolledBack).toEqual(['b']);
    expect(result.committed.length).toBe(1);
    expect(result.committed[0]).toMatchObject({ nodeId: 'a' });
  });

  it('commits when all gates pass', async () => {
    const pass = [{ id: 'allow', verify: () => ({ gateId: 'allow', pass: true }) }];
    const machine = new CvmMachine({ gates: pass });
    const result = await machine.execute(
      program([observe('a', 'ok'), think('b', 'a', ['a'], 'constitutional')]),
    );
    expect(result.status).toBe('completed');
    expect(result.rolledBack).toEqual([]);
  });
});

describe('CVM checkpoint / resume / branch / merge', () => {
  it('checkpoints mid-execution and resumes from the snapshot', async () => {
    const machine = new CvmMachine();
    let midSnapshot: Awaited<ReturnType<typeof machine.execute>>['checkpoints'][number] | null =
      null;

    const first = await machine.execute(program([observe('a', 7), think('b', 'a', ['a'])], 5), {
      onCheckpoint: (snapshot) => {
        if (snapshot.nodes.b?.state === 'ready') midSnapshot = snapshot;
      },
    });
    expect(first.status).toBe('completed');

    const resumed = await machine.execute(
      program(
        [
          observe('a', 7),
          think('b', 'a', ['a']),
          {
            id: 'c',
            op: 'remember',
            operands: [{ kind: 'ref', key: 'b' }],
            verify: 'none',
            scope: 'session',
            depends: ['b'],
          },
        ],
        5,
      ),
      { fromSnapshot: midSnapshot ?? undefined },
    );
    expect(resumed.status).toBe('completed');
    expect(resumed.results.a).toBeUndefined();
    expect(resumed.results.b).toBeDefined();
    expect(resumed.results.c).toBeDefined();
    expect(resumed.trace.map((entry) => entry.nodeId)).toEqual(['b', 'c']);
  });

  it('branches into an independent machine with identical deterministic results', async () => {
    const machine = new CvmMachine();
    const fork = machine.branch();
    const input = program([observe('a', 3), think('b', 'a', ['a'])]);
    const left = await machine.execute(input);
    const right = await fork.execute(input);
    expect(right.status).toBe('completed');
    expect(right.results).toEqual(left.results);
    expect(right.order).toEqual(left.order);
  });

  it('reports conflicts when merging devices that fail certification', () => {
    const machine = new CvmMachine({
      devices: [
        {
          id: 'd1',
          tier: 'standard',
          capabilities: ['generate'],
          energyPerCall: 1,
          latencyProfile: { p50: 1, p95: 2 },
          invoke: () => null,
        },
      ],
    });
    const broken = new CvmMachine({
      devices: [
        {
          id: 'd2',
          tier: 'deep',
          capabilities: ['generate'],
          energyPerCall: -1,
          latencyProfile: { p50: 1, p95: 2 },
          invoke: () => null,
        },
      ],
    });
    const merged = machine.merge(broken);
    expect(merged.merged).toBe(false);
    expect(merged.conflicts.some((entry) => entry.includes('d2'))).toBe(true);
  });
});

describe('CVM replay determinism', () => {
  const input = program([observe('a', 'stable'), think('b', 'a', ['a'])]);

  it('reproduces identical results for the same program', async () => {
    const machine = new CvmMachine();
    const first = await machine.execute(input);
    const report = await machine.replay(input, first.trace as CvmTraceEntry[]);
    expect(report.deterministic).toBe(true);
    expect(report.mismatches).toEqual([]);
  });

  it('detects divergence when the program changes', async () => {
    const machine = new CvmMachine();
    const first = await machine.execute(input);
    const changed = program([observe('a', 'DIFFERENT'), think('b', 'a', ['a'])]);
    const report = await machine.replay(changed, first.trace as CvmTraceEntry[]);
    expect(report.deterministic).toBe(false);
    expect(report.mismatches.length).toBeGreaterThan(0);
  });

  it('skips delegated ops in replay comparison', async () => {
    const machine = new CvmMachine({
      devices: [
        {
          id: 'g',
          tier: 'standard',
          capabilities: ['generate'],
          energyPerCall: 1,
          latencyProfile: { p50: 1, p95: 2 },
          invoke: async () => ({ text: 'x' }),
        },
      ],
    });
    const mixed = program([
      observe('a', 1),
      {
        id: 'g1',
        op: 'generate',
        operands: [{ kind: 'ref', key: 'a' }],
        verify: 'none',
        scope: 'session',
        depends: ['a'],
      },
    ]);
    const first = await machine.execute(mixed);
    const report = await machine.replay(mixed, first.trace as CvmTraceEntry[]);
    expect(report.deterministic).toBe(true);
  });
});
