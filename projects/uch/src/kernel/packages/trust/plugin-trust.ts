/**
 * IDEA-0080 — Plugin Trust Scoring (prototype).
 *
 * A six-axis scorecard (trust, quality, security, performance,
 * compatibility, maintenance), each axis derived from independent
 * evidence, with a load-time policy: allow / allow-with-monitoring /
 * allow-in-sandbox / deny. The organism decides — scores gate loading
 * with graded actions. Deterministic: no randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type TrustAxis =
  | 'trust'
  | 'quality'
  | 'security'
  | 'performance'
  | 'compatibility'
  | 'maintenance';

export interface AxisScore {
  readonly axis: TrustAxis;
  /** 0..1 — higher is better. */
  readonly score: number;
  /** Independent evidence source (verification runs, not declarations). */
  readonly evidence: string;
}

export interface PluginScorecard {
  readonly pluginId: string;
  readonly version: string;
  readonly axes: readonly AxisScore[];
  readonly overall: number;
  readonly decision: PluginDecision;
}

export type PluginDecision = 'allow' | 'allow-with-monitoring' | 'allow-in-sandbox' | 'deny';

export interface TrustPolicy {
  readonly denyBelow: number;
  readonly sandboxBelow: number;
  readonly monitorBelow: number;
  /** Axes whose score may not fall below the deny floor regardless of aggregate. */
  readonly vetoAxes: readonly TrustAxis[];
}

export const DEFAULT_TRUST_POLICY: TrustPolicy = {
  denyBelow: 0.3,
  sandboxBelow: 0.5,
  monitorBelow: 0.7,
  vetoAxes: ['security'],
};

/** Weighted overall score across axes (deterministic; equal weights). */
export function overallScore(axes: readonly AxisScore[]): number {
  if (axes.length === 0) return 0;
  const sum = axes.reduce((acc, a) => acc + a.score, 0);
  return sum / axes.length;
}

/**
 * Load-time decision from the scorecard. Veto axes floor the decision:
 * a security score below the deny floor is a hard deny even if the
 * aggregate is high.
 */
export function decide(scorecard: Omit<PluginScorecard, 'overall' | 'decision'>, policy: TrustPolicy = DEFAULT_TRUST_POLICY): PluginScorecard {
  const overall = overallScore(scorecard.axes);
  const axisBy = new Map(scorecard.axes.map((a) => [a.axis, a.score]));
  const vetoViolated = policy.vetoAxes.some((a) => (axisBy.get(a) ?? 0) < policy.denyBelow);

  let decision: PluginDecision;
  if (vetoViolated || overall < policy.denyBelow) {
    decision = 'deny';
  } else if (overall < policy.sandboxBelow) {
    decision = 'allow-in-sandbox';
  } else if (overall < policy.monitorBelow) {
    decision = 'allow-with-monitoring';
  } else {
    decision = 'allow';
  }
  return { ...scorecard, overall, decision };
}

/** Score history is lineage (IDEA-0076): a plugin's score over versions. */
export interface ScoreHistoryEntry {
  readonly version: string;
  readonly overall: number;
  readonly decision: PluginDecision;
  readonly atTick: number;
}

export class TrustRegistry {
  private history = new Map<string, ScoreHistoryEntry[]>();
  private latest = new Map<string, PluginScorecard>();

  register(scorecard: PluginScorecard, atTick: number): void {
    this.latest.set(scorecard.pluginId, scorecard);
    const h = this.history.get(scorecard.pluginId) ?? [];
    h.push({ version: scorecard.version, overall: scorecard.overall, decision: scorecard.decision, atTick });
    this.history.set(scorecard.pluginId, h);
  }

  get(pluginId: string): PluginScorecard | undefined {
    return this.latest.get(pluginId);
  }

  historyFor(pluginId: string): readonly ScoreHistoryEntry[] {
    return this.history.get(pluginId) ?? [];
  }
}
