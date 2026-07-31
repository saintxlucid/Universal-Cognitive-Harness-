import type { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import type { Episode, EpisodeContent } from '../kernel/types/episode.js';

export interface ExperienceEntry {
  id: string;
  timestamp: string;
  summary: string;
  content: EpisodeContent;
  session_id: string;
  importance: number;
}

export class ExperienceStore {
  private kernel: CognitiveKernel;

  constructor(kernel: CognitiveKernel) {
    this.kernel = kernel;
  }

  async record(content: EpisodeContent, opts?: { concepts?: string[]; source?: string }): Promise<Episode> {
    return this.kernel.remember({ content, concepts: opts?.concepts, provenance: { source: opts?.source ?? 'user' } });
  }

  async query(timeRange?: { start: Date; end: Date }, limit = 20): Promise<ExperienceEntry[]> {
    const episodes = timeRange
      ? this.kernel.getEpisodesByTimeRange(timeRange.start, timeRange.end)
      : this.kernel.getRecentEpisodes(limit);
    return episodes.slice(0, limit).map((ep: Episode) => ({
      id: ep.id,
      timestamp: ep.timestamp.toISOString(),
      summary: ep.summary ?? JSON.stringify(ep.content).slice(0, 100),
      content: ep.content,
      session_id: ep.session_id,
      importance: ep.access_count / 10,
    }));
  }

  recent(limit = 10): ExperienceEntry[] {
    return this.kernel.getRecentEpisodes(limit).map((ep: Episode) => ({
      id: ep.id,
      timestamp: ep.timestamp.toISOString(),
      summary: ep.summary ?? JSON.stringify(ep.content).slice(0, 100),
      content: ep.content,
      session_id: ep.session_id,
      importance: ep.access_count / 10,
    }));
  }
}
