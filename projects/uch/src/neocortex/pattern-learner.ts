export interface Pattern {
  id: string;
  name: string;
  context: string;
  observed: number;
  confidence: number;
  lastObserved: Date;
  relatedPatterns: string[];
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  proficiency: number;
  useCount: number;
  lastUsed: Date;
}

export class Neocortex {
  private patterns: Map<string, Pattern> = new Map();
  private skills: Map<string, Skill> = new Map();
  private nextPatternId = 0;
  private nextSkillId = 0;

  learnPattern(name: string, context: string): string {
    const existing = [...this.patterns.values()].find(
      (p) => p.name === name && p.context === context,
    );
    if (existing) {
      existing.observed++;
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.lastObserved = new Date();
      return existing.id;
    }

    const id = `pat-${this.nextPatternId++}`;
    this.patterns.set(id, {
      id,
      name,
      context,
      observed: 1,
      confidence: 0.3,
      lastObserved: new Date(),
      relatedPatterns: [],
    });
    return id;
  }

  findRelated(context: string, limit = 5): Pattern[] {
    const ctx = context.toLowerCase();
    return [...this.patterns.values()]
      .filter((p) => p.context.toLowerCase().includes(ctx) || p.name.toLowerCase().includes(ctx))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  registerSkill(name: string, category: string): string {
    const id = `skill-${this.nextSkillId++}`;
    this.skills.set(id, {
      id,
      name,
      category,
      proficiency: 0.1,
      useCount: 0,
      lastUsed: new Date(),
    });
    return id;
  }

  useSkill(id: string): void {
    const skill = this.skills.get(id);
    if (skill) {
      skill.useCount++;
      skill.proficiency = Math.min(1, skill.proficiency + 0.05);
      skill.lastUsed = new Date();
    }
  }

  getPatterns(): Pattern[] {
    return [...this.patterns.values()];
  }

  getSkills(): Skill[] {
    return [...this.skills.values()];
  }

  getStatus(): Record<string, unknown> {
    return {
      patterns: this.patterns.size,
      skills: this.skills.size,
      avgPatternConfidence:
        this.patterns.size > 0
          ? [...this.patterns.values()].reduce((s, p) => s + p.confidence, 0) / this.patterns.size
          : 0,
      avgSkillProficiency:
        this.skills.size > 0
          ? [...this.skills.values()].reduce((s, sk) => s + sk.proficiency, 0) / this.skills.size
          : 0,
    };
  }
}
