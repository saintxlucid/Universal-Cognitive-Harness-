export type AsyncTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface AsyncTaskRecord {
  id: string;
  name: string;
  status: AsyncTaskStatus;
  progress: string | null;
  createdAt: string;
  updatedAt: string;
  result: string | null;
  error: string | null;
}

export interface AsyncLaunchOptions {
  signal?: AbortSignal;
}

export type AsyncTaskRunner = (signal: AbortSignal) => Promise<string>;

export function createAsyncTaskId(): string {
  return `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class AsyncSubagentRegistry {
  private tasks = new Map<string, AsyncTaskRecord>();

  launch(name: string, runner: AsyncTaskRunner, options: AsyncLaunchOptions = {}): string {
    const id = createAsyncTaskId();
    const now = new Date().toISOString();
    this.tasks.set(id, {
      id,
      name,
      status: 'queued',
      progress: null,
      createdAt: now,
      updatedAt: now,
      result: null,
      error: null,
    });
    setTimeout(() => {
      void this.execute(id, runner, options.signal ?? null);
    }, 0);
    return id;
  }

  private async execute(id: string, runner: AsyncTaskRunner, signal: AbortSignal | null): Promise<void> {
    const task = this.tasks.get(id);
    if (!task) return;
    if (signal?.aborted) {
      this.transition(id, 'cancelled');
      return;
    }
    task.status = 'running';
    task.updatedAt = new Date().toISOString();
    if (signal) {
      signal.addEventListener('abort', () => {
        this.transition(id, 'cancelled');
      }, { once: true });
    }
    try {
      const result = await runner(signal ?? new AbortController().signal);
      const current = this.tasks.get(id);
      if (!current) return;
      if (current.status === 'cancelled') return;
      current.status = 'completed';
      current.result = result;
      current.updatedAt = new Date().toISOString();
    } catch (error) {
      const current = this.tasks.get(id);
      if (!current) return;
      if (current.status === 'cancelled') return;
      current.status = 'failed';
      current.error = error instanceof Error ? error.message : String(error);
      current.updatedAt = new Date().toISOString();
    }
  }

  private transition(id: string, status: AsyncTaskStatus): void {
    const task = this.tasks.get(id);
    if (!task) return;
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') return;
    task.status = status;
    task.updatedAt = new Date().toISOString();
  }

  check(id: string): AsyncTaskRecord | null {
    const task = this.tasks.get(id);
    return task ? { ...task } : null;
  }

  updateProgress(id: string, progress: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    if (task.status !== 'queued' && task.status !== 'running') return false;
    task.progress = progress;
    task.updatedAt = new Date().toISOString();
    return true;
  }

  cancel(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    this.transition(id, 'cancelled');
    return true;
  }

  list(filter?: { status?: AsyncTaskStatus }): AsyncTaskRecord[] {
    return [...this.tasks.values()]
      .filter((task) => !filter?.status || task.status === filter.status)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((task) => ({ ...task }));
  }

  clearCompleted(): void {
    for (const [id, task] of this.tasks) {
      if (task.status === 'completed' || task.status === 'cancelled' || task.status === 'failed') {
        this.tasks.delete(id);
      }
    }
  }
}
