import type { TaskModel, TaskStatus } from '../types.js';

export type TaskType = 'local_agent' | 'local_bash' | 'in_process_teammate' | 'monitor' | 'dream';

export interface TaskContext {
  abortController: AbortController;
  sessionId: string;
  getState(): Record<string, unknown>;
}

export interface Task {
  readonly id: string;
  readonly type: TaskType;
  readonly description: string;
  status: TaskStatus;
  createdAt: Date;
  result?: string;
  error?: string;
  start(context: TaskContext): Promise<void>;
  kill(): Promise<void>;
  output?(): string;
}

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function generateTaskId(prefix: string): string {
  let id = prefix;
  for (let i = 0; i < 8; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return id;
}

export class LocalAgentTask implements Task {
  readonly id: string;
  readonly type: TaskType = 'local_agent';
  readonly description: string;
  status: TaskStatus = 'pending';
  createdAt = new Date();
  result?: string;
  error?: string;

  private run: (context: TaskContext) => Promise<string>;
  private abortController = new AbortController();
  private outputBuffer: string[] = [];

  constructor(description: string, run: (context: TaskContext) => Promise<string>) {
    this.id = generateTaskId('agent_');
    this.description = description;
    this.run = run;
  }

  async start(context: TaskContext): Promise<void> {
    this.status = 'running';
    try {
      this.result = await this.run({
        abortController: this.abortController,
        sessionId: context.sessionId,
        getState: context.getState,
      });
      this.status = 'completed';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = 'failed';
    }
  }

  async kill(): Promise<void> {
    this.abortController.abort();
    if (this.status === 'pending' || this.status === 'running') {
      this.status = 'cancelled';
    }
  }

  output(): string {
    return this.outputBuffer.join('\n');
  }
}

export class LocalShellTask implements Task {
  readonly id: string;
  readonly type: TaskType = 'local_bash';
  readonly description: string;
  status: TaskStatus = 'pending';
  createdAt = new Date();
  result?: string;
  error?: string;

  private command: string;
  private cwd: string;
  private child: { kill(): void } | null = null;
  private outputBuffer: string[] = [];

  constructor(command: string, cwd: string) {
    this.id = generateTaskId('bash_');
    this.description = `Run: ${command}`;
    this.command = command;
    this.cwd = cwd;
  }

  async start(context: TaskContext): Promise<void> {
    this.status = 'running';
    const { exec } = await import('node:child_process');
    await new Promise<void>((resolve) => {
      const proc = exec(
        this.command,
        {
          cwd: this.cwd,
          timeout: 0,
          maxBuffer: 50 * 1024 * 1024,
          windowsHide: true,
        },
        (error, stdout, stderr) => {
          this.outputBuffer.push(stdout ?? '', stderr ?? '');
          if (error) {
            this.error = error.message;
            this.status = 'failed';
          } else {
            this.result = (stdout + stderr).slice(0, 100000);
            this.status = 'completed';
          }
          resolve();
        },
      );
      this.child = proc;
      context.abortController.signal.addEventListener('abort', () => {
        proc.kill();
      });
    });
  }

  async kill(): Promise<void> {
    this.child?.kill();
    if (this.status === 'pending' || this.status === 'running') {
      this.status = 'cancelled';
    }
  }

  output(): string {
    return this.outputBuffer.join('\n');
  }
}

export class DreamTask implements Task {
  readonly id: string;
  readonly type: TaskType = 'dream';
  readonly description: string;
  status: TaskStatus = 'pending';
  createdAt = new Date();
  result?: string;
  error?: string;

  private run: () => Promise<string>;

  constructor(description: string, run: () => Promise<string>) {
    this.id = generateTaskId('dream_');
    this.description = description;
    this.run = run;
  }

  async start(): Promise<void> {
    this.status = 'running';
    try {
      this.result = await this.run();
      this.status = 'completed';
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
      this.status = 'failed';
    }
  }

  async kill(): Promise<void> {
    if (this.status === 'pending' || this.status === 'running') {
      this.status = 'cancelled';
    }
  }
}

export interface TaskRegistry {
  getAll(): Task[];
  getByType(type: TaskType): Task[];
  register(task: Task): void;
  get(id: string): Task | undefined;
  remove(id: string): boolean;
}

export function createTaskRegistry(): TaskRegistry {
  const tasks = new Map<string, Task>();
  return {
    getAll: () => [...tasks.values()],
    getByType: (type) => [...tasks.values()].filter((t) => t.type === type),
    register: (task) => {
      tasks.set(task.id, task);
    },
    get: (id) => tasks.get(id),
    remove: (id) => tasks.delete(id),
  };
}

export function taskToModel(task: Task): TaskModel {
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    description: task.description,
    createdAt: task.createdAt,
    result: task.result,
    error: task.error,
  };
}

export function taskSummary(task: Task): string {
  const prefix = task.status === 'completed' ? '' : task.status === 'running' ? 'RUNNING ' : `${task.status.toUpperCase()} `;
  return `${prefix}[${task.type}] ${task.description}`;
}
