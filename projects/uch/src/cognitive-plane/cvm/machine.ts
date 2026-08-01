import type { VerificationGate } from '../../kernel/transactional/index.js';
import { TransactionalMemory } from '../../kernel/transactional/index.js';
import type { CVMExecutionInput, CVMGraphSnapshot } from './cognitive-vm.js';
import { CognitiveExecutionGraph } from './cognitive-vm.js';
import {
  decodeProgram,
  DETERMINISTIC_OPS,
  type CVMInstructionClass,
  type DecodedInstruction,
} from './bytecode.js';
import { certifyDevice, type ModelDevice } from './device.js';

export interface CvmTraceEntry {
  nodeId: string;
  op: string;
  class: CVMInstructionClass;
  tick: number;
  observed: unknown[];
  result: unknown;
}

export interface CvmExecutionResult {
  status: 'completed' | 'failed';
  graphId: string;
  order: string[];
  results: Record<string, unknown>;
  trace: CvmTraceEntry[];
  checkpoints: CVMGraphSnapshot[];
  committed: unknown[];
  rolledBack: string[];
  failed: string[];
}

export interface CvmReplayReport {
  deterministic: boolean;
  mismatches: string[];
}

export interface CvmMachineOptions {
  devices?: ModelDevice[];
  gates?: VerificationGate[];
  clock?: () => number;
}

export interface CvmExecuteOptions {
  fromSnapshot?: CVMGraphSnapshot;
  onCheckpoint?: (snapshot: CVMGraphSnapshot) => void;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resolveOperands(
  instruction: DecodedInstruction,
  results: Record<string, unknown>,
): unknown[] {
  return instruction.operands.map((operand) => {
    if (operand.kind === 'literal') return operand.value;
    if (operand.kind === 'ref' && operand.key) {
      return results[operand.key] ?? operand.key;
    }
    return operand.text ?? operand.key ?? operand.value;
  });
}

function evalDeterministic(op: string, observed: unknown[]): unknown {
  const first = observed[0] ?? null;
  switch (op) {
    case 'ping':
      return { pong: true };
    case 'list':
      return { ops: [...DETERMINISTIC_OPS] };
    case 'status':
      return { status: 'ok', observed };
    case 'observe':
      return { observed };
    case 'think':
      return { trace: observed, conclusion: first };
    case 'retrieve':
      return { results: observed };
    case 'remember':
      return { stored: true, content: observed };
    case 'learn':
      return { learned: true, evidence: observed };
    case 'reflect':
      return { episodes: observed };
    case 'consolidate':
      return { consolidated: true, episodes: observed };
    case 'dream':
      return { dreamt: true, replay: observed };
    case 'plan':
      return { steps: observed };
    case 'predict':
      return { predictions: observed };
    case 'simulate':
      return { projected: observed };
    case 'evaluate':
      return { stats: 'ok' };
    case 'critique':
      return { gaps: observed };
    case 'execute':
      return { action: observed };
    default:
      throw new Error(`no deterministic evaluation for op ${op}`);
  }
}

export class CvmMachine {
  private readonly devices: ModelDevice[];
  private readonly gates: VerificationGate[];
  private readonly clock: () => number;

  constructor(options: CvmMachineOptions = {}) {
    this.devices = options.devices ?? [];
    this.gates = options.gates ?? [];
    this.clock = options.clock ?? (() => this.nextTick());
  }

  private tickCounter = 0;
  private nextTick(): number {
    this.tickCounter += 1;
    return this.tickCounter;
  }

  branch(): CvmMachine {
    return new CvmMachine({ devices: this.devices, gates: this.gates, clock: this.clock });
  }

  merge(other: CvmMachine): { merged: boolean; conflicts: string[] } {
    const conflicts: string[] = [];
    const seen = new Set<string>();
    for (const device of [...this.devices, ...other.devices]) {
      if (seen.has(device.id)) continue;
      seen.add(device.id);
      for (const op of device.capabilities) {
        const left = certifyDevice(device, op);
        if (!left.certified) {
          conflicts.push(`device ${device.id} fails certification for ${op}: ${left.reason ?? ''}`);
        }
      }
    }
    return { merged: conflicts.length === 0, conflicts };
  }

  async execute(
    input: CVMExecutionInput,
    options: CvmExecuteOptions = {},
  ): Promise<CvmExecutionResult> {
    this.tickCounter = 0;
    const program = decodeProgram(input);
    const graph = new CognitiveExecutionGraph(
      `cvm:${program.header.compiled_by}:${program.header.compiled_at_tick}`,
    );
    for (const instruction of program.instructions) {
      graph.addNode({
        id: instruction.id,
        op: instruction.op,
        dependsOn: instruction.depends,
        state: 'ready',
      });
    }

    if (options.fromSnapshot && options.fromSnapshot.graphId === graph.id) {
      graph.restore(options.fromSnapshot);
    }

    const memory = new TransactionalMemory();
    const results: Record<string, unknown> = {};
    const trace: CvmTraceEntry[] = [];
    const checkpoints: CVMGraphSnapshot[] = [];
    const committed: unknown[] = [];
    const rolledBack: string[] = [];
    const failed: string[] = [];

    const order = graph.order();
    for (const id of order) {
      const node = graph.nodes.get(id);
      if (!node) continue;
      if (node.state === 'done') continue;

      const instruction = program.instructions.find((entry) => entry.id === id);
      if (!instruction) {
        failed.push(id);
        return {
          status: 'failed',
          graphId: graph.id,
          order,
          results,
          trace,
          checkpoints,
          committed,
          rolledBack,
          failed,
        };
      }

      const observed = resolveOperands(instruction, results);
      const cls = instruction.class;
      let result: unknown;
      let failedNode = false;

      if (cls === 'delegated') {
        const device = this.devices.find(
          (candidate) => certifyDevice(candidate, instruction.op).certified,
        );
        if (!device) {
          rolledBack.push(id);
          failed.push(id);
          node.state = 'failed';
          failedNode = true;
        } else {
          result = await device.invoke(instruction.op, observed);
        }
      } else {
        result = evalDeterministic(instruction.op, observed);
      }

      if (!failedNode) {
        const tick = this.clock();
        const proposal = {
          nodeId: id,
          op: instruction.op,
          claim: JSON.stringify(result),
          change: JSON.stringify(result),
        };
        const tx = memory.propose(proposal);
        if (instruction.verify === 'constitutional') {
          memory.verify(tx, this.gates);
        } else if (instruction.verify === 'structural') {
          memory.verify(tx, [
            {
              id: 'structural',
              verify: (p: unknown) => {
                const maybe = p as { change?: unknown };
                const pass = maybe.change !== undefined && typeof maybe.change === 'string';
                return {
                  gateId: 'structural',
                  pass,
                  reason: pass ? undefined : 'result is not serializable',
                };
              },
            },
          ]);
        }

        if (memory.commit(tx)) {
          node.state = 'done';
          node.result = result;
          results[id] = result;
          committed.push(tx.proposal);
          trace.push({ nodeId: id, op: instruction.op, class: cls, tick, observed, result });
          checkpoints.push(graph.snapshot());
          if (options.onCheckpoint) options.onCheckpoint(graph.snapshot());
        } else {
          memory.rollback(tx);
          rolledBack.push(id);
          failed.push(id);
          node.state = 'failed';
          failedNode = true;
        }
      }

      if (failedNode) {
        return {
          status: 'failed',
          graphId: graph.id,
          order,
          results,
          trace,
          checkpoints,
          committed,
          rolledBack,
          failed,
        };
      }
    }

    return {
      status: 'completed',
      graphId: graph.id,
      order,
      results,
      trace,
      checkpoints,
      committed,
      rolledBack,
      failed,
    };
  }

  async replay(input: CVMExecutionInput, expected: CvmTraceEntry[]): Promise<CvmReplayReport> {
    const fresh = await this.execute(input);
    const mismatches: string[] = [];
    const expectedById = new Map(expected.map((entry) => [entry.nodeId, entry]));
    for (const entry of fresh.trace) {
      if (entry.class === 'delegated') continue;
      const prior = expectedById.get(entry.nodeId);
      if (!prior) {
        mismatches.push(`${entry.nodeId}: no prior trace entry`);
        continue;
      }
      if (!deepEqual(entry.result, prior.result)) {
        mismatches.push(`${entry.nodeId}: result diverged from trace`);
      }
      if (entry.tick !== prior.tick) {
        mismatches.push(`${entry.nodeId}: tick diverged from trace`);
      }
    }
    return { deterministic: mismatches.length === 0, mismatches };
  }
}
