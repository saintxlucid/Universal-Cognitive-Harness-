/**
 * Productivity OS Engine — the unified productivity pipeline:
 *
 *   Define Goals (SMART) → Choose Priorities (MIT, Pareto, Eisenhower)
 *   → Schedule (Time Blocking) → Focus (Pomodoro, Eat the Frog, Batching)
 *   → Capture (GTD, Two-Minute Rule) → Review → Repeat
 *
 * Each method solves a different bottleneck; the engine is deterministic
 * and operates on plain task descriptors.
 */

export type Urgency = 'urgent' | 'not-urgent';
export type Importance = 'important' | 'not-important';

export interface Task {
  name: string;
  /** Minutes estimated. */
  durationMin?: number;
  urgency?: Urgency;
  importance?: Importance;
  /** 0-1 leverage — share of total outcome this task drives (Pareto). */
  leverage?: number;
  /** 0-1 emotional resistance — Eat the Frog signal. */
  resistance?: number;
  /** Free text notes (captured via GTD). */
  notes?: string;
}

export interface TaskPlannerInput {
  tasks: Task[];
  /** Hours available today for focused work. */
  focusHours?: number;
  pomodoroMin?: number;
}

export interface TaskPlannerOutput {
  /** MIT — the 1-3 most important tasks. */
  mostImportantTasks: string[];
  /** Eisenhower classification. */
  eisenhower: Record<'do' | 'schedule' | 'delegate' | 'delete', string[]>;
  /** Pareto vital few. */
  vitalFew: string[];
  /** Eat the frog recommendation. */
  eatTheFrog: string | null;
  /** Eat-the-frog candidate: the top MIT when it carries resistance, else the most resisted task. */
  frog: string | null;
  /** Two-minute rule: tasks doable in <= 2 minutes (same as twoMinuteActions). */
  quickTasks: string[];
  /** Batching hints: groups of short tasks sharing a theme (<= 15 minutes each). */
  batches: { name: string; tasks: string[] }[];
  /** Proposed time blocks. */
  timeBlocks: { start: string; task: string; minutes: number }[];
  /** GTD-style two-minute rule results. */
  twoMinuteActions: string[];
  /** Smart goal template. */
  smartGoal: { specific: boolean; measurable: boolean; achievable: boolean; relevant: boolean; timeBound: boolean; gaps: string[] };
}

const EISENHOWER_MAP: Record<string, { do: boolean; schedule: boolean; delegate: boolean; delete: boolean }> = {
  'important|urgent': { do: true, schedule: false, delegate: false, delete: false },
  'important|not-urgent': { do: false, schedule: true, delegate: false, delete: false },
  'not-important|urgent': { do: false, schedule: false, delegate: true, delete: false },
  'not-important|not-urgent': { do: false, schedule: false, delegate: false, delete: true },
};

export function planTasks(input: TaskPlannerInput): TaskPlannerOutput {
  const tasks = input.tasks;
  const eisenhower = { do: [] as string[], schedule: [] as string[], delegate: [] as string[], delete: [] as string[] };
  for (const t of tasks) {
    if (t.urgency && t.importance) {
      const cell = EISENHOWER_MAP[`${t.importance}|${t.urgency}`];
      if (cell) {
        if (cell.do) eisenhower.do.push(t.name);
        if (cell.schedule) eisenhower.schedule.push(t.name);
        if (cell.delegate) eisenhower.delegate.push(t.name);
        if (cell.delete) eisenhower.delete.push(t.name);
      }
    }
  }

  const mitCandidates = eisenhower.do.length > 0 ? eisenhower.do : eisenhower.schedule;
  const mostImportantTasks = mitCandidates.slice(0, 3);

  const totalLeverage = tasks.reduce((acc, t) => acc + Math.max(0, t.leverage ?? 0), 0) || 1;
  let cum = 0;
  const vitalFew: string[] = [];
  const byLeverage = [...tasks].sort((a, b) => (b.leverage ?? 0) - (a.leverage ?? 0));
  for (const t of byLeverage) {
    const share = ((t.leverage ?? 0) / totalLeverage) * 100;
    // The item that crosses the 80% line is still vital.
    if (cum < 80 || vitalFew.length === 0) vitalFew.push(t.name);
    cum += share;
  }

  const frog = [...tasks].sort((a, b) => (b.resistance ?? 0) - (a.resistance ?? 0))[0] ?? null;
  const eatTheFrog = frog && (frog.resistance ?? 0) > 0.5 ? frog.name : null;

  // Explicit frog candidate: prefer the top MIT when it also carries resistance,
  // otherwise fall back to the single most-resisted task.
  const topMit = mostImportantTasks[0] ?? null;
  let frogCandidate: string | null = null;
  if (frog && (frog.resistance ?? 0) > 0.5) {
    const topMitTask = topMit ? tasks.find((t) => t.name === topMit) : null;
    frogCandidate =
      topMitTask && (topMitTask.resistance ?? 0) > 0.5 ? topMit : frog.name;
  }

  const focusMin = Math.round((input.focusHours ?? 4) * 60);
  const focusTasks = [...mostImportantTasks, ...vitalFew.filter((v) => !mostImportantTasks.includes(v))].slice(0, 4);
  const perTask = focusTasks.length > 0 ? Math.round(focusMin / focusTasks.length) : 0;
  let cursor = 9;
  const timeBlocks = focusTasks.map((task) => {
    const block = { start: `${cursor}:00`, task, minutes: Math.min(perTask, 90) };
    cursor += Math.round(perTask / 60);
    return block;
  });

  const quickTasks = tasks.filter((t) => (t.durationMin ?? Infinity) <= 2).map((t) => t.name);
  const twoMinuteActions = quickTasks;
  const batches = clusterShortTasks(tasks.filter((t) => (t.durationMin ?? Infinity) <= 15));

  const goal = input.tasks[0]?.notes ?? '';
  const ACTION_VERBS = /\b(complete|build|fix|create|reduce|increase|improve|ship|write|implement|deliver|learn|finish|launch|migrate|add|remove|optimize|refactor|land)\b/i;
  const smartGoal = {
    specific: ACTION_VERBS.test(goal) && /(what|to|using|with|by)/i.test(goal),
    measurable: /\d|percent|count|number|reduce|increase/.test(goal),
    achievable: !/(all|everything|world|perfect)/i.test(goal),
    relevant: true,
    timeBound: /by|within|in \d+|weeks?|months?|days?/.test(goal),
    gaps: [] as string[],
  };
  if (!smartGoal.specific) smartGoal.gaps.push('make it specific: what exactly will be achieved?');
  if (!smartGoal.measurable) smartGoal.gaps.push('make it measurable: add a number or metric');
  if (!smartGoal.achievable) smartGoal.gaps.push('tone it down: achievable, not aspirational');
  if (!smartGoal.timeBound) smartGoal.gaps.push('make it time-bound: add a deadline');

  return {
    mostImportantTasks,
    eisenhower,
    vitalFew,
    eatTheFrog,
    frog: frogCandidate,
    quickTasks,
    batches,
    timeBlocks,
    twoMinuteActions,
    smartGoal,
  };
}

/* ── Batching helper ─────────────────────────────────────────────── */

const BATCH_STOP = new Set(['the', 'a', 'an', 'to', 'for', 'with', 'in', 'on', 'at', 'and', 'my', 'our', 'your', 'all', 'of']);
const BATCH_VERBS = new Set([
  'send', 'reply', 'update', 'check', 'review', 'fix', 'create', 'write', 'read',
  'call', 'email', 'fill', 'file', 'schedule', 'prepare', 'organize', 'clean',
  'set', 'make', 'do', 'log', 'track', 'add', 'remove', 'print', 'buy', 'order',
]);

/** Group short tasks (<= 15 min) into batches by their leading theme keyword. */
export function clusterShortTasks(tasks: Task[]): { name: string; tasks: string[] }[] {
  const groups = new Map<string, string[]>();
  const order: string[] = [];
  for (const t of tasks) {
    const tokens = t.name.toLowerCase().split(/\W+/).filter(Boolean);
    const theme =
      tokens.find((w) => !BATCH_STOP.has(w) && !BATCH_VERBS.has(w)) ?? tokens[0] ?? 'misc';
    const key = theme.slice(0, 12);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(t.name);
  }
  return order.map((key) => ({ name: key, tasks: groups.get(key)! })).filter((g) => g.tasks.length >= 2);
}

/* ── 3-3-3 method ────────────────────────────────────────────────── */

export interface ThreeThreeThreeInput {
  deepWorkHours: number;
  urgentTasks: string[];
  maintenanceTasks: string[];
}

export interface ThreeThreeThreeResult {
  structure: string;
  commitments: string[];
  warning: string | null;
}

export function threeThreeThree(input: ThreeThreeThreeInput): ThreeThreeThreeResult {
  const deep = `3 hours on the most important work (${input.deepWorkHours >= 3 ? 'ok' : `only ${input.deepWorkHours}h — below the 3h target`})`;
  const urgent = input.urgentTasks.slice(0, 3);
  const maintenance = input.maintenanceTasks.slice(0, 3);
  return {
    structure: deep,
    commitments: [...urgent, ...maintenance],
    warning: input.urgentTasks.length > 3 ? 'more than 3 urgent tasks — reprioritize' : null,
  };
}
