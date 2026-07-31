import { EpisodicStore } from './storage/episodic-store.js';
import { SemanticGraph } from './storage/semantic-graph.js';
import { PersistentStore } from './storage/persistent-store.js';
import { RetrievalFusion, type FusionQuery, type ScoredResult } from './retrieval/fusion.js';
import { ContextCompressor, type CompressOptions } from './retrieval/context-compressor.js';
import { SleepCycle, type SleepReport } from './consolidation/sleep-cycle.js';
import { Neuromodulation, type ContextState, type NeuromodulationState } from './cortex/neuromodulation.js';
import { createProvenance } from './types/provenance.js';
import { createConcept, type Concept, type ConceptType } from './types/concept.js';
import { type Episode, type EpisodeContent } from './types/episode.js';
import { createEdge, type Edge } from './types/edge.js';
import { integrateEvidence, createBeliefSet, type BeliefSet } from './constitution/epistemology.js';
import { ActivationField, type ActivationFieldConfig, type FieldStats } from './activation/activation-field.js';
import { WorldModelEngine } from './world-model/world-model.js';

export interface CognitiveKernelConfig {
  agent_id: string;
  user_id: string;
  project_id: string;
  sleep_interval_ms?: number;
  persistence_path?: string;
  activation?: Partial<ActivationFieldConfig>;
}

export class CognitiveKernel {
  private config: CognitiveKernelConfig;
  private episodic: EpisodicStore;
  private graph: SemanticGraph;
  private persistence: PersistentStore | null = null;
  private retrieval: RetrievalFusion;
  private sleep: SleepCycle;
  private neuromodulation: Neuromodulation;
  private beliefs: BeliefSet;
  private session_id: string;
  private activationField: ActivationField;
  private worldModels: WorldModelEngine | null = null;

  constructor(config: CognitiveKernelConfig) {
    this.config = config;
    this.session_id = crypto.randomUUID();
    this.episodic = new EpisodicStore();
    this.graph = new SemanticGraph();
    this.activationField = new ActivationField(config.activation);
    this.neuromodulation = new Neuromodulation();
    this.retrieval = new RetrievalFusion(this.graph, this.episodic);
    this.sleep = new SleepCycle(this.episodic, this.graph, this.neuromodulation, {
      interval_ms: config.sleep_interval_ms ?? 300_000,
    });
    this.beliefs = createBeliefSet();
  }

  async init(): Promise<void> {
    const basePath = this.config.persistence_path;
    if (basePath) {
      this.persistence = new PersistentStore(
        { basePath },
        this.episodic,
        this.graph,
      );
      await this.persistence.init();
    }
  }

  async shutdown(): Promise<void> {
    this.stopSleep();
    if (this.persistence) {
      await this.persistence.shutdown();
    }
  }

  // === Session ===

  getSessionId(): string {
    return this.session_id;
  }

  startSleep(): void {
    this.sleep.start();
  }

  stopSleep(): void {
    this.sleep.stop();
  }

  async forceSleepCycle(): Promise<SleepReport> {
    return this.sleep.cycle();
  }

  // === Memory Operations ===

  async remember(params: {
    content: EpisodeContent;
    concepts?: string[];
    provenance?: { source: string; reliability?: number };
  }): Promise<Episode> {
    const provenance = createProvenance(
      (params.provenance?.source as 'user' | 'tool_output') ?? 'system_log',
      this.config.agent_id,
      params.provenance?.reliability ?? 1.0,
    );

    const recent = this.episodic.getRecent(1);
    const episode = await this.episodic.append({
      content: params.content,
      session_id: this.session_id,
      agent_id: this.config.agent_id,
      user_id: this.config.user_id,
      project_id: this.config.project_id,
      provenance,
      concepts: params.concepts,
      preceding_episode: recent[0]?.id,
    });

    if (this.persistence) {
      await this.persistence.appendEpisode({
        ...episode,
        provenance: { ...episode.provenance, source: episode.provenance.source, timestamp: episode.provenance.timestamp },
      });
    }

    this.activationField.register({
      id: episode.id,
      label: this.episodeLabel(params.content),
      kind: 'episode',
      activation: 0.3,
    });
    for (const conceptId of params.concepts ?? []) {
      const concept = this.graph.getConcept(conceptId);
      this.activationField.register({
        id: conceptId,
        label: concept?.name ?? conceptId,
        kind: 'concept',
      });
      this.activationField.spike(conceptId, 0.4);
    }

    return episode;
  }

  async recall(query: FusionQuery): Promise<ScoredResult[]> {
    const results = this.retrieval.search(query);
    const reranked = this.retrieval.mmrRerank(results, 0.5, 10);
    for (const result of reranked.slice(0, 3)) {
      this.activationField.spike(result.id, 0.3);
    }
    return reranked;
  }

  recallFormatted(query: FusionQuery): string {
    const results = this.retrieval.search(query);
    const reranked = this.retrieval.mmrRerank(results, 0.5, 10);
    return this.retrieval.formatContext(reranked);
  }

  recallCompressed(query: FusionQuery, options?: CompressOptions): {
    text: string;
    stats: ReturnType<ContextCompressor['compress']>['stats'];
  } {
    const results = this.retrieval.search(query);
    const reranked = this.retrieval.mmrRerank(results, 0.5, 10);
    return new ContextCompressor(options).compress(reranked, query);
  }

  // === Concept Management ===

  addConcept(params: {
    name: string;
    concept_type: ConceptType;
    definition: string;
    purpose?: string;
    importance?: number;
    embedding?: number[];
  }): Concept {
    const concept = createConcept({
      name: params.name,
      concept_type: params.concept_type,
      definition: params.definition,
      purpose: params.purpose,
      importance: params.importance,
      provenance: createProvenance('system_log', this.config.agent_id),
    });

    if (params.embedding) {
      concept.embedding = params.embedding;
    }

    this.graph.addConcept(concept);
    this.activationField.register({
      id: concept.id,
      label: concept.name,
      kind: `concept:${concept.concept_type}`,
      activation: 0.2,
      utility: params.importance,
    });
    if (this.persistence) {
      this.persistence.addConcept(concept).catch(() => {});
    }
    return concept;
  }

  getConcept(id: string): Concept | undefined {
    return this.graph.getConcept(id);
  }

  findConcept(name: string): Concept | undefined {
    return this.graph.findConceptByName(name);
  }

  addRelationship(params: {
    source: string;
    target: string;
    relationship: string;
    source_episode: string;
    confidence?: number;
  }): Edge {
    const edge = createEdge({
      source: params.source,
      target: params.target,
      relationship: params.relationship,
      source_episode: params.source_episode,
      provenance: createProvenance('system_log', this.config.agent_id),
      confidence: params.confidence,
    });

    this.graph.addEdge(edge);
    this.activationField.link(params.source, params.target, params.confidence);
    if (this.persistence) {
      this.persistence.addEdge(edge).catch(() => {});
    }
    return edge;
  }

  getRelationships(conceptId: string): Edge[] {
    return this.graph.getEdgesFrom(conceptId);
  }

  // === Neuromodulation ===

  updateContext(context: Partial<ContextState>): void {
    const defaultContext: ContextState = {
      novelty: context.novelty ?? 0.3,
      task_horizon: context.task_horizon ?? 3,
      uncertainty: context.uncertainty ?? 0.2,
      reward_history: context.reward_history ?? [],
    };
    this.neuromodulation.update(defaultContext);
  }

  getNeuromodulationState(): NeuromodulationState {
    return this.neuromodulation.getState();
  }

  // === Cognitive Constitution ===

  getBeliefs(): BeliefSet {
    return this.beliefs;
  }

  async learnEvidence(proposition: string, evidence: string, sourceReliability: number): Promise<void> {
    await integrateEvidence(
      this.beliefs,
      proposition,
      {
        proposition,
        provenance: createProvenance('tool_output', this.config.agent_id, sourceReliability),
        strength: sourceReliability,
        timestamp: new Date(),
      },
      sourceReliability,
    );
  }

  // === Episodic Queries ===

  getRecentEpisodes(limit = 10): Episode[] {
    return this.episodic.getRecent(limit);
  }

  getEpisodesBySession(sessionId: string): Episode[] {
    return this.episodic.getBySession(sessionId);
  }

  getEpisodesByTimeRange(start: Date, end: Date): Episode[] {
    return this.episodic.getByTimeRange(start, end);
  }

  getEpisodesByConcept(conceptId: string): Episode[] {
    return this.episodic.getByConcept(conceptId);
  }

  getAllConcepts(): Concept[] {
    return this.graph.getAllConcepts();
  }

  // === Internal access for persistent store integration ===

  getEpisodicStore(): EpisodicStore { return this.episodic; }
  getSemanticGraph(): SemanticGraph { return this.graph; }
  getActivationField(): ActivationField { return this.activationField; }
  getWorldModels(): WorldModelEngine {
    this.worldModels ??= new WorldModelEngine({ field: this.activationField });
    return this.worldModels;
  }
  getPersistence(): PersistentStore | null { return this.persistence; }
  async setPersistencePath(path: string): Promise<void> {
    this.config.persistence_path = path;
    this.persistence = new PersistentStore({ basePath: path }, this.episodic, this.graph);
    await this.persistence.init();
  }

  // === Activation Field ===

  tickField(deltaMs: number): void {
    this.activationField.tick(deltaMs);
  }

  // === Stats ===

  private episodeLabel(content: EpisodeContent): string {
    if (content.type === 'text') return content.text.slice(0, 60);
    if (content.type === 'observation') return content.observation.slice(0, 60);
    if (content.type === 'tool_call') return `tool:${content.tool}`;
    return 'structured';
  }

  getStats(): CognitiveKernelStats {
    return {
      session_id: this.session_id,
      episodes: this.episodic.count(),
      concepts: this.graph.getConceptCount(),
      relationships: this.graph.getEdgeCount(),
      beliefs: this.beliefs.propositions.size,
      sleep_active: this.sleep.isRunning(),
      sleep_cycles: this.sleep.getCycleCount(),
      neuromodulation: this.neuromodulation.getState(),
      activation: this.activationField.getStats(),
    };
  }
}

export interface CognitiveKernelStats {
  session_id: string;
  episodes: number;
  concepts: number;
  relationships: number;
  beliefs: number;
  sleep_active: boolean;
  sleep_cycles: number;
  neuromodulation: NeuromodulationState;
  activation: FieldStats;
}
