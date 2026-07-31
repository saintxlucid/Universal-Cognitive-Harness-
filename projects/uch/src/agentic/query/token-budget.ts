import type { MessageUsage } from '../types.js';

export interface TokenBudgetState {
  totalTokens: number;
  budgetTokens: number;
  usedTokens: number;
  continuationCount: number;
}

export function createTokenBudget(totalTokens: number): TokenBudgetState {
  return {
    totalTokens,
    budgetTokens: totalTokens,
    usedTokens: 0,
    continuationCount: 0,
  };
}

export function checkTokenBudget(
  state: TokenBudgetState,
  usage: MessageUsage,
): { ok: boolean; reason?: string; ratio: number } {
  const used = usage.inputTokens + usage.outputTokens + (usage.cacheReadInputTokens ?? 0);
  state.usedTokens = used;
  const ratio = state.totalTokens > 0 ? used / state.totalTokens : 0;
  if (ratio >= 0.9) {
    return { ok: false, reason: `Token budget 90% consumed (${used}/${state.totalTokens})`, ratio };
  }
  return { ok: true, ratio };
}

export interface ContinuationTracker {
  count: number;
  lastDeltaTokens: number;
  diminishing: boolean;
}

export function createContinuationTracker(): ContinuationTracker {
  return { count: 0, lastDeltaTokens: 0, diminishing: false };
}

export function recordContinuation(
  tracker: ContinuationTracker,
  usage: MessageUsage,
): void {
  tracker.count += 1;
  const delta = usage.inputTokens + usage.outputTokens;
  if (tracker.lastDeltaTokens > 0 && delta < 500) {
    tracker.diminishing = true;
  }
  tracker.lastDeltaTokens = delta;
}

export function shouldStopContinuations(tracker: ContinuationTracker): boolean {
  return tracker.count >= 3 && tracker.diminishing;
}

type ModelTier = 'fast' | 'standard' | 'frontier' | 'reasoning';

function tierForModel(model: string): ModelTier {
  if (/o[1-4]|reasoning|thinking/i.test(model)) return 'reasoning';
  if (/haiku|mini|flash|nano|light/i.test(model)) return 'fast';
  if (/opus|ultra|max|pro/i.test(model)) return 'frontier';
  return 'standard';
}

export function getMaxOutputTokensForModel(model: string, defaultMax = 8192): number {
  switch (tierForModel(model)) {
    case 'fast':
      return Math.min(defaultMax, 4096);
    case 'reasoning':
      return 16384;
    default:
      return defaultMax;
  }
}

export function computeCostUsd(usage: MessageUsage, model: string): number {
  const tier = tierForModel(model);
  const isCheapModel = tier === 'fast' || tier === 'reasoning';
  const inputRate = isCheapModel ? 0.25 : 3;
  const outputRate = isCheapModel ? 1.25 : 15;
  return (
    (usage.inputTokens / 1_000_000) * inputRate +
    (usage.outputTokens / 1_000_000) * outputRate
  );
}
