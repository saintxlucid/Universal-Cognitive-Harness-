import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface RetrieveRecord {
  agentId: string;
  resultCount: number;
  scopeBreadth: number;
  lastRetrieve: number;
  flagged: boolean;
}

export class T05DataExfiltrationMitigation implements ThreatMitigation {
  id = 'T05' as ThreatID;
  description =
    'Detect and cap abnormally large retrieve operations that may indicate data exfiltration';
  severity = 'high' as const;
  subsystem = 'retrieval';
  isActive = false;
  private retrieveRecords: Map<string, RetrieveRecord> = new Map();
  private readonly maxResultsPerRetrieve = 100;
  private readonly maxScopeBreadth = 5;
  private readonly windowMs = 30000;
  private cappedAgents: Set<string> = new Set();
  private pendingApprovals: Map<string, { agentId: string; count: number; timestamp: number }> =
    new Map();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.retrieveRecords) {
      if (now - record.lastRetrieve > this.windowMs) continue;
      if (record.resultCount > this.maxResultsPerRetrieve && !record.flagged) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.retrieveRecords) {
      if (now - record.lastRetrieve > this.windowMs) continue;
      if (record.resultCount > this.maxResultsPerRetrieve && !record.flagged) {
        record.flagged = true;
        this.cappedAgents.add(record.agentId);
        this.pendingApprovals.set(`approval-${record.agentId}-${now}`, {
          agentId: record.agentId,
          count: record.resultCount,
          timestamp: now,
        });
        evidence.push(
          `retrieve-capped:${record.agentId} returned ${record.resultCount} results (max ${this.maxResultsPerRetrieve})`,
        );
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Data exfiltration mitigation: capped ${evidence.length} large retrieve operations`,
      evidence,
    };
  }

  recordRetrieve(agentId: string, resultCount: number, scopeBreadth: number): void {
    const now = Date.now();
    let record = this.retrieveRecords.get(agentId);
    if (!record || now - record.lastRetrieve > this.windowMs) {
      record = { agentId, resultCount: 0, scopeBreadth: 0, lastRetrieve: now, flagged: false };
      this.retrieveRecords.set(agentId, record);
    }
    record.resultCount = resultCount;
    record.scopeBreadth = scopeBreadth;
    record.lastRetrieve = now;
  }

  isRetrieveAllowed(agentId: string, requestedCount: number): boolean {
    if (this.cappedAgents.has(agentId)) return requestedCount <= this.maxResultsPerRetrieve;
    return true;
  }

  getPendingApprovals(): Array<{ agentId: string; count: number; timestamp: number }> {
    return [...this.pendingApprovals.values()];
  }

  approveLargeRetrieve(agentId: string): void {
    this.cappedAgents.delete(agentId);
    for (const [key, record] of this.pendingApprovals) {
      if (record.agentId === agentId) this.pendingApprovals.delete(key);
    }
    for (const [, record] of this.retrieveRecords) {
      if (record.agentId === agentId) record.flagged = false;
    }
  }

  getStats(): Record<string, unknown> {
    return {
      trackedRetrieves: this.retrieveRecords.size,
      cappedAgents: this.cappedAgents.size,
      pendingApprovals: this.pendingApprovals.size,
    };
  }
}
