import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import {
  writeSnapshot,
  readSnapshot,
  type Storable,
} from '../../cognitive-plane/persistence/persistence-engine.js';
import type {
  CognitiveProcess,
  PID,
  ProcessSpec,
  ProcessStatus,
  ProcessThread,
} from './types.js';

interface PersistedProcessTable {
  version: 1;
  nextPid: number;
  nextThreadId: number;
  processes: CognitiveProcess[];
}

export interface ProcessTableOptions {
  /** Bus for governed process-life events (process:spawned/joined/detached/signaled/killed). */
  eventBus?: NeuralEventBus;
}

export interface ProcessTableStats {
  total: number;
  running: number;
  suspended: number;
  draining: number;
  terminated: number;
  threads: number;
}

const RESERVED_SIGNALS: Record<string, { from: ProcessStatus[]; to: ProcessStatus }> = {
  pause: { from: ['running'], to: 'suspended' },
  resume: { from: ['suspended'], to: 'running' },
  terminate: { from: ['running', 'suspended'], to: 'draining' },
};

/**
 * The kernel-owned process table (ADR-006 §4, COGNITIVE-PROCESSES.md).
 *
 *   spawn ─► running ─► (pause) ─► suspended ─► (resume) ─► running
 *              └──────► (terminate) ─► draining ─► kill ─► terminated
 *
 * PIDs are monotonic and never reused. `attach(pid, driverLabel)` IS the
 * join: the driver becomes a thread of the existing process — nothing
 * transfers, nothing syncs (the thread carries only its own fields). A
 * process outlives its threads; only kill terminates it, and the record is
 * preserved (Law 12). Every transition publishes a governed event when a
 * bus is provided.
 */
export class ProcessTable implements Storable {
  private processes = new Map<PID, CognitiveProcess>();
  private nextPid = 1;
  private nextThreadId = 1;
  private eventBus?: NeuralEventBus;

  constructor(options?: ProcessTableOptions) {
    this.eventBus = options?.eventBus;
  }

  spawn(spec: ProcessSpec, now: Date = new Date()): CognitiveProcess {
    const process: CognitiveProcess = {
      pid: this.nextPid++,
      name: spec.name,
      ownerLabel: spec.ownerLabel,
      status: 'running',
      goals: [...(spec.goals ?? [])],
      capabilities: [...(spec.capabilities ?? [])],
      permissions: [...(spec.permissions ?? [])],
      openFiles: [...(spec.openFiles ?? [])],
      ...(spec.workingMemory !== undefined ? { workingMemory: { ...spec.workingMemory } } : {}),
      episodeId: spec.episodeId,
      contextRef: spec.contextRef,
      pendingSignals: [],
      threads: [],
      createdAt: now,
      updatedAt: now,
    };
    this.processes.set(process.pid, process);
    this.emit('process:spawned', { pid: process.pid, name: process.name });
    return process;
  }

  /** Attach = join a PID: the driver becomes a thread; nothing transfers. */
  attach(pid: PID, driverLabel: string, now: Date = new Date()): ProcessThread {
    const process = this.processes.get(pid);
    if (!process || process.status === 'terminated') {
      throw new Error(`cannot attach to pid ${pid}: unknown or terminated process`);
    }
    if (process.status !== 'running') {
      throw new Error(`cannot attach to pid ${pid}: process is ${process.status} (attach requires a running process)`);
    }
    const thread: ProcessThread = {
      threadId: this.nextThreadId++,
      driverLabel,
      attachedAt: now,
    };
    process.threads.push(thread);
    process.updatedAt = now;
    this.emit('process:joined', { pid, threadId: thread.threadId, driverLabel });
    return thread;
  }

  detach(pid: PID, threadId: number): boolean {
    const process = this.processes.get(pid);
    if (!process) return false;
    const index = process.threads.findIndex((t) => t.threadId === threadId);
    if (index < 0) return false;
    const [thread] = process.threads.splice(index, 1);
    if (!thread) return false;
    process.updatedAt = new Date();
    this.emit('process:detached', { pid, threadId, driverLabel: thread.driverLabel });
    return true;
  }

  detachDriver(pid: PID, driverLabel: string): number {
    const process = this.processes.get(pid);
    if (!process) return 0;
    const before = process.threads.length;
    process.threads = process.threads.filter((t) => t.driverLabel !== driverLabel);
    const removed = before - process.threads.length;
    if (removed > 0) {
      process.updatedAt = new Date();
      this.emit('process:detached', { pid, driverLabel, count: removed });
    }
    return removed;
  }

  kill(pid: PID, now: Date = new Date()): boolean {
    const process = this.processes.get(pid);
    if (!process) return false;
    if (process.status !== 'terminated') {
      if (process.status !== 'draining') {
        process.pendingSignals.push('terminate');
        this.emit('process:signaled', { pid, signal: 'terminate' });
      }
      process.status = 'terminated';
      process.threads = [];
      process.updatedAt = now;
      this.emit('process:killed', { pid, terminatedAt: now.toISOString() });
    }
    return true;
  }

  signal(pid: PID, name: string, now: Date = new Date()): boolean {
    const process = this.processes.get(pid);
    if (!process || process.status === 'terminated') return false;
    process.pendingSignals.push(name);
    process.updatedAt = now;
    const reserved = RESERVED_SIGNALS[name];
    if (reserved && reserved.from.includes(process.status)) {
      process.status = reserved.to;
    }
    this.emit('process:signaled', { pid, signal: name });
    return true;
  }

  drainSignals(pid: PID, now: Date = new Date()): string[] {
    const process = this.processes.get(pid);
    if (!process) return [];
    const drained = process.pendingSignals;
    // replace the array so previously returned references never alias the store
    process.pendingSignals = [];
    process.updatedAt = now;
    return drained;
  }

  get(pid: PID): CognitiveProcess | undefined {
    return this.processes.get(pid);
  }

  list(): CognitiveProcess[] {
    return [...this.processes.values()];
  }

  threadsOf(pid: PID): ProcessThread[] {
    const process = this.processes.get(pid);
    if (!process) return [];
    return [...process.threads];
  }

  stats(): ProcessTableStats {
    const stats: ProcessTableStats = { total: 0, running: 0, suspended: 0, draining: 0, terminated: 0, threads: 0 };
    for (const process of this.processes.values()) {
      stats.total += 1;
      stats[process.status] += 1;
      stats.threads += process.threads.length;
    }
    return stats;
  }

  async persist(filePath: string): Promise<void> {
    const snapshot: PersistedProcessTable = {
      version: 1,
      nextPid: this.nextPid,
      nextThreadId: this.nextThreadId,
      processes: [...this.processes.values()],
    };
    writeSnapshot(filePath, snapshot);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<PersistedProcessTable>(filePath);
    if (!data) return 0;
    this.processes.clear();
    let maxPid = 0;
    let maxThreadId = 0;
    for (const process of data.processes) {
      this.processes.set(process.pid, process);
      if (process.pid > maxPid) maxPid = process.pid;
      for (const thread of process.threads) {
        if (thread.threadId > maxThreadId) maxThreadId = thread.threadId;
      }
    }
    // counters never regress below observed records (corrupt/truncated snapshot safety)
    this.nextPid = Math.max(data.nextPid ?? 1, maxPid + 1);
    this.nextThreadId = Math.max(data.nextThreadId ?? 1, maxThreadId + 1);
    return this.processes.size;
  }

  private emit(
    type: 'process:spawned' | 'process:joined' | 'process:detached' | 'process:signaled' | 'process:killed',
    payload: Record<string, unknown>,
  ): void {
    if (this.eventBus) {
      void this.eventBus.publish({ type, source: 'uch-process-table', payload });
    }
  }
}
