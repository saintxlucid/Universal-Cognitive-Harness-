import { writeSnapshot, readSnapshot, mapToRecord, recordToMap } from '../persistence/persistence-engine.js';

export type IdeaDomain =
  | 'architecture' | 'algorithm' | 'design' | 'feature'
  | 'optimization' | 'refactor' | 'test' | 'tooling'
  | 'documentation' | 'product' | 'research' | 'creative';

export type IdeaNovelty = 'incremental' | 'moderate' | 'novel' | 'breakthrough';

export interface Idea {
  id: string;
  title: string;
  description: string;
  domain: IdeaDomain;
  novelty: IdeaNovelty;
  elaboration: string;
  risks: string[];
  prerequisites: string[];
  tags: string[];
  inspiration: string;
  createdAt: Date;
  evaluated: boolean;
  accepted: boolean;
}

export type CreativeTechnique =
  | 'brainstorming' | 'analogy' | 'combination' | 'inversion'
  | 'constraint-relaxation' | 'random-stimulus' | 'first-principles';

export class CreativityEngine {
  private ideas: Map<string, Idea> = new Map();
  private maxIdeas: number;
  private readonly techniques: CreativeTechnique[] = [
    'brainstorming', 'analogy', 'combination', 'inversion',
    'constraint-relaxation', 'random-stimulus', 'first-principles',
  ];
  private generationCount = 0;

  constructor(maxIdeas = 5000) {
    this.maxIdeas = maxIdeas;
  }

  generate(context: {
    domain: IdeaDomain;
    seed?: string;
    constraints?: string[];
    technique?: CreativeTechnique;
    count?: number;
  }): Idea[] {
    const technique = context.technique ?? this.selectTechnique();
    const count = context.count ?? 3;
    const results: Idea[] = [];

    for (let i = 0; i < count; i++) {
      const idea = this.generateIdea(context.domain, technique, context.seed, context.constraints);
      results.push(idea);
      this.ideas.set(idea.id, idea);
    }

    this.generationCount++;
    this.enforceLimit();
    return results;
  }

  generateByAnalogy(sourceDomain: string, targetDomain: IdeaDomain): Idea[] {
    const results: Idea[] = [];
    const analogies = [
      { from: 'database indexing', to: 'intelligent caching layer' },
      { from: 'circuit breaker', to: 'agent throttle mechanism' },
      { from: 'transaction log', to: 'cognitive event sourcing' },
      { from: 'garbage collection', to: 'memory compression scheduler' },
      { from: 'neural network layer', to: 'skill composition pipeline' },
    ];

    for (const a of analogies.slice(0, 3)) {
      const idea: Idea = {
        id: crypto.randomUUID(),
        title: `Apply "${a.from}" to ${targetDomain}`,
        description: `Analogous to "${a.from}" in ${sourceDomain}, apply the same pattern to ${targetDomain}.`,
        domain: targetDomain,
        novelty: 'moderate',
        elaboration: `In ${sourceDomain}, "${a.from}" solves a specific problem. The analogous approach for ${targetDomain} would be "${a.to}".`,
        risks: ['Analogy may not map directly', 'Domain differences may invalidate key assumptions'],
        prerequisites: [`Understanding of "${a.from}" in ${sourceDomain}`],
        tags: [sourceDomain, 'analogy'],
        inspiration: `${sourceDomain}/${a.from}`,
        createdAt: new Date(),
        evaluated: false,
        accepted: false,
      };
      results.push(idea);
      this.ideas.set(idea.id, idea);
    }

    return results;
  }

  get(id: string): Idea | undefined {
    return this.ideas.get(id);
  }

  getByDomain(domain: IdeaDomain): Idea[] {
    return [...this.ideas.values()].filter((i) => i.domain === domain);
  }

  getByNovelty(novelty: IdeaNovelty): Idea[] {
    return [...this.ideas.values()].filter((i) => i.novelty === novelty);
  }

  getRecent(limit = 50): Idea[] {
    return [...this.ideas.values()]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  evaluate(id: string, accepted: boolean): boolean {
    const idea = this.ideas.get(id);
    if (!idea) return false;
    idea.evaluated = true;
    idea.accepted = accepted;
    return true;
  }

  getAccepted(): Idea[] {
    return [...this.ideas.values()].filter((i) => i.accepted);
  }

  getUnEvaluated(): Idea[] {
    return [...this.ideas.values()].filter((i) => !i.evaluated);
  }

  getStats(): { total: number; byDomain: Record<string, number>; byNovelty: Record<string, number>; accepted: number; generationCount: number } {
    const byDomain: Record<string, number> = {};
    const byNovelty: Record<string, number> = {};
    for (const [, i] of this.ideas) {
      byDomain[i.domain] = (byDomain[i.domain] ?? 0) + 1;
      byNovelty[i.novelty] = (byNovelty[i.novelty] ?? 0) + 1;
    }
    return {
      total: this.ideas.size, byDomain, byNovelty,
      accepted: this.getAccepted().length,
      generationCount: this.generationCount,
    };
  }

  clear(): void {
    this.ideas.clear();
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      ideas: mapToRecord(this.ideas),
      maxIdeas: this.maxIdeas,
      generationCount: this.generationCount,
    };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{
      ideas: Record<string, Idea>;
      maxIdeas: number;
      generationCount: number;
    }>(filePath);
    if (!data) return 0;

    if (data.maxIdeas !== undefined) this.maxIdeas = data.maxIdeas;
    this.ideas = recordToMap(data.ideas ?? {});
    this.generationCount = data.generationCount ?? 0;
    return this.ideas.size;
  }

  private generateIdea(domain: IdeaDomain, technique: CreativeTechnique, seed?: string, constraints?: string[]): Idea {
    const templates = this.getTemplates(domain, technique);
    const template = templates[Math.floor(Math.random() * templates.length)]!;
    const title = seed
      ? `${seed}: ${template.title}`
      : template.title;

    return {
      id: crypto.randomUUID(),
      title,
      description: template.description,
      domain,
      novelty: this.randomNovelty(technique),
      elaboration: template.elaboration,
      risks: template.risks,
      prerequisites: template.prerequisites,
      tags: [domain, technique, ...(constraints ?? []).slice(0, 2)],
      inspiration: technique,
      createdAt: new Date(),
      evaluated: false,
      accepted: false,
    };
  }

  private getTemplates(domain: IdeaDomain, _technique: CreativeTechnique): Array<{ title: string; description: string; elaboration: string; risks: string[]; prerequisites: string[] }> {
    const shared = [
      { title: 'New abstraction layer', description: `Introduce an abstraction layer in ${domain}`, elaboration: 'Separate concerns and reduce coupling.', risks: ['Over-engineering'], prerequisites: ['Understanding of current abstractions'] },
      { title: 'Inversion of control', description: `Invert control flow in ${domain}`, elaboration: 'Let the framework call your code.', risks: ['Increased complexity'], prerequisites: ['Clear interface boundaries'] },
      { title: 'Event-driven architecture', description: `Apply event-driven patterns to ${domain}`, elaboration: 'Decouple components through events.', risks: ['Eventual consistency challenges'], prerequisites: ['Event schema design'] },
    ];
    return shared;
  }

  private selectTechnique(): CreativeTechnique {
    return this.techniques[Math.floor(Math.random() * this.techniques.length)]!;
  }

  private randomNovelty(technique: CreativeTechnique): IdeaNovelty {
    if (technique === 'first-principles' || technique === 'inversion') {
      const choices: IdeaNovelty[] = ['moderate', 'novel', 'breakthrough'];
      return choices[Math.floor(Math.random() * choices.length)]!;
    }
    const choices: IdeaNovelty[] = ['incremental', 'moderate'];
    return choices[Math.floor(Math.random() * choices.length)]!;
  }

  private enforceLimit(): void {
    if (this.ideas.size > this.maxIdeas) {
      const oldest = [...this.ideas.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      if (oldest) this.ideas.delete(oldest.id);
    }
  }
}
