import type { Concept } from '../types/concept.js';
import type { Episode } from '../types/episode.js';
import type { Edge } from '../types/edge.js';
import { SemanticGraph } from '../storage/semantic-graph.js';
import { EpisodicStore } from '../storage/episodic-store.js';

export interface ScoredResult {
  id: string;
  score: number;
  source: 'semantic' | 'keyword' | 'graph' | 'temporal' | 'sparse';
  content: Concept | Episode | Edge;
}

export interface FusionQuery {
  text: string;
  embedding?: number[];
  concepts?: string[];
  timeRange?: { start: Date; end: Date };
  limit?: number;
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

function bm25Score(query: string, text: string): number {
  const queryTerms = query.toLowerCase().split(/\s+/);
  const textLower = text.toLowerCase();
  let score = 0;
  for (const term of queryTerms) {
    const count = (textLower.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
    if (count > 0) {
      score += Math.log(1 + count);
    }
  }
  return score / queryTerms.length;
}

export class RetrievalFusion {
  private graph: SemanticGraph;
  private episodic: EpisodicStore;

  constructor(graph: SemanticGraph, episodic: EpisodicStore) {
    this.graph = graph;
    this.episodic = episodic;
  }

  search(query: FusionQuery): ScoredResult[] {
    const allResults: ScoredResult[] = [];
    const limit = query.limit ?? 20;

    // 1. Semantic search on concepts
    if (query.embedding && query.embedding.length > 0) {
      for (const concept of this.graph.getAllConcepts()) {
        if (concept.embedding.length > 0) {
          const sim = cosineSimilarity(query.embedding, concept.embedding);
          if (sim > 0.3) {
            allResults.push({ id: concept.id, score: sim, source: 'semantic', content: concept });
          }
        }
      }
    }

    // 2. BM25 keyword search on concepts
    for (const concept of this.graph.getAllConcepts()) {
      const score = bm25Score(query.text, `${concept.name} ${concept.definition} ${concept.purpose}`);
      if (score > 0) {
        allResults.push({ id: concept.id, score: score * 0.8, source: 'keyword', content: concept });
      }
    }

    // 3. Graph BFS traversal from related concepts
    if (query.concepts) {
      for (const conceptId of query.concepts) {
        const neighbors = this.graph.bfsTraversal(conceptId, 2);
        for (const neighbor of neighbors) {
          const existing = allResults.find((r) => r.id === neighbor.concept.id);
          if (existing) {
            existing.score += 0.3 / neighbor.depth;
          } else {
            allResults.push({
              id: neighbor.concept.id,
              score: 0.5 / neighbor.depth,
              source: 'graph',
              content: neighbor.concept,
            });
          }
        }
      }
    }

    // 4. Temporal — recent episodes
    if (query.timeRange) {
      const episodes = this.episodic.getByTimeRange(query.timeRange.start, query.timeRange.end);
      for (const episode of episodes) {
        allResults.push({
          id: episode.id,
          score: 0.4,
          source: 'temporal',
          content: episode,
        });
      }
    }

    // 5. Recent episodes as fallback context
    const recent = this.episodic.getRecent(10);
    for (const episode of recent) {
      const alreadyScored = query.embedding && query.embedding.length > 0
        ? allResults.find((r) => r.id === episode.id)
        : undefined;
      if (!alreadyScored) {
        allResults.push({
          id: episode.id,
          score: 0.2,
          source: 'temporal',
          content: episode,
        });
      }
    }

    // RRF fusion: combine duplicate IDs via Reciprocal Rank Fusion
    return this.rrfFusion(allResults).slice(0, limit);
  }

  private rrfFusion(results: ScoredResult[], k = 60): ScoredResult[] {
    const grouped = new Map<string, ScoredResult[]>();
    for (const r of results) {
      const group = grouped.get(r.id) ?? [];
      group.push(r);
      grouped.set(r.id, group);
    }

    const fused: ScoredResult[] = [];
    for (const [, group] of grouped) {
      // Sort each group by score descending within their source
      group.sort((a, b) => b.score - a.score);

      // RRF: each source contributes rank position
      let rrfScore = 0;
      let bestResult = group[0]!;
      for (const r of group) {
        const rank = group.indexOf(r) + 1;
        rrfScore += 1 / (k + rank);
        if (r.score > bestResult.score) bestResult = r;
      }

      fused.push({ ...bestResult, score: rrfScore });
    }

    return fused.sort((a, b) => b.score - a.score);
  }

  mmrRerank(results: ScoredResult[], lambda = 0.5, limit = 10): ScoredResult[] {
    if (results.length === 0) return [];

    const selected: ScoredResult[] = [];
    const candidateSet = [...results];

    while (selected.length < limit && candidateSet.length > 0) {
      let bestIdx = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < candidateSet.length; i++) {
        const relevance = candidateSet[i]!.score;

        let maxSimilarity = 0;
        for (const sel of selected) {
          const candidateContent = 'embedding' in candidateSet[i]!.content
            ? (candidateSet[i]!.content as Concept).embedding
            : [];
          const selectedContent = 'embedding' in sel.content
            ? (sel.content as Concept).embedding
            : [];

          if (candidateContent.length > 0 && selectedContent.length > 0) {
            const sim = cosineSimilarity(candidateContent, selectedContent);
            maxSimilarity = Math.max(maxSimilarity, sim);
          }
        }

        const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;
        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIdx = i;
        }
      }

      selected.push(candidateSet[bestIdx]!);
      candidateSet.splice(bestIdx, 1);
    }

    return selected;
  }

  formatContext(results: ScoredResult[]): string {
    return results
      .map((r) => {
        const confidence = 'confidence' in r.content ? (r.content as Concept).confidence.value.toFixed(2) : 'N/A';
        const source = r.source;
        const value = 'name' in r.content
          ? `[${(r.content as Concept).name}]: ${(r.content as Concept).definition}`
          : 'content' in r.content
            ? JSON.stringify((r.content as Episode).content)
            : JSON.stringify(r.content);

        return `--- Memory (confidence: ${confidence}, source: ${source}) ---\n${value}`;
      })
      .join('\n\n');
  }
}
