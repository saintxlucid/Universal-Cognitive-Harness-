import {
  readSnapshot,
  writeSnapshot,
  type Storable,
} from '../../../cognitive-plane/persistence/persistence-engine.js';
import { recencyBoost, type RecencyDecayConfig } from '../../retrieval/recency-decay.js';
import { TIER_ORDER, TIER_RANK, type MemoryTier, type Page, type PageMeta, type PagingPolicy, type TierCounts } from './types.js';

const DAY_MS = 86_400_000;

export const DEFAULT_PAGING_POLICY: PagingPolicy = {
  hotCapacity: 8,
  warmCapacity: 16,
  coldCapacity: 32,
  promoteThreshold: 0.5,
  evictThreshold: 0.1,
  compactByHash: true,
};

export const VMEM_RECENCY_DECAY: RecencyDecayConfig = {
  halflifeDays: 1,
  coefficient: 1,
};

export function payloadHash(ref: string): string {
  let hash = 5381;
  for (let i = 0; i < ref.length; i += 1) {
    hash = ((hash << 5) + hash + ref.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

interface PersistedVMem {
  pages: Page[];
}

export class CognitiveVMem implements Storable {
  private readonly pages: Map<string, Page> = new Map();
  private readonly policy: PagingPolicy;
  private readonly clock: () => Date;

  constructor(policy: Partial<PagingPolicy> = {}, clock: () => Date = () => new Date()) {
    this.policy = { ...DEFAULT_PAGING_POLICY, ...policy };
    this.clock = clock;
  }

  score(page: Page, now: Date): number {
    const ageDays = Math.max(0, (now.getTime() - page.lastTouched.getTime()) / DAY_MS);
    const recency = recencyBoost(ageDays, VMEM_RECENCY_DECAY);
    // energy weight in (0, 1]: cheaper pages cost less to keep resident, so they score higher
    return recency * page.salience * (1 / (1 + page.energyCost));
  }

  pageIn(id: string, payloadRef: string, meta: PageMeta): Page {
    const page: Page = {
      id,
      payloadRef,
      tier: 'hot',
      salience: meta.salience,
      energyCost: meta.energyCost,
      sizeBytes: meta.sizeBytes,
      lastTouched: this.clock(),
    };
    this.pages.set(id, page);
    this.rebalance(page.lastTouched);
    return page;
  }

  touch(id: string, now?: Date): boolean {
    const stamp = now ?? this.clock();
    const page = this.pages.get(id);
    if (!page) return false;
    page.lastTouched = stamp;
    if (page.tier !== 'hot' && this.score(page, stamp) >= this.policy.promoteThreshold) {
      page.tier = 'hot';
      this.rebalance(stamp);
    }
    return true;
  }

  promote(id: string, now?: Date): Page | undefined {
    const stamp = now ?? this.clock();
    const page = this.pages.get(id);
    if (!page || page.tier === 'hot') return undefined;
    page.tier = this.tierUp(page.tier);
    page.lastTouched = stamp;
    // the promoted page is pinned through its own rebalance, otherwise a full
    // target tier would immediately demote it right back — archive reversibility (law 12)
    this.rebalance(stamp, id);
    return page;
  }

  evict(now?: Date): Page | undefined {
    const stamp = now ?? this.clock();
    let victim: Page | undefined;
    let victimScore = Number.POSITIVE_INFINITY;
    for (const page of this.pages.values()) {
      if (page.tier === 'hot' || page.tier === 'archive') continue;
      const s = this.score(page, stamp);
      if (s < victimScore) {
        victimScore = s;
        victim = page;
      }
    }
    if (!victim || victimScore >= this.policy.evictThreshold) return undefined;
    victim.tier = this.tierDown(victim.tier);
    return victim;
  }

  compact(now?: Date): number {
    if (!this.policy.compactByHash) return 0;
    const stamp = now ?? this.clock();
    const groups = new Map<string, Page[]>();
    for (const page of this.pages.values()) {
      const hash = payloadHash(page.payloadRef);
      const group = groups.get(hash);
      if (group) group.push(page);
      else groups.set(hash, [page]);
    }
    let removed = 0;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      group.sort((a, b) => this.score(b, stamp) - this.score(a, stamp));
      const survivor = group[0];
      if (!survivor) continue;
      for (const dup of group.slice(1)) {
        survivor.sizeBytes += dup.sizeBytes;
        if (dup.lastTouched > survivor.lastTouched) survivor.lastTouched = dup.lastTouched;
        if (TIER_RANK[dup.tier] < TIER_RANK[survivor.tier]) survivor.tier = dup.tier;
        this.pages.delete(dup.id);
        removed += 1;
      }
    }
    return removed;
  }

  residency(id: string): MemoryTier | undefined {
    return this.pages.get(id)?.tier;
  }

  stats(): { perTier: TierCounts; totalBytes: number } {
    const perTier: TierCounts = { hot: 0, warm: 0, cold: 0, archive: 0 };
    let totalBytes = 0;
    for (const page of this.pages.values()) {
      perTier[page.tier] += 1;
      totalBytes += page.sizeBytes;
    }
    return { perTier, totalBytes };
  }

  async persist(filePath: string): Promise<void> {
    const data: PersistedVMem = { pages: [...this.pages.values()] };
    writeSnapshot(filePath, data);
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<PersistedVMem | null>(filePath);
    if (!data) return 0;
    this.pages.clear();
    for (const page of data.pages) {
      this.pages.set(page.id, page);
    }
    return data.pages.length;
  }

  private tierDown(tier: MemoryTier): MemoryTier {
    switch (tier) {
      case 'hot':
        return 'warm';
      case 'warm':
        return 'cold';
      default:
        return 'archive';
    }
  }

  private tierUp(tier: MemoryTier): MemoryTier {
    switch (tier) {
      case 'archive':
        return 'cold';
      case 'cold':
        return 'warm';
      default:
        return 'hot';
    }
  }

  private capacityOf(tier: MemoryTier): number {
    switch (tier) {
      case 'hot':
        return this.policy.hotCapacity;
      case 'warm':
        return this.policy.warmCapacity;
      case 'cold':
        return this.policy.coldCapacity;
      default:
        return Number.POSITIVE_INFINITY;
    }
  }

  private rebalance(now: Date, protectedId?: string): void {
    for (const tier of TIER_ORDER) {
      if (tier === 'archive') continue;
      while (this.tierSize(tier) > this.capacityOf(tier)) {
        const victim = this.lowestScoredInTier(tier, now, protectedId);
        if (!victim) break;
        victim.tier = this.tierDown(victim.tier);
      }
    }
  }

  private tierSize(tier: MemoryTier): number {
    let count = 0;
    for (const page of this.pages.values()) {
      if (page.tier === tier) count += 1;
    }
    return count;
  }

  // ties break toward the earlier-inserted page, keeping eviction deterministic
  private lowestScoredInTier(tier: MemoryTier, now: Date, excludeId?: string): Page | undefined {
    let best: Page | undefined;
    let bestScore = Number.POSITIVE_INFINITY;
    for (const page of this.pages.values()) {
      if (page.tier !== tier) continue;
      if (page.id === excludeId) continue;
      const s = this.score(page, now);
      if (s < bestScore) {
        bestScore = s;
        best = page;
      }
    }
    return best;
  }
}
