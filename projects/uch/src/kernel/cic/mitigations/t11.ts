import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface DeletionRecord {
  objectId: string;
  objectType: string;
  requestedBy: string;
  timestamp: number;
  auditLogged: boolean;
  intercepted: boolean;
}

export class T11HardDeleteWithoutAuditMitigation implements ThreatMitigation {
  id = 'T11' as ThreatID;
  description = 'Intercept hard-delete operations that skip audit logging and force audit entry';
  severity = 'medium' as const;
  subsystem = 'storage';
  isActive = false;
  private deletionRecords: Map<string, DeletionRecord> = new Map();
  private auditLog: string[] = [];
  private readonly maxAuditEntries = 500;

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    for (const [, record] of this.deletionRecords) {
      if (!record.auditLogged && record.intercepted) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const evidence: string[] = [];
    for (const [, record] of this.deletionRecords) {
      if (!record.auditLogged && record.intercepted) {
        this.forceAuditLog(record);
        evidence.push(`audit-forced:${record.objectId} by ${record.requestedBy}`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Hard-delete audit mitigation: forced audit log for ${evidence.length} deletion operations`,
      evidence,
    };
  }

  recordDeletion(
    objectId: string,
    objectType: string,
    requestedBy: string,
    hasAudit: boolean,
  ): boolean {
    if (hasAudit) return true;
    this.deletionRecords.set(objectId, {
      objectId,
      objectType,
      requestedBy,
      timestamp: Date.now(),
      auditLogged: false,
      intercepted: true,
    });
    return false;
  }

  private forceAuditLog(record: DeletionRecord): void {
    const entry = `[${new Date(record.timestamp).toISOString()}] HARD-DELETE: ${record.objectType} "${record.objectId}" by ${record.requestedBy} (audit-forced)`;
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }
    record.auditLogged = true;
    record.intercepted = false;
  }

  getAuditLog(): string[] {
    return [...this.auditLog];
  }

  getStats(): Record<string, unknown> {
    return {
      interceptedDeletions: this.deletionRecords.size,
      auditLogEntries: this.auditLog.length,
    };
  }
}
