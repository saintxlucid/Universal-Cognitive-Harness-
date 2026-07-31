import type { Concept } from '../types/concept.js';
import type { Episode } from '../types/episode.js';
import type { Edge } from '../types/edge.js';
import type { EpistemicStatus } from '../types/provenance.js';
import { SemanticGraph } from '../storage/semantic-graph.js';
import { EpisodicStore } from '../storage/episodic-store.js';
import {
  DEFAULT_RECENCY_DECAY,
  lookupDecayConfig,
  recencyBoost,
  type RecencyDecayMap,
} from './recency-decay.js';

export interface ProvenanceWeightConfig {
  enabled: boolean;
  reliabilityWeight: number;
  confidenceWeight: number;
  entrenchmentWeight: number;
  epistemicStatusWeight: number;
  epistemicStatusMap: Record<EpistemicStatus, number>;
  accessCountBonus: number;
}

const DEFAULT_EPISTEMIC_MAP: Record<EpistemicStatus, number> = {
  observation: 0.6,
  fact: 1.0,
  knowledge: 0.9,
  belief: 0.7,
  speculation: 0.4,
  rejected: 0.0,
};

const DEFAULT_PROVENANCE_WEIGHTS: ProvenanceWeightConfig = {
  enabled: true,
  reliabilityWeight: 0.35,
  confidenceWeight: 0.30,
  entrenchmentWeight: 0.20,
  epistemicStatusWeight: 0.15,
  epistemicStatusMap: DEFAULT_EPISTEMIC_MAP,
  accessCountBonus: 0.02,
};

export interface ScoredResult {
  id: string;
  score: number;
  rawScore: number;
  provenanceFactor: number;
  source: 'semantic' | 'keyword' | 'graph' | 'temporal' | 'sparse';
  content: Concept | Episode | Edge;
}

export interface FusionQuery {
  text: string;
  embedding?: number[];
  concepts?: string[];
  timeRange?: { start: Date; end: Date };
  limit?: number;
  provenanceWeights?: Partial<ProvenanceWeightConfig>;
  /** Recency decay overrides. Disable with `enabled: false`. */
  recencyDecay?: { enabled?: boolean; map?: RecencyDecayMap };
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
  private provenanceWeights: ProvenanceWeightConfig;
  private recencyDecay: RecencyDecayMap;

  constructor(
    graph: SemanticGraph,
    episodic: EpisodicStore,
    provenanceWeights?: Partial<ProvenanceWeightConfig>,
    recencyDecay?: RecencyDecayMap,
  ) {
    this.graph = graph;
    this.episodic = episodic;
    this.provenanceWeights = { ...DEFAULT_PROVENANCE_WEIGHTS, ...provenanceWeights };
    this.recencyDecay = { ...DEFAULT_RECENCY_DECAY, ...(recencyDecay ?? {}) };
  }

  private computeProvenanceFactor(concept: Concept): number {
    if (!this.provenanceWeights.enabled) return 1.0;

    const pw = this.provenanceWeights;

    const reliabilityScore = concept.provenance?.reliability ?? 0.5;
    const confidenceScore = concept.confidence?.value ?? 0.5;
    const entrenchmentScore = (concept.entrenchment as number) / 5;
    const epistemicScore = pw.epistemicStatusMap[concept.epistemic_status] ?? 0.5;
    const accessBonus = Math.min(concept.access_count * pw.accessCountBonus, 0.2);

    const factor = (
      reliabilityScore * pw.reliabilityWeight +
      confidenceScore * pw.confidenceWeight +
      entrenchmentScore * pw.entrenchmentWeight +
      epistemicScore * pw.epistemicStatusWeight
    ) + accessBonus;

    return Math.max(0.05, Math.min(1.5, factor));
  }

  private computeEpisodeProvenanceFactor(episode: Episode): number {
    if (!this.provenanceWeights.enabled) return 1.0;

    const pw = this.provenanceWeights;
    const reliabilityScore = episode.provenance?.reliability ?? 0.5;
    const accessBonus = Math.min(episode.access_count * pw.accessCountBonus, 0.2);

    return Math.max(0.05, Math.min(1.5, reliabilityScore + accessBonus));
  }

  private applyProvenance(raw: number, factor: number): number {
    return raw * factor;
  }

  setProvenanceWeights(weights: Partial<ProvenanceWeightConfig>): void {
    this.provenanceWeights = { ...this.provenanceWeights, ...weights };
  }

  getProvenanceWeights(): ProvenanceWeightConfig {
    return { ...this.provenanceWeights };
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
            const pf = this.computeProvenanceFactor(concept);
            allResults.push({ id: concept.id, score: this.applyProvenance(sim, pf), rawScore: sim, provenanceFactor: pf, source: 'semantic', content: concept });
          }
        }
      }
    }

    // 2. BM25 keyword search on concepts
    for (const concept of this.graph.getAllConcepts()) {
      const raw = bm25Score(query.text, `${concept.name} ${concept.definition} ${concept.purpose}`);
      if (raw > 0) {
        const pf = this.computeProvenanceFactor(concept);
        allResults.push({ id: concept.id, score: this.applyProvenance(raw * 0.8, pf), rawScore: raw * 0.8, provenanceFactor: pf, source: 'keyword', content: concept });
      }
    }

    // 3. Graph BFS traversal from related concepts
    if (query.concepts) {
      for (const conceptId of query.concepts) {
        const neighbors = this.graph.bfsTraversal(conceptId, 2);
        for (const neighbor of neighbors) {
          const existing = allResults.find((r) => r.id === neighbor.concept.id);
          const pf = this.computeProvenanceFactor(neighbor.concept);
          const rawAdd = 0.3 / neighbor.depth;
          if (existing) {
            existing.rawScore += rawAdd;
            existing.provenanceFactor = (existing.provenanceFactor + pf) / 2;
            existing.score = this.applyProvenance(existing.rawScore, existing.provenanceFactor);
          } else {
            const raw = 0.5 / neighbor.depth;
            allResults.push({
              id: neighbor.concept.id,
              score: this.applyProvenance(raw, pf),
              rawScore: raw,
              provenanceFactor: pf,
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
        const pf = this.computeEpisodeProvenanceFactor(episode);
        allResults.push({
          id: episode.id,
          score: this.applyProvenance(0.4, pf),
          rawScore: 0.4,
          provenanceFactor: pf,
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
        const pf = this.computeEpisodeProvenanceFactor(episode);
        allResults.push({
          id: episode.id,
          score: this.applyProvenance(0.2, pf),
          rawScore: 0.2,
          provenanceFactor: pf,
          source: 'temporal',
          content: episode,
        });
      }
    }

    // RRF fusion: combine duplicate IDs via Reciprocal Rank Fusion
    let fused = this.rrfFusion(allResults);

    // Recency-decay stage: compose recency boost multiplicatively
    // as a post-fusion stage (per-prefix half-life map).
    if (query.recencyDecay?.enabled !== false) {
      const decayMap = { ...this.recencyDecay, ...(query.recencyDecay?.map ?? {}) };
      fused = this.applyRecencyBoost(fused, decayMap, new Date());
    }

    return fused.slice(0, limit);
  }

  /**
   * Post-fusion recency boost.
   * Multiplies each score by (1 + recency component) where the component is
   * coefficient × halflife / (halflife + days_old) per prefix tier.
   * Evergreen tiers (coefficient 0 or halflife 0) are untouched.
   */
  private applyRecencyBoost(results: ScoredResult[], decayMap: RecencyDecayMap, now: Date): ScoredResult[] {
    return results.map((r) => {
      let tier: string;
      let ageDays: number;

      if ('name' in r.content) {
        const concept = r.content as Concept;
        tier = 'concept';
        ageDays = (now.getTime() - concept.updated_at.getTime()) / 86_400_000;
      } else if ('timestamp' in r.content) {
        const episode = r.content as Episode;
        const type = episode.content?.type ?? 'text';
        tier = `episode:${type}`;
        ageDays = (now.getTime() - episode.timestamp.getTime()) / 86_400_000;
      } else {
        return r;
      }

      const boost = recencyBoost(ageDays, lookupDecayConfig(tier, decayMap));
      if (boost <= 0) return r;
      return { ...r, score: r.score * (1 + boost), rawScore: r.rawScore };
    }).sort((a, b) => b.score - a.score);
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
        const concept = 'name' in r.content ? (r.content as Concept) : null;
        const confidence = concept ? concept.confidence.value.toFixed(2) : 'N/A';
        const reliability = concept ? concept.provenance.reliability.toFixed(2) : 'N/A';
        const epistemic = concept ? concept.epistemic_status : 'N/A';
        const provenanceFactor = r.provenanceFactor.toFixed(2);
        const value = concept
          ? `[${concept.name}]: ${concept.definition}`
          : 'content' in r.content
            ? JSON.stringify((r.content as Episode).content)
            : JSON.stringify(r.content);

        return `--- Memory (confidence: ${confidence}, provenance: ${provenanceFactor}, reliability: ${reliability}, status: ${epistemic}, source: ${r.source}) ---\n${value}`;
      })
      .join('\n\n');
  }
}
