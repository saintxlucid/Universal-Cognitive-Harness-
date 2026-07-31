/**
 * Virtual Processors — Level 4 of the Cognitive Computer (model virtualization).
 *
 * The kernel never exposes models. It exposes virtual processors:
 * reasoning.cpu, memory.cpu, security.cpu, ... — exactly like an operating
 * system exposes CPU abstractions while the hardware behind them churns.
 *
 * This module is PURE and DETERMINISTIC: no I/O, no provider calls, no wall
 * clock. Given the same profile and the same provider roster snapshot, it
 * returns the same routing decision. That property is what makes the fabric
 * testable and auditable (see constitution law 'Frugal Inference by Default').
 */

import { normalizeProfile, type CognitiveProfile } from './profile.js';
import type { CapabilityTier, ProviderModel } from './types.js';

export type VirtualProcessorId =
  | 'reasoning.cpu'
  | 'memory.cpu'
  | 'engineering.cpu'
  | 'security.cpu'
  | 'creativity.cpu'
  | 'planning.cpu'
  | 'research.cpu'
  | 'reflection.cpu'
  | 'classification.cpu'
  | 'embedding.cpu';

export interface VirtualProcessor {
  id: VirtualProcessorId;
  role: string;
  description: string;
  /** Profile dimensions this processor is specialized for (0 = irrelevant). */
  affinity: Partial<Record<keyof CognitiveProfile, number>>;
  /** Never route below this tier for this processor. */
  minTier: CapabilityTier;
  /** Default tier when the profile does not demand more. */
  defaultTier: CapabilityTier;
}

export const VIRTUAL_PROCESSORS: readonly VirtualProcessor[] = [
  {
    id: 'reasoning.cpu',
    role: 'Deep reasoning',
    description: 'Structured chain-of-thought, deduction, analysis',
    affinity: { complexity: 0.5, reasoningNeeded: 1.0, verificationNeeded: 0.2 },
    minTier: 'deep',
    defaultTier: 'standard',
  },
  {
    id: 'memory.cpu',
    role: 'Memory consolidation',
    description: 'Classify, merge, deduplicate, summarize, compress',
    affinity: { knowledgeNeeded: 0.8 },
    minTier: 'standard',
    defaultTier: 'standard',
  },
  {
    id: 'engineering.cpu',
    role: 'Engineering review',
    description: 'Architecture, design, code review, optimization',
    affinity: { complexity: 0.4, verificationNeeded: 0.5, reasoningNeeded: 0.2 },
    minTier: 'standard',
    defaultTier: 'standard',
  },
  {
    id: 'security.cpu',
    role: 'Security analysis',
    description: 'Threat modeling, vulnerability review, supply chain',
    affinity: { risk: 0.8, verificationNeeded: 0.6 },
    minTier: 'deep',
    defaultTier: 'standard',
  },
  {
    id: 'creativity.cpu',
    role: 'Divergent generation',
    description: 'Naming, branding, innovation, alternative approaches',
    affinity: { creativityNeeded: 1.0 },
    minTier: 'standard',
    defaultTier: 'standard',
  },
  {
    id: 'planning.cpu',
    role: 'Planning',
    description: 'Roadmaps, dependency graphs, execution plans',
    affinity: { reasoningNeeded: 0.4, complexity: 0.3 },
    minTier: 'standard',
    defaultTier: 'standard',
  },
  {
    id: 'research.cpu',
    role: 'Research',
    description: 'Papers, RFCs, benchmarks, academic knowledge',
    affinity: { knowledgeNeeded: 0.5, complexity: 0.3 },
    minTier: 'standard',
    defaultTier: 'standard',
  },
  {
    id: 'reflection.cpu',
    role: 'Reflection',
    description: 'Learn from mistakes, patterns, user behavior, quality',
    affinity: { verificationNeeded: 0.3, knowledgeNeeded: 0.2 },
    minTier: 'standard',
    defaultTier: 'standard',
  },
  {
    id: 'classification.cpu',
    role: 'Classification and routing',
    description: 'Labels, categories, trivial classification (frugal home)',
    affinity: {},
    minTier: 'tiny',
    defaultTier: 'tiny',
  },
  {
    id: 'embedding.cpu',
    role: 'Embeddings',
    description: 'Vectorization, semantic search pre-computation',
    affinity: {},
    minTier: 'tiny',
    defaultTier: 'tiny',
  },
];

export function getVirtualProcessor(id: VirtualProcessorId): VirtualProcessor | undefined {
  return VIRTUAL_PROCESSORS.find((p) => p.id === id);
}

/**
 * Deterministic affinity match: weighted sum of the profile dimensions each
 * processor is specialized for. Ties resolve to registry order (stable).
 * A profile with no salient dimension lands on classification.cpu — the
 * frugal default home, matching the scheduler's frugality gate.
 */
export function resolveVirtualCpu(profileInput: Partial<CognitiveProfile> = {}): VirtualProcessor {
  const profile = normalizeProfile(profileInput);

  const frugal =
    profile.complexity <= 0.25 &&
    profile.reasoningNeeded < 0.35 &&
    profile.creativityNeeded < 0.25 &&
    profile.verificationNeeded < 0.5 &&
    profile.knowledgeNeeded < 0.35 &&
    profile.risk < 0.3;
  if (frugal || Object.keys(profileInput).length === 0) {
    return getVirtualProcessor('classification.cpu')!;
  }

  const preferredByIntent =
    profile.risk >= 0.7 || profile.verificationNeeded >= 0.7
      ? 'security.cpu'
      : profile.creativityNeeded >= 0.8
        ? 'creativity.cpu'
        : profile.knowledgeNeeded >= 0.75
          ? 'memory.cpu'
          : profile.reasoningNeeded >= 0.7 || profile.complexity >= 0.8
            ? 'reasoning.cpu'
            : undefined;

  if (preferredByIntent) {
    const preferred = getVirtualProcessor(preferredByIntent as VirtualProcessorId);
    if (preferred) return preferred;
  }

  let best = getVirtualProcessor('classification.cpu')!;
  let bestScore = -Infinity;
  for (const cpu of VIRTUAL_PROCESSORS) {
    let score = 0;
    for (const [dim, weight] of Object.entries(cpu.affinity)) {
      if (!weight) continue;
      const value = profile[dim as keyof CognitiveProfile];
      if (typeof value === 'number') score += value * weight;
    }
    if (score > bestScore) {
      bestScore = score;
      best = cpu;
    }
  }

  if (bestScore <= 0) {
    return getVirtualProcessor('classification.cpu')!;
  }
  return best;
}

/**
 * The capability tier a profile demands. Mirrors the scheduler's existing
 * strategy thresholds so strategy kind and processor tier never contradict.
 */
export function requiredTier(
  profileInput: Partial<CognitiveProfile>,
  cpu: VirtualProcessor = resolveVirtualCpu(profileInput),
): CapabilityTier {
  const profile = normalizeProfile(profileInput);
  const requestedTier: CapabilityTier =
    profile.reasoningNeeded >= 0.6 || profile.complexity >= 0.8 || profile.verificationNeeded >= 0.6
      ? 'deep'
      : profile.complexity <= 0.25 &&
          profile.reasoningNeeded < 0.35 &&
          profile.creativityNeeded < 0.25 &&
          profile.verificationNeeded < 0.5
        ? 'tiny'
        : cpu.defaultTier;

  return TIER_ORDER[requestedTier] >= TIER_ORDER[cpu.minTier] ? requestedTier : cpu.minTier;
}

/** Snapshot of a provider's capability surface, as seen by the router. */
export interface ProviderRosterEntry {
  providerId: string;
  label: string;
  available: boolean;
  healthy: boolean;
  consecutiveFailures: number;
  avgLatencyMs: number | null;
  models: ProviderModel[];
}

export interface ProviderSelection {
  /** Ordered candidate provider ids (length > 1 only when verification demands it). */
  providerIds: string[];
  /** The model chosen for the primary provider, at the required tier. */
  model: string;
  tier: CapabilityTier;
  rationale: string;
}

const TIER_ORDER: Record<CapabilityTier, number> = { tiny: 0, standard: 1, deep: 2 };

function modelTier(provider: ProviderRosterEntry, tier: CapabilityTier): ProviderModel | null {
  const models =
    provider.models.length > 0
      ? provider.models
      : [{ tier: 'standard' as CapabilityTier, model: 'default' }];
  const exact = models.find((m) => m.tier === tier);
  if (exact) return exact;
  const deepEnough = models
    .filter((m) => (TIER_ORDER[m.tier] ?? 0) >= (TIER_ORDER[tier] ?? 0))
    .sort((a, b) => (TIER_ORDER[a.tier] ?? 0) - (TIER_ORDER[b.tier] ?? 0))[0];
  if (deepEnough) return deepEnough;
  return models.slice().sort((a, b) => TIER_ORDER[b.tier] - TIER_ORDER[a.tier])[0] ?? null;
}

function providerScore(entry: ProviderRosterEntry): [number, number, number, string] {
  const cost = entry.models.reduce((min, m) => Math.min(min, m.costRank ?? 99), 99);
  const latency = entry.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
  return [entry.consecutiveFailures, cost, latency, entry.providerId];
}

function rank(entries: ProviderRosterEntry[], tier: CapabilityTier): ProviderRosterEntry[] {
  const exact = new Map(entries.map((e) => [e.providerId, e.models.some((m) => m.tier === tier)]));
  return entries.slice().sort((a, b) => {
    const ea = exact.get(a.providerId) ? 0 : 1;
    const eb = exact.get(b.providerId) ? 0 : 1;
    if (ea !== eb) return ea - eb;
    const sa = providerScore(a);
    const sb = providerScore(b);
    for (let i = 0; i < 3; i++) {
      const av = sa[i] ?? Number.MAX_SAFE_INTEGER;
      const bv = sb[i] ?? Number.MAX_SAFE_INTEGER;
      if (av !== bv) return av < bv ? -1 : 1;
    }
    return sa[3] < sb[3] ? -1 : 1;
  });
}

/**
 * Pure provider selection: cheapest healthy provider that can serve the
 * required tier wins; failures, cost, then latency break ties. When the
 * profile demands verification, up to 3 distinct providers are returned.
 * Never throws — an empty roster yields a deterministic fallback selection.
 */
export function resolveProvider(
  profileInput: Partial<CognitiveProfile>,
  roster: readonly ProviderRosterEntry[],
  cpu: VirtualProcessor = resolveVirtualCpu(profileInput),
): ProviderSelection {
  const profile = normalizeProfile(profileInput);
  const tier = requiredTier(profile, cpu);
  const floor = TIER_ORDER[cpu.minTier];

  const eligible = roster
    .filter((p) => p.available && p.healthy)
    .filter((p) => p.models.some((m) => TIER_ORDER[m.tier] >= floor));
  const ranked = rank(eligible, tier);

  if (ranked.length === 0) {
    const anyHealthy = rank(
      roster.filter((p) => p.available && p.healthy),
      tier,
    );
    if (anyHealthy.length === 0) {
      return {
        providerIds: [],
        model: 'none',
        tier,
        rationale: 'No healthy provider available: deterministic fallback',
      };
    }
    const fallback = anyHealthy[0]!;
    return {
      providerIds: [fallback.providerId],
      model: fallback.models[0]?.model ?? 'default',
      tier,
      rationale: `No provider serves tier ${tier}: falling back to ${fallback.providerId}`,
    };
  }

  const need = profile.verificationNeeded >= 0.6 ? 3 : 1;
  const count = Math.min(need, ranked.length);
  const primary = ranked[0]!;
  const primaryModel = modelTier(primary, tier);
  const model = primaryModel?.model ?? 'default';

  if (count === 1) {
    return {
      providerIds: [primary.providerId],
      model,
      tier,
      rationale: `${primary.providerId} serves tier ${tier} cheapest and healthy (affinity: ${cpu.id})`,
    };
  }

  return {
    providerIds: ranked.slice(0, count).map((p) => p.providerId),
    model,
    tier,
    rationale: `Verification requested: consulting ${count} independent providers (${ranked
      .slice(0, count)
      .map((p) => p.providerId)
      .join(', ')})`,
  };
}
