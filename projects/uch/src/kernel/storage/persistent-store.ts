import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Journal, type JournalEntry, type JournalOperation } from './journal.js';
import { EpisodicStore } from './episodic-store.js';
import { SemanticGraph } from './semantic-graph.js';
import type { SourceType } from '../types/provenance.js';
import type { EpisodeContent } from '../types/episode.js';

export interface PersistentStoreConfig {
  basePath: string;
  saveIntervalMs?: number;
  maxJournalEntriesBeforeSnapshot?: number;
}

export interface StoreSnapshot {
  version: number;
  timestamp: string;
  episodes: Array<{
    id: string;
    timestamp: string;
    content: EpisodeContent;
    session_id: string;
    agent_id: string;
    user_id: string;
    project_id: string;
    concepts: string[];
    preceding_episode: string | null;
    provenance: { source: SourceType; source_id: string; timestamp: string; reliability: number };
    compressed: boolean;
    summary: string | null;
    access_count: number;
    last_access: string;
  }>;
  concepts: Array<{
    id: string;
    name: string;
    concept_type: string;
    definition: string;
    embedding: number[];
    importance: number;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationship: string;
    valid_at: string;
    invalid_at: string | null;
    created_at: string;
    expired_at: string | null;
  }>;
}

export class PersistentStore {
  private config: PersistentStoreConfig;
  private journal: Journal;
  private episodic: EpisodicStore;
  private graph: SemanticGraph;
  private version = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;

  constructor(
    config: PersistentStoreConfig,
    episodic: EpisodicStore,
    graph: SemanticGraph,
  ) {
    this.config = { saveIntervalMs: 30000, maxJournalEntriesBeforeSnapshot: 1000, ...config };
    this.episodic = episodic;
    this.graph = graph;
    this.journal = new Journal(config.basePath);
  }

  async init(): Promise<void> {
    await mkdir(this.config.basePath, { recursive: true });
    await this.journal.replay();
    const entries = this.journal.getEntries();
    const snapshotPath = join(this.config.basePath, 'snapshot.json');
    const snapshotExists = existsSync(snapshotPath);

    if (snapshotExists) {
      await this.loadSnapshot(snapshotPath);
    }

    if (entries.length > 0) {
      this.replayFromLastSnapshot(entries);
    }

    this.timer = setInterval(async () => {
      if (this.dirty) {
        await this.createSnapshot();
        this.dirty = false;
      }
    }, this.config.saveIntervalMs);

    if (entries.length > 0) {
      await this.journal.rotate();
    }
  }

  async shutdown(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.dirty) {
      await this.createSnapshot();
    }
  }

  markDirty(): void {
    this.dirty = true;
  }

  async appendEpisode(episode: {
    id: string;
    content: EpisodeContent;
    session_id: string;
    agent_id: string;
    user_id: string;
    project_id: string;
    provenance: { source: SourceType; source_id: string; timestamp: Date; reliability: number };
    concepts: string[];
    preceding_episode: string | null;
    compressed: boolean;
    summary: string | null;
    timestamp: Date;
  }): Promise<void> {
    const data = JSON.stringify(episode);
    await this.journal.append({ type: 'episode:append', episode_id: episode.id, data });
    this.dirty = true;

    if (this.journal.getEntryCount() >= this.config.maxJournalEntriesBeforeSnapshot!) {
      await this.createSnapshot();
    }
  }

  async markEpisodeCompressed(episodeId: string, summary: string): Promise<void> {
    await this.journal.append({ type: 'episode:mark_compressed', episode_id: episodeId, summary });
    this.dirty = true;
  }

  async addConcept(concept: { id: string; name: string; concept_type: string; definition: string; embedding: number[]; importance: number }): Promise<void> {
    const data = JSON.stringify(concept);
    await this.journal.append({ type: 'concept:add', concept_id: concept.id, data });
    this.dirty = true;
  }

  async addEdge(edge: { id: string; source: string; target: string; relationship: string; valid_at: Date }): Promise<void> {
    const data = JSON.stringify(edge);
    await this.journal.append({ type: 'edge:add', edge_id: edge.id, data });
    this.dirty = true;
  }

  async invalidateEdge(edgeId: string, invalidAt: Date): Promise<void> {
    await this.journal.append({ type: 'edge:invalidate', edge_id: edgeId, invalid_at: invalidAt.toISOString() });
    this.dirty = true;
  }

  async recordConsolidation(cycleNumber: number, promoted: number, pruned: number): Promise<void> {
    await this.journal.append({ type: 'consolidation:cycle', cycle_number: cycleNumber, promoted, pruned });
  }

  private async createSnapshot(): Promise<void> {
    const snapshot: StoreSnapshot = {
      version: this.version,
      timestamp: new Date().toISOString(),
      episodes: this.episodic.getRecent(Infinity).map((ep) => ({
        id: ep.id,
        timestamp: ep.timestamp.toISOString(),
        content: ep.content,
        session_id: ep.session_id,
        agent_id: ep.agent_id,
        user_id: ep.user_id,
        project_id: ep.project_id,
        concepts: ep.concepts,
        preceding_episode: ep.preceding_episode,
        provenance: {
          source: ep.provenance.source,
          source_id: ep.provenance.source_id,
          timestamp: ep.provenance.timestamp.toISOString(),
          reliability: ep.provenance.reliability,
        },
        compressed: ep.compressed,
        summary: ep.summary,
        access_count: ep.access_count,
        last_access: ep.last_access.toISOString(),
      })),
      concepts: this.graph.getAllConcepts().map((c) => ({
        id: c.id,
        name: c.name,
        concept_type: c.concept_type,
        definition: c.definition,
        embedding: c.embedding,
        importance: c.importance,
      })),
      edges: [],
    };

    const snapshotPath = join(this.config.basePath, 'snapshot.json');
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
    await this.journal.rotate();
  }

  private async loadSnapshot(snapshotPath: string): Promise<void> {
    try {
      const raw = await readFile(snapshotPath, 'utf8');
      const snapshot = JSON.parse(raw) as StoreSnapshot;

      for (const ep of snapshot.episodes) {
        await this.episodic.append({
          content: ep.content,
          session_id: ep.session_id,
          agent_id: ep.agent_id,
          user_id: ep.user_id,
          project_id: ep.project_id,
          provenance: {
            ...ep.provenance,
            timestamp: new Date(ep.provenance.timestamp),
          },
          concepts: ep.concepts,
          preceding_episode: ep.preceding_episode ?? undefined,
        });
        if (ep.compressed && ep.summary) {
          this.episodic.markCompressed(ep.id, ep.summary);
        }
      }

      for (const c of snapshot.concepts) {
        const { createConcept } = await import('../types/concept.js');
        const { createProvenance } = await import('../types/provenance.js');
        const concept = createConcept({
          name: c.name,
          concept_type: c.concept_type as any,
          definition: c.definition,
          provenance: createProvenance('system_log', 'restored'),
          importance: c.importance,
        });
        concept.id = c.id;
        concept.embedding = c.embedding;
        this.graph.addConcept(concept);
      }
    } catch {
      // Corrupted snapshot — start fresh
    }
  }

  private replayFromLastSnapshot(entries: JournalEntry[]): void {
    for (const entry of entries) {
      this.applyOperation(entry.operation);
    }
  }

  private applyOperation(op: JournalOperation): void {
    switch (op.type) {
      case 'episode:append': {
        const ep = JSON.parse(op.data);
        this.episodic.append({
          content: ep.content,
          session_id: ep.session_id,
          agent_id: ep.agent_id,
          user_id: ep.user_id,
          project_id: ep.project_id,
          provenance: { ...ep.provenance, timestamp: new Date(ep.provenance.timestamp) },
          concepts: ep.concepts,
          preceding_episode: ep.preceding_episode ?? undefined,
        });
        break;
      }
      case 'episode:mark_compressed':
        this.episodic.markCompressed(op.episode_id, op.summary);
        break;
    }
  }
}
