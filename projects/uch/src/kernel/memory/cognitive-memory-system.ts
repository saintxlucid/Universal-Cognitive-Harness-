import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createProvenance } from '../types/provenance.js';
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
    const provenance = createProvenance('user', this.config.agent_id, 0.95);
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
    };
    this.records.push(record);

    const concept = createConcept({
      name: this.summarize(contextualizedText),
      concept_type: 'quality',
      definition: contextualizedText,
      provenance,
      importance,
    });

    concept.confidence.value = Math.min(
      1,
      concept.confidence.value + (input.importance ?? 0.5) * 0.1,
    );
    concept.embedding = this.embed(contextualizedText);
    concept.epistemic_status = 'observation';
    this.graph.addConcept(concept);

    return episode.id;
  }

  async learnFromOutcome(
    description: string,
    outcome: 'success' | 'failure' | 'neutral',
    reward: number,
  ): Promise<void> {
    const provenance = createProvenance('consolidation', this.config.agent_id, 0.85);
    const importance = Math.min(1, reward);
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
    };
    this.records.push(record);

    const concept = createConcept({
      name: this.summarize(description),
      concept_type: 'process',
      definition: `${description} -> ${outcome}`,
      provenance,
      importance,
    });

    concept.embedding = this.embed(description);
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
      const importance = this.scoreImportance(record.text, record.provenance.reliability);
      const shouldPromote = record.importance >= 0.75 || importance >= 0.6;
      if (record.tier !== 'core' && shouldPromote) {
        record.tier = 'core';
        promoted++;
      } else if (record.tier === 'working' && importance < 0.4) {
        record.tier = 'archival';
      }

      if (record.tier === 'core') {
        const concept = createConcept({
          name: this.summarize(record.text),
          concept_type: 'value',
          definition: record.text,
          provenance: createProvenance(
            'consolidation',
            this.config.agent_id,
            record.provenance.reliability,
          ),
          importance: Math.max(record.importance, importance),
        });
        concept.embedding = this.embed(record.text);
        concept.confidence.value = Math.min(1, 0.6 + importance * 0.3);
        concept.entrenchment = 4;
        this.graph.addConcept(concept);
      }
    }

    const pruned = this.episodic.pruneOlderThan(new Date(Date.now() - 24 * 60 * 60 * 1000));
    return { promoted, pruned };
  }

  async recall(
    query: string,
    options?: { limit?: number },
  ): Promise<Array<{ id: string; content: string; score: number }>> {
    const limit = options?.limit ?? 5;
    const scored: Array<{ id: string; content: string; score: number }> = [];

    for (const concept of this.graph.getAllConcepts()) {
      const score = this.scoreQuery(query, concept.definition);
      if (score > 0) {
        scored.push({ id: concept.id, content: concept.definition, score });
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

    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
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
        (record.provenance.source as
          | 'user'
          | 'tool_output'
          | 'model_inference'
          | 'retrieved_document'
          | 'system_log'
          | 'consolidation') ?? 'system_log',
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
      concept.embedding = this.embed(record.text);
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
      policy: {
        reward_bias: this.policy.reward_bias,
        exploration_rate: this.policy.exploration_rate,
        learning_rate: this.policy.learning_rate,
      },
    };
  }

  private extractText(content: unknown): string {
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object' && 'type' in content) {
      const value = content as {
        type?: string;
        text?: string;
        observation?: string;
        tool?: string;
        input?: unknown;
        output?: unknown;
      };
      if (value.type === 'text' && value.text) return value.text;
      if (value.type === 'observation' && value.observation) return value.observation;
      if (value.type === 'tool_call') return `tool ${value.tool ?? 'unknown'}`;
    }
    return JSON.stringify(content);
  }

  private summarize(text: string): string {
    return text.split(/\s+/).slice(0, 6).join(' ').trim() || 'memory';
  }

  private embed(text: string): number[] {
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);
    const vector = new Array(8).fill(0);
    for (let i = 0; i < words.length; i++) {
      const idx = (words[i]!.charCodeAt(0) + i) % 8;
      vector[idx] = Math.min(1, vector[idx] + 0.25);
    }
    return vector;
  }

  private scoreImportance(text: string, reliability: number): number {
    const keywordBonus =
      /prefer|architecture|performance|preference|improve|critical|error|slow|build/i.test(text)
        ? 0.25
        : 0;
    return Math.min(1, reliability * 0.7 + keywordBonus + this.policy.reward_bias * 0.1);
  }

  private scoreQuery(query: string, definition: string): number {
    const q = query.toLowerCase();
    const d = definition.toLowerCase();
    const overlap = q
      .split(/\W+/)
      .filter(Boolean)
      .filter((term) => d.includes(term)).length;
    const exact = d.includes(q) ? 0.4 : 0;
    return (
      overlap * 0.35 + exact + (d.includes('architecture') && q.includes('architecture') ? 0.2 : 0)
    );
  }
}
