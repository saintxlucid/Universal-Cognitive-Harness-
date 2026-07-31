import { NeuralEventBus, type NeuralEvent } from '../../event-bus/neural-event-bus.js';
import { CognitiveKernel } from '../../kernel/cognitive-kernel.js';
import { ScientificMemory } from '../memory/scientific-memory.js';
import { CognitiveConstitution } from '../constitution/constitution.js';
import { KnowledgeCompiler } from '../compiler/knowledge-compiler.js';
import { Conscience } from '../../cognitive-brain/conscience.js';
import { TrustEngine } from '../trust/trust-engine.js';
import { EvolutionEngine } from '../evolution/index.js';
import type { WorkspaceIdentity } from '../../workspace-brain/identity.js';

export type PerceptionModality = 'visual' | 'language' | 'engineering' | 'behavioral' | 'unknown';

export interface PerceptionObservation {
  id: string;
  modality: PerceptionModality;
  content: string;
  source: string;
  timestamp: Date;
}

export class PerceptionGrid {
  private observations: PerceptionObservation[] = [];

  classify(event: NeuralEvent): PerceptionModality {
    const type = event.type.toLowerCase();
    const payloadText = JSON.stringify(event.payload ?? {}).toLowerCase();

    if (type.includes('screen') || type.includes('screenshot') || type.includes('diagram'))
      return 'visual';
    if (
      type.includes('text') ||
      type.includes('doc') ||
      type.includes('message') ||
      payloadText.includes('issue') ||
      payloadText.includes('pr')
    )
      return 'language';
    if (
      type.includes('git') ||
      type.includes('file') ||
      type.includes('build') ||
      type.includes('compile') ||
      type.includes('architecture')
    )
      return 'engineering';
    if (
      type.includes('typing') ||
      type.includes('debug') ||
      type.includes('agent') ||
      payloadText.includes('workflow')
    )
      return 'behavioral';
    return 'unknown';
  }

  perceive(event: NeuralEvent): PerceptionObservation {
    const observation: PerceptionObservation = {
      id: crypto.randomUUID(),
      modality: this.classify(event),
      content: String(event.payload?.message ?? event.payload?.observation ?? event.type ?? ''),
      source: String(event.source ?? 'system'),
      timestamp: new Date(),
    };
    this.observations.unshift(observation);
    if (this.observations.length > 200) this.observations.pop();
    return observation;
  }

  getRecent(limit = 20): PerceptionObservation[] {
    return this.observations.slice(0, limit);
  }
}

export interface WorkingContext {
  mission: string;
  objective: string;
  branch: string;
  currentTask?: string;
  lastUpdated: Date;
}

export class WorkingMemory {
  private context: WorkingContext;

  constructor() {
    this.context = {
      mission: 'Unknown',
      objective: 'Idle',
      branch: 'main',
      lastUpdated: new Date(),
    };
  }

  update(context: Partial<Omit<WorkingContext, 'lastUpdated'>>): void {
    this.context = {
      ...this.context,
      ...context,
      lastUpdated: new Date(),
    };
  }

  getContext(): WorkingContext {
    return { ...this.context };
  }
}

export interface EmotionalMemoryEntry {
  id: string;
  description: string;
  importance: number;
  category: 'incident' | 'breakthrough' | 'risk' | 'lesson';
  createdAt: Date;
}

export class EmotionalMemory {
  private entries: EmotionalMemoryEntry[] = [];

  record(
    description: string,
    importance: number,
    category: EmotionalMemoryEntry['category'],
  ): EmotionalMemoryEntry {
    const entry: EmotionalMemoryEntry = {
      id: crypto.randomUUID(),
      description,
      importance: Math.min(1, Math.max(0, importance)),
      category,
      createdAt: new Date(),
    };
    this.entries.unshift(entry);
    if (this.entries.length > 100) this.entries.pop();
    return entry;
  }

  getTopSignificant(limit = 10): EmotionalMemoryEntry[] {
    return [...this.entries]
      .sort((a, b) => b.importance - a.importance || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export class ProceduralMemory {
  private steps: Map<string, string> = new Map();

  store(key: string, procedure: string): void {
    this.steps.set(key, procedure);
  }

  get(key: string): string | undefined {
    return this.steps.get(key);
  }

  list(): Array<{ key: string; procedure: string }> {
    return [...this.steps.entries()].map(([key, procedure]) => ({ key, procedure }));
  }
}

export class SocialMemory {
  private relationships: Map<string, { strength: number; expertise: string[]; style: string }> =
    new Map();

  learn(memberId: string, expertise: string[], style: string, strength = 0.5): void {
    this.relationships.set(memberId, {
      strength: Math.min(1, Math.max(0, strength)),
      expertise,
      style,
    });
  }

  get(memberId: string) {
    return this.relationships.get(memberId);
  }

  list(): Array<{ memberId: string; strength: number; expertise: string[]; style: string }> {
    return [...this.relationships.entries()].map(([memberId, value]) => ({ memberId, ...value }));
  }
}

export class EvolutionaryMemory {
  private changeLog: Array<{ id: string; summary: string; timestamp: Date }> = [];

  record(summary: string): void {
    this.changeLog.unshift({ id: crypto.randomUUID(), summary, timestamp: new Date() });
    if (this.changeLog.length > 100) this.changeLog.pop();
  }

  recent(limit = 10) {
    return this.changeLog.slice(0, limit);
  }
}

export class MemoryOrgans {
  public readonly sensory: PerceptionGrid;
  public readonly working: WorkingMemory;
  public readonly episodic: CognitiveKernel;
  public readonly semantic: ScientificMemory;
  public readonly procedural: ProceduralMemory;
  public readonly emotional: EmotionalMemory;
  public readonly social: SocialMemory;
  public readonly evolutionary: EvolutionaryMemory;

  constructor(kernel: CognitiveKernel, semantic: ScientificMemory) {
    this.sensory = new PerceptionGrid();
    this.working = new WorkingMemory();
    this.episodic = kernel;
    this.semantic = semantic;
    this.procedural = new ProceduralMemory();
    this.emotional = new EmotionalMemory();
    this.social = new SocialMemory();
    this.evolutionary = new EvolutionaryMemory();
  }

  async ingestObservation(event: NeuralEvent, importance = 0.5): Promise<void> {
    const observation = this.sensory.perceive(event);
    this.emotional.record(`Perceived ${observation.modality} event`, importance, 'lesson');
    await this.episodic.remember({
      content: { type: 'observation', observation: observation.content },
      concepts: [observation.modality],
      provenance: { source: observation.source, reliability: 0.75 },
    });
  }

  storeSemanticFact(key: string, value: unknown, source = 'organism'): void {
    this.semantic.store({
      key,
      value,
      source,
      certainty: 'likely',
      confidence: 0.6,
      tags: ['organism'],
    });
  }
}

export interface AttentionSignal {
  id: string;
  priority: number;
  reason: string;
  context: Record<string, unknown>;
}

export class AttentionEngine {
  focus(
    items: Array<{
      importance: number;
      novelty: number;
      urgency: number;
      risk: number;
      description: string;
    }>,
  ): AttentionSignal[] {
    return items
      .map((item) => {
        const score =
          item.importance * 0.35 + item.novelty * 0.2 + item.urgency * 0.25 + item.risk * 0.2;
        return {
          id: crypto.randomUUID(),
          priority: Number(score.toFixed(3)),
          reason: item.description,
          context: item,
        };
      })
      .sort((a, b) => b.priority - a.priority);
  }
}

export class PredictionEngine {
  private conscience: Conscience;

  constructor(conscience: Conscience) {
    this.conscience = conscience;
  }

  async imagine(
    agentId: string,
    context: string[],
  ): Promise<{ prediction: string; confidence: number; alternatives: string[] }> {
    const result = await this.conscience.predict(agentId, context);
    return {
      prediction: `Expected next activity: ${result.predicted_type}`,
      confidence: result.confidence,
      alternatives: [`Maintain current plan`, `Pause and verify`, `Refactor before proceeding`],
    };
  }
}

export class CuriosityEngine {
  generateQuestions(memory: MemoryOrgans): string[] {
    const questions: string[] = [];
    const working = memory.working.getContext();
    if (!working.mission || working.mission === 'Unknown') {
      questions.push('What is the current mission and why is it important?');
    }

    if (memory.semantic.getAll(5).length === 0) {
      questions.push('Which facts are missing from semantic memory for this workspace?');
    }

    if (memory.emotional.getTopSignificant(3).length === 0) {
      questions.push('Which recent events should be encoded as high significance memories?');
    }

    if (memory.evolutionary.recent(5).length === 0) {
      questions.push('What changed in the workspace genome since the last major update?');
    }

    return questions.length > 0
      ? questions
      : ['What is the weakest part of the current architecture?'];
  }
}

export class DoubtEngine {
  evaluate(
    memory: ScientificMemory,
    trust: TrustEngine,
  ): { uncertainty: number; contradictions: number; lowTrustSubjects: string[] } {
    const stats = memory.getStats();
    const contradictions = stats.contradictions;
    const lowTrust = trust.getLowTrust(0.4).map((entry) => entry.subject);
    const uncertainty = 1 - stats.avgConfidence;
    return { uncertainty, contradictions, lowTrustSubjects: lowTrust };
  }
}

export class WisdomEngine {
  private constitution: CognitiveConstitution;
  private compiler: KnowledgeCompiler;

  constructor(constitution: CognitiveConstitution, compiler: KnowledgeCompiler) {
    this.constitution = constitution;
    this.compiler = compiler;
  }

  summarize(): string {
    const laws = this.constitution.getStats();
    const artifacts = this.compiler.getWisdom();
    return `Wisdom summary: ${laws.totalLaws} governing laws, ${artifacts.length} wisdom artifacts.`;
  }
}

export class CounterfactualEngine {
  simulate(proposal: string): Array<{ universe: string; outcome: string; risk: string }> {
    return [
      { universe: 'A', outcome: `${proposal} executed as planned`, risk: 'low' },
      { universe: 'B', outcome: `${proposal} delayed for review`, risk: 'moderate' },
      { universe: 'C', outcome: `${proposal} refactored into smaller units`, risk: 'low' },
      {
        universe: 'D',
        outcome: `${proposal} abandoned in favor of simpler approach`,
        risk: 'moderate',
      },
    ];
  }
}

export class IdentityEngine {
  private identity: WorkspaceIdentity;

  constructor(identity: WorkspaceIdentity) {
    this.identity = identity;
  }

  getProfile(): WorkspaceIdentity {
    return { ...this.identity };
  }

  updateVision(mission: string, goals: string[]): void {
    this.identity.mission = mission;
    this.identity.goals = [...goals];
    this.identity.last_updated = new Date();
  }
}

export interface ImmuneIssue {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  subject: string;
}

export class ImmuneSystem {
  private trust: TrustEngine;
  private constitution: CognitiveConstitution;

  constructor(trust: TrustEngine, constitution: CognitiveConstitution) {
    this.trust = trust;
    this.constitution = constitution;
  }

  scan(memory: ScientificMemory): ImmuneIssue[] {
    const issues: ImmuneIssue[] = [];
    const contradicted = memory.getContradicted();
    for (const entry of contradicted) {
      issues.push({
        id: entry.id,
        description: `Contradicted memory: ${entry.key}`,
        severity: 'high',
        subject: entry.source,
      });
    }

    for (const untrusted of this.trust.getLowTrust(0.3)) {
      issues.push({
        id: crypto.randomUUID(),
        description: `Low trust subject: ${untrusted.subject}`,
        severity: 'medium',
        subject: untrusted.subject,
      });
    }

    const violations = this.constitution.getViolations(10);
    for (const violation of violations) {
      issues.push({
        id: crypto.randomUUID(),
        description: `Governance violation: ${violation.details}`,
        severity: violation.severity === 'immutable' ? 'high' : 'medium',
        subject: violation.subject,
      });
    }

    return issues;
  }
}

export interface CognitiveOrganismConfig {
  eventBus: NeuralEventBus;
  kernel: CognitiveKernel;
  semanticMemory: ScientificMemory;
  identity: WorkspaceIdentity;
  constitution: CognitiveConstitution;
  knowledgeCompiler: KnowledgeCompiler;
  trustEngine: TrustEngine;
  conscience: Conscience;
}

export class CognitiveOrganism {
  readonly memory: MemoryOrgans;
  readonly attention: AttentionEngine;
  readonly prediction: PredictionEngine;
  readonly curiosity: CuriosityEngine;
  readonly doubt: DoubtEngine;
  readonly wisdom: WisdomEngine;
  readonly counterfactual: CounterfactualEngine;
  readonly identity: IdentityEngine;
  readonly immune: ImmuneSystem;
  readonly evolution: EvolutionEngine;

  constructor(private readonly config: CognitiveOrganismConfig) {
    this.memory = new MemoryOrgans(config.kernel, config.semanticMemory);
    this.attention = new AttentionEngine();
    this.prediction = new PredictionEngine(config.conscience);
    this.curiosity = new CuriosityEngine();
    this.doubt = new DoubtEngine();
    this.wisdom = new WisdomEngine(config.constitution, config.knowledgeCompiler);
    this.counterfactual = new CounterfactualEngine();
    this.identity = new IdentityEngine(config.identity);
    this.immune = new ImmuneSystem(config.trustEngine, config.constitution);
    this.evolution = new EvolutionEngine();
  }

  async initialize(): Promise<void> {
    this.config.eventBus.subscribe('file:saved', async (event) => {
      await this.memory.ingestObservation(event, 0.6);
      this.memory.working.update({
        currentTask: `Saved ${String(event.payload?.path ?? 'unknown')}`,
      });
      this.memory.evolutionary.record(
        `Observed file save at ${String(event.payload?.path ?? 'unknown')}`,
      );
    });

    this.config.eventBus.subscribe('git:commit', async (event) => {
      await this.memory.ingestObservation(event, 0.7);
      this.memory.evolutionary.record(
        `Git commit: ${String(event.payload?.message ?? '').split('\n')[0]}`,
      );
    });

    this.config.eventBus.subscribe('error:occurred', async (event) => {
      this.memory.emotional.record(
        String(event.payload?.message ?? 'Unknown error'),
        0.9,
        'incident',
      );
      this.memory.storeSemanticFact('last_error', event.payload?.message ?? 'Unknown');
    });
  }

  summarizeOrganism(): string {
    const memoryStats = this.memory.semantic.getStats();
    const attention = this.attention.focus([
      {
        importance: 0.8,
        novelty: 0.6,
        urgency: 0.7,
        risk: 0.4,
        description: 'Current workspace activity',
      },
    ]);
    const doubt = this.doubt.evaluate(this.memory.semantic, this.config.trustEngine);
    return [
      `Organism mission: ${this.identity.getProfile().mission}`,
      `Sensory observations: ${this.memory.sensory.getRecent(5).length}`,
      `Semantic memories: ${memoryStats.total}`,
      `Attention focus: ${attention[0]?.reason ?? 'none'}`,
      `Uncertainty: ${doubt.uncertainty.toFixed(2)}`,
    ].join(' | ');
  }
}
