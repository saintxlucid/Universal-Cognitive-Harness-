export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  trigger_patterns: string[];
  location: string;
  enabled: boolean;
  version: string;
  metadata: Record<string, unknown>;
}

export interface SkillInvocation {
  skill_id: string;
  timestamp: Date;
  input: string;
  output: string;
  duration_ms: number;
  success: boolean;
}

export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map();
  private invocations: SkillInvocation[] = [];

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
  }

  unregister(skillId: string): void {
    this.skills.delete(skillId);
  }

  getById(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId);
  }

  findByTrigger(input: string): SkillDefinition[] {
    const results: SkillDefinition[] = [];
    for (const [, skill] of this.skills) {
      if (skill.trigger_patterns.some((p) => input.toLowerCase().includes(p.toLowerCase()))) {
        results.push(skill);
      }
    }
    return results;
  }

  getAll(): SkillDefinition[] {
    return [...this.skills.values()];
  }

  recordInvocation(invocation: SkillInvocation): void {
    this.invocations.push(invocation);
  }

  getRecentInvocations(limit = 20): SkillInvocation[] {
    return this.invocations.slice(-limit);
  }

  count(): number {
    return this.skills.size;
  }

  getStats(): { total_skills: number; enabled_skills: number; total_invocations: number; success_rate: number } {
    const enabled = [...this.skills.values()].filter((s) => s.enabled).length;
    const success = this.invocations.filter((i) => i.success).length;
    return {
      total_skills: this.skills.size,
      enabled_skills: enabled,
      total_invocations: this.invocations.length,
      success_rate: this.invocations.length > 0 ? success / this.invocations.length : 1,
    };
  }
}
