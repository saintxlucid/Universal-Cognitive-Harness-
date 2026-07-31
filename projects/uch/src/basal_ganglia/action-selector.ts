export interface Action {
  id: string;
  name: string;
  priority: number;
  estimatedCost: number;
  dependencies: string[];
  handler: () => Promise<void>;
  metadata?: Record<string, unknown>;
}

export interface ActionSelectionResult {
  selected: Action | null;
  candidates: Action[];
  reason: string;
}

export class ActionSelector {
  private queue: Action[] = [];
  private history: ActionSelectionResult[] = [];
  private inFlight: Set<string> = new Set();
  private nextId = 0;

  enqueue(action: Omit<Action, 'id'>): string {
    const id = `action-${this.nextId++}`;
    this.queue.push({ id, ...action });
    this.queue.sort((a, b) => b.priority - a.priority);
    return id;
  }

  dequeue(id: string): boolean {
    const idx = this.queue.findIndex((a) => a.id === id);
    if (idx >= 0) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  select(resourceBudget = 1.0): ActionSelectionResult {
    const available = this.queue.filter((a) => {
      const depsMet = a.dependencies.every((d) => !this.inFlight.has(d));
      return depsMet && a.estimatedCost <= resourceBudget;
    });

    if (available.length === 0) {
      return {
        selected: null,
        candidates: [],
        reason: this.queue.length === 0 ? 'No actions queued' : 'No actions within budget',
      };
    }

    const selected = available[0]!;
    this.inFlight.add(selected.id);
    this.queue = this.queue.filter((a) => a.id !== selected.id);

    const result: ActionSelectionResult = {
      selected,
      candidates: available.slice(0, 5),
      reason: `Selected "${selected.name}" (priority ${selected.priority})`,
    };

    this.history.push(result);
    if (this.history.length > 100) this.history.shift();

    return result;
  }

  complete(id: string): void {
    this.inFlight.delete(id);
  }

  fail(id: string): void {
    this.inFlight.delete(id);
  }

  getQueue(): Action[] {
    return [...this.queue];
  }

  getInFlight(): string[] {
    return [...this.inFlight];
  }

  getStats(): Record<string, unknown> {
    return {
      queued: this.queue.length,
      inFlight: this.inFlight.size,
      totalSelected: this.history.length,
      avgPriority:
        this.history.length > 0
          ? this.history.reduce((s, r) => s + (r.selected!.priority ?? 0), 0) /
            this.history.length
          : 0,
    };
  }
}
