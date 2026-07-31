import type { Episode, EpisodeContent } from '../kernel/types/episode.js';

export interface MemoryProvider {
  getRecent(limit: number): Episode[];
  getById(id: string): Episode | undefined;
}

export interface SearchIndexEntry {
  id: string;
  snippet: string;
  timestamp: Date;
  sessionId: string;
  tokenEstimate: number;
  score: number;
  matchedTerms: string[];
}

export interface TimelineWindow {
  anchorId: string;
  before?: number;
  after?: number;
}

export interface TimelineEntry {
  id: string;
  timestamp: Date;
  sessionId: string;
  snippet: string;
  relation: 'before' | 'anchor' | 'after';
}

export interface ObservationDetail {
  id: string;
  timestamp: Date;
  sessionId: string;
  content: EpisodeContent;
  tokenEstimate: number;
}

export interface ProgressiveSearchOptions {
  limit?: number;
  projectId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface ProgressiveSearchResult {
  query: string;
  totalMatches: number;
  entries: SearchIndexEntry[];
  tokenCostHint: string;
}

export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function extractText(content: EpisodeContent): string {
  switch (content.type) {
    case 'text':
      return content.text;
    case 'observation':
      return content.observation;
    case 'structured':
      return JSON.stringify(content.data);
    case 'tool_call':
      return JSON.stringify({ tool: content.tool, input: content.input, output: content.output });
  }
}

export function stripPrivate(text: string): string {
  return text.replace(/<private>[\s\S]*?<\/private>/g, '[private]').replace(/<private\/>/g, '');
}

export function scoreText(query: string, text: string): { score: number; terms: string[] } {
  const queryTerms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);
  if (queryTerms.length === 0) return { score: 0, terms: [] };

  const textLower = text.toLowerCase();
  const terms: string[] = [];
  let score = 0;
  for (const term of queryTerms) {
    const count = (textLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    if (count > 0) {
      terms.push(term);
      score += Math.log(1 + count);
    }
  }
  const phrase = query.toLowerCase().trim();
  if (phrase.length > 4 && textLower.includes(phrase)) {
    score += 3;
  }
  return { score: score / queryTerms.length, terms };
}

export class ProgressiveMemorySearch {
  private provider: MemoryProvider;

  constructor(provider: MemoryProvider) {
    this.provider = provider;
  }

  search(query: string, options: ProgressiveSearchOptions = {}): ProgressiveSearchResult {
    const limit = options.limit ?? 10;
    const episodes = this.provider.getRecent(10_000).filter((e) => {
      if (options.projectId && e.project_id !== options.projectId) return false;
      if (options.dateFrom && e.timestamp < options.dateFrom) return false;
      if (options.dateTo && e.timestamp > options.dateTo) return false;
      return true;
    });

    const scored: Array<{ episode: Episode; score: number; terms: string[] }> = [];
    for (const episode of episodes) {
      const text = extractText(episode.content);
      if (text === '[private]' || text.trim() === '') continue;
      const { score, terms } = scoreText(query, text);
      if (score > 0) {
        scored.push({ episode, score, terms });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, limit);

    const entries: SearchIndexEntry[] = top.map(({ episode, score, terms }) => ({
      id: episode.id,
      snippet: extractText(episode.content).slice(0, 120),
      timestamp: episode.timestamp,
      sessionId: episode.session_id,
      tokenEstimate: estimateTokens(extractText(episode.content)),
      score: Number(score.toFixed(4)),
      matchedTerms: terms,
    }));

    return {
      query,
      totalMatches: scored.length,
      entries,
      tokenCostHint: `index: ~${entries.reduce((s, e) => s + e.tokenEstimate, 0)} tokens (fetch details only for relevant IDs)`,
    };
  }

  timeline(window: TimelineWindow): TimelineEntry[] {
    const anchor = this.provider.getById(window.anchorId);
    if (!anchor) return [];

    const all = this.provider
      .getRecent(10_000)
      .filter((e) => e.session_id === anchor.session_id)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const anchorIdx = all.findIndex((e) => e.id === anchor.id);
    if (anchorIdx === -1) return [];

    const before = Math.max(0, anchorIdx - (window.before ?? 5));
    const after = Math.min(all.length, anchorIdx + 1 + (window.after ?? 3));

    return all.slice(before, after).map((e, idx) => {
      const absoluteIdx = before + idx;
      return {
        id: e.id,
        timestamp: e.timestamp,
        sessionId: e.session_id,
        snippet: extractText(e.content).slice(0, 100),
        relation: e.id === anchor.id ? 'anchor' : absoluteIdx < anchorIdx ? 'before' : 'after',
      };
    });
  }

  getObservations(ids: string[]): ObservationDetail[] {
    const details: ObservationDetail[] = [];
    for (const id of ids) {
      const episode = this.provider.getById(id);
      if (!episode) continue;
      details.push({
        id: episode.id,
        timestamp: episode.timestamp,
        sessionId: episode.session_id,
        content: episode.content,
        tokenEstimate: estimateTokens(extractText(episode.content)),
      });
    }
    return details;
  }
}
