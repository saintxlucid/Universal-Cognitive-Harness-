export interface Critique {
  id: string;
  target: string;
  target_type: 'plan' | 'code' | 'decision' | 'memory' | 'prediction';
  issues: CritiqueIssue[];
  overall_score: number;
  created_at: Date;
}

export interface CritiqueIssue {
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: 'correctness' | 'completeness' | 'consistency' | 'efficiency' | 'safety' | 'style';
  description: string;
  evidence: string;
  recommendation: string;
}

export class Critic {
  private critiques: Map<string, Critique> = new Map();

  createCritique(
    target: string,
    target_type: Critique['target_type'],
    issues: Omit<CritiqueIssue, 'id'>[],
  ): Critique {
    const critique: Critique = {
      id: crypto.randomUUID(),
      target,
      target_type,
      issues: issues.map((i) => ({ ...i })),
      overall_score: this.calculateScore(issues),
      created_at: new Date(),
    };
    this.critiques.set(critique.id, critique);
    return critique;
  }

  addIssue(critiqueId: string, issue: Omit<CritiqueIssue, 'id'>): boolean {
    const critique = this.critiques.get(critiqueId);
    if (!critique) return false;
    critique.issues.push({ ...issue });
    critique.overall_score = this.calculateScore(critique.issues);
    return true;
  }

  getCritique(id: string): Critique | undefined {
    return this.critiques.get(id);
  }

  getCriticalIssues(): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];
    for (const [, critique] of this.critiques) {
      for (const issue of critique.issues) {
        if (issue.severity === 'critical') issues.push(issue);
      }
    }
    return issues;
  }

  getIssuesBySeverity(severity: CritiqueIssue['severity']): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];
    for (const [, critique] of this.critiques) {
      for (const issue of critique.issues) {
        if (issue.severity === severity) issues.push(issue);
      }
    }
    return issues;
  }

  getIssuesByCategory(category: CritiqueIssue['category']): CritiqueIssue[] {
    const issues: CritiqueIssue[] = [];
    for (const [, critique] of this.critiques) {
      for (const issue of critique.issues) {
        if (issue.category === category) issues.push(issue);
      }
    }
    return issues;
  }

  summarizeCritique(critiqueId: string): string | null {
    const critique = this.critiques.get(critiqueId);
    if (!critique) return null;
    return [
      `Critique for ${critique.target} (${critique.target_type})`,
      `Score: ${critique.overall_score.toFixed(2)}`,
      `Issues: ${critique.issues.length}`,
      ...critique.issues.map(
        (issue) => `- [${issue.severity}] ${issue.category}: ${issue.description}`,
      ),
    ].join('\n');
  }

  private calculateScore(issues: { severity: string }[]): number {
    if (issues.length === 0) return 1.0;
    const penalties: Record<string, number> = {
      critical: 0.4,
      major: 0.2,
      minor: 0.05,
      suggestion: 0.01,
    };
    let score = 1.0;
    for (const issue of issues) {
      score -= penalties[issue.severity] ?? 0.05;
    }
    return Math.max(0, score);
  }
}
