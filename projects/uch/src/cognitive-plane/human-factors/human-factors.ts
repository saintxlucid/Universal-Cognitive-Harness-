/**
 * IDEA-0077 — Human Factors Model (prototype).
 *
 * A per-user work-posture profile: eight fields (expertise, stress,
 * focus, fatigue, communication style, risk tolerance, review style,
 * decision style), each with a level, an observable source, and
 * confidence. Privacy governance from day one: the profile is local,
 * user-owned, user-editable, and never exported without consent; its
 * only output is workflow adjustment, never judgment. Deterministic.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export type HumanFactorField =
  | 'expertise'
  | 'stress'
  | 'focus'
  | 'fatigue'
  | 'communicationStyle'
  | 'riskTolerance'
  | 'reviewStyle'
  | 'decisionStyle';

export interface HumanFactorValue {
  readonly field: HumanFactorField;
  /** 0..1 — for stress/fatigue higher = more stressed/fatigued. */
  readonly level: number;
  /** Observable source (interaction pattern, explicit setting, preference). */
  readonly source: string;
  /** Confidence in the observation 0..1. */
  readonly confidence: number;
}

export interface HumanFactorsProfile {
  readonly userId: string;
  readonly values: readonly HumanFactorValue[];
  /** Consent gate: profile is never exported/shared without this. */
  readonly exportConsent: boolean;
}

export const DEFAULT_PROFILE: Omit<HumanFactorsProfile, 'userId'> = {
  values: [
    { field: 'expertise', level: 0.5, source: 'default', confidence: 0.1 },
    { field: 'stress', level: 0.3, source: 'default', confidence: 0.1 },
    { field: 'focus', level: 0.5, source: 'default', confidence: 0.1 },
    { field: 'fatigue', level: 0.2, source: 'default', confidence: 0.1 },
    { field: 'communicationStyle', level: 0.5, source: 'default', confidence: 0.1 },
    { field: 'riskTolerance', level: 0.5, source: 'default', confidence: 0.1 },
    { field: 'reviewStyle', level: 0.5, source: 'default', confidence: 0.1 },
    { field: 'decisionStyle', level: 0.5, source: 'default', confidence: 0.1 },
  ],
  exportConsent: false,
};

export class HumanFactorsRegistry {
  private profiles = new Map<string, HumanFactorsProfile>();

  create(userId: string): void {
    this.profiles.set(userId, { userId, ...DEFAULT_PROFILE });
  }

  get(userId: string): HumanFactorsProfile | undefined {
    return this.profiles.get(userId);
  }

  /** Updates one field; confidence from the observation source. */
  update(userId: string, field: HumanFactorField, level: number, source: string, confidence: number): boolean {
    const profile = this.profiles.get(userId);
    if (!profile || confidence <= 0) return false;
    const values = profile.values.map((v) =>
      v.field === field ? { field, level, source, confidence: Math.max(v.confidence, confidence) } : v,
    );
    this.profiles.set(userId, { userId, values, exportConsent: profile.exportConsent });
    return true;
  }

  /** Explicit consent required before any export/sharing. */
  setExportConsent(userId: string, consent: boolean): void {
    const profile = this.profiles.get(userId);
    if (!profile) return;
    this.profiles.set(userId, { ...profile, exportConsent: consent });
  }

  /**
   * Privacy-gated export: returns a de-identified workflow parameter
   * only when consent is granted; otherwise undefined.
   */
  riskToleranceForWorkflow(userId: string): number | undefined {
    const profile = this.profiles.get(userId);
    if (!profile || !profile.exportConsent) return undefined;
    return profile.values.find((v) => v.field === 'riskTolerance')?.level;
  }

  /** Workflow simplification signal: high stress + fatigue → simplify. */
  shouldSimplify(userId: string): boolean {
    const profile = this.profiles.get(userId);
    if (!profile) return false;
    const stress = profile.values.find((v) => v.field === 'stress')?.level ?? 0;
    const fatigue = profile.values.find((v) => v.field === 'fatigue')?.level ?? 0;
    return stress >= 0.7 && fatigue >= 0.6;
  }
}
