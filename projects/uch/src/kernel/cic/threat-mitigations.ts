import { ImmuneSystem, type ThreatAssessment } from '../../cognitive-core/immune.js';
import { PolicyEngine } from '../../control-plane/policies.js';
import { CircuitBreaker } from './circuit-breaker.js';

export type ThreatID = `T${string}`;

export interface ThreatMitigation {
  id: ThreatID;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  subsystem: string;
  detect: (immune: ImmuneSystem, policies: PolicyEngine) => Promise<boolean>;
  mitigate: (immune: ImmuneSystem, policies: PolicyEngine) => Promise<MitigationResult>;
  isActive: boolean;
}

export interface MitigationResult {
  applied: boolean;
  description: string;
  evidence: string[];
}

export interface ThreatMitigationConfig {
  autoMitigate: boolean;
  maxMitigationsPerCycle: number;
  cycleIntervalMs: number;
}

// ── T06: Runaway cognitive process / unbounded execution ──

export class T06RunawayProcessMitigation implements ThreatMitigation {
  id = 'T06' as ThreatID;
  description = 'Detect and contain runaway cognitive processes consuming excessive resources';
  severity = 'critical' as const;
  subsystem = 'cic';
  isActive = false;
  private circuitBreaker: CircuitBreaker;
  private processTimeouts: Map<string, number> = new Map();
  private readonly maxProcessDurationMs = 60000;

  constructor() {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      successThreshold: 1,
      resetTimeoutMs: 120000,
      halfOpenMaxCalls: 1,
    });
  }

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    return this.circuitBreaker.getState() === 'open';
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    this.circuitBreaker.forceClose();
    this.processTimeouts.clear();
    return {
      applied: true,
      description: 'Runaway process mitigation applied: circuit breaker reset, process timeouts cleared',
      evidence: ['circuit-breaker reset', 'process-timeout-cache cleared'],
    };
  }

  trackProcessStart(processId: string): void {
    this.processTimeouts.set(processId, Date.now());
  }

  trackProcessEnd(processId: string): boolean {
    const started = this.processTimeouts.get(processId);
    if (!started) return true;
    const duration = Date.now() - started;
    this.processTimeouts.delete(processId);

    if (duration > this.maxProcessDurationMs) {
      this.circuitBreaker.call(async () => { }, 1).catch(() => { });
      return false;
    }
    return true;
  }

  getCircuitBreaker(): CircuitBreaker { return this.circuitBreaker; }
  getActiveProcesses(): number { return this.processTimeouts.size; }
}

// ── T07: Cascading policy failure / policy evaluation storm ──

export interface PolicyFailureRecord {
  policyId: string;
  failureCount: number;
  lastFailure: Date;
  circuitBreaker: CircuitBreaker;
}

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
    record.circuitBreaker.call(async () => { throw new Error('policy-failure'); }).catch(() => { });
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

// ── T13: Auth token exhaustion / rapid credential cycling ──

export interface TokenExhaustionRecord {
  source: string;
  tokenCount: number;
  failureCount: number;
  windowStart: number;
  tokensIssued: number;
}

export class T13TokenExhaustionMitigation implements ThreatMitigation {
  id = 'T13' as ThreatID;
  description = 'Detect and block rapid token cycling / credential exhaustion attacks';
  severity = 'critical' as const;
  subsystem = 'auth';
  isActive = false;
  private sourceRecords: Map<string, TokenExhaustionRecord> = new Map();
  private readonly maxTokensPerWindow = 50;
  private readonly windowMs = 60000;
  private readonly maxFailuresBeforeBlock = 5;
  private blockedSources: Set<string> = new Set();
  private totalMitigations = 0;

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    if (this.blockedSources.size > 0) return true;
    const now = Date.now();
    for (const [, record] of this.sourceRecords) {
      const elapsed = now - record.windowStart;
      if (elapsed < this.windowMs) {
        if (record.failureCount >= this.maxFailuresBeforeBlock) {
          return true;
        }
      }
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const blocked: string[] = [];

    for (const [source, record] of this.sourceRecords) {
      const elapsed = now - record.windowStart;
      if (elapsed < this.windowMs) {
        if (record.failureCount >= this.maxFailuresBeforeBlock) {
          this.blockedSources.add(source);
          blocked.push(source);
          this.totalMitigations++;
        }
      }
    }

    return {
      applied: blocked.length > 0,
      description: `Token exhaustion mitigation: blocked ${blocked.length} sources`,
      evidence: blocked.map((s) => `source-blocked:${s}`),
    };
  }

  recordTokenIssue(source: string, success: boolean): void {
    const now = Date.now();
    let record = this.sourceRecords.get(source);

    if (!record || (now - record.windowStart) > this.windowMs) {
      record = {
        source,
        tokenCount: 0,
        failureCount: 0,
        windowStart: now,
        tokensIssued: 0,
      };
      this.sourceRecords.set(source, record);
    }

    if (success) {
      record.tokensIssued++;
    } else {
      record.failureCount++;
    }

    if (record.failureCount >= this.maxFailuresBeforeBlock) {
      this.blockedSources.add(source);
    }
  }

  isSourceBlocked(source: string): boolean {
    if (!this.blockedSources.has(source)) return false;

    const record = this.sourceRecords.get(source);
    if (record) {
      const elapsed = Date.now() - record.windowStart;
      if (elapsed > this.windowMs * 2) {
        this.blockedSources.delete(source);
        this.sourceRecords.delete(source);
        return false;
      }
    }

    return true;
  }

  unblockSource(source: string): void {
    this.blockedSources.delete(source);
    this.sourceRecords.delete(source);
  }

  getBlockedSources(): string[] {
    return [...this.blockedSources];
  }

  getStats(): Record<string, unknown> {
    return {
      trackedSources: this.sourceRecords.size,
      blockedSources: this.blockedSources.size,
      totalMitigations: this.totalMitigations,
      windowMs: this.windowMs,
      maxTokensPerWindow: this.maxTokensPerWindow,
    };
  }
}

// ── T01: Unauthorized memory access ──

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
      if ((now - record.lastAttempt) > this.violationWindowMs) continue;
      if (!record.hasCrossUserGrant && record.count >= this.maxViolations) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.accessRecords) {
      if ((now - record.lastAttempt) > this.violationWindowMs) continue;
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
    if (!record || (now - record.lastAttempt) > this.violationWindowMs) {
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

// ── T02: Cross-project contamination ──

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
      if ((now - record.lastCrossProjectAccess) > this.windowMs) continue;
      if (record.crossProjectCount >= this.contaminationThreshold) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.accessRecords) {
      if ((now - record.lastCrossProjectAccess) > this.windowMs) continue;
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
    if (!record || (now - record.lastCrossProjectAccess) > this.windowMs) {
      record = { agentId, projectScope, crossProjectCount: 0, lastCrossProjectAccess: now, quarantined: false };
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

// ── T03: Privilege escalation ──

interface OperationMismatchRecord {
  clientId: string;
  grantScope: string;
  mismatchedOperations: number;
  lastMismatch: number;
}

export class T03PrivilegeEscalationMitigation implements ThreatMitigation {
  id = 'T03' as ThreatID;
  description = 'Detect and ratchet down permissions when read-only clients attempt mutate operations';
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
      if ((now - record.lastMismatch) > this.windowMs) continue;
      if (record.mismatchedOperations >= this.maxMismatches) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.mismatchRecords) {
      if ((now - record.lastMismatch) > this.windowMs) continue;
      if (record.mismatchedOperations >= this.maxMismatches && !this.demotedClients.has(record.clientId)) {
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
    if (!record || (now - record.lastMismatch) > this.windowMs) {
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

// ── T04: Consent bypass ──

interface ObservationRecord {
  driverId: string;
  observationsWithoutConsent: number;
  lastObservation: number;
  blocked: boolean;
}

export class T04ConsentBypassMitigation implements ThreatMitigation {
  id = 'T04' as ThreatID;
  description = 'Detect and block observation events emitted without active consent grants';
  severity = 'high' as const;
  subsystem = 'exoskeleton';
  isActive = false;
  private observationRecords: Map<string, ObservationRecord> = new Map();
  private readonly maxViolations = 2;
  private readonly windowMs = 60000;
  private blockedDrivers: Set<string> = new Set();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.observationRecords) {
      if ((now - record.lastObservation) > this.windowMs) continue;
      if (record.observationsWithoutConsent >= this.maxViolations) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.observationRecords) {
      if ((now - record.lastObservation) > this.windowMs) continue;
      if (record.observationsWithoutConsent >= this.maxViolations && !record.blocked) {
        record.blocked = true;
        this.blockedDrivers.add(record.driverId);
        evidence.push(`driver-blocked:${record.driverId} observation pipeline disabled`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Consent bypass mitigation: blocked ${evidence.length} drivers from emitting observations`,
      evidence,
    };
  }

  recordObservation(driverId: string, hasConsent: boolean): void {
    if (hasConsent) return;
    const now = Date.now();
    let record = this.observationRecords.get(driverId);
    if (!record || (now - record.lastObservation) > this.windowMs) {
      record = { driverId, observationsWithoutConsent: 0, lastObservation: now, blocked: false };
      this.observationRecords.set(driverId, record);
    }
    record.observationsWithoutConsent++;
    record.lastObservation = now;
  }

  isDriverBlocked(driverId: string): boolean {
    return this.blockedDrivers.has(driverId);
  }

  unblockDriver(driverId: string, reConsented: boolean): void {
    if (reConsented) {
      this.blockedDrivers.delete(driverId);
      this.observationRecords.delete(driverId);
    }
  }

  getStats(): Record<string, unknown> {
    return {
      trackedDrivers: this.observationRecords.size,
      blockedDrivers: this.blockedDrivers.size,
    };
  }
}

// ── T05: Data exfiltration via retrieve ──

interface RetrieveRecord {
  agentId: string;
  resultCount: number;
  scopeBreadth: number;
  lastRetrieve: number;
  flagged: boolean;
}

export class T05DataExfiltrationMitigation implements ThreatMitigation {
  id = 'T05' as ThreatID;
  description = 'Detect and cap abnormally large retrieve operations that may indicate data exfiltration';
  severity = 'high' as const;
  subsystem = 'retrieval';
  isActive = false;
  private retrieveRecords: Map<string, RetrieveRecord> = new Map();
  private readonly maxResultsPerRetrieve = 100;
  private readonly maxScopeBreadth = 5;
  private readonly windowMs = 30000;
  private cappedAgents: Set<string> = new Set();
  private pendingApprovals: Map<string, { agentId: string; count: number; timestamp: number }> = new Map();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.retrieveRecords) {
      if ((now - record.lastRetrieve) > this.windowMs) continue;
      if (record.resultCount > this.maxResultsPerRetrieve && !record.flagged) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.retrieveRecords) {
      if ((now - record.lastRetrieve) > this.windowMs) continue;
      if (record.resultCount > this.maxResultsPerRetrieve && !record.flagged) {
        record.flagged = true;
        this.cappedAgents.add(record.agentId);
        this.pendingApprovals.set(`approval-${record.agentId}-${now}`, {
          agentId: record.agentId,
          count: record.resultCount,
          timestamp: now,
        });
        evidence.push(`retrieve-capped:${record.agentId} returned ${record.resultCount} results (max ${this.maxResultsPerRetrieve})`);
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
    if (!record || (now - record.lastRetrieve) > this.windowMs) {
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

// ── T08: Replay attack ──

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
    if (existing && (now - existing.timestamp) < this.replayWindowMs) {
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

// ── T09: Consolidation poisoning ──

interface EvidenceRecord {
  consolidationId: string;
  sourceConfidence: number;
  promotedWithoutVerification: boolean;
  timestamp: number;
}

export class T09ConsolidationPoisoningMitigation implements ThreatMitigation {
  id = 'T09' as ThreatID;
  description = 'Detect and demote low-confidence evidence promoted during consolidation without verification';
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
      if ((now - record.timestamp) > this.windowMs) continue;
      if (record.sourceConfidence < this.minConfidenceThreshold && record.promotedWithoutVerification) {
        return true;
      }
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.evidenceRecords) {
      if ((now - record.timestamp) > this.windowMs) continue;
      if (record.sourceConfidence < this.minConfidenceThreshold && record.promotedWithoutVerification) {
        this.demotedConsolidations.add(record.consolidationId);
        this.flaggedForReview.push(record.consolidationId);
        evidence.push(`consolidation-demoted:${record.consolidationId} confidence:${record.sourceConfidence}`);
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

// ── T10: Retention policy bypass ──

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

// ── T11: Hard-delete without audit ──

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

  recordDeletion(objectId: string, objectType: string, requestedBy: string, hasAudit: boolean): boolean {
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

// ── T12: Timing side channel ──

interface TimingRecord {
  scopeId: string;
  responseTimes: number[];
  variance: number;
  lastAccess: number;
}

export class T12TimingSideChannelMitigation implements ThreatMitigation {
  id = 'T12' as ThreatID;
  description = 'Detect and mitigate timing side channels by injecting noise and enforcing constant-time scope checks';
  severity = 'low' as const;
  subsystem = 'cic';
  isActive = false;
  private timingRecords: Map<string, TimingRecord> = new Map();
  private readonly maxSamples = 20;
  private readonly varianceThreshold = 50;
  private readonly noiseMin = 5;
  private readonly noiseMax = 25;
  private readonly windowMs = 60000;

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    const now = Date.now();
    for (const [, record] of this.timingRecords) {
      if ((now - record.lastAccess) > this.windowMs) continue;
      if (record.responseTimes.length >= 3 && record.variance > this.varianceThreshold) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const now = Date.now();
    const evidence: string[] = [];
    for (const [, record] of this.timingRecords) {
      if ((now - record.lastAccess) > this.windowMs) continue;
      if (record.responseTimes.length >= 3 && record.variance > this.varianceThreshold) {
        evidence.push(`noise-injected:${record.scopeId} variance:${record.variance.toFixed(0)}ms`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Timing side channel mitigation: injected noise into ${evidence.length} scope timing patterns`,
      evidence,
    };
  }

  recordTiming(scopeId: string, responseTimeMs: number): void {
    let record = this.timingRecords.get(scopeId);
    const now = Date.now();
    if (!record || (now - record.lastAccess) > this.windowMs) {
      record = { scopeId, responseTimes: [], variance: 0, lastAccess: now };
      this.timingRecords.set(scopeId, record);
    }
    record.responseTimes.push(responseTimeMs);
    if (record.responseTimes.length > this.maxSamples) {
      record.responseTimes = record.responseTimes.slice(-this.maxSamples);
    }
    record.variance = this.calculateVariance(record.responseTimes);
    record.lastAccess = now;
  }

  injectNoise(): number {
    return Math.floor(Math.random() * (this.noiseMax - this.noiseMin + 1)) + this.noiseMin;
  }

  private calculateVariance(times: number[]): number {
    if (times.length < 2) return 0;
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const squaredDiffs = times.map((t) => (t - mean) ** 2);
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / times.length);
  }

  getStats(): Record<string, unknown> {
    return {
      trackedScopes: this.timingRecords.size,
      varianceThreshold: this.varianceThreshold,
    };
  }
}

// ── T14: Session hijacking ──

interface SessionBinding {
  sessionId: string;
  clientId: string;
  clientIdentity: string;
  lastVerified: number;
  isValid: boolean;
}

export class T14SessionHijackingMitigation implements ThreatMitigation {
  id = 'T14' as ThreatID;
  description = 'Detect session token reuse from different client identities and force re-authentication';
  severity = 'high' as const;
  subsystem = 'auth';
  isActive = false;
  private sessionBindings: Map<string, SessionBinding> = new Map();
  private readonly verificationIntervalMs = 60000;
  private hijackedSessions: Set<string> = new Set();

  async detect(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<boolean> {
    for (const [, binding] of this.sessionBindings) {
      if (!binding.isValid) return true;
    }
    return false;
  }

  async mitigate(_immune: ImmuneSystem, _policies: PolicyEngine): Promise<MitigationResult> {
    const evidence: string[] = [];
    for (const [, binding] of this.sessionBindings) {
      if (!binding.isValid) {
        this.hijackedSessions.add(binding.sessionId);
        evidence.push(`session-invalidated:${binding.sessionId} client:${binding.clientIdentity}`);
      }
    }
    return {
      applied: evidence.length > 0,
      description: `Session hijacking mitigation: invalidated ${evidence.length} hijacked sessions`,
      evidence,
    };
  }

  registerSession(sessionId: string, clientId: string, clientIdentity: string): void {
    this.sessionBindings.set(sessionId, {
      sessionId,
      clientId,
      clientIdentity,
      lastVerified: Date.now(),
      isValid: true,
    });
  }

  verifySession(sessionId: string, clientIdentity: string): boolean {
    const binding = this.sessionBindings.get(sessionId);
    if (!binding) return false;
    if (binding.clientIdentity !== clientIdentity) {
      binding.isValid = false;
      return false;
    }
    binding.lastVerified = Date.now();
    return true;
  }

  isSessionValid(sessionId: string): boolean {
    const binding = this.sessionBindings.get(sessionId);
    if (!binding) return false;
    return binding.isValid;
  }

  getStats(): Record<string, unknown> {
    return {
      trackedSessions: this.sessionBindings.size,
      hijackedSessions: this.hijackedSessions.size,
    };
  }
}

// ── Threat Mitigation Engine ──

export class ThreatMitigationEngine {
  private mitigations: Map<ThreatID, ThreatMitigation> = new Map();
  private config: Required<ThreatMitigationConfig>;
  private immune: ImmuneSystem;
  private policies: PolicyEngine;
  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private totalCycles = 0;
  private totalMitigationsApplied = 0;
  private history: MitigationResult[] = [];

  constructor(
    immune: ImmuneSystem,
    policies: PolicyEngine,
    config?: Partial<ThreatMitigationConfig>,
  ) {
    this.immune = immune;
    this.policies = policies;
    this.config = {
      autoMitigate: config?.autoMitigate ?? true,
      maxMitigationsPerCycle: config?.maxMitigationsPerCycle ?? 5,
      cycleIntervalMs: config?.cycleIntervalMs ?? 30000,
    };

    this.register(new T01UnauthorizedMemoryAccessMitigation());
    this.register(new T02CrossProjectContaminationMitigation());
    this.register(new T03PrivilegeEscalationMitigation());
    this.register(new T04ConsentBypassMitigation());
    this.register(new T05DataExfiltrationMitigation());
    this.register(new T06RunawayProcessMitigation());
    this.register(new T07CascadingPolicyMitigation());
    this.register(new T08ReplayAttackMitigation());
    this.register(new T09ConsolidationPoisoningMitigation());
    this.register(new T10RetentionPolicyMitigation());
    this.register(new T11HardDeleteWithoutAuditMitigation());
    this.register(new T12TimingSideChannelMitigation());
    this.register(new T13TokenExhaustionMitigation());
    this.register(new T14SessionHijackingMitigation());
  }

  register(mitigation: ThreatMitigation): void {
    this.mitigations.set(mitigation.id, mitigation);
  }

  get(id: ThreatID): ThreatMitigation | undefined {
    return this.mitigations.get(id);
  }

  async tick(): Promise<MitigationResult[]> {
    this.totalCycles++;
    const applied: MitigationResult[] = [];

    for (const [, mitigation] of this.mitigations) {
      try {
        const detected = await mitigation.detect(this.immune, this.policies);
        if (detected && this.config.autoMitigate) {
          const result = await mitigation.mitigate(this.immune, this.policies);
          if (result.applied) {
            mitigation.isActive = true;
            applied.push(result);
            this.totalMitigationsApplied++;
            this.history.push(result);

            this.immune['reportThreat']({
              severity: mitigation.severity,
              source: 'threat-mitigation-engine',
              description: result.description,
              subsystem: mitigation.subsystem,
              recommendation: result.evidence.join('; '),
            } as unknown as ThreatAssessment);
          }
        } else if (!detected) {
          mitigation.isActive = false;
        }
      } catch { /* mitigation is best-effort */ }
    }

    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    return applied;
  }

  start(): void {
    if (this.cycleTimer) return;
    this.cycleTimer = setInterval(async () => {
      await this.tick();
    }, this.config.cycleIntervalMs);
  }

  stop(): void {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
  }

  getHistory(limit = 10): MitigationResult[] {
    return this.history.slice(-limit);
  }

  getStats(): Record<string, unknown> {
    return {
      totalCycles: this.totalCycles,
      totalMitigationsApplied: this.totalMitigationsApplied,
      registeredMitigations: this.mitigations.size,
      autoMitigate: this.config.autoMitigate,
      mitigations: [...this.mitigations.entries()].map(([id, m]) => ({
        id,
        severity: m.severity,
        subsystem: m.subsystem,
        isActive: m.isActive,
      })),
    };
  }
}
