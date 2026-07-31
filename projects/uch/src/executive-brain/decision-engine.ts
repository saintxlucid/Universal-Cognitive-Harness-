export interface DecisionOption {
  id: string;
  label: string;
  description: string;
  confidence: number;
  pros: string[];
  cons: string[];
  estimated_effort: string;
  estimated_impact: string;
}

export interface Decision {
  id: string;
  prompt: string;
  options: DecisionOption[];
  selected_option: string | null;
  rationale: string | null;
  status: 'pending' | 'made' | 'executed' | 'revisited';
  created_at: Date;
  made_at: Date | null;
}

export class DecisionEngine {
  private decisions: Map<string, Decision> = new Map();

  createDecision(prompt: string, options: Omit<DecisionOption, 'id'>[]): Decision {
    const decision: Decision = {
      id: crypto.randomUUID(),
      prompt,
      options: options.map((o) => ({ ...o, id: crypto.randomUUID() })),
      selected_option: null,
      rationale: null,
      status: 'pending',
      created_at: new Date(),
      made_at: null,
    };
    this.decisions.set(decision.id, decision);
    return decision;
  }

  makeDecision(decisionId: string, optionId: string, rationale: string): boolean {
    const decision = this.decisions.get(decisionId);
    if (!decision) return false;

    const option = decision.options.find((o) => o.id === optionId);
    if (!option) return false;

    decision.selected_option = optionId;
    decision.rationale = rationale;
    decision.status = 'made';
    decision.made_at = new Date();
    return true;
  }

  revisitDecision(decisionId: string): boolean {
    const decision = this.decisions.get(decisionId);
    if (!decision) return false;
    decision.status = 'revisited';
    return true;
  }

  getDecision(id: string): Decision | undefined {
    return this.decisions.get(id);
  }

  getRecentDecisions(count = 10): Decision[] {
    return [...this.decisions.values()]
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, count);
  }

  getDecisionsByStatus(status: Decision['status']): Decision[] {
    return [...this.decisions.values()].filter((d) => d.status === status);
  }
}
