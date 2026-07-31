import type { Episode, EpisodeContent } from '../types/episode.js';
import type { Provenance } from '../types/provenance.js';

interface SparseIndexEntry {
  hash: bigint;
  episode_ids: string[];
}

interface TemporalIndexEntry {
  timestamp: Date;
  episode_id: string;
}

export class EpisodicStore {
  private episodes: Map<string, Episode> = new Map();
  private sparse_index: Map<string, SparseIndexEntry> = new Map();
  private temporal_index: TemporalIndexEntry[] = [];
  private concept_index: Map<string, string[]> = new Map();

  async append(params: {
    content: EpisodeContent;
    session_id: string;
    agent_id?: string;
    user_id?: string;
    project_id?: string;
    provenance: Provenance;
    preceding_episode?: string;
    concepts?: string[];
  }): Promise<Episode> {
    const now = new Date();
    const episode: Episode = {
      id: crypto.randomUUID(),
      timestamp: now,
      content: params.content,
      session_id: params.session_id,
      agent_id: params.agent_id ?? 'default',
      user_id: params.user_id ?? 'default',
      project_id: params.project_id ?? 'default',
      concepts: params.concepts ?? [],
      preceding_episode: params.preceding_episode ?? null,
      provenance: params.provenance,
      compressed: false,
      summary: null,
      access_count: 0,
      last_access: now,
    };

    this.episodes.set(episode.id, episode);
    this.temporal_index.push({ timestamp: episode.timestamp, episode_id: episode.id });

    for (const conceptId of episode.concepts) {
      const existing = this.concept_index.get(conceptId) ?? [];
      existing.push(episode.id);
      this.concept_index.set(conceptId, existing);
    }

    // Sparse hash indexing for content-based lookup
    const contentHash = this.computeSparseHash(episode.content);
    const key = contentHash.toString();
    const entry = this.sparse_index.get(key) ?? { hash: contentHash, episode_ids: [] };
    entry.episode_ids.push(episode.id);
    this.sparse_index.set(key, entry);

    return episode;
  }

  getById(id: string): Episode | undefined {
    const episode = this.episodes.get(id);
    if (episode) {
      this.updateAccessPattern(episode);
    }
    return episode;
  }

  getByTimeRange(start: Date, end: Date): Episode[] {
    return this.temporal_index
      .filter((e) => e.timestamp >= start && e.timestamp <= end)
      .map((e) => this.episodes.get(e.episode_id))
      .filter((e): e is Episode => e !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getBySession(sessionId: string): Episode[] {
    const results: Episode[] = [];
    for (const [, episode] of this.episodes) {
      if (episode.session_id === sessionId) {
        results.push(episode);
      }
    }
    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getByConcept(conceptId: string): Episode[] {
    const ids = this.concept_index.get(conceptId) ?? [];
    return ids
      .map((id) => this.episodes.get(id))
      .filter((e): e is Episode => e !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getRecent(limit = 50): Episode[] {
    const sorted = [...this.episodes.values()].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return sorted.slice(0, limit);
  }

  count(): number {
    return this.episodes.size;
  }

  markCompressed(id: string, summary: string): void {
    const episode = this.episodes.get(id);
    if (episode) {
      episode.compressed = true;
      episode.summary = summary;
    }
  }

  getAccessFrequency(since: Date): Map<string, number> {
    const frequency = new Map<string, number>();
    for (const [, episode] of this.episodes) {
      if (episode.timestamp >= since) {
        for (const conceptId of episode.concepts) {
          frequency.set(conceptId, (frequency.get(conceptId) ?? 0) + 1);
        }
      }
    }
    return frequency;
  }

  pruneOlderThan(date: Date): number {
    let count = 0;
    for (const [id, episode] of this.episodes) {
      if (episode.timestamp < date) {
        this.episodes.delete(id);
        this.temporal_index = this.temporal_index.filter((e) => e.episode_id !== id);
        count++;
      }
    }
    return count;
  }

  private computeSparseHash(content: EpisodeContent): bigint {
    const str = JSON.stringify(content);
    let hash = 0n;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5n) - hash + BigInt(str.charCodeAt(i));
    }
    return hash;
  }

  private updateAccessPattern(episode: Episode): void {
    episode.last_access = new Date();
    episode.access_count = (episode.access_count ?? 0) + 1;
  }
}
