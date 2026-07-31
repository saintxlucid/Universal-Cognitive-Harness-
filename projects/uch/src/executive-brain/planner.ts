export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  dependencies: string[];
  assigned_agent: string | null;
  estimated_cost: number;
  result: string | null;
  error: string | null;
}

export interface Plan {
  id: string;
  goal: string;
  created_at: Date;
  updated_at: Date;
  status: 'active' | 'completed' | 'failed' | 'abandoned';
  steps: PlanStep[];
  context: Record<string, unknown>;
}

export class Planner {
  private plans: Map<string, Plan> = new Map();

  createPlan(goal: string, context?: Record<string, unknown>): Plan {
    const plan: Plan = {
      id: crypto.randomUUID(),
      goal,
      created_at: new Date(),
      updated_at: new Date(),
      status: 'active',
      steps: [],
      context: context ?? {},
    };
    this.plans.set(plan.id, plan);
    return plan;
  }

  addStep(planId: string, description: string, dependencies: string[] = []): PlanStep | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;

    const step: PlanStep = {
      id: crypto.randomUUID(),
      description,
      status: 'pending',
      dependencies,
      assigned_agent: null,
      estimated_cost: 1,
      result: null,
      error: null,
    };

    plan.steps.push(step);
    plan.updated_at = new Date();
    return step;
  }

  getNextSteps(planId: string): PlanStep[] {
    const plan = this.plans.get(planId);
    if (!plan) return [];

    return plan.steps.filter((step) => {
      if (step.status !== 'pending') return false;
      return step.dependencies.every((depId) => {
        const dep = plan.steps.find((s) => s.id === depId);
        return dep?.status === 'completed';
      });
    });
  }

  getBlockedSteps(planId: string): PlanStep[] {
    const plan = this.plans.get(planId);
    if (!plan) return [];
    return plan.steps.filter((step) => step.status === 'blocked');
  }

  assignStep(planId: string, stepId: string, agentId: string): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return false;

    step.assigned_agent = agentId;
    plan.updated_at = new Date();
    return true;
  }

  getReadySteps(planId: string): PlanStep[] {
    return this.getNextSteps(planId);
  }

  updateStepStatus(
    planId: string,
    stepId: string,
    status: PlanStep['status'],
    result?: string,
    error?: string,
  ): boolean {
    const plan = this.plans.get(planId);
    if (!plan) return false;

    const step = plan.steps.find((s) => s.id === stepId);
    if (!step) return false;

    step.status = status;
    if (result) step.result = result;
    if (error) step.error = error;
    plan.updated_at = new Date();

    // Auto-complete plan if all steps done
    if (plan.steps.every((s) => s.status === 'completed' || s.status === 'failed')) {
      plan.status = plan.steps.some((s) => s.status === 'failed') ? 'failed' : 'completed';
    }

    return true;
  }

  getPlan(id: string): Plan | undefined {
    return this.plans.get(id);
  }

  getActivePlans(): Plan[] {
    return [...this.plans.values()].filter((p) => p.status === 'active');
  }

  planSummary(planId: string): string | null {
    const plan = this.plans.get(planId);
    if (!plan) return null;
    const total = plan.steps.length;
    const done = plan.steps.filter((s) => s.status === 'completed').length;
    const failed = plan.steps.filter((s) => s.status === 'failed').length;
    const blocked = plan.steps.filter((s) => s.status === 'blocked').length;

    return [
      `Plan: ${plan.goal}`,
      `Status: ${plan.status}`,
      `Progress: ${done}/${total} steps (${failed} failed, ${blocked} blocked)`,
      plan.steps.map((s) => `  [${s.status}] ${s.description}`).join('\n'),
    ].join('\n');
  }
}
