import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import type { MitigationResult, ThreatID, ThreatMitigation } from './types.js';

interface OperationMismatchRecord {
  clientId: string;
  grantScope: string;
  mismatchedOperations: number;
  lastMismatch: number;
}

export class T03PrivilegeEscalationMitigation implements ThreatMitigation {
  id = 'T03' as ThreatID;
  description =
    'Detect and ratchet down permissions when read-only clients attempt mutate operations';
  severity = 'high' as const;
  subsystem = 'policies';
  isActive = false;
  private mismatchRecords: Map<string, OperationMismatchRecord> = new Map();
  private readonly maxMismatches = 3;
  private readonly windowMs = 60000;
  private readonly readOnlyClients: Set<string> = new Set();
  private demotedClients: Set<string> = new Set();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.mismatchRecords) {
      if (now - record.lastMismatch > this.windowMs) continue;
      if (record.mismatchedOperations >= this.maxMismatches) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.mismatchRecords) {
      if (now - record.lastMismatch > this.windowMs) continue;
      if (
        record.mismatchedOperations >= this.maxMismatches &&
        !this.demotedClients.has(record.clientId)
      ) {
        this.demotedClients.add(record.clientId);
        policies.addRule({
          id: `demoted-${record.clientId}`,
          effect: 'deny',
          principals: [record.clientId],
          actions: ['write', 'update', 'delete', 'mutate'],
          resources: ['*'],
          priority: 100,
        });
        evidence.push(`client-demoted:${record.clientId} from ${record.grantScope} to read-only`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Privilege escalation mitigation: demoted ${evidence.length} clients to read-only`,
      evidence,
    };
  }

  recordOperation(clientId: string, grantScope: string, operationType: string): void {
    if (operationType === 'read' || operationType === 'query') return;
    if (!this.readOnlyClients.has(clientId)) return;
    const key = `${clientId}:${grantScope}`;
    const now = Date.now();
    let record = this.mismatchRecords.get(key);
    if (!record || now - record.lastMismatch > this.windowMs) {
      record = { clientId, grantScope, mismatchedOperations: 0, lastMismatch: now };
      this.mismatchRecords.set(key, record);
    }
    record.mismatchedOperations++;
    record.lastMismatch = now;
  }

  registerReadOnlyClient(clientId: string): void {
    this.readOnlyClients.add(clientId);
  }

  isClientDemoted(clientId: string): boolean {
    return this.demotedClients.has(clientId);
  }

  getStats(): Record<string, unknown> {
    return {
      trackedClients: this.readOnlyClients.size,
      demotedClients: this.demotedClients.size,
      mismatchRecords: this.mismatchRecords.size,
    };
  }
}
