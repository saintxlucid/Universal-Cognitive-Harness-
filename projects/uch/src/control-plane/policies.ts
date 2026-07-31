export type PolicyEffect = 'allow' | 'deny';

export interface PolicyRule {
  id: string;
  effect: PolicyEffect;
  principals: string[];
  actions: string[];
  resources: string[];
  conditions?: Record<string, unknown>;
  priority: number;
}

export class PolicyEngine {
  private rules: PolicyRule[] = [];

  addRule(rule: PolicyRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  removeRule(id: string): void {
    this.rules = this.rules.filter((r) => r.id !== id);
  }

  evaluate(params: { principal: string; action: string; resource: string; context?: Record<string, unknown> }): { allowed: boolean; matchedRule: PolicyRule | null } {
    for (const rule of this.rules) {
      if (!rule.principals.includes('*') && !rule.principals.includes(params.principal)) continue;
      if (!rule.actions.includes('*') && !rule.actions.includes(params.action)) continue;
      if (!rule.resources.includes('*') && !rule.resources.includes(params.resource)) continue;

      if (rule.conditions) {
        if (!this.evaluateConditions(rule.conditions, params.context ?? {})) continue;
      }

      return { allowed: rule.effect === 'allow', matchedRule: rule };
    }

    return { allowed: false, matchedRule: null };
  }

  getAllRules(): PolicyRule[] {
    return [...this.rules];
  }

  clear(): void {
    this.rules = [];
  }

  private evaluateConditions(conditions: Record<string, unknown>, context: Record<string, unknown>): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      const ctxVal = context[key];
      if (typeof value === 'object' && value !== null && 'eq' in (value as any)) {
        if (ctxVal !== (value as any).eq) return false;
      } else if (ctxVal !== value) {
        return false;
      }
    }
    return true;
  }
}
