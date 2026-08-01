import { describe, expect, it } from 'vitest';

import { CognitiveExecutionGraph, CognitiveVM } from '../cognitive-vm.js';

describe('cognitive virtual machine', () => {
  it('compiles a CIR stream into a dependency-ordered execution graph', () => {
    const vm = new CognitiveVM();
    const graph = vm.compile({
      header: {
        cir: '1.0.0',
        requires_cp: '^1.0',
        compiled_by: 'test',
        compiled_at_tick: 1,
      },
      instructions: [
        {
          id: 'a',
          op: 'observe',
          operands: [{ kind: 'literal', value: 'hello' }],
          verify: 'none',
          scope: 'session',
        },
        {
          id: 'b',
          op: 'think',
          operands: [{ kind: 'ref', key: 'a' }],
          verify: 'structural',
          scope: 'session',
          depends: ['a'],
        },
        {
          id: 'c',
          op: 'remember',
          operands: [{ kind: 'ref', key: 'b' }],
          verify: 'constitutional',
          scope: 'session',
          depends: ['b'],
        },
      ],
    });

    expect(graph.order()).toEqual(['a', 'b', 'c']);
    expect(graph.snapshot().status).toBe('ready');
  });

  it('executes a graph deterministically and records checkpoints', () => {
    const vm = new CognitiveVM();
    const result = vm.execute({
      header: {
        cir: '1.0.0',
        requires_cp: '^1.0',
        compiled_by: 'test',
        compiled_at_tick: 2,
      },
      instructions: [
        {
          id: 'p1',
          op: 'observe',
          operands: [{ kind: 'literal', value: 7 }],
          verify: 'none',
          scope: 'session',
        },
        {
          id: 'p2',
          op: 'plan',
          operands: [{ kind: 'ref', key: 'p1' }],
          verify: 'structural',
          scope: 'session',
          depends: ['p1'],
        },
      ],
    });

    expect(result.status).toBe('completed');
    expect(result.execution.order).toEqual(['p1', 'p2']);
    expect(result.execution.results.p1).toEqual({ observed: [7] });
    expect(result.checkpoint().state).toMatchObject({ status: 'completed' });
  });

  it('restores a graph checkpoint to a valid prior state', () => {
    const graph = new CognitiveExecutionGraph('graph-restore');
    graph.addNode({ id: 'n1', op: 'observe', dependsOn: [], state: 'ready' });
    graph.addNode({ id: 'n2', op: 'think', dependsOn: ['n1'], state: 'ready' });
    const snapshot = graph.snapshot();

    graph.nodes.get('n2')!.state = 'running';
    expect(graph.restore(snapshot)).toBe(true);
    expect(graph.nodes.get('n2')!.state).toBe('ready');
  });
});
