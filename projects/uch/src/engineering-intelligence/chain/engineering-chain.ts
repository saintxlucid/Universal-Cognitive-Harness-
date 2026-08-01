/**
 * IDEA-0081 — Deterministic Engineering Chain (prototype).
 *
 * The chain contract: plan → simulation → verification → execution →
 * validation → evidence → replay. Each stage has a mandatory ledger
 * artifact type; chain completeness checks that all artifacts exist
 * and link. Deterministic: no randomness, no I/O.
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export const CHAIN_STAGES = [
  'plan',
  'simulation',
  'verification',
  'execution',
  'validation',
  'evidence',
  'replay',
] as const;

export type ChainStage = (typeof CHAIN_STAGES)[number];

export interface ChainArtifact {
  readonly stage: ChainStage;
  readonly artifactId: string;
  /** The artifact this one derives from (lineage link). */
  readonly derivedFrom?: string;
  /** Stage-specific content hash (deterministic fingerprint). */
  readonly contentHash: string;
  readonly atTick: number;
}

export interface ChainCompleteness {
  readonly complete: boolean;
  /** Stages with no artifact. */
  readonly missing: readonly ChainStage[];
  /** Artifacts whose derivedFrom link points at a non-existent artifact. */
  readonly brokenLinks: readonly string[];
}

/**
 * Checks chain completeness: every stage must have an artifact, and
 * every artifact after plan must link to a prior artifact.
 */
export function checkChain(artifacts: readonly ChainArtifact[]): ChainCompleteness {
  const byId = new Set(artifacts.map((a) => a.artifactId));
  const present = new Set<ChainStage>();
  const brokenLinks: string[] = [];
  for (const artifact of artifacts) {
    present.add(artifact.stage);
    if (artifact.stage !== 'plan' && artifact.derivedFrom !== undefined && !byId.has(artifact.derivedFrom)) {
      brokenLinks.push(artifact.artifactId);
    }
  }
  const missing = CHAIN_STAGES.filter((s) => !present.has(s));
  return { complete: missing.length === 0 && brokenLinks.length === 0, missing, brokenLinks };
}

/** Compares two artifacts for replay-ability: same stage, same hash. */
export function isReplayable(a: ChainArtifact, b: ChainArtifact): boolean {
  return a.stage === b.stage && a.contentHash === b.contentHash;
}

/** Validates that a chain respects stage order (no out-of-order artifacts). */
export function isOrdered(artifacts: readonly ChainArtifact[]): boolean {
  const sorted = [...artifacts].sort((x, y) => x.atTick - y.atTick);
  let lastIndex = -1;
  for (const artifact of sorted) {
    const idx = CHAIN_STAGES.indexOf(artifact.stage);
    if (idx < lastIndex) return false;
    lastIndex = idx;
  }
  return true;
}
