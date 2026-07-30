import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

export interface ScheduledTask {
  id: string;
  name: string;
  handler: string;
  payload?: Record<string, unknown>;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  result?: unknown;
  schedule?: TaskSchedule;
}

export interface TaskSchedule {
  type: 'once' | 'interval' | 'daily' | 'cron';
  intervalMs?: number;
  hour?: number;
  minute?: number;
  expression?: string;
}

export type TaskHandler = (task: ScheduledTask) => unknown | Promise<unknown>;

export class TaskScheduler {
  private tasks: Map<string, ScheduledTask> = new Map();
  private handlers: Map<string, TaskHandler> = new Map();
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private completedCount = 0;
  private failedCount = 0;
  private running = false;

  registerHandler(name: string, handler: TaskHandler): void {
    this.handlers.set(name, handler);
  }

  unregisterHandler(name: string): void {
    this.handlers.delete(name);
  }

  enqueue(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt'>): ScheduledTask {
    const created: ScheduledTask = {
      ...task,
      id: crypto.randomUUID(),
      status: 'pending',
      createdAt: new Date(),
    };
    this.tasks.set(created.id, created);
    return created;
  }

  schedule(task: Omit<ScheduledTask, 'id' | 'status' | 'createdAt' | 'schedule'> & { schedule: TaskSchedule }): ScheduledTask {
    const created = this.enqueue(task);
    this.startSchedule(created);
    return created;
  }

  async execute(taskId: string): Promise<unknown> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status === 'running') throw new Error(`Task already running: ${taskId}`);

    const handler = this.handlers.get(task.handler);
    if (!handler) throw new Error(`Handler not found: ${task.handler}`);

    task.status = 'running';
    task.startedAt = new Date();

    try {
      const result = await handler(task);
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
      this.completedCount++;
      return result;
    } catch (err) {
      task.status = 'failed';
      task.error = err instanceof Error ? err.message : String(err);
      this.failedCount++;
      throw err;
    }
  }

  async executeAll(): Promise<{ completed: number; failed: number }> {
    const pending = [...this.tasks.values()].filter((t) => t.status === 'pending');
    pending.sort((a, b) => {
      const prioRank = { critical: 0, high: 1, normal: 2, low: 3 };
      return (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2);
    });

    let completed = 0;
    let failed = 0;
    for (const task of pending) {
      try {
        await this.execute(task.id);
        completed++;
      } catch {
        failed++;
      }
    }
    return { completed, failed };
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'completed') return false;
    task.status = 'cancelled';
    this.stopTimer(taskId);
    return true;
  }

  getTask(taskId: string): ScheduledTask | undefined {
    return this.tasks.get(taskId);
  }

  getByStatus(status: TaskStatus): ScheduledTask[] {
    return [...this.tasks.values()].filter((t) => t.status === status);
  }

  getByHandler(handler: string): ScheduledTask[] {
    return [...this.tasks.values()].filter((t) => t.handler === handler);
  }

  getAll(limit = 100): ScheduledTask[] {
    return [...this.tasks.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    for (const task of this.tasks.values()) {
      if (task.schedule && task.status === 'pending') {
        this.startSchedule(task);
      }
    }
  }

  stop(): void {
    this.running = false;
    for (const [id] of this.timers) {
      this.stopTimer(id);
    }
  }

  getStats(): { total: number; pending: number; running: number; completed: number; failed: number; cancelled: number; handlers: number } {
    const all = [...this.tasks.values()];
    return {
      total: all.length,
      pending: all.filter((t) => t.status === 'pending').length,
      running: all.filter((t) => t.status === 'running').length,
      completed: this.completedCount,
      failed: this.failedCount,
      cancelled: all.filter((t) => t.status === 'cancelled').length,
      handlers: this.handlers.size,
    };
  }

  private startSchedule(task: ScheduledTask): void {
    if (!task.schedule) return;
    if (task.schedule.type === 'once') return;

    const run = () => { this.execute(task.id).catch(() => {}); };

    if (task.schedule.type === 'interval' && task.schedule.intervalMs) {
      const timer = setInterval(run, task.schedule.intervalMs);
      this.timers.set(task.id, timer);
    } else if (task.schedule.type === 'daily') {
      const hour = task.schedule.hour ?? 0;
      const minute = task.schedule.minute ?? 0;
      const msUntilNext = this.computeMsUntilDaily(hour, minute);
      setTimeout(() => {
        run();
        const timer = setInterval(run, 24 * 60 * 60 * 1000);
        this.timers.set(task.id, timer);
      }, msUntilNext);
    }
  }

  private stopTimer(taskId: string): void {
    const timer = this.timers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(taskId);
    }
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      tasks: mapToRecord(this.tasks),
      completedCount: this.completedCount,
      failedCount: this.failedCount,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      tasks: Record<string, ScheduledTask>;
      completedCount: number;
      failedCount: number;
    }>(filePath);
    if (!data) return 0;

    this.tasks = recordToMap(data.tasks ?? {});
    this.completedCount = data.completedCount ?? 0;
    this.failedCount = data.failedCount ?? 0;
    return this.tasks.size;
  }

  private computeMsUntilDaily(hour: number, minute: number): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }
}
