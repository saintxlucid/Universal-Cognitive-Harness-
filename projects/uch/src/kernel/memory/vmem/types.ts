export type MemoryTier = 'hot' | 'warm' | 'cold' | 'archive';

export interface Page {
  id: string;
  payloadRef: string;
  tier: MemoryTier;
  salience: number;
  energyCost: number;
  sizeBytes: number;
  lastTouched: Date;
}

export interface PageMeta {
  salience: number;
  energyCost: number;
  sizeBytes: number;
}

export interface PagingPolicy {
  hotCapacity: number;
  warmCapacity: number;
  coldCapacity: number;
  promoteThreshold: number;
  evictThreshold: number;
  compactByHash: boolean;
}

export type TierCounts = Record<MemoryTier, number>;

export const TIER_ORDER: readonly MemoryTier[] = ['hot', 'warm', 'cold', 'archive'];

export const TIER_RANK: Record<MemoryTier, number> = {
  hot: 0,
  warm: 1,
  cold: 2,
  archive: 3,
};
