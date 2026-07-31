import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  pattern: string;
  confidence: number;
  invocation_count: number;
  created_at: string;
}

export class SkillStore {
  private kernel: CognitiveKernel;
  private skills: Map<string, SkillDefinition> = new Map();

  constructor(kernel: CognitiveKernel) {
    this.kernel = kernel;
  }

  register(skill: Omit<SkillDefinition, 'id' | 'invocation_count' | 'created_at'>): SkillDefinition {
    const id = crypto.randomUUID();
    const entry: SkillDefinition = {
      id,
      ...skill,
      invocation_count: 0,
      created_at: new Date().toISOString(),
    };
    this.skills.set(id, entry);
    return entry;
  }

  learn(name: string, pattern: string, description: string): SkillDefinition {
    return this.register({ name, description, pattern, confidence: 0.5 });
  }

  find(name: string): SkillDefinition | undefined {
    for (const [, skill] of this.skills) {
      if (skill.name === name) return skill;
    }
    return undefined;
  }

  search(query: string): SkillDefinition[] {
    const q = query.toLowerCase();
    return Array.from(this.skills.values()).filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.pattern.toLowerCase().includes(q),
    );
  }

  invoke(id: string): SkillDefinition | undefined {
    const skill = this.skills.get(id);
    if (skill) {
      skill.invocation_count++;
      skill.confidence = Math.min(1, skill.confidence + 0.05);
    }
    return skill;
  }

  listAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  get count(): number {
    return this.skills.size;
  }
}
