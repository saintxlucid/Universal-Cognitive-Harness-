/**
 * Recency decay — per-prefix recency decay map, adapted to UCH's content model.
 *
 * Drives the recency BOOST in RetrievalFusion. It composes multiplicatively
 * with provenance weighting.
 *
 * Keyed by memory tier prefix. Longest-prefix-match wins at lookup time.
 *
 * Interpretation:
 *   - halflifeDays = 0  → evergreen, no decay (recency component = 0)
 *   - halflifeDays > 0  → hyperbolic decay; coefficient × halflife / (halflife + days_old)
 *   - At days_old=0:        recency component = coefficient (max boost)
 *   - At days_old=halflife: recency component = coefficient / 2
 *
 * Override priority (later wins):
 *   1. DEFAULT_RECENCY_DECAY (this file)
 *   2. UCH_RECENCY_DECAY env var (prefix:halflifeDays:coefficient,...)
 *   3. Per-call caller map (tests + library consumers)
 *
 * Pure module. No side effects.
 */

export interface RecencyDecayConfig {
  /** Days at which the recency component is halved. 0 = no decay (evergreen). */
  halflifeDays: number;
  /** Max recency boost contribution at days_old = 0. Must be >= 0. */
  coefficient: number;
}

export type RecencyDecayMap = Record<string, RecencyDecayConfig>;

export const DEFAULT_RECENCY_DECAY: RecencyDecayMap = {
  // Evergreen tier — concepts are curated semantic knowledge; no decay.
  'concept': { halflifeDays: 0, coefficient: 0 },

  // Observation episodes — "what was on my plate" signals; freshness is the signal.
  'episode:observation': { halflifeDays: 14, coefficient: 1.5 },

  // Tool-call episodes — transient context; strongest decay.
  'episode:tool_call': { halflifeDays: 7, coefficient: 1.0 },

  // Structured episodes — slow decay.
  'episode:structured': { halflifeDays: 90, coefficient: 0.5 },

  // Generic fallback tier.
  'episode': { halflifeDays: 60, coefficient: 1.0 },
};

/** Fallback applied to ids that don't match any prefix. */
export const DEFAULT_FALLBACK: RecencyDecayConfig = {
  halflifeDays: 90,
  coefficient: 0.5,
};

/** Sentinel error thrown by the env parser; CLI catches it and exits with a useful message. */
export class RecencyDecayParseError extends Error {
  constructor(message: string, public readonly source: 'env' | 'caller') {
    super(message);
    this.name = 'RecencyDecayParseError';
  }
}

/**
 * Parse the UCH_RECENCY_DECAY env var.
 * Format: comma-separated `prefix:halflifeDays:coefficient` triples.
 * Example: "episode:observation:7:2.0,concept:0:0,episode:30:1.0"
 *
 * Fails LOUD on parse errors so misconfigurations surface at startup instead
 * of silently degrading rankings.
 */
export function parseRecencyDecayEnv(env: string | undefined): RecencyDecayMap {
  if (!env) return {};
  const out: RecencyDecayMap = {};
  const triples = env.split(',').map((s) => s.trim()).filter(Boolean);
  for (const triple of triples) {
    // Split on the FIRST and SECOND `:` from the right so the prefix may
    // safely contain `/` etc. but NOT colons.
    const lastIdx = triple.lastIndexOf(':');
    if (lastIdx <= 0) {
      throw new RecencyDecayParseError(
        `Invalid UCH_RECENCY_DECAY entry "${triple}": expected prefix:halflife:coefficient`,
        'env',
      );
    }
    const beforeLast = triple.slice(0, lastIdx);
    const middleIdx = beforeLast.lastIndexOf(':');
    if (middleIdx <= 0) {
      throw new RecencyDecayParseError(
        `Invalid UCH_RECENCY_DECAY entry "${triple}": expected prefix:halflife:coefficient`,
        'env',
      );
    }
    const prefix = triple.slice(0, middleIdx).trim();
    const halflifeRaw = triple.slice(middleIdx + 1, lastIdx).trim();
    const coefficientRaw = triple.slice(lastIdx + 1).trim();
    const halflife = Number.parseFloat(halflifeRaw);
    const coefficient = Number.parseFloat(coefficientRaw);
    if (!prefix) {
      throw new RecencyDecayParseError(`Empty prefix in UCH_RECENCY_DECAY entry "${triple}"`, 'env');
    }
    if (!Number.isFinite(halflife) || halflife < 0) {
      throw new RecencyDecayParseError(
        `Invalid halflifeDays "${halflifeRaw}" in UCH_RECENCY_DECAY (must be number >= 0; 0 = evergreen)`,
        'env',
      );
    }
    if (!Number.isFinite(coefficient) || coefficient < 0) {
      throw new RecencyDecayParseError(
        `Invalid coefficient "${coefficientRaw}" in UCH_RECENCY_DECAY (must be number >= 0)`,
        'env',
      );
    }
    out[prefix] = { halflifeDays: halflife, coefficient };
  }
  return out;
}

/**
 * Merge defaults + env + caller-supplied overrides into the effective decay
 * map. Later sources win. Empty entries are dropped.
 */
export function resolveRecencyDecayMap(opts: {
  envValue?: string;
  caller?: RecencyDecayMap;
} = {}): RecencyDecayMap {
  const fromEnv = parseRecencyDecayEnv(opts.envValue ?? process.env.UCH_RECENCY_DECAY);
  return {
    ...DEFAULT_RECENCY_DECAY,
    ...fromEnv,
    ...(opts.caller ?? {}),
  };
}

/**
 * Longest-prefix-match lookup of the decay config for an id.
 * Ids may be plain ("episode" fallback) or prefixed ("episode:observation").
 */
export function lookupDecayConfig(id: string, map: RecencyDecayMap): RecencyDecayConfig {
  let best: RecencyDecayConfig | null = null;
  let bestLen = -1;
  for (const [prefix, cfg] of Object.entries(map)) {
    if (id.startsWith(prefix) && prefix.length > bestLen) {
      best = cfg;
      bestLen = prefix.length;
    }
  }
  return best ?? DEFAULT_FALLBACK;
}

/**
 * Compute the recency boost factor in [0, 1] for an item aged `daysOld` days.
 *   - evergreen (halflifeDays 0) or coefficient 0 → 0 (no boost)
 *   - otherwise: coefficient × halflife / (halflife + days_old)
 */
export function recencyBoost(daysOld: number, cfg: RecencyDecayConfig): number {
  if (cfg.halflifeDays <= 0 || cfg.coefficient <= 0) return 0;
  if (daysOld < 0) return cfg.coefficient;
  return cfg.coefficient * (cfg.halflifeDays / (cfg.halflifeDays + daysOld));
}

/** Convenience: full id → boost in one call. */
export function recencyBoostForId(id: string, daysOld: number, map: RecencyDecayMap): number {
  return recencyBoost(daysOld, lookupDecayConfig(id, map));
}
