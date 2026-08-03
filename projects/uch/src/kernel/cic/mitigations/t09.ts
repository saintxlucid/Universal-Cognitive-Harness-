import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface EvidenceRecord {
  consolidationId: string;
  sourceConfidence: number;
  promotedWithoutVerification: boolean;
  timestamp: number;
}

export class T09ConsolidationPoisoningMitigation implements ThreatMitigation {
  id = 'T09' as ThreatID;
  description =
    'Detect and demote low-confidence evidence promoted during consolidation without verification';
  severity = 'medium' as const;
  subsystem = 'consolidation';
  isActive = false;
  private evidenceRecords: Map<string, EvidenceRecord> = new Map();
  private readonly minConfidenceThreshold = 0.4;
  private readonly windowMs = 120000;
  private demotedConsolidations: Set<string> = new Set();
  private flaggedForReview: string[] = [];

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.evidenceRecords) {
      if (now - record.timestamp > this.windowMs) continue;
      if (
        record.sourceConfidence < this.minConfidenceThreshold &&
        record.promotedWithoutVerification
      ) {
        return true;
      }
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.evidenceRecords) {
      if (now - record.timestamp > this.windowMs) continue;
      if (
        record.sourceConfidence < this.minConfidenceThreshold &&
        record.promotedWithoutVerification
      ) {
        this.demotedConsolidations.add(record.consolidationId);
        this.flaggedForReview.push(record.consolidationId);
        evidence.push(
          `consolidation-demoted:${record.consolidationId} confidence:${record.sourceConfidence}`,
        );
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Consolidation poisoning mitigation: demoted ${evidence.length} low-confidence consolidations`,
      evidence,
    };
  }

  recordConsolidation(consolidationId: string, sourceConfidence: number, verified: boolean): void {
    this.evidenceRecords.set(consolidationId, {
      consolidationId,
      sourceConfidence,
      promotedWithoutVerification: !verified,
      timestamp: Date.now(),
    });
  }

  isConsolidationDemoted(consolidationId: string): boolean {
    return this.demotedConsolidations.has(consolidationId);
  }

  getFlaggedForReview(): string[] {
    return [...this.flaggedForReview];
  }

  clearFlagged(consolidationId: string): void {
    this.flaggedForReview = this.flaggedForReview.filter((id) => id !== consolidationId);
    this.demotedConsolidations.delete(consolidationId);
  }

  getStats(): Record<string, unknown> {
    return {
      trackedEvidence: this.evidenceRecords.size,
      demotedConsolidations: this.demotedConsolidations.size,
      flaggedForReview: this.flaggedForReview.length,
    };
  }
}
