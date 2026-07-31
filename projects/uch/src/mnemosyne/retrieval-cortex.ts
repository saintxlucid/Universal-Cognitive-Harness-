// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Retrieval cortex: the read path
// Five gates in order: scope → trust → candidates → activation/rerank →
// budget. Candidate signals: semantic (cosine), lexical (BM25), fingerprint
// (pattern completion), temporal (validity windows), associative (PPR over
// the entity graph), ACT-R activation. Fusion via RRF; diversity via MMR.
// Output: a budgeted evidence packet with epistemic labels and an explicit
// abstention signal (LongMemEval).
// ═══════════════════════════════════════════════════════════════════════════

import type { Claim, EvidencePacket, EvidencePacketItem, MnemEpisode, PatternSkill, Scope } from './types.js';
import { cosineSimilarity, HashEmbedder, kwtaFingerprint, fingerprintOverlap } from './embedding.js';
import { baseLevelActivation, decayFor, totalActivation, type DecaySchedule } from './activation.js';
import type { EpisodicStore } from './stores/episodic-store.js';
import type { SemanticStore } from './stores/semantic-store.js';
import type { ProceduralStore } from './stores/procedural-store.js';
import type { ParahippocampalGate } from './parahippocampal-gate.js';

export interface RetrievalQuery {
  text: string;
  scope: Scope;
  trustRequirement?: number;
  budget?: number;
  kinds?: Array<'claim' | 'episode' | 'pattern' | 'lesson'>;
  now?: Date;
}

export interface RetrievalResult {
  packet: EvidencePacket;
  gates: { scope: boolean; trust: boolean; candidates: number; reranked: number };
}

const DEFAULT_BUDGET = 1600;
const RRF_K = 60;

export function reciprocalRankFusion(lists: Array<Array<{ id: string; score: number }>>): Map<string, number> {
  const fused = new Map<string, number>();
  for (const list of lists) {
    let rank = 1;
    for (const item of list) {
      fused.set(item.id, (fused.get(item.id) ?? 0) + 1 / (RRF_K + rank));
      rank++;
    }
  }
  return fused;
}

export function mmrDiversity(
  ranked: Array<{ id: string; score: number; embedding: number[] }>,
  lambda = 0.6,
  topK = 12,
): Array<{ id: string; score: number }> {
  const selected: Array<{ id: string; score: number; embedding: number[] }> = [];
  const candidates = [...ranked];
  while (selected.length < topK && candidates.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i]!;
      const relevance = cand.score;
      let maxSim = 0;
      for (const sel of selected) {
        maxSim = Math.max(maxSim, cosineSimilarity(cand.embedding, sel.embedding));
      }
      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }
    const chosen = candidates[bestIdx]!;
    selected.push(chosen);
    candidates.splice(bestIdx, 1);
  }
  return selected.map(({ id, score }) => ({ id, score }));
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

export class RetrievalCortex {
  private episodic: EpisodicStore;
  private semantic: SemanticStore;
  private procedural: ProceduralStore;
  private gate: ParahippocampalGate;
  private decay: DecaySchedule;

  constructor(
    episodic: EpisodicStore,
    semantic: SemanticStore,
    procedural: ProceduralStore,
    gate: ParahippocampalGate,
    decay: DecaySchedule,
  ) {
    this.episodic = episodic;
    this.semantic = semantic;
    this.procedural = procedural;
    this.gate = gate;
    this.decay = decay;
  }

  retrieve(query: RetrievalQuery): RetrievalResult {
    const now = query.now ?? new Date();
    const queryEmb = this.embedQuery(query.text);
    const queryFp = kwtaFingerprint(queryEmb);
    const queryTerms = query.text.toLowerCase().split(/\W+/).filter((t) => t.length >= 3);

    // ── Gate 1: scope ─────────────────────────────────────────────────────
    const scopedEpisodes = this.episodic.all().filter((e) => this.gate.scopeAllows(query.scope, e.scope));
    const scopedClaims = this.semantic.active(now).filter((c) => this.gate.scopeAllows(query.scope, c.scope));
    const scopedPatterns = this.procedural.all().filter((p) => this.gate.scopeAllows(query.scope, p.scope));

    // ── Gate 2: trust ──────────────────────────────────────────────────────
    const trustReq = query.trustRequirement ?? 0.3;
    const trustedEpisodes = scopedEpisodes.filter((e) => this.gate.trustScore(e.reliability, e.channel, e.instructionLikeness) >= trustReq || e.channel === 'user');
    const trustedClaims = scopedClaims.filter((c) => !c.quarantined);
    const trustedPatterns = scopedPatterns.filter((p) => p.lti >= trustReq * 0.5);

    // ── Gate 3: candidates (fused signals) ────────────────────────────────
    const lists: Array<Array<{ id: string; score: number }>> = [];
    const kindFilter = new Set(query.kinds ?? ['claim', 'episode', 'pattern', 'lesson']);

    if (kindFilter.has('episode')) {
      // Semantic gate is calibrated against the hash embedder's noise floor
      // (unrelated texts score ~0.27; related queries score ≥ 0.53).
      const semanticHits: Array<{ id: string; score: number }> = [];
      for (const e of trustedEpisodes) {
        const sim = cosineSimilarity(queryEmb, e.embedding);
        if (sim >= 0.4) semanticHits.push({ id: e.id, score: sim });
      }
      lists.push(semanticHits.sort((a, b) => b.score - a.score).slice(0, 20));

      // Pattern completion: hippocampal-style sparse fingerprint overlap
      const fingerprintHits: Array<{ id: string; score: number }> = [];
      for (const e of trustedEpisodes) {
        const overlap = e.fingerprint.length > 0 ? this.fingerprintOverlap(queryFp, e.fingerprint) : 0;
        if (overlap >= 0.4) fingerprintHits.push({ id: e.id, score: overlap });
      }
      lists.push(fingerprintHits.sort((a, b) => b.score - a.score).slice(0, 20));

      const lexicalHits: Array<{ id: string; score: number }> = [];
      for (const e of trustedEpisodes) {
        let score = 0;
        for (const term of queryTerms) {
          if (e.terms.includes(term)) score++;
        }
        if (score > 0) lexicalHits.push({ id: e.id, score });
      }
      lists.push(lexicalHits.sort((a, b) => b.score - a.score).slice(0, 20));

      // Temporal recency is a *boost on relevant candidates*, never a
      // standalone admission signal — otherwise every fresh episode would
      // pollute unrelated queries (context rot).
      const relevant = new Set([...semanticHits, ...fingerprintHits, ...lexicalHits].map((h) => h.id));
      const temporalHits: Array<{ id: string; score: number }> = [];
      for (const e of trustedEpisodes) {
        if (!relevant.has(e.id)) continue;
        const days = (now.getTime() - e.ts.getTime()) / 86_400_000;
        if (days <= 7) temporalHits.push({ id: e.id, score: 1 / (1 + days) });
      }
      lists.push(temporalHits.slice(0, 20));
    }

    if (kindFilter.has('claim')) {
      const claimHits: Array<{ id: string; score: number }> = [];
      for (const c of trustedClaims) {
        const text = `${c.subject} ${c.predicate} ${c.object}`;
        const terms = text.toLowerCase().split(/\W+/).filter((t) => t.length >= 3);
        const overlap = queryTerms.filter((t) => terms.includes(t)).length;
        const score = overlap > 0 ? overlap * 0.6 + c.certainty * 0.2 : 0;
        if (score > 0.3) claimHits.push({ id: c.id, score });
      }
      lists.push(claimHits.sort((a, b) => b.score - a.score).slice(0, 20));

      // Associative: PPR over entity graph seeded by query entities (HippoRAG)
      const pprHits = this.personalizedPageRank(queryTerms, trustedClaims, 2);
      lists.push(pprHits.slice(0, 20));
    }

    if (kindFilter.has('pattern') || kindFilter.has('lesson')) {
      const patternHits: Array<{ id: string; score: number }> = [];
      for (const p of trustedPatterns) {
        const overlap = queryTerms.filter((t) => p.pattern.toLowerCase().includes(t)).length;
        if (overlap > 0) patternHits.push({ id: p.id, score: overlap + p.lti });
      }
      lists.push(patternHits.sort((a, b) => b.score - a.score).slice(0, 10));
    }

    const fused = reciprocalRankFusion(lists);

    // ── Gate 4: activation & rerank ───────────────────────────────────────
    const reranked: Array<{ id: string; score: number; embedding: number[] }> = [];
    for (const [id, rrf] of fused) {
      const embedding = this.embeddingOf(id);
      let activation = 0;
      const episode = this.episodic.peek(id);
      const claim = this.semantic.peek(id);
      const pattern = this.procedural.get(id);
      if (episode) activation = baseLevelActivation(episode.accessTimes, now, decayFor(episode.class, this.decay));
      else if (claim) activation = baseLevelActivation(claim.accessTimes, now, decayFor('semantic', this.decay));
      else if (pattern) activation = baseLevelActivation(pattern.accessTimes, now, decayFor('procedure', this.decay));
      const total = totalActivation(activation, 0);
      const score = rrf * (1 + Math.max(0, total) * 0.1);
      reranked.push({ id, score, embedding });
    }
    reranked.sort((a, b) => b.score - a.score);
    const diversified = mmrDiversity(reranked, 0.65, 16);

    // ── Gate 5: budget ─────────────────────────────────────────────────────
    return this.buildPacket(query, diversified);
  }

  private buildPacket(
    query: RetrievalQuery,
    items: Array<{ id: string; score: number }>,
  ): RetrievalResult {
    const budget = query.budget ?? DEFAULT_BUDGET;
    const packetItems: EvidencePacketItem[] = [];
    let tokens = 0;
    let admitted = 0;
    let confidenceSum = 0;
    let totalCandidates = items.length;

    for (const item of items) {
      if (tokens >= budget) break;
      const itemText = this.renderItem(item.id);
      if (!itemText) continue;
      const itemTokens = estimateTokens(itemText.text);
      if (tokens + itemTokens > budget) break;

      const readDecision = this.gate.admitRead({
        scope: query.scope,
        channel: itemText.channel,
        reliability: itemText.reliability,
        instructionLikeness: itemText.instructionLikeness,
        text: itemText.text,
        targetId: item.id,
        op: 'read',
      });
      if (!readDecision.admitted) {
        totalCandidates--;
        continue;
      }

      packetItems.push({
        id: item.id,
        kind: itemText.kind,
        text: itemText.text,
        status: itemText.status,
        confidence: itemText.confidence,
        evidenceCount: itemText.evidenceCount,
        validAt: itemText.validAt,
        invalidAt: itemText.invalidAt,
        scope: itemText.scope,
        tokens: itemTokens,
        flags: readDecision.flags,
      });
      tokens += itemTokens;
      admitted++;
      confidenceSum += itemText.confidence;
    }

    const avgConfidence = admitted > 0 ? confidenceSum / admitted : 0;
    const unknown = admitted === 0 || avgConfidence < 0.35 || packetItems.some((i) => i.flags.includes('instruction-like'));
    const unknownReason = admitted === 0 ? 'no admissible memory candidates' : avgConfidence < 0.35 ? 'packet confidence below abstention threshold' : 'instruction-like content flagged';

    return {
      packet: {
        query: query.text,
        items: packetItems,
        tokens,
        budget,
        unknown,
        unknownReason: unknown ? unknownReason : null,
        totalCandidates,
      },
      gates: { scope: true, trust: true, candidates: items.length, reranked: admitted },
    };
  }

  private personalizedPageRank(
    queryTerms: string[],
    claims: Claim[],
    iterations: number,
  ): Array<{ id: string; score: number }> {
    const claimIds = claims.map((c) => c.id);
    const seeds = new Set<string>();
    for (const claim of claims) {
      const text = `${claim.subject} ${claim.object}`.toLowerCase();
      if (queryTerms.some((t) => text.includes(t))) seeds.add(claim.id);
    }
    if (seeds.size === 0) return [];

    const graph = new Map<string, Set<string>>();
    for (const claim of claims) {
      const neighbors = new Set<string>();
      for (const other of claims) {
        if (other.id === claim.id) continue;
        const shareSubject = claim.subject.toLowerCase() === other.subject.toLowerCase();
        const shareObject = claim.object.toLowerCase() === other.object.toLowerCase();
        const shareEntity =
          (claim.subject.toLowerCase() === other.object.toLowerCase()) || (claim.object.toLowerCase() === other.subject.toLowerCase());
        if (shareSubject || shareObject || shareEntity) neighbors.add(other.id);
      }
      graph.set(claim.id, neighbors);
    }

    const alpha = 0.85;
    let scores = new Map<string, number>();
    for (const id of claimIds) scores.set(id, 0);
    for (const seed of seeds) scores.set(seed, 1 / seeds.size);

    for (let iter = 0; iter < iterations; iter++) {
      const next = new Map<string, number>();
      for (const id of claimIds) {
        let acc = (1 - alpha) * (seeds.has(id) ? 1 / seeds.size : 0);
        for (const neighbor of graph.get(id) ?? []) {
          const nb = graph.get(neighbor);
          if (nb && nb.size > 0) acc += alpha * (scores.get(neighbor) ?? 0) / nb.size;
        }
        next.set(id, acc);
      }
      scores = next;
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .filter((x) => x.score > 0.001)
      .sort((a, b) => b.score - a.score);
  }

  private renderItem(id: string): {
    kind: EvidencePacketItem['kind'];
    text: string;
    status: EvidencePacketItem['status'];
    confidence: number;
    evidenceCount: number;
    validAt: Date | null;
    invalidAt: Date | null;
    scope: Scope;
    channel: MnemEpisode['channel'];
    reliability: number;
    instructionLikeness: number;
  } | null {
    const episode = this.episodic.peek(id);
    if (episode) {
      return {
        kind: 'episode',
        text: typeof episode.content === 'object' && 'text' in episode.content ? (episode.content as { text: string }).text : JSON.stringify(episode.content),
        status: episode.status,
        confidence: episode.reliability,
        evidenceCount: 1,
        validAt: episode.ts,
        invalidAt: null,
        scope: episode.scope,
        channel: episode.channel,
        reliability: episode.reliability,
        instructionLikeness: episode.instructionLikeness,
      };
    }
    const claim = this.semantic.peek(id);
    if (claim) {
      return {
        kind: 'claim',
        text: `${claim.subject} ${claim.predicate} ${claim.object} [${claim.status}, certainty ${claim.certainty.toFixed(2)}, sources: ${claim.sourceEpisodes.length}]`,
        status: claim.status,
        confidence: claim.certainty,
        evidenceCount: claim.corroborations,
        validAt: claim.validAt,
        invalidAt: claim.invalidAt,
        scope: claim.scope,
        channel: 'consolidation',
        reliability: 0.8,
        instructionLikeness: 0,
      };
    }
    const pattern = this.procedural.get(id);
    if (pattern) {
      const reward = pattern.utilities.length > 0 ? Math.max(...pattern.utilities.map((u) => u.reward)) : 0;
      const text =
        pattern.class === 'lesson' && 'prevention' in pattern
          ? `lesson: ${pattern.pattern} — root cause: ${(pattern as { rootCause: string }).rootCause}; prevention: ${(pattern as { prevention: string }).prevention}`
          : `pattern: ${pattern.pattern} (condition: ${pattern.condition}, best reward ${reward.toFixed(2)})`;
      return {
        kind: pattern.class === 'lesson' ? 'lesson' : 'pattern',
        text,
        status: 'inferred',
        confidence: Math.min(1, 0.4 + Math.max(0, reward) * 0.5),
        evidenceCount: pattern.utilities.length,
        validAt: null,
        invalidAt: null,
        scope: pattern.scope,
        channel: 'consolidation',
        reliability: 0.6,
        instructionLikeness: 0,
      };
    }
    return null;
  }

  private embeddingOf(id: string): number[] {
    const episode = this.episodic.peek(id);
    if (episode) return episode.embedding;
    const claim = this.semantic.peek(id);
    if (claim) {
      const subject = this.semantic.entityByName(claim.subject);
      return subject?.embedding ?? this.embedQuery(`${claim.subject} ${claim.object}`);
    }
    const pattern = this.procedural.get(id);
    if (pattern) return this.embedQuery(pattern.pattern);
    return [];
  }

  private embedQuery(text: string): number[] {
    return new HashEmbedder().embed(text);
  }

  private fingerprintOverlap(a: number[], b: number[]): number {
    return fingerprintOverlap(a, b);
  }
}

// Re-export PatternSkill type guard helper used by tests.
export function isLesson(p: PatternSkill): boolean {
  return p.class === 'lesson';
}
