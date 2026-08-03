import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface NamespaceAccessRecord {
  agentId: string;
  targetNamespace: string;
  count: number;
  lastAttempt: number;
  hasCrossUserGrant: boolean;
}

export class T01UnauthorizedMemoryAccessMitigation implements ThreatMitigation {
  id = 'T01' as ThreatID;
  description = 'Detect and block unauthorized cross-agent memory namespace access';
  severity = 'critical' as const;
  subsystem = 'memory';
  isActive = false;
  private accessRecords: Map<string, NamespaceAccessRecord> = new Map();
  private readonly maxViolations = 3;
  private readonly violationWindowMs = 60000;
  private revokedNamespaces: Set<string> = new Set();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.accessRecords) {
      if (now - record.lastAttempt > this.violationWindowMs) continue;
      if (!record.hasCrossUserGrant && record.count >= this.maxViolations) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.accessRecords) {
      if (now - record.lastAttempt > this.violationWindowMs) continue;
      if (!record.hasCrossUserGrant && record.count >= this.maxViolations) {
        this.revokedNamespaces.add(record.targetNamespace);
        evidence.push(`namespace-revoked:${record.targetNamespace} by ${record.agentId}`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Unauthorized memory access mitigation: revoked ${evidence.length} namespace access attempts`,
      evidence,
    };
  }

  recordAccess(agentId: string, targetNamespace: string, hasCrossUserGrant: boolean): void {
    const key = `${agentId}:${targetNamespace}`;
    const now = Date.now();
    let record = this.accessRecords.get(key);
    if (!record || now - record.lastAttempt > this.violationWindowMs) {
      record = { agentId, targetNamespace, count: 0, lastAttempt: now, hasCrossUserGrant };
      this.accessRecords.set(key, record);
    }
    record.count++;
    record.lastAttempt = now;
    record.hasCrossUserGrant = hasCrossUserGrant;
  }

  isNamespaceRevoked(namespace: string): boolean {
    return this.revokedNamespaces.has(namespace);
  }

  getStats(): Record<string, unknown> {
    return {
      trackedAccesses: this.accessRecords.size,
      revokedNamespaces: this.revokedNamespaces.size,
    };
  }
}
