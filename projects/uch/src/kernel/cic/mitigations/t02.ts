import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface ProjectAccessRecord {
  agentId: string;
  projectScope: string;
  crossProjectCount: number;
  lastCrossProjectAccess: number;
  quarantined: boolean;
}

export class T02CrossProjectContaminationMitigation implements ThreatMitigation {
  id = 'T02' as ThreatID;
  description = 'Detect and quarantine cross-project concept/episode contamination';
  severity = 'critical' as const;
  subsystem = 'memory';
  isActive = false;
  private accessRecords: Map<string, ProjectAccessRecord> = new Map();
  private readonly contaminationThreshold = 2;
  private readonly windowMs = 120000;
  private quarantinedSessions: Set<string> = new Set();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.accessRecords) {
      if (now - record.lastCrossProjectAccess > this.windowMs) continue;
      if (record.crossProjectCount >= this.contaminationThreshold) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.accessRecords) {
      if (now - record.lastCrossProjectAccess > this.windowMs) continue;
      if (record.crossProjectCount >= this.contaminationThreshold && !record.quarantined) {
        record.quarantined = true;
        this.quarantinedSessions.add(record.agentId);
        evidence.push(`session-quarantined:${record.agentId} crossed into ${record.projectScope}`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Cross-project contamination mitigation: quarantined ${evidence.length} sessions`,
      evidence,
    };
  }

  recordAccess(agentId: string, projectScope: string, isCrossProject: boolean): void {
    if (!isCrossProject) return;
    const key = `${agentId}:${projectScope}`;
    const now = Date.now();
    let record = this.accessRecords.get(key);
    if (!record || now - record.lastCrossProjectAccess > this.windowMs) {
      record = {
        agentId,
        projectScope,
        crossProjectCount: 0,
        lastCrossProjectAccess: now,
        quarantined: false,
      };
      this.accessRecords.set(key, record);
    }
    record.crossProjectCount++;
    record.lastCrossProjectAccess = now;
  }

  isSessionQuarantined(agentId: string): boolean {
    return this.quarantinedSessions.has(agentId);
  }

  getStats(): Record<string, unknown> {
    return {
      trackedAccesses: this.accessRecords.size,
      quarantinedSessions: this.quarantinedSessions.size,
    };
  }
}
