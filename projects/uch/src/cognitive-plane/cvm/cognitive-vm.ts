export type CVMNodeState = 'ready' | 'running' | 'done' | 'failed';

export interface CVMNode {
  id: string;
  op: string;
  dependsOn: string[];
  state: CVMNodeState;
  result?: unknown;
}

export interface CVMGraphSnapshot {
  graphId: string;
  status: 'ready' | 'completed' | 'failed';
  nodes: Record<string, CVMNode>;
  tick: number;
}

export interface CVMExecutionInput {
  header: {
    cir: string;
    requires_cp: string;
    compiled_by: string;
    compiled_at_tick: number;
  };
  instructions: Array<{
    id: string;
    op: string;
    operands: Array<{
      kind: string;
      value?: unknown;
      key?: string;
      text?: string;
      policy?: unknown;
    }>;
    verify: string;
    scope: string;
    depends?: string[];
  }>;
}

export class CognitiveExecutionGraph {
  readonly id: string;
  readonly nodes = new Map<string, CVMNode>();
  private tick = 0;

  constructor(id = 'cvm-graph') {
    this.id = id;
  }

  addNode(node: CVMNode): void {
    this.nodes.set(node.id, { ...node });
  }

  order(): string[] {
    const ordered: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (id: string): void => {
      if (visited.has(id)) return;
      if (visiting.has(id)) {
        throw new Error(`cycle detected at ${id}`);
      }
      const node = this.nodes.get(id);
      if (!node) return;
      visiting.add(id);
      for (const dep of node.dependsOn) visit(dep);
      visiting.delete(id);
      visited.add(id);
      ordered.push(id);
    };

    for (const id of this.nodes.keys()) visit(id);
    return ordered;
  }

  snapshot(): CVMGraphSnapshot {
    const status = Array.from(this.nodes.values()).every((n) => n.state === 'done')
      ? 'completed'
      : 'ready';
    this.tick += 1;
    return {
      graphId: this.id,
      status,
      nodes: Object.fromEntries(
        Array.from(this.nodes.entries()).map(([id, node]) => [id, { ...node }]),
      ),
      tick: this.tick,
    };
  }

  restore(snapshot: CVMGraphSnapshot): boolean {
    if (snapshot.graphId !== this.id) return false;
    for (const [id, node] of Object.entries(snapshot.nodes)) {
      const current = this.nodes.get(id);
      if (!current) return false;
      current.state = node.state;
      current.result = node.result;
    }
    return true;
  }
}

export class CognitiveVM {
  private graph: CognitiveExecutionGraph | undefined;

  compile(input: CVMExecutionInput): CognitiveExecutionGraph {
    const graph = new CognitiveExecutionGraph(
      `cvm:${input.header.compiled_by}:${input.header.compiled_at_tick}`,
    );
    for (const instr of input.instructions) {
      graph.addNode({
        id: instr.id,
        op: instr.op,
        dependsOn: instr.depends ?? [],
        state: 'ready',
      });
    }
    this.graph = graph;
    return graph;
  }

  execute(input: CVMExecutionInput): {
    status: 'completed';
    execution: { order: string[]; results: Record<string, unknown> };
    checkpoint: () => { state: { status: 'completed'; graphId: string; tick: number } };
  } {
    const graph = this.compile(input);
    const order = graph.order();
    const results: Record<string, unknown> = {};
    for (const id of order) {
      const node = graph.nodes.get(id)!;
      const instruction = input.instructions.find((entry) => entry.id === id)!;
      const observed = instruction.operands.map((operand) => {
        if (operand.kind === 'literal') return operand.value;
        if (operand.kind === 'ref' && operand.key) {
          return results[operand.key] ?? operand.key;
        }
        return operand.text ?? operand.key ?? operand.value;
      });

      node.state = 'running';
      const result = { observed };
      node.result = result;
      node.state = 'done';
      results[id] = result;
    }

    const checkpoint = (): {
      state: { status: 'completed'; graphId: string; tick: number };
    } => ({
      state: { status: 'completed', graphId: graph.id, tick: graph.snapshot().tick },
    });

    return {
      status: 'completed',
      execution: { order, results },
      checkpoint,
    };
  }
}
