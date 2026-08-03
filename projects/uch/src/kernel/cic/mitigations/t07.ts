import type { ImmuneSystem } from '../../../cognitive-core/immune.js';
import type { PolicyEngine } from '../../../control-plane/policies.js';
import { CircuitBreaker } from '../circuit-breaker.js';
import type { MitigationResult, PolicyFailureRecord, ThreatID, ThreatMitigation } from './types.js';

export class T07CascadingPolicyMitigation implements ThreatMitigation {
  id = 'T07' as ThreatID;
  description = 'Detect and prevent cascading policy evaluation failures';
  severity = 'high' as const;
  subsystem = 'policies';
  isActive = false;
  private policyRecords: Map<string, PolicyFailureRecord> = new Map();
  private readonly failureThreshold = 10;
  private readonly cooldownMs = 60000;

  async detect(_immune: ImmuneSystem, policies: PolicyEngine): Promise<boolean> {
    const rules = policies.getAllRules();
    let totalFailures = 0;

    for (const rule of rules) {
      const record = this.policyRecords.get(rule.id);
      if (!record) continue;
      if (record.failureCount >= this.failureThreshold) {
        totalFailures++;
      }
    }

    return totalFailures >= 3;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const mitigated: string[] = [];
    for (const [policyId, record] of this.policyRecords) {
      if (record.failureCount >= this.failureThreshold) {
        record.circuitBreaker.forceOpen();
        mitigated.push(policyId);
      }
    }
    return {
      applied: mitigated.length > 0,
      description: `Cascading policy mitigation: opened circuits for ${mitigated.length} failing policies`,
      evidence: mitigated.map((id) => `policy-circuit-opened:${id}`),
    };
  }

  recordPolicyFailure(policyId: string): void {
    const now = new Date();
    let record = this.policyRecords.get(policyId);
    if (!record) {
      record = {
        policyId,
        failureCount: 0,
        lastFailure: now,
        circuitBreaker: new CircuitBreaker({
          failureThreshold: this.failureThreshold,
          successThreshold: 1,
          resetTimeoutMs: this.cooldownMs,
          halfOpenMaxCalls: 1,
        }),
      };
      this.policyRecords.set(policyId, record);
    }
    record.failureCount++;
    record.lastFailure = now;
    record.circuitBreaker
      .call(async () => {
        throw new Error('policy-failure');
      })
      .catch(() => {});
  }

  recordPolicySuccess(policyId: string): void {
    const record = this.policyRecords.get(policyId);
    if (record) {
      record.failureCount = Math.max(0, record.failureCount - 1);
    }
  }

  isPolicyAvailable(policyId: string): boolean {
    const record = this.policyRecords.get(policyId);
    if (!record) return true;
    return record.failureCount < this.failureThreshold;
  }

  getFailingPolicies(): string[] {
    return [...this.policyRecords.entries()]
      .filter(([, r]) => r.failureCount >= this.failureThreshold)
      .map(([id]) => id);
  }

  getStats(): Record<string, unknown> {
    return {
      trackedPolicies: this.policyRecords.size,
      failingPolicies: this.getFailingPolicies().length,
    };
  }
}
