import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface OperationIdRecord {
  operationId: string;
  timestamp: number;
}

export class T08ReplayAttackMitigation implements ThreatMitigation {
  id = 'T08' as ThreatID;
  description = 'Detect and reject duplicate operation IDs to prevent replay attacks';
  severity = 'medium' as const;
  subsystem = 'cic';
  isActive = false;
  private seenOperationIds: Map<string, OperationIdRecord> = new Map();
  private readonly replayWindowMs = 300000;
  private rejectedCount = 0;

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    return this.rejectedCount > 0;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const count = this.rejectedCount;
    this.rejectedCount = 0;
    return {
      applied: count > 0,
      description: `Replay attack mitigation: rejected ${count} duplicate operation IDs`,
      evidence: [`replay-rejections:${count}`],
    };
  }

  isOperationReplay(operationId: string): boolean {
    const existing = this.seenOperationIds.get(operationId);
    const now = Date.now();
    if (existing && now - existing.timestamp < this.replayWindowMs) {
      this.rejectedCount++;
      return true;
    }
    this.seenOperationIds.set(operationId, { operationId, timestamp: now });
    this.evictExpired();
    return false;
  }

  private evictExpired(): void {
    const cutoff = Date.now() - this.replayWindowMs;
    for (const [id, record] of this.seenOperationIds) {
      if (record.timestamp < cutoff) this.seenOperationIds.delete(id);
    }
  }

  getStats(): Record<string, unknown> {
    return {
      trackedOperationIds: this.seenOperationIds.size,
      totalRejected: this.rejectedCount,
    };
  }
}
