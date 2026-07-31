// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Hippocampus: episodic store
// Append-only ground truth. Episodes are immutable; they can be quarantined
// or archived but never mutated or deleted. Bi-temporal: event time + ingest.
// ═══════════════════════════════════════════════════════════════════════════

import type { MnemEpisode, Scope } from '../types.js';
import { reviveDates, reviveDateList } from '../hydrate.js';

export interface EpisodeInput {
  id: string;
  class: MnemEpisode['class'];
  content: MnemEpisode['content'];
  status: MnemEpisode['status'];
  scope: Scope;
  channel: MnemEpisode['channel'];
  sourceId: string;
  reliability: number;
  importance: number;
  instructionLikeness: number;
  sanitized: boolean;
  contextNote: string | null;
  ts: Date;
  ingestedAt: Date;
  embedding: number[];
  fingerprint: number[];
  terms: string[];
}

export class EpisodicStore {
  private episodes = new Map<string, MnemEpisode>();
  private temporalIndex: Array<{ ts: Date; id: string }> = [];
  private scopeIndex = new Map<string, string[]>();
  private fingerprintIndex = new Map<string, string[]>();
  private tierIndex = new Map<string, string[]>();

  append(input: EpisodeInput): MnemEpisode {
    const episode: MnemEpisode = {
      ...input,
      accessTimes: [],
      lastAccess: null,
      tier: 'working',
      sti: 0,
      lti: 0,
      vlti: 0,
      crossRefs: [],
      quarantined: false,
      quarantineReason: null,
    };
    this.episodes.set(episode.id, episode);
    this.temporalIndex.push({ ts: episode.ts, id: episode.id });

    const scopeKey = scopeKeyOf(episode.scope);
    const scopeList = this.scopeIndex.get(scopeKey) ?? [];
    scopeList.push(episode.id);
    this.scopeIndex.set(scopeKey, scopeList);

    for (const fp of episode.fingerprint) {
      const list = this.fingerprintIndex.get(String(fp)) ?? [];
      list.push(episode.id);
      this.fingerprintIndex.set(String(fp), list);
    }

    this.indexTier(episode.id, episode.tier);
    return episode;
  }

  get(id: string): MnemEpisode | undefined {
    const episode = this.episodes.get(id);
    if (episode) {
      episode.accessTimes.push(new Date());
      episode.lastAccess = new Date();
      this.accessCount.set(id, (this.accessCount.get(id) ?? 0) + 1);
    }
    return episode;
  }

  private accessCount = new Map<string, number>();

  getAccessCount(id: string): number {
    return this.accessCount.get(id) ?? 0;
  }

  peek(id: string): MnemEpisode | undefined {
    return this.episodes.get(id);
  }

  all(): MnemEpisode[] {
    return [...this.episodes.values()];
  }

  byScope(scope: Scope): MnemEpisode[] {
    const key = scopeKeyOf(scope);
    const ids = this.scopeIndex.get(key) ?? [];
    return ids.map((id) => this.episodes.get(id)).filter((e): e is MnemEpisode => e !== undefined);
  }

  recent(limit = 50): MnemEpisode[] {
    const sorted = [...this.temporalIndex].sort((a, b) => b.ts.getTime() - a.ts.getTime());
    return sorted.slice(0, limit).map((e) => this.episodes.get(e.id)).filter((e): e is MnemEpisode => e !== undefined);
  }

  byFingerprintOverlap(target: number[], minOverlap = 0.5): MnemEpisode[] {
    const candidates = new Set<string>();
    for (const fp of target) {
      for (const id of this.fingerprintIndex.get(String(fp)) ?? []) {
        candidates.add(id);
      }
    }
    const results: MnemEpisode[] = [];
    for (const id of candidates) {
      const episode = this.episodes.get(id);
      if (!episode) continue;
      const overlap = overlapRatio(target, episode.fingerprint);
      if (overlap >= minOverlap) results.push(episode);
    }
    return results;
  }

  setTier(id: string, tier: MnemEpisode['tier']): void {
    const episode = this.episodes.get(id);
    if (!episode) return;
    this.removeTierIndex(id, episode.tier);
    episode.tier = tier;
    this.indexTier(id, tier);
  }

  byTier(tier: MnemEpisode['tier']): MnemEpisode[] {
    const ids = this.tierIndex.get(tier) ?? [];
    return ids.map((id) => this.episodes.get(id)).filter((e): e is MnemEpisode => e !== undefined);
  }

  quarantine(id: string, reason: string): void {
    const episode = this.episodes.get(id);
    if (episode) {
      episode.quarantined = true;
      episode.quarantineReason = reason;
    }
  }

  unquarantine(id: string): void {
    const episode = this.episodes.get(id);
    if (episode) {
      episode.quarantined = false;
      episode.quarantineReason = null;
    }
  }

  addCrossRef(id: string, refId: string): void {
    const episode = this.episodes.get(id);
    if (episode && !episode.crossRefs.includes(refId)) episode.crossRefs.push(refId);
  }

  count(): number {
    return this.episodes.size;
  }

  snapshot(): MnemEpisode[] {
    return [...this.episodes.values()].map((e) => structuredClone(e));
  }

  restore(episodes: MnemEpisode[]): void {
    this.episodes.clear();
    this.temporalIndex = [];
    this.scopeIndex.clear();
    this.fingerprintIndex.clear();
    this.tierIndex.clear();
    this.accessCount.clear();
    for (const raw of episodes) {
      const e: MnemEpisode = { ...raw };
      reviveDates(e, ['ts', 'ingestedAt', 'lastAccess']);
      e.accessTimes = reviveDateList(e.accessTimes);
      this.episodes.set(e.id, e);
      this.temporalIndex.push({ ts: e.ts, id: e.id });
      const key = scopeKeyOf(e.scope);
      const list = this.scopeIndex.get(key) ?? [];
      list.push(e.id);
      this.scopeIndex.set(key, list);
      for (const fp of e.fingerprint) {
        const list2 = this.fingerprintIndex.get(String(fp)) ?? [];
        list2.push(e.id);
        this.fingerprintIndex.set(String(fp), list2);
      }
      this.indexTier(e.id, e.tier);
    }
  }

  private indexTier(id: string, tier: MnemEpisode['tier']): void {
    const list = this.tierIndex.get(tier) ?? [];
    list.push(id);
    this.tierIndex.set(tier, list);
  }

  private removeTierIndex(id: string, tier: MnemEpisode['tier']): void {
    const list = this.tierIndex.get(tier) ?? [];
    this.tierIndex.set(tier, list.filter((x) => x !== id));
  }
}

export function scopeKeyOf(scope: Scope): string {
  return `${scope.user}::${scope.agent}::${scope.project}::${scope.session}::${scope.task ?? '*'}`;
}

/** Project-level scope key (cross-session isolation boundary). */
export function projectKeyOf(scope: Scope): string {
  return `${scope.user}::${scope.agent}::${scope.project}`;
}

function overlapRatio(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let hits = 0;
  for (const x of a) if (setB.has(x)) hits++;
  return hits / Math.min(a.length, b.length);
}
