export interface BeliefLike {
  claim: string;
  confidence: number;
  verdict?: string;
  evidence: string[];
}

export type MergeConflictReason = 'confidence' | 'verdict' | 'evidence';

export interface MergeConflict {
  claim: string;
  a: BeliefLike;
  b: BeliefLike;
  reason: MergeConflictReason;
}

export interface MergeResult {
  beliefs: BeliefLike[];
  conflicts: MergeConflict[];
  stats: { added: number; merged: number; conflicted: number };
}

const CONFIDENCE_TOLERANCE = 0.15;

function copyBelief(belief: BeliefLike): BeliefLike {
  return {
    claim: belief.claim,
    confidence: belief.confidence,
    verdict: belief.verdict,
    evidence: [...belief.evidence],
  };
}

function unionEvidence(x: string[], y: string[]): string[] {
  const seen = new Set(x);
  const result = [...x];
  for (const item of y) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

function byClaim(x: { claim: string }, y: { claim: string }): number {
  return x.claim < y.claim ? -1 : x.claim > y.claim ? 1 : 0;
}

export function mergeCognition(a: BeliefLike[], b: BeliefLike[]): MergeResult {
  const index = (side: BeliefLike[]): Map<string, BeliefLike> => {
    const map = new Map<string, BeliefLike>();
    for (const belief of side) {
      if (!map.has(belief.claim)) map.set(belief.claim, copyBelief(belief));
    }
    return map;
  };

  const aByClaim = index(a);
  const bByClaim = index(b);
  const claims = new Set([...aByClaim.keys(), ...bByClaim.keys()]);

  const beliefs: BeliefLike[] = [];
  const conflicts: MergeConflict[] = [];
  const stats = { added: 0, merged: 0, conflicted: 0 };

  for (const claim of claims) {
    const left = aByClaim.get(claim);
    const right = bByClaim.get(claim);
    if (left === undefined) {
      beliefs.push(right!);
      stats.added++;
      continue;
    }
    if (right === undefined) {
      beliefs.push(left);
      stats.added++;
      continue;
    }
    if (left.verdict !== right.verdict) {
      conflicts.push({ claim, a: left, b: right, reason: 'verdict' });
      stats.conflicted++;
      continue;
    }
    if (Math.abs(left.confidence - right.confidence) > CONFIDENCE_TOLERANCE) {
      conflicts.push({ claim, a: left, b: right, reason: 'confidence' });
      stats.conflicted++;
      continue;
    }
    beliefs.push({
      claim,
      confidence: (left.confidence + right.confidence) / 2,
      verdict: left.verdict,
      evidence: unionEvidence(left.evidence, right.evidence),
    });
    stats.merged++;
  }

  beliefs.sort(byClaim);
  conflicts.sort(byClaim);
  return { beliefs, conflicts, stats };
}
