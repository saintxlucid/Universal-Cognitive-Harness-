import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createProvenance, type SourceType } from '../types/provenance.js';
import { createConcept } from '../types/concept.js';
import { EpisodicStore } from '../storage/episodic-store.js';
import { SemanticGraph } from '../storage/semantic-graph.js';

export interface MemorySystemConfig {
  agent_id: string;
  user_id: string;
  project_id: string;
}

export interface MemoryObservationInput {
  importance?: number;
  tags?: string[];
  context?: string;
  source?: SourceType;
}

export interface MemoryProfile {
  tagCoverage: string[];
  lessons: Array<{ pattern: string; outcome: string; confidence: number }>;
  recallReadiness: number;
  dominantTier: 'working' | 'core' | 'archival';
}

interface MemoryStateSnapshot {
  episodic_count: number;
  semantic_count: number;
  core_count: number;
  working_count: number;
  archival_count: number;
  policy: {
    reward_bias: number;
    exploration_rate: number;
    learning_rate: number;
  };
}

interface MemoryRecord {
  id: string;
  text: string;
  importance: number;
  tier: 'working' | 'core' | 'archival';
  kind: 'observation' | 'outcome';
  created_at: string;
  provenance: {
    source: string;
    source_id: string;
    reliability: number;
  };
  tags: string[];
  embedding: number[];
  access_count: number;
  last_access: string;
  cross_ref_count: number;
}

interface PersistedMemoryState {
  config: MemorySystemConfig;
  policy: {
    reward_bias: number;
    exploration_rate: number;
    learning_rate: number;
  };
  records: MemoryRecord[];
}

const EMBEDDING_DIM = 64;

function textToEmbedding(text: string): number[] {
  const vector = new Array(EMBEDDING_DIM).fill(0);
  const lower = text.toLowerCase();
  const tokens = lower.split(/\W+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    let hash = 0;
    for (let j = 0; j < t.length; j++) {
      hash = ((hash << 5) - hash + t.charCodeAt(j)) | 0;
    }
    const idx = ((hash % EMBEDDING_DIM) + EMBEDDING_DIM) % EMBEDDING_DIM;
    vector[idx] = Math.min(1, vector[idx] + 0.15);

    for (let ng = 0; ng < Math.max(1, t.length - 1); ng++) {
      const ngram = t.slice(ng, ng + 3);
      if (ngram.length < 2) continue;
      let nh = 0;
      for (let k = 0; k < ngram.length; k++) {
        nh = ((nh << 5) - nh + ngram.charCodeAt(k)) | 0;
      }
      const nidx = ((nh % EMBEDDING_DIM) + EMBEDDING_DIM) % EMBEDDING_DIM;
      vector[nidx] = Math.min(1, vector[nidx] + 0.08);
    }
  }

  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0));
  if (mag > 0) {
    for (let i = 0; i < vector.length; i++) vector[i] = vector[i]! / mag;
  }
  return vector;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export class CognitiveMemorySystem {
  private episodic: EpisodicStore;
  private graph: SemanticGraph;
  private config: MemorySystemConfig;
  private records: MemoryRecord[] = [];
  private lessons: Array<{ pattern: string; outcome: string; confidence: number }> = [];
  private policy = {
    reward_bias: 0.6,
    exploration_rate: 0.5,
    learning_rate: 0.7,
  };

  constructor(config: MemorySystemConfig) {
    this.config = config;
    this.episodic = new EpisodicStore();
    this.graph = new SemanticGraph();
  }

  async ingestObservation(text: string, input: MemoryObservationInput = {}): Promise<string> {
    const provenance = createProvenance(input.source ?? 'user', this.config.agent_id, 0.95);
    const importance = input.importance ?? 0.5;
    const contextualizedText = input.context ? `${text} [context: ${input.context}]` : text;
    const episode = await this.episodic.append({
      content: { type: 'text', text: contextualizedText },
      session_id: `session-${Date.now()}`,
      agent_id: this.config.agent_id,
      user_id: this.config.user_id,
      project_id: this.config.project_id,
      provenance,
      concepts: [],
    });

    const embedding = textToEmbedding(contextualizedText);
    const record: MemoryRecord = {
      id: episode.id,
      text: contextualizedText,
      importance,
      tier: 'working',
      kind: 'observation',
      created_at: new Date().toISOString(),
      provenance: {
        source: provenance.source,
        source_id: provenance.source_id,
        reliability: provenance.reliability,
      },
      tags: input.tags ?? [],
      embedding,
      access_count: 0,
      last_access: new Date().toISOString(),
      cross_ref_count: 0,
    };
    this.records.push(record);

    const concept = createConcept({
      name: this.summarize(contextualizedText),
      concept_type: 'quality',
      definition: contextualizedText,
      provenance,
      importance,
    });

    concept.confidence.value = Math.min(1, concept.confidence.value + (input.importance ?? 0.5) * 0.1);
    concept.embedding = embedding;
    concept.epistemic_status = 'observation';
    this.graph.addConcept(concept);

    return episode.id;
  }

  async learnFromOutcome(description: string, outcome: 'success' | 'failure' | 'neutral', reward: number): Promise<void> {
    const provenance = createProvenance('consolidation', this.config.agent_id, 0.85);
    const importance = Math.min(1, reward);
    const embedding = textToEmbedding(description);
    const record: MemoryRecord = {
      id: crypto.randomUUID(),
      text: `${description} -> ${outcome}`,
      importance,
      tier: importance >= 0.75 ? 'core' : 'working',
      kind: 'outcome',
      created_at: new Date().toISOString(),
      provenance: {
        source: provenance.source,
        source_id: provenance.source_id,
        reliability: provenance.reliability,
      },
      tags: ['outcome'],
      embedding,
      access_count: 0,
      last_access: new Date().toISOString(),
      cross_ref_count: 0,
    };
    this.records.push(record);

    const concept = createConcept({
      name: this.summarize(description),
      concept_type: 'process',
      definition: `${description} -> ${outcome}`,
      provenance,
      importance,
    });

    concept.embedding = embedding;
    concept.confidence.value = Math.min(1, concept.confidence.value + reward * 0.1);
    this.graph.addConcept(concept);

    this.policy.reward_bias = Math.min(1, this.policy.reward_bias + reward * 0.05);
    this.policy.learning_rate = Math.min(1, this.policy.learning_rate + 0.02);

    if (outcome === 'failure' && reward < 0) {
      this.lessons.push({
        pattern: description,
        outcome,
        confidence: Math.min(1, Math.abs(reward)),
      });
    }
  }

  async consolidate(): Promise<{ promoted: number; pruned: number }> {
    let promoted = 0;

    for (const record of this.records) {
      record.access_count++;
      const importance = this.scoreImportance(record.text, record.provenance.reliability);
      const frequency = record.access_count / Math.max(1, (Date.now() - new Date(record.created_at).getTime()) / 86400000 + 1);
      const recency = 1 / (1 + (Date.now() - new Date(record.last_access).getTime()) / 3600000);
      const multiFactorScore = importance * 0.35 + Math.min(1, frequency) * 0.25 + recency * 0.2 + Math.min(1, record.cross_ref_count / 5) * 0.2;

      if (record.tier !== 'core' && multiFactorScore >= 0.55) {
        record.tier = 'core';
        record.importance = Math.min(1, record.importance + 0.1);
        promoted++;
      } else if (record.tier === 'working' && multiFactorScore < 0.3) {
        record.tier = 'archival';
      }

      if (record.tier === 'core') {
        const concept = createConcept({
          name: this.summarize(record.text),
          concept_type: 'value',
          definition: record.text,
          provenance: createProvenance('consolidation', this.config.agent_id, record.provenance.reliability),
          importance: Math.max(record.importance, importance),
        });
        concept.embedding = record.embedding;
        concept.confidence.value = Math.min(1, 0.6 + importance * 0.3);
        concept.entrenchment = 4;
        this.graph.addConcept(concept);
      }
    }

    this.updateCrossReferences();

    const pruned = this.episodic.pruneOlderThan(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return { promoted, pruned };
  }

  private updateCrossReferences(): void {
    for (let i = 0; i < this.records.length; i++) {
      let refs = 0;
      for (let j = 0; j < this.records.length; j++) {
        if (i === j) continue;
        const sim = cosineSimilarity(this.records[i]!.embedding, this.records[j]!.embedding);
        if (sim > 0.3) refs++;
      }
      this.records[i]!.cross_ref_count = refs;
    }
  }

  async recall(query: string, options?: { limit?: number }): Promise<Array<{ id: string; content: string; score: number }>> {
    const limit = options?.limit ?? 5;
    const queryEmb = textToEmbedding(query);
    const scored: Array<{ id: string; content: string; score: number }> = [];

    for (const concept of this.graph.getAllConcepts()) {
      const semanticScore = concept.embedding.length > 0 ? cosineSimilarity(queryEmb, concept.embedding) : 0;
      const keywordScore = this.scoreQuery(query, concept.definition);
      const combined = semanticScore * 0.6 + keywordScore * 0.4;
      if (combined > 0.05) {
        scored.push({ id: concept.id, content: concept.definition, score: combined });
      }
    }

    for (const record of this.records) {
      const semanticScore = cosineSimilarity(queryEmb, record.embedding);
      const keywordScore = this.scoreQuery(query, record.text);
      const combined = semanticScore * 0.5 + keywordScore * 0.5;
      if (combined > 0.05) {
        scored.push({ id: record.id, content: record.text, score: combined });
      }
    }

    for (const lesson of this.lessons) {
      const lessonScore = this.scoreQuery(query, lesson.pattern);
      if (lessonScore > 0) {
        scored.push({
          id: `lesson-${lesson.pattern}`,
          content: `${lesson.pattern} -> ${lesson.outcome}`,
          score: lessonScore + lesson.confidence * 0.2,
        });
      }
    }

    const unique = new Map<string, { id: string; content: string; score: number }>();
    for (const item of scored) {
      const existing = unique.get(item.id);
      if (existing) {
        existing.score = Math.max(existing.score, item.score);
      } else {
        unique.set(item.id, item);
      }
    }

    return Array.from(unique.values()).sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async crossSessionRecall(query: string, otherSystems: CognitiveMemorySystem[], options?: { limit?: number }): Promise<Array<{ id: string; content: string; score: number; source: string }>> {
    const local = await this.recall(query, { limit: options?.limit ?? 3 });
    const results: Array<{ id: string; content: string; score: number; source: string }> = local.map((r) => ({ ...r, source: this.config.agent_id }));

    for (const other of otherSystems) {
      const remote = await other.recall(query, { limit: 3 });
      for (const r of remote) {
        if (!results.find((l) => l.content === r.content)) {
          results.push({ ...r, source: other['config'].agent_id });
        }
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, options?.limit ?? 5);
  }

  getMemoryProfile(): MemoryProfile {
    const tags = new Set<string>();
    for (const record of this.records) {
      for (const tag of record.tags) {
        tags.add(tag);
      }
    }

    const coreCount = this.records.filter((record) => record.tier === 'core').length;
    const workingCount = this.records.filter((record) => record.tier === 'working').length;
    const archivalCount = this.records.filter((record) => record.tier === 'archival').length;

    const dominantTier = coreCount >= workingCount && coreCount >= archivalCount ? 'core' : workingCount >= archivalCount ? 'working' : 'archival';

    const recallReadiness = Math.min(1, 0.35 + coreCount * 0.15 + this.lessons.length * 0.08 + tags.size * 0.04);

    return {
      tagCoverage: Array.from(tags).sort(),
      lessons: [...this.lessons],
      recallReadiness,
      dominantTier,
    };
  }

  summarizeMemory(): string {
    const profile = this.getMemoryProfile();
    return [
      'Memory profile',
      `- dominant tier: ${profile.dominantTier}`,
      `- tag coverage: ${profile.tagCoverage.join(', ') || 'none'}`,
      `- lessons: ${profile.lessons.length}`,
      `- recall readiness: ${profile.recallReadiness.toFixed(2)}`,
    ].join('\n');
  }

  async persist(filePath: string): Promise<void> {
    const payload: PersistedMemoryState = {
      config: this.config,
      policy: { ...this.policy },
      records: this.records,
    };

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8');
  }

  async load(filePath: string): Promise<void> {
    const raw = await readFile(filePath, 'utf8');
    const payload = JSON.parse(raw) as PersistedMemoryState;

    this.config = payload.config ?? this.config;
    this.policy = payload.policy ?? this.policy;
    this.records = payload.records ?? [];
    this.episodic = new EpisodicStore();
    this.graph = new SemanticGraph();

    for (const record of this.records) {
      const provenance = createProvenance(
        (record.provenance.source as 'user' | 'tool_output' | 'model_inference' | 'retrieved_document' | 'system_log' | 'consolidation') ?? 'system_log',
        record.provenance.source_id ?? this.config.agent_id,
        record.provenance.reliability ?? 0.8,
      );

      await this.episodic.append({
        content: { type: 'text', text: record.text },
        session_id: `restored-${record.id}`,
        agent_id: this.config.agent_id,
        user_id: this.config.user_id,
        project_id: this.config.project_id,
        provenance,
        concepts: [],
      });

      const concept = createConcept({
        name: this.summarize(record.text),
        concept_type: record.kind === 'outcome' ? 'process' : 'quality',
        definition: record.text,
        provenance,
        importance: record.importance,
      });
      concept.embedding = record.embedding.length > 0 ? record.embedding : textToEmbedding(record.text);
      concept.confidence.value = Math.min(1, 0.6 + record.importance * 0.25);
      if (record.tier === 'core') concept.entrenchment = 4;
      this.graph.addConcept(concept);
    }
  }

  getState(): MemoryStateSnapshot {
    return {
      episodic_count: this.episodic.count(),
      semantic_count: this.graph.getConceptCount(),
      core_count: this.records.filter((record) => record.tier === 'core').length,
      working_count: this.records.filter((record) => record.tier === 'working').length,
      archival_count: this.records.filter((record) => record.tier === 'archival').length,
      policy: { reward_bias: this.policy.reward_bias, exploration_rate: this.policy.exploration_rate, learning_rate: this.policy.learning_rate },
    };
  }

  private summarize(text: string): string {
    return text.split(/\s+/).slice(0, 6).join(' ').trim() || 'memory';
  }

  private scoreImportance(text: string, reliability: number): number {
    const keywordBonus = /prefer|architecture|performance|preference|improve|critical|error|slow|build/i.test(text) ? 0.25 : 0;
    return Math.min(1, reliability * 0.7 + keywordBonus + this.policy.reward_bias * 0.1);
  }

  private scoreQuery(query: string, definition: string): number {
    const q = query.toLowerCase();
    const d = definition.toLowerCase();
    const overlap = q.split(/\W+/).filter(Boolean).filter((term) => d.includes(term)).length;
    const exact = d.includes(q) ? 0.4 : 0;
    return overlap * 0.35 + exact;
  }
}
