import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface RetentionRecord {
  objectId: string;
  objectType: string;
  createdAt: number;
  retentionPeriodMs: number;
  expired: boolean;
}

export class T10RetentionPolicyMitigation implements ThreatMitigation {
  id = 'T10' as ThreatID;
  description = 'Detect and forcibly expire objects persisting beyond their retention window';
  severity = 'medium' as const;
  subsystem = 'storage';
  isActive = false;
  private objectRecords: Map<string, RetentionRecord> = new Map();
  private readonly defaultRetentionMs = 86400000;
  private expiredCount = 0;

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.objectRecords) {
      if (record.expired) continue;
      const age = now - record.createdAt;
      if (age > (record.retentionPeriodMs || this.defaultRetentionMs)) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.objectRecords) {
      if (record.expired) continue;
      const age = now - record.createdAt;
      if (age > (record.retentionPeriodMs || this.defaultRetentionMs)) {
        record.expired = true;
        this.expiredCount++;
        evidence.push(`object-expired:${record.objectId} type:${record.objectType} age:${age}ms`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Retention policy mitigation: expired ${evidence.length} over-age objects`,
      evidence,
    };
  }

  trackObject(objectId: string, objectType: string, retentionPeriodMs?: number): void {
    this.objectRecords.set(objectId, {
      objectId,
      objectType,
      createdAt: Date.now(),
      retentionPeriodMs: retentionPeriodMs ?? this.defaultRetentionMs,
      expired: false,
    });
  }

  isObjectExpired(objectId: string): boolean {
    const record = this.objectRecords.get(objectId);
    if (!record) return false;
    return record.expired;
  }

  getStats(): Record<string, unknown> {
    return {
      trackedObjects: this.objectRecords.size,
      expiredCount: this.expiredCount,
    };
  }
}
