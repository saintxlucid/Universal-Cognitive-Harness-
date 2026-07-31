import type { ToolCallProgress } from '../tools/types.js';

export const GLOBAL_LANE = 'global';
export const DEFAULT_LANE_CAPACITY = 100;

export interface LaneEnqueueOptions {
  priority?: number;
  signal?: AbortSignal;
}

export interface LaneTask<T = unknown> {
  id: string;
  lane: string;
  priority: number;
  sequence: number;
  run: () => Promise<T>;
  signal: AbortSignal | null;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  queuedAt: number;
  startedAt: number | null;
}

export interface LaneQueueOptions {
  laneCapacity?: number;
  globalCapacity?: number;
  maxLanes?: number;
}

export interface LaneStats {
  lane: string;
  running: number;
  queued: number;
}

export interface LaneQueueStatus {
  running: number;
  queued: number;
  lanes: LaneStats[];
  finishedCount: number;
}

export function createAbortError(message = 'Task aborted'): DOMException {
  return new DOMException(message, 'AbortError');
}

export class LaneQueue {
  private readonly lanes = new Map<string, LaneTask<unknown>[]>();
  private running = new Map<string, number>();
  private readonly options: Required<LaneQueueOptions>;
  private sequence = 0;
  private finished = 0;

  constructor(options: LaneQueueOptions = {}) {
    this.options = {
      laneCapacity: options.laneCapacity ?? DEFAULT_LANE_CAPACITY,
      globalCapacity: options.globalCapacity ?? 1,
      maxLanes: options.maxLanes ?? 1000,
    };
  }

  enqueue<T>(lane: string, run: () => Promise<T>, options: LaneEnqueueOptions = {}): Promise<T> {
    const signal = options.signal ?? null;
    if (signal?.aborted) {
      return Promise.reject(createAbortError());
    }
    if (!this.lanes.has(lane)) {
      if (this.lanes.size >= this.options.maxLanes) {
        return Promise.reject(new Error(`Lane limit reached (${this.options.maxLanes})`));
      }
      this.lanes.set(lane, []);
    }
    const queue = this.lanes.get(lane) as LaneTask<unknown>[];
    const activeInLane = (this.running.get(lane) ?? 0) + queue.length;
    if (activeInLane >= this.options.laneCapacity) {
      return Promise.reject(new Error(`Lane queue full (${this.options.laneCapacity} pending)`));
    }

    return new Promise<T>((resolve, reject) => {
      const task: LaneTask<T> = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        lane,
        priority: options.priority ?? 0,
        sequence: this.sequence++,
        run,
        signal,
        resolve,
        reject,
        queuedAt: Date.now(),
        startedAt: null,
      };
      if (signal) {
        signal.addEventListener('abort', () => {
          const index = queue.indexOf(task as unknown as LaneTask<unknown>);
          if (index !== -1) {
            queue.splice(index, 1);
            reject(createAbortError());
          }
        }, { once: true });
      }
      queue.push(task as unknown as LaneTask<unknown>);
      void this.dispatch();
    });
  }

  private canRun(lane: string): boolean {
    const current = this.running.get(lane) ?? 0;
    const laneLimit = lane === GLOBAL_LANE ? this.options.globalCapacity : 1;
    if (current >= laneLimit) return false;
    if (lane === GLOBAL_LANE) {
      const othersRunning = [...this.running.entries()].some(([l, count]) => l !== GLOBAL_LANE && count > 0);
      if (othersRunning) return false;
    } else {
      const globalRunning = this.running.get(GLOBAL_LANE) ?? 0;
      if (globalRunning > 0) return false;
      const globalQueued = (this.lanes.get(GLOBAL_LANE)?.length ?? 0) > 0;
      if (globalQueued) return false;
    }
    return true;
  }

  private async dispatch(): Promise<void> {
    const lanes = [...this.lanes.keys()].sort((a, b) => (a === GLOBAL_LANE ? -1 : b === GLOBAL_LANE ? 1 : 0));
    for (const lane of lanes) {
      const queue = this.lanes.get(lane);
      if (!queue || queue.length === 0) continue;
      if (!this.canRun(lane)) continue;
      const candidates = [...queue].sort((a, b) => b.priority - a.priority || a.sequence - b.sequence);
      const task = candidates[0] as LaneTask;
      const index = queue.indexOf(task);
      queue.splice(index, 1);
      this.running.set(lane, (this.running.get(lane) ?? 0) + 1);
      task.startedAt = Date.now();
      void this.execute(task);
      return;
    }
  }

  private async execute(task: LaneTask): Promise<void> {
    try {
      if (task.signal?.aborted) {
        throw createAbortError();
      }
      const result = await task.run();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.finished++;
      const count = (this.running.get(task.lane) ?? 1) - 1;
      if (count <= 0) {
        this.running.delete(task.lane);
      } else {
        this.running.set(task.lane, count);
      }
      void this.dispatch();
    }
  }

  abortLane(lane: string): void {
    const queue = this.lanes.get(lane);
    if (queue) {
      for (const task of queue) {
        task.reject(createAbortError(`Task aborted: lane ${lane}`));
      }
      queue.length = 0;
    }
    this.lanes.delete(lane);
    void this.dispatch();
  }

  abortAll(): void {
    for (const lane of [...this.lanes.keys()]) {
      this.abortLane(lane);
    }
  }

  clear(): void {
    this.lanes.clear();
    void this.dispatch();
  }

  status(): LaneQueueStatus {
    const lanes: LaneStats[] = [];
    for (const [lane, queue] of this.lanes) {
      lanes.push({ lane, running: this.running.get(lane) ?? 0, queued: queue.length });
    }
    return {
      running: this.running.size,
      queued: [...this.lanes.values()].reduce((acc, queue) => acc + queue.length, 0),
      lanes,
      finishedCount: this.finished,
    };
  }

  isRunning(lane: string): boolean {
    return (this.running.get(lane) ?? 0) > 0;
  }

  queuedIn(lane: string): number {
    return this.lanes.get(lane)?.length ?? 0;
  }

  progress(): ToolCallProgress[] {
    const progress: ToolCallProgress[] = [];
    for (const [lane, count] of this.running) {
      progress.push({ type: 'log', message: `lane ${lane} running (${count} active)` });
    }
    for (const [lane, queue] of this.lanes) {
      if (queue.length > 0) {
        progress.push({ type: 'log', message: `lane ${lane} has ${queue.length} queued` });
      }
    }
    return progress;
  }
}
