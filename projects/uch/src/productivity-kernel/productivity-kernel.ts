/**
 * Productivity Kernel (Basal Ganglia, extended) — blueprint §2.
 *
 * Converts goals into scheduled, prioritized, interruption-resistant
 * execution units: MIT selection, Eisenhower classification, time
 * blocks, Pomodoro cycles, GTD capture, frog-first ordering. Delegates
 * the task-planning math to the productivity framework engine (pure
 * function) and adds the stateful organ behavior: session day
 * initialization, MIT tracking, capture-to-clarify latency, plan-to-
 * execution conversion, and interruption resistance.
 *
 * Benchmarkable: plan-to-execution conversion rate, MIT completion
 * rate, capture-to-clarify latency.
 */

import {
  planTasks,
  threeThreeThree,
  type Task,
  type TaskPlannerInput,
  type TaskPlannerOutput,
} from '../cognitive-plane/frameworks/productivity/productivity-os.js';

export interface PendingTask {
  id: string;
  name: string;
  /** Estimated minutes (drives the two-minute rule). */
  durationMin?: number;
  /** Seconds from capture to clarification. */
  capturedAt: Date;
  clarified: boolean;
  clarifiedAt: Date | null;
  completed: boolean;
  completedAt: Date | null;
}

export interface DayPlan {
  date: string;
  mit: string[];
  timeBlocks: TaskPlannerOutput['timeBlocks'];
  pomodoroCycles: number;
}

export type ProductivityEventType = 'productivity:task_captured' | 'productivity:day_planned';

export interface ProductivityEvent {
  type: ProductivityEventType;
  source: string;
  payload: Record<string, unknown>;
}

export interface ProductivityKernelConfig {
  /** Default focus hours per day (default 4). */
  focusHours?: number;
  /** Pomodoro length in minutes (default 25). */
  pomodoroMin?: number;
  /** Fire-and-forget event sink for the event-driven workflow layer. */
  eventSink?: (event: ProductivityEvent) => void;
}

export class ProductivityKernel {
  private config: Required<Omit<ProductivityKernelConfig, 'eventSink'>>;
  private readonly eventSink: ((event: ProductivityEvent) => void) | undefined;
  private inbox: PendingTask[] = [];
  private dayPlan: DayPlan | null = null;
  private executed = 0;
  private planned = 0;
  private capturedTotal = 0;
  private clarifyLatencyMsSum = 0;
  private clarifiedCount = 0;

  constructor(config: ProductivityKernelConfig = {}) {
    this.config = {
      focusHours: config.focusHours ?? 4,
      pomodoroMin: config.pomodoroMin ?? 25,
    };
    this.eventSink = config.eventSink;
  }

  /** GTD capture: add a task to the inbox (fast, no friction). */
  capture(name: string, durationMin?: number): PendingTask {
    const task: PendingTask = {
      id: crypto.randomUUID(),
      name,
      durationMin,
      capturedAt: new Date(),
      clarified: false,
      clarifiedAt: null,
      completed: false,
      completedAt: null,
    };
    this.inbox.push(task);
    this.capturedTotal++;
    this.eventSink?.({
      type: 'productivity:task_captured',
      source: 'productivity-kernel',
      payload: {
        task_id: task.id,
        name: task.name,
        duration_min: task.durationMin ?? null,
        inbox_size: this.inbox.length,
      },
    });
    return task;
  }

  /** GTD clarify: mark a captured item actionable (latency benchmark). */
  clarify(id: string): boolean {
    const task = this.inbox.find((t) => t.id === id);
    if (!task || task.clarified) return false;
    task.clarified = true;
    task.clarifiedAt = new Date();
    this.clarifyLatencyMsSum += task.clarifiedAt.getTime() - task.capturedAt.getTime();
    this.clarifiedCount++;
    return true;
  }

  /** Two-minute rule: trivial captured items may be executed immediately. */
  getTwoMinuteActions(): string[] {
    const output = this.buildPlannerOutput(this.inbox.map((t) => ({ name: t.name, durationMin: t.durationMin })));
    return output.twoMinuteActions;
  }

  /**
   * Initialize the day: select MITs (frog-first, Eisenhower, Pareto)
   * and schedule time blocks. Returns the day plan.
   */
  initializeDay(tasks: Task[]): DayPlan {
    const output = this.buildPlannerOutput(tasks);
    this.planned += output.mostImportantTasks.length;

    const pomodoroCycles = output.timeBlocks.reduce(
      (acc, b) => acc + Math.max(1, Math.round(b.minutes / this.config.pomodoroMin)),
      0,
    );

    this.dayPlan = {
      date: new Date().toISOString().slice(0, 10),
      mit: output.mostImportantTasks,
      timeBlocks: output.timeBlocks,
      pomodoroCycles,
    };
    this.eventSink?.({
      type: 'productivity:day_planned',
      source: 'productivity-kernel',
      payload: {
        date: this.dayPlan.date,
        mit_count: this.dayPlan.mit.length,
        block_count: this.dayPlan.timeBlocks.length,
        pomodoro_cycles: this.dayPlan.pomodoroCycles,
      },
    });
    return this.dayPlan;
  }

  /**
   * Execute a task from the plan. Interruption resistance: a task that
   * has started may be interrupted only with a reason (tracked, but not
   * silently dropped).
   */
  execute(taskName: string, interrupted = false): boolean {
    if (!this.dayPlan) return false;
    const inPlan = [...this.dayPlan.mit, ...this.dayPlan.timeBlocks.map((b) => b.task)].includes(taskName);
    if (!inPlan) return false;
    this.executed++;
    if (interrupted) this.interruptions++;
    const inbox = this.inbox.find((t) => t.name === taskName);
    if (inbox) {
      inbox.completed = true;
      inbox.completedAt = new Date();
    }
    return true;
  }

  private interruptions = 0;

  /** 3-3-3 structure check (3h deep work, 3 urgent, 3 maintenance). */
  threeThreeThree(deepWorkHours: number, urgent: string[], maintenance: string[]) {
    return threeThreeThree({ deepWorkHours, urgentTasks: urgent, maintenanceTasks: maintenance });
  }

  /** Benchmark: plan-to-execution conversion rate. */
  getPlanExecutionRate(): number {
    if (this.planned === 0) return 0;
    return this.executed / this.planned;
  }

  /** Benchmark: MIT completion rate. */
  getMITCompletionRate(): number {
    if (!this.dayPlan || this.dayPlan.mit.length === 0) return 0;
    const completed = this.dayPlan.mit.filter((m) =>
      this.inbox.some((t) => t.name === m && t.completed),
    ).length;
    return completed / this.dayPlan.mit.length;
  }

  /** Benchmark: capture-to-clarify latency (ms). */
  getCaptureToClarifyLatencyMs(): number {
    if (this.clarifiedCount === 0) return 0;
    return Math.round(this.clarifyLatencyMsSum / this.clarifiedCount);
  }

  /** Interruption count per executed task. */
  getInterruptionRate(): number {
    if (this.executed === 0) return 0;
    return this.interruptions / this.executed;
  }

  getInbox(): PendingTask[] {
    return [...this.inbox];
  }

  getDayPlan(): DayPlan | null {
    return this.dayPlan ? { ...this.dayPlan } : null;
  }

  getStatus(): Record<string, unknown> {
    return {
      inbox: this.inbox.length,
      planned: this.planned,
      executed: this.executed,
      planExecutionRate: this.getPlanExecutionRate(),
      mitCompletionRate: this.getMITCompletionRate(),
      captureToClarifyLatencyMs: this.getCaptureToClarifyLatencyMs(),
      interruptionRate: this.getInterruptionRate(),
    };
  }

  private buildPlannerOutput(tasks: Task[]): TaskPlannerOutput {
    return planTasks({
      tasks,
      focusHours: this.config.focusHours,
      pomodoroMin: this.config.pomodoroMin,
    } satisfies TaskPlannerInput);
  }
}
