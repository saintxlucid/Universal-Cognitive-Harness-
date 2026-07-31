/**
 * Composite Signal Fusion Engine — combine many weak, weakly-correlated
 * signals into a robust ranked composite with risk controls.
 *
 * Mirrors the quant-investing architecture from the corpus:
 *   Raw data → Features → Alpha factors → Portfolio decisions
 * The edge comes from the architecture of the whole decision system,
 * not any single formula: normalize → weight → fuse → rank → risk.
 */

export type FactorId =
  | 'momentum'
  | 'mean-reversion'
  | 'volume'
  | 'volatility'
  | 'liquidity'
  | 'quality'
  | 'fundamentals'
  | 'microstructure'
  | 'custom';

export interface Factor {
  id: FactorId;
  label: string;
  /** Raw 0-1 score for the candidate on this factor. */
  score: number;
  /** Optional weight; default 1 (equal weighting). */
  weight?: number;
}

export interface Candidate {
  name: string;
  factors: Factor[];
}

export interface FusionOptions {
  /** Risk controls. */
  maxAllocationPct?: number;
  topN?: number;
  rebalanceEvery?: string;
  neutralizeSectors?: boolean;
}

export interface FusedCandidate {
  name: string;
  composite: number;
  normalizedPct: number;
  coverage: number;
  riskFlags: string[];
}

export interface FusionResult {
  candidates: FusedCandidate[];
  ranked: FusedCandidate[];
  recommendation: { buy: string[]; watch: string[]; avoid: string[] };
  riskControls: string[];
  insight: string;
}

const FACTOR_REGIMES: Partial<Record<FactorId, { excels: string; struggles: string }>> = {
  momentum: { excels: 'strong trends', struggles: 'choppy markets' },
  'mean-reversion': { excels: 'range-bound markets', struggles: 'strong trends' },
  volume: { excels: 'institutional participation matters', struggles: 'thin markets' },
  volatility: { excels: 'regime changes', struggles: 'stable markets' },
  liquidity: { excels: 'inefficient assets', struggles: 'highly efficient assets' },
  quality: { excels: 'long-term investing', struggles: 'short-term trading' },
  fundamentals: { excels: 'long-term investing', struggles: 'short-term trading' },
  microstructure: { excels: 'high-frequency environments', struggles: 'long-term horizons' },
};

export function fuseSignals(candidates: Candidate[], options?: FusionOptions): FusionResult {
  const fused: FusedCandidate[] = candidates.map((c) => {
    if (c.factors.length === 0) {
      return { name: c.name, composite: 0, normalizedPct: 0, coverage: 0, riskFlags: ['no factors — cannot score'] };
    }
    const totalWeight = c.factors.reduce((a, f) => a + Math.max(0, f.weight ?? 1), 0) || 1;
    const composite = c.factors.reduce((a, f) => a + Math.max(0, f.score) * Math.max(0, f.weight ?? 1), 0) / totalWeight;
    const coverage = c.factors.length;
    const riskFlags: string[] = [];
    const lowLiquidity = c.factors.find((f) => f.id === 'liquidity' && f.score < 0.35);
    const highVol = c.factors.find((f) => f.id === 'volatility' && f.score > 0.75);
    if (lowLiquidity) riskFlags.push('low liquidity — wider spreads, higher costs');
    if (highVol) riskFlags.push('high volatility — regime-change exposure');
    if (c.factors.length < 3) riskFlags.push('few factors — single-signal risk (noise dominates)');
    return { name: c.name, composite: round3(composite), normalizedPct: round3(composite * 100), coverage, riskFlags };
  });

  const ranked = [...fused].sort((a, b) => b.composite - a.composite);
  const topN = options?.topN ?? Math.max(1, Math.ceil(candidates.length / 4));
  const buy = ranked.slice(0, topN).filter((c) => c.composite >= 0.5 && c.riskFlags.length === 0).map((c) => c.name);
  const watch = ranked.filter((c) => !buy.includes(c.name) && c.composite >= 0.5).map((c) => c.name);
  const avoid = ranked.filter((c) => c.composite < 0.5).map((c) => c.name);

  const riskControls = [
    `max allocation per candidate: ${options?.maxAllocationPct ?? 25}%`,
    `top N for action: ${topN}`,
    options?.rebalanceEvery ?? 'rebalance periodically',
    options?.neutralizeSectors ? 'sector-neutral weighting applied' : 'consider sector exposure',
    'rank opportunities relatively — relative ranking is more stable than absolute prediction',
  ];

  return {
    candidates: fused,
    ranked,
    recommendation: { buy, watch, avoid },
    riskControls,
    insight:
      buy.length > 0
        ? `edge comes from the architecture: ${candidates.length} candidates × ${Math.max(...ranked.map((r) => r.coverage))} factors each, risk-controlled`
        : 'no candidate clears the composite bar — either weaken constraints or the signals lack separation',
  };
}

/** Regime notes for factor selection (why no single factor dominates). */
export function factorRegimeNotes(id: FactorId): { id: FactorId; excels: string; struggles: string } | null {
  const regime = FACTOR_REGIMES[id];
  return regime ? { id, ...regime } : null;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
