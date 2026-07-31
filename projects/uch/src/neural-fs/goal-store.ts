import { VectorStore } from '../kernel/storage/vector-store.js';
import { GraphStore } from '../kernel/storage/graph-store.js';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned' | 'blocked';
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Goal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  priority: GoalPriority;
  parentGoalId: string | null;
  subGoalIds: string[];
  deadline: number | null;
  progress: number;
  dependencies: string[];
  blockedBy: string[];
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  notes: string[];
}

export class GoalStore {
  private goals: Map<string, Goal> = new Map();
  private vectors: VectorStore;
  private graph: GraphStore;

  constructor(vectors: VectorStore, graph: GraphStore) {
    this.vectors = vectors;
    this.graph = graph;
  }

  createGoal(title: string, description: string, priority: GoalPriority = 'medium', options?: {
    parentGoalId?: string; deadline?: number; tags?: string[]; createdBy?: string; dependencies?: string[];
  }): Goal {
    const id = `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const goal: Goal = {
      id, title, description, status: 'active', priority,
      parentGoalId: options?.parentGoalId ?? null, subGoalIds: [],
      deadline: options?.deadline ?? null, progress: 0,
      dependencies: options?.dependencies ?? [], blockedBy: [],
      createdBy: options?.createdBy ?? 'system', createdAt: Date.now(),
      updatedAt: Date.now(), tags: options?.tags ?? [], notes: [],
    };
    this.goals.set(id, goal);

    this.graph.addNode(id, 'goal', title, { priority, status: goal.status });

    if (goal.parentGoalId) {
      const parent = this.goals.get(goal.parentGoalId);
      if (parent) {
        parent.subGoalIds.push(id);
        this.graph.addEdge(`goal-hierarchy-${id}`, parent.id, id, 'contains', { type: 'hierarchy' });
      }
    }
    for (const depId of goal.dependencies) {
      if (this.goals.has(depId)) {
        this.graph.addEdge(`goal-dep-${id}-${depId}`, id, depId, 'depends-on', { type: 'dependency' });
      }
    }
    this.checkBlockers(id);
    return goal;
  }

  updateProgress(id: string, progress: number): void {
    const goal = this.goals.get(id);
    if (!goal) return;
    goal.progress = Math.min(100, Math.max(0, progress));
    goal.updatedAt = Date.now();
    if (goal.progress >= 100) goal.status = 'completed';
    this.checkBlockers(id);
    this.propagateProgress(id);
  }

  private checkBlockers(id: string): void {
    const goal = this.goals.get(id);
    if (!goal) return;
    goal.blockedBy = goal.dependencies.filter(depId => {
      const dep = this.goals.get(depId);
      return dep && dep.status !== 'completed';
    });
    if (goal.blockedBy.length > 0 && goal.status === 'active') {
      goal.status = 'blocked';
    } else if (goal.blockedBy.length === 0 && goal.status === 'blocked') {
      goal.status = 'active';
    }
  }

  private propagateProgress(id: string): void {
    for (const goal of this.goals.values()) {
      if (goal.subGoalIds.includes(id)) {
        const subGoals = goal.subGoalIds.map(sid => this.goals.get(sid)).filter((g): g is Goal => g !== undefined);
        if (subGoals.length > 0) {
          goal.progress = Math.round(subGoals.reduce((sum, g) => sum + g.progress, 0) / subGoals.length);
        }
      }
    }
  }

  setStatus(id: string, status: GoalStatus): void {
    const goal = this.goals.get(id);
    if (!goal) return;
    goal.status = status;
    goal.updatedAt = Date.now();
  }

  addNote(id: string, note: string): void {
    const goal = this.goals.get(id);
    if (!goal) return;
    goal.notes.push(note);
    goal.updatedAt = Date.now();
  }

  getGoal(id: string): Goal | undefined {
    return this.goals.get(id);
  }

  getActiveGoals(priority?: GoalPriority): Goal[] {
    let results = [...this.goals.values()].filter(g => g.status === 'active');
    if (priority) results = results.filter(g => g.priority === priority);
    return results.sort((a, b) => {
      const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (pOrder[a.priority] ?? 99) - (pOrder[b.priority] ?? 99);
    });
  }

  getGoalHierarchy(rootId: string): { goal: Goal; children: Goal[] } | null {
    const goal = this.goals.get(rootId);
    if (!goal) return null;
    return {
      goal,
      children: goal.subGoalIds.map(id => this.goals.get(id)).filter((g): g is Goal => g !== undefined),
    };
  }

  count(): { total: number; active: number; completed: number; blocked: number } {
    const all = [...this.goals.values()];
    return {
      total: all.length,
      active: all.filter(g => g.status === 'active').length,
      completed: all.filter(g => g.status === 'completed').length,
      blocked: all.filter(g => g.status === 'blocked').length,
    };
  }
}
