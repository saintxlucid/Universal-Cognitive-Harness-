/**
 * Cognitive Scheduler — Level 2 of the Cognitive Computer.
 *
 * Analogous to a Linux process scheduler, but it schedules THINKING:
 * every request gets a cognitive profile and the scheduler decides the
 * execution strategy — deterministic algorithm, cached reasoning, small
 * model, large model, multiple models, or human approval.
 *
 * The scheduler owns the frugality gate: trivial cognition never spends
 * inference budget (see constitution law 'Frugal Inference by Default').
 * It also seeds Level 10 (cognitive cache): successful provider reasoning
 * is stored keyed by request so future requests reuse thinking instead of
 * repeating it. The cache is in-memory and fully workspace-isolated.
 */

import { InferenceFabric } from './fabric.js';
import type { Accelerator, AcceleratorResult } from './types.js';
import type { CapabilityTier } from './types.js';
import { normalizeProfile, type CognitiveProfile } from './profile.js';
import {
  resolveProvider,
  resolveVirtualCpu,
  requiredTier,
  type ProviderRosterEntry,
  type VirtualProcessorId,
} from './virtual-processors.js';

export type ExecutionStrategyKind =
  | 'deterministic'
  | 'cached'
  | 'human_approval'
  | 'small_model'
  | 'large_model'
  | 'multi_model';

export interface ExecutionStrategy {
  kind: ExecutionStrategyKind;
  rationale: string;
  maxTokens?: number;
  retries?: number;
  /** Level 4: the virtual processor this request is routed to (e.g. reasoning.cpu). */
  virtualCpu?: VirtualProcessorId;
  /** The capability tier the request demands. */
  tier?: CapabilityTier;
  /** Kernel-chosen provider (cheapest healthy provider at the required tier). */
  preferredProviderId?: string;
  /** Kernel-chosen model for the preferred provider. */
  model?: string;
  /** Distinct providers consulted (>= 2 only for multi_model verification). */
  providerCount?: number;
}

export interface ScheduledResult<O> extends AcceleratorResult<O> {
  strategy: ExecutionStrategy;
  approvalNeeded: boolean;
  cached: boolean;
}

export const RISK_HUMAN_APPROVAL = 0.8;
export const FRUGALITY_MAX_COMPLEXITY = 0.25;

const CACHE_TTL_DEFAULT_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function canonicalCacheKey(kind: string, input: Record<string, unknown>): string {
  return fnv1a(`${kind}|${JSON.stringify(input)}`);
}

interface CacheEntry {
  result: AcceleratorResult<object>;
  expiresAt: number;
}

export class CognitiveScheduler {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly fabric: InferenceFabric,
    private readonly ttlMs = CACHE_TTL_DEFAULT_MS,
  ) {}

  cacheKey(kind: string, input: Record<string, unknown>): string {
    return canonicalCacheKey(kind, input);
  }

  hasCached(key: string): boolean {
    return this.cacheHas(key);
  }

  cacheSize(): number {
    return this.cache.size;
  }

  clearCache(): void {
    this.cache.clear();
  }

  /** Decide the execution strategy for a cognitive profile. Deterministic and serializable. */
  plan(
    profileInput: Partial<CognitiveProfile>,
    state: { cacheKey?: string; providersAvailable?: boolean; roster?: ProviderRosterEntry[] } = {},
  ): ExecutionStrategy {
    const profile = normalizeProfile(profileInput);
    const virtualCpu = resolveVirtualCpu(profile);
    const tier = requiredTier(profile, virtualCpu);
    const selection = state.roster && state.roster.length > 0
      ? resolveProvider(profile, state.roster, virtualCpu)
      : undefined;

    const route = (strategy: ExecutionStrategy): ExecutionStrategy => ({
      ...strategy,
      virtualCpu: virtualCpu.id,
      tier,
      ...(selection ? {
        preferredProviderId: selection.providerIds[0],
        model: selection.providerIds.length > 0 ? selection.model : undefined,
        providerCount: selection.providerIds.length,
      } : {}),
    });

    if (profile.risk >= RISK_HUMAN_APPROVAL) {
      return route({
        kind: 'human_approval',
        rationale: `Risk ${profile.risk.toFixed(2)} >= ${RISK_HUMAN_APPROVAL}: requires human approval`,
      });
    }

    if (
      profile.complexity <= FRUGALITY_MAX_COMPLEXITY
      && profile.reasoningNeeded < 0.35
      && profile.creativityNeeded < 0.25
      && profile.verificationNeeded < 0.5
    ) {
      return route({ kind: 'deterministic', rationale: 'Trivial task: deterministic coprocessor suffices (frugality gate)' });
    }

    if (state.cacheKey && this.cacheHas(state.cacheKey)) {
      return route({ kind: 'cached', rationale: 'Reusing previously computed reasoning (cognitive cache)' });
    }

    if (profile.verificationNeeded >= 0.6) {
      return route({
        kind: 'multi_model',
        rationale: 'Verification required: consult multiple independent models',
        maxTokens: 800,
        retries: 2,
      });
    }

    if (profile.reasoningNeeded >= 0.6 || profile.complexity >= 0.8) {
      return route({
        kind: 'large_model',
        rationale: 'Deep reasoning: route to the largest available model',
        maxTokens: 1200,
        retries: 2,
      });
    }

    return route({
      kind: 'small_model',
      rationale: 'Routine cognition: cheapest healthy provider suffices',
      maxTokens: 400,
      retries: 1,
    });
  }

  /** Execute the accelerator under the scheduler: plan → dispatch → cache → report. */
  async dispatch<I extends Record<string, unknown>, O extends object>(
    accelerator: Accelerator<I, O>,
    input: I,
    profileInput: Partial<CognitiveProfile> = {},
    options?: { skipInference?: boolean; maxTokens?: number; retries?: number },
  ): Promise<ScheduledResult<O>> {
    const key = canonicalCacheKey(accelerator.kind, input);
    const roster = this.fabric.roster();
    const strategy = this.plan(profileInput, {
      cacheKey: key,
      providersAvailable: this.fabric.isAvailable(),
      roster,
    });

    if (strategy.kind === 'human_approval') {
      const base = await this.fabric.dispatch(accelerator, input, { skipInference: true });
      return { ...base, strategy, approvalNeeded: true, cached: false };
    }

    if (strategy.kind === 'cached') {
      const hit = this.cache.get(key);
      if (!hit) return { ...(await this.fabric.dispatch(accelerator, input)), strategy, approvalNeeded: false, cached: false };
      return { ...(hit.result as AcceleratorResult<O>), strategy, approvalNeeded: false, cached: true };
    }

    const result = await this.fabric.dispatch(accelerator, input, {
      skipInference: options?.skipInference ?? strategy.kind === 'deterministic',
      maxTokens: options?.maxTokens ?? strategy.maxTokens,
      retries: options?.retries ?? strategy.retries,
      preferredProviderId: strategy.preferredProviderId,
      model: strategy.model,
    });

    if (result.fired && !result.fallbackUsed) {
      this.store(key, result);
    }

    return { ...result, strategy, approvalNeeded: false, cached: false };
  }

  private store(key: string, result: AcceleratorResult<object>): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, { result, expiresAt: Date.now() + this.ttlMs });
  }

  private cacheHas(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
}
