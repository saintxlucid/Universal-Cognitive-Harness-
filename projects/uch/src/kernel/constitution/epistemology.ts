import type { Confidence, EntrenchmentLevel, EpistemicStatus, Provenance } from '../types/provenance.js';

export interface Proposition {
  value: string;
  confidence: Confidence;
  entrenchment: EntrenchmentLevel;
  evidence: Evidence[];
  contradictions: string[];
  created_at: Date;
  last_revised: Date;
}

export interface Evidence {
  proposition: string;
  provenance: Provenance;
  strength: number;
  timestamp: Date;
}

export interface BeliefSet {
  propositions: Map<string, Proposition>;
}

export function createBeliefSet(): BeliefSet {
  return { propositions: new Map() };
}

export function classifyEpistemicStatus(confidence: number, independentVerifications: number, contradictionTested: boolean): EpistemicStatus {
  if (confidence > 0.99 && independentVerifications >= 2) return 'fact';
  if (confidence >= 0.95 && contradictionTested) return 'knowledge';
  if (confidence >= 0.70) return 'belief';
  if (confidence >= 0.30) return 'speculation';
  return 'rejected';
}

export function assessTruth(
  proposition: string,
  pragmaticSuccess: number,
  coherenceScore: number,
  contradictionResult: number,
  consensusScore: number,
): number {
  return 0.40 * pragmaticSuccess + 0.30 * coherenceScore + 0.20 * contradictionResult + 0.10 * consensusScore;
}

export function findConflicts(beliefSet: BeliefSet, proposition: Proposition): Proposition[] {
  const conflicts: Proposition[] = [];
  for (const [, existing] of beliefSet.propositions) {
    if (existing.contradictions.includes(proposition.value) || proposition.contradictions.includes(existing.value)) {
      conflicts.push(existing);
    }
  }
  return conflicts;
}

export function revise(beliefSet: BeliefSet, proposition: Proposition): void {
  const conflicts = findConflicts(beliefSet, proposition);

  if (conflicts.length === 0) {
    beliefSet.propositions.set(proposition.value, proposition);
    return;
  }

  const maxConflictEntrenchment = Math.max(...conflicts.map((b) => b.entrenchment));

  if (proposition.entrenchment > maxConflictEntrenchment) {
    for (const c of conflicts) {
      beliefSet.propositions.delete(c.value);
    }
    beliefSet.propositions.set(proposition.value, proposition);
  } else if (proposition.entrenchment < maxConflictEntrenchment) {
    // Flag contradiction, don't change
    proposition.contradictions.push(...conflicts.map((c) => c.value));
  } else {
    resolveEqualEntrenchment(beliefSet, proposition, conflicts);
  }
}

function resolveEqualEntrenchment(beliefSet: BeliefSet, proposition: Proposition, conflicts: Proposition[]): void {
  const totalConfidence = proposition.confidence.value + conflicts.reduce((s, c) => s + c.confidence.value, 0);

  // If new proposition has higher relative confidence, accept it
  if (proposition.confidence.value / totalConfidence > 0.6) {
    for (const c of conflicts) {
      beliefSet.propositions.delete(c.value);
    }
    beliefSet.propositions.set(proposition.value, proposition);
  } else {
    proposition.contradictions.push(...conflicts.map((c) => c.value));
  }
}

export async function integrateEvidence(
  beliefSet: BeliefSet,
  propositionValue: string,
  evidence: Evidence,
  sourceReliability: number,
): Promise<void> {
  const existing = beliefSet.propositions.get(propositionValue);
  const likelihood = sourceReliability;

  if (existing) {
    const prior = existing.confidence.value;
    const posterior = (likelihood * prior) / (likelihood * prior + (1 - likelihood) * (1 - prior));
    existing.confidence.value = posterior;
    existing.confidence.calibration_history.push(posterior);
    existing.evidence.push(evidence);
    existing.last_revised = new Date();
    existing.entrenchment = Math.min(5, (existing.entrenchment + 1)) as EntrenchmentLevel;
  } else {
    const proposition: Proposition = {
      value: propositionValue,
      confidence: {
        value: sourceReliability,
        method: 'bayesian',
        calibration_history: [sourceReliability],
      },
      entrenchment: 1,
      evidence: [evidence],
      contradictions: [],
      created_at: new Date(),
      last_revised: new Date(),
    };
    beliefSet.propositions.set(propositionValue, proposition);
  }
}
