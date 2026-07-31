import { VectorStore } from '../storage/vector-store.js';
import { GraphStore } from '../storage/graph-store.js';
import { CognitiveMemorySystem } from './cognitive-memory-system.js';
import { ScientificMemory } from '../../cognitive-plane/memory/scientific-memory.js';
import { DecisionLog } from '../../cognitive-plane/decisions/decision-log.js';
import { MemoryEvolution } from './memory-evolution.js';

export interface MemoryOrganConfig {
  basePath: string;
  dimension?: number;
  maxEpisodic?: number;
  maxSemantic?: number;
  evolutionIntervalMs?: number;
}

export class MemoryOrgan {
  readonly episodic: CognitiveMemorySystem;
  readonly semantic: ScientificMemory;
  readonly decisions: DecisionLog;
  readonly vectorStore: VectorStore;
  readonly graphStore: GraphStore;
  readonly evolution: MemoryEvolution;
  private evolutionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: MemoryOrganConfig) {
    this.episodic = new CognitiveMemorySystem({ agent_id: 'memory-organ', user_id: 'system', project_id: 'uch' });
    this.semantic = new ScientificMemory(config.maxSemantic ?? 10000);
    this.decisions = new DecisionLog(config.maxEpisodic ?? 5000);
    this.vectorStore = new VectorStore(config.basePath, config.dimension);
    this.graphStore = new GraphStore(config.basePath);
    this.evolution = new MemoryEvolution({
      basePath: config.basePath,
      vectorStore: this.vectorStore,
      graphStore: this.graphStore,
    });
  }

  async start(): Promise<void> {
    this.evolutionTimer = setInterval(async () => {
      await this.evolution.runCycle();
    }, 60000);
  }

  async stop(): Promise<void> {
    if (this.evolutionTimer) {
      clearInterval(this.evolutionTimer);
      this.evolutionTimer = null;
    }
  }

  async observe(content: string, tags: string[], importance = 0.5, context?: string): Promise<void> {
    await this.episodic.ingestObservation(content, { importance, tags, context });
    await this.evolution.recordAccess(content);
  }

  async recall(query: string, limit = 10): Promise<{ content: string; score: number; source: string }[]> {
    const results: { content: string; score: number; source: string }[] = [];

    const episodic = await this.episodic.recall(query, { limit: Math.ceil(limit / 2) });
    for (const e of episodic) {
      results.push({ content: typeof e.content === 'string' ? e.content : JSON.stringify(e.content), score: 0.8, source: 'episodic' });
    }

    const semantic = this.semantic.query(query);
    for (const s of semantic.slice(0, Math.ceil(limit / 2))) {
      if (typeof s.value === 'object' && s.value !== null) {
        results.push({ content: JSON.stringify(s.value), score: s.confidence, source: 'semantic' });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  getStats(): { episodic: number; semantic: number; decisions: number; vectors: number; graph: { nodes: number; edges: number } } {
    return {
      episodic: this.episodic.getState().episodic_count,
      semantic: this.semantic.getStats().total,
      decisions: this.decisions.getAll().length,
      vectors: this.vectorStore.count(),
      graph: { nodes: this.graphStore.nodeCount(), edges: this.graphStore.edgeCount() },
    };
  }
}
