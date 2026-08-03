import { describe, it, expect } from 'vitest';
import { ConformanceRunner, defineFixture, pass, fail } from './conformance-runner.js';
import {
  ThreatMitigationEngine,
  T01UnauthorizedMemoryAccessMitigation,
  T02CrossProjectContaminationMitigation,
  T03PrivilegeEscalationMitigation,
  T04ConsentBypassMitigation,
  T05DataExfiltrationMitigation,
  T06RunawayProcessMitigation,
  T07CascadingPolicyMitigation,
  T08ReplayAttackMitigation,
  T09ConsolidationPoisoningMitigation,
  T10RetentionPolicyMitigation,
  T11HardDeleteWithoutAuditMitigation,
  T12TimingSideChannelMitigation,
  T13TokenExhaustionMitigation,
  T14SessionHijackingMitigation,
} from '../kernel/cic/mitigations/index.js';
import { ImmuneSystem } from '../cognitive-core/immune.js';
import { PolicyEngine } from '../control-plane/policies.js';
import { ReflexEngine } from '../suit/instinct/reflex-engine.js';
import { Auth } from '../control-plane/auth/auth.js';

// ── Helpers ──

function createImmuneSystem(): ImmuneSystem {
  return new ImmuneSystem(new PolicyEngine(), new Auth(), new ReflexEngine());
}

function createPolicyEngine(): PolicyEngine {
  return new PolicyEngine();
}

// ── T01: Unauthorized Memory Access ──

const fixtureT01 = defineFixture({
  id: 'T01',
  name: 'T01: Unauthorized Memory Access',
  description: 'Simulate cross-namespace access and detect unauthorized memory access',
  category: 'security',
  run: async () => {
    const mit = new T01UnauthorizedMemoryAccessMitigation();

    // Simulate 3 unauthorized cross-namespace access attempts
    for (let i = 0; i < 3; i++) {
      mit.recordAccess('malicious-agent', 'restricted-namespace', false);
    }

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T01', ['detect() returned false — expected true after 3 unauthorized accesses']);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T01', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('namespace-revoked'))) {
      return fail('T01', ['mitigate() evidence missing namespace-revoked']);
    }
    if (!mit.isNamespaceRevoked('restricted-namespace')) {
      return fail('T01', ['namespace should be revoked after mitigation']);
    }

    return pass('T01', { stats: mit.getStats() });
  },
});

// ── T02: Cross-Project Contamination ──

const fixtureT02 = defineFixture({
  id: 'T02',
  name: 'T02: Cross-Project Contamination',
  description: 'Simulate cross-project retrieve and detect scope violation',
  category: 'security',
  run: async () => {
    const mit = new T02CrossProjectContaminationMitigation();

    // Record cross-project accesses (threshold is 2 per agent/project)
    mit.recordAccess('agent-a', 'project-other', true);
    mit.recordAccess('agent-a', 'project-other', true);
    // One more pushes over threshold
    mit.recordAccess('agent-a', 'project-other', true);

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T02', [
        'detect() returned false — expected true after 3 cross-project accesses',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T02', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('session-quarantined'))) {
      return fail('T02', ['mitigate() evidence missing session-quarantined']);
    }
    if (!mit.isSessionQuarantined('agent-a')) {
      return fail('T02', ['agent-a should be quarantined after mitigation']);
    }

    return pass('T02', { stats: mit.getStats() });
  },
});

// ── T03: Privilege Escalation ──

const fixtureT03 = defineFixture({
  id: 'T03',
  name: 'T03: Privilege Escalation',
  description: 'Simulate read-only client sending mutate and detect escalation',
  category: 'security',
  run: async () => {
    const mit = new T03PrivilegeEscalationMitigation();
    const policies = createPolicyEngine();

    mit.registerReadOnlyClient('readonly-client');

    // Attempt mutate operations from a read-only client
    for (let i = 0; i < 3; i++) {
      mit.recordOperation('readonly-client', 'read-scope', 'write');
    }

    const detected = await mit.detect(createImmuneSystem(), policies);
    if (!detected) {
      return fail('T03', [
        'detect() returned false — expected true after 3 mutate attempts on read-only client',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), policies);
    if (!result.applied) {
      return fail('T03', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('client-demoted'))) {
      return fail('T03', ['mitigate() evidence missing client-demoted']);
    }
    if (!mit.isClientDemoted('readonly-client')) {
      return fail('T03', ['readonly-client should be demoted after mitigation']);
    }

    return pass('T03', { stats: mit.getStats() });
  },
});

// ── T04: Consent Bypass ──

const fixtureT04 = defineFixture({
  id: 'T04',
  name: 'T04: Consent Bypass',
  description: 'Simulate observation without consent and detect consent bypass',
  category: 'security',
  run: async () => {
    const mit = new T04ConsentBypassMitigation();

    // Record observations without consent
    for (let i = 0; i < 2; i++) {
      mit.recordObservation('rogue-driver', false);
    }

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T04', [
        'detect() returned false — expected true after 2 observations without consent',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T04', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('driver-blocked'))) {
      return fail('T04', ['mitigate() evidence missing driver-blocked']);
    }
    if (!mit.isDriverBlocked('rogue-driver')) {
      return fail('T04', ['rogue-driver should be blocked after mitigation']);
    }

    return pass('T04', { stats: mit.getStats() });
  },
});

// ── T05: Data Exfiltration ──

const fixtureT05 = defineFixture({
  id: 'T05',
  name: 'T05: Data Exfiltration',
  description: 'Simulate oversized retrieve operation and detect exfiltration',
  category: 'security',
  run: async () => {
    const mit = new T05DataExfiltrationMitigation();

    // Record a retrieve with results exceeding the max (100)
    mit.recordRetrieve('data-scraper', 200, 10);

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T05', [
        'detect() returned false — expected true after oversized retrieve (200 results)',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T05', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('retrieve-capped'))) {
      return fail('T05', ['mitigate() evidence missing retrieve-capped']);
    }

    // Agent should be capped — retrieves over 100 should be denied
    if (mit.isRetrieveAllowed('data-scraper', 200)) {
      return fail('T05', ['retrieve should be capped after mitigation']);
    }
    // But retrieves under cap should still be allowed
    if (!mit.isRetrieveAllowed('data-scraper', 50)) {
      return fail('T05', ['retrieve under cap should still be allowed']);
    }

    // Approval should restore access
    mit.approveLargeRetrieve('data-scraper');
    if (!mit.isRetrieveAllowed('data-scraper', 200)) {
      return fail('T05', ['retrieve should be allowed after approval']);
    }

    return pass('T05', { stats: mit.getStats() });
  },
});

// ── T06: Runaway Process ──

const fixtureT06 = defineFixture({
  id: 'T06',
  name: 'T06: Runaway Process',
  description: 'Simulate runaway cognitive process and verify circuit breaker opens',
  category: 'security',
  run: async () => {
    const mit = new T06RunawayProcessMitigation();

    // Force the circuit breaker open to simulate a runaway process
    mit.getCircuitBreaker().forceOpen();

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T06', ['detect() returned false — expected true when circuit breaker is open']);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T06', ['mitigate() did not apply']);
    }
    if (!result.evidence.includes('circuit-breaker reset')) {
      return fail('T06', ['mitigate() evidence missing circuit-breaker reset']);
    }

    // Verify the circuit was force-closed and timeouts cleared
    if (mit.getCircuitBreaker().getState() !== 'closed') {
      return fail('T06', ['circuit breaker should be closed after mitigation']);
    }
    if (mit.getActiveProcesses() !== 0) {
      return fail('T06', ['active process count should be 0 after mitigation']);
    }

    return pass('T06', { stats: { activeProcesses: mit.getActiveProcesses() } });
  },
});

// ── T07: Cascading Policy Failure ──

const fixtureT07 = defineFixture({
  id: 'T07',
  name: 'T07: Cascading Policy Failure',
  description: 'Record multiple policy failures and detect cascade risk',
  category: 'security',
  run: async () => {
    const mit = new T07CascadingPolicyMitigation();
    const policies = createPolicyEngine();

    // Add rules matching the policy IDs we'll fail
    policies.addRule({
      id: 'auth-policy',
      effect: 'allow',
      principals: ['*'],
      actions: ['*'],
      resources: ['*'],
      priority: 1,
    });
    policies.addRule({
      id: 'storage-policy',
      effect: 'deny',
      principals: ['*'],
      actions: ['write'],
      resources: ['*'],
      priority: 10,
    });
    policies.addRule({
      id: 'network-policy',
      effect: 'allow',
      principals: ['admin'],
      actions: ['connect'],
      resources: ['*'],
      priority: 5,
    });

    // Record enough failures to trip each policy's circuit breaker
    for (let i = 0; i < 15; i++) {
      mit.recordPolicyFailure('auth-policy');
      mit.recordPolicyFailure('storage-policy');
      mit.recordPolicyFailure('network-policy');
    }

    const detected = await mit.detect(createImmuneSystem(), policies);
    if (!detected) {
      return fail('T07', [
        'detect() returned false — expected true after 3 policies with 15 failures each',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), policies);
    if (!result.applied) {
      return fail('T07', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('policy-circuit-opened'))) {
      return fail('T07', ['mitigate() evidence missing policy-circuit-opened']);
    }

    return pass('T07', { stats: mit.getStats() });
  },
});

// ── T08: Replay Attack ──

const fixtureT08 = defineFixture({
  id: 'T08',
  name: 'T08: Replay Attack',
  description: 'Submit duplicate operation ID and detect replay',
  category: 'security',
  run: async () => {
    const mit = new T08ReplayAttackMitigation();

    // First submission should succeed
    const firstAttempt = mit.isOperationReplay('txn-001');
    if (firstAttempt) {
      return fail('T08', ['first submission of operation ID should not be a replay']);
    }

    // Second submission of same ID should be detected as replay
    const secondAttempt = mit.isOperationReplay('txn-001');
    if (!secondAttempt) {
      return fail('T08', ['second submission of same operation ID should be detected as replay']);
    }

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T08', ['detect() returned false — expected true after replay was detected']);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T08', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('replay-rejections'))) {
      return fail('T08', ['mitigate() evidence missing replay-rejections']);
    }

    return pass('T08', { stats: mit.getStats() });
  },
});

// ── T09: Consolidation Poisoning ──

const fixtureT09 = defineFixture({
  id: 'T09',
  name: 'T09: Consolidation Poisoning',
  description: 'Submit low-confidence evidence and detect consolidation poisoning risk',
  category: 'security',
  run: async () => {
    const mit = new T09ConsolidationPoisoningMitigation();

    // Record low-confidence, unverified consolidation
    mit.recordConsolidation('poisoned-cons', 0.3, false);

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T09', [
        'detect() returned false — expected true for low-confidence, unverified consolidation',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T09', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('consolidation-demoted'))) {
      return fail('T09', ['mitigate() evidence missing consolidation-demoted']);
    }
    if (!mit.isConsolidationDemoted('poisoned-cons')) {
      return fail('T09', ['consolidation should be demoted after mitigation']);
    }

    return pass('T09', { stats: mit.getStats() });
  },
});

// ── T10: Retention Policy Bypass ──

const fixtureT10 = defineFixture({
  id: 'T10',
  name: 'T10: Retention Policy Bypass',
  description: 'Create object past retention window and detect retention bypass',
  category: 'security',
  run: async () => {
    const mit = new T10RetentionPolicyMitigation();

    // Track an object with a very short (1ms) retention period
    mit.trackObject('obj-retro', 'test-type', 1);

    // Wait for it to exceed retention
    await new Promise((r) => setTimeout(r, 10));

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T10', [
        'detect() returned false — expected true for object past retention window',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T10', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('object-expired'))) {
      return fail('T10', ['mitigate() evidence missing object-expired']);
    }
    if (!mit.isObjectExpired('obj-retro')) {
      return fail('T10', ['object should be expired after mitigation']);
    }

    return pass('T10', { stats: mit.getStats() });
  },
});

// ── T11: Hard-Delete Without Audit ──

const fixtureT11 = defineFixture({
  id: 'T11',
  name: 'T11: Hard-Delete Without Audit',
  description: 'Attempt hard-delete without audit logging and detect the skip',
  category: 'security',
  run: async () => {
    const mit = new T11HardDeleteWithoutAuditMitigation();

    // Record a deletion without audit — should be intercepted
    const allowed = mit.recordDeletion('doc-1', 'document', 'user-a', false);
    if (allowed) {
      return fail('T11', ['deletion without audit should be intercepted (return false)']);
    }

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T11', [
        'detect() returned false — expected true after intercepted deletion without audit',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T11', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('audit-forced'))) {
      return fail('T11', ['mitigate() evidence missing audit-forced']);
    }

    // Verify audit log was created
    const auditLog = mit.getAuditLog();
    if (auditLog.length === 0) {
      return fail('T11', ['audit log should contain at least one entry']);
    }
    if (!auditLog[0]!.includes('HARD-DELETE')) {
      return fail('T11', ['audit log entry should indicate HARD-DELETE']);
    }
    if (!auditLog[0]!.includes('user-a')) {
      return fail('T11', ['audit log entry should reference the requesting user']);
    }

    // Deletion with audit should pass through
    const withAudit = mit.recordDeletion('doc-2', 'document', 'user-b', true);
    if (!withAudit) {
      return fail('T11', ['deletion with audit should be allowed (return true)']);
    }

    return pass('T11', { stats: mit.getStats() });
  },
});

// ── T12: Timing Side Channel ──

const fixtureT12 = defineFixture({
  id: 'T12',
  name: 'T12: Timing Side Channel',
  description: 'Record response times with high variance and detect timing side channel',
  category: 'security',
  run: async () => {
    const mit = new T12TimingSideChannelMitigation();

    // Record response times with high variance (> 50 threshold)
    mit.recordTiming('scope-secure', 10);
    mit.recordTiming('scope-secure', 200);
    mit.recordTiming('scope-secure', 15);

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T12', [
        'detect() returned false — expected true for high-variance timing pattern',
      ]);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T12', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('noise-injected'))) {
      return fail('T12', ['mitigate() evidence missing noise-injected']);
    }

    // Verify noise injection produces values in the configured range
    const noise = mit.injectNoise();
    if (noise < 5 || noise > 25) {
      return fail('T12', [`injectNoise() returned ${noise} — expected between 5 and 25`]);
    }

    return pass('T12', { stats: mit.getStats() });
  },
});

// ── T13: Token Exhaustion ──

const fixtureT13 = defineFixture({
  id: 'T13',
  name: 'T13: Token Exhaustion',
  description: 'Issue tokens rapidly and detect credential exhaustion',
  category: 'security',
  run: async () => {
    const mit = new T13TokenExhaustionMitigation();

    // Rapidly issue tokens from a single source (exceeds threshold of 50)
    for (let i = 0; i < 60; i++) {
      mit.recordTokenIssue('attacker-pool', false);
    }

    if (!mit.isSourceBlocked('attacker-pool')) {
      return fail('T13', ['attacker-pool should be blocked after 60 failed token issues']);
    }
    if (!mit.getBlockedSources().includes('attacker-pool')) {
      return fail('T13', ['getBlockedSources() should include attacker-pool']);
    }

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T13', ['detect() returned false — expected true after token exhaustion']);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T13', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('source-blocked'))) {
      return fail('T13', ['mitigate() evidence missing source-blocked']);
    }

    // Unblock should restore access
    mit.unblockSource('attacker-pool');
    if (mit.isSourceBlocked('attacker-pool')) {
      return fail('T13', ['attacker-pool should be unblocked after unblockSource()']);
    }

    // Successful token issues should NOT trigger blocking
    const mitLegit = new T13TokenExhaustionMitigation();
    for (let i = 0; i < 60; i++) {
      mitLegit.recordTokenIssue('legit-source', true);
    }
    if (mitLegit.getBlockedSources().includes('legit-source')) {
      return fail('T13', ['successful token issues should not result in blocking']);
    }

    return pass('T13', { stats: mit.getStats() });
  },
});

// ── T14: Session Hijacking ──

const fixtureT14 = defineFixture({
  id: 'T14',
  name: 'T14: Session Hijacking',
  description: 'Switch client identity mid-session and detect hijacking',
  category: 'security',
  run: async () => {
    const mit = new T14SessionHijackingMitigation();

    // Register a session for client-a
    mit.registerSession('sess-1', 'client-1', 'user-a');
    if (!mit.isSessionValid('sess-1')) {
      return fail('T14', ['session should be valid after registration']);
    }

    // Verify with a different identity — should fail and mark hijacked
    const valid = mit.verifySession('sess-1', 'user-b');
    if (valid) {
      return fail('T14', ['verifySession() should return false for mismatched identity']);
    }
    if (mit.isSessionValid('sess-1')) {
      return fail('T14', ['session should be invalid after identity mismatch']);
    }

    const detected = await mit.detect(createImmuneSystem(), createPolicyEngine());
    if (!detected) {
      return fail('T14', ['detect() returned false — expected true after session hijack']);
    }

    const result = await mit.mitigate(createImmuneSystem(), createPolicyEngine());
    if (!result.applied) {
      return fail('T14', ['mitigate() did not apply']);
    }
    if (!result.evidence.some((e) => e.includes('session-invalidated'))) {
      return fail('T14', ['mitigate() evidence missing session-invalidated']);
    }

    // Unknown session handling
    if (mit.isSessionValid('unknown-session')) {
      return fail('T14', ['unknown session should not be valid']);
    }
    if (mit.verifySession('unknown-session', 'user-x')) {
      return fail('T14', ['verifySession() should return false for unknown session']);
    }

    return pass('T14', { stats: mit.getStats() });
  },
});

// ── Test Suite ──

describe('Conformance: All 14 Threat Mitigations', () => {
  it('runs all 14 threat mitigation fixtures and expects all to pass', async () => {
    const runner = new ConformanceRunner();
    runner.registerMany([
      fixtureT01,
      fixtureT02,
      fixtureT03,
      fixtureT04,
      fixtureT05,
      fixtureT06,
      fixtureT07,
      fixtureT08,
      fixtureT09,
      fixtureT10,
      fixtureT11,
      fixtureT12,
      fixtureT13,
      fixtureT14,
    ]);

    const report = await runner.runAll();

    // Log individual fixture results for debugging
    for (const f of report.fixtures) {
      if (!f.passed) {
        console.error(`FAIL: ${f.fixtureId} — ${f.failures.join(', ')}`);
      }
    }

    expect(report.total).toBe(14);
    expect(report.passed).toBe(14);
    expect(report.failed).toBe(0);
    expect(report.summary).toContain('14/14');
  });
});

// ── Threat Mitigation Engine Integration ──

describe('ThreatMitigationEngine integration', () => {
  it('tick processes all 14 registered mitigations', async () => {
    const immune = createImmuneSystem();
    const policies = createPolicyEngine();
    const engine = new ThreatMitigationEngine(immune, policies, {
      autoMitigate: true,
      cycleIntervalMs: 100,
      maxMitigationsPerCycle: 20,
    });

    const results = await engine.tick();
    expect(Array.isArray(results)).toBe(true);
    const stats = engine.getStats();
    expect(stats.totalCycles).toBe(1);
    expect(stats.registeredMitigations).toBe(14);
  });

  it('start and stop cycle timer cleanly', () => {
    const engine = new ThreatMitigationEngine(createImmuneSystem(), createPolicyEngine(), {
      autoMitigate: false,
      cycleIntervalMs: 50,
    });

    engine.start();
    expect(engine.getStats().autoMitigate).toBe(false);
    engine.stop();
  });

  it('getHistory returns recent mitigation results', async () => {
    const engine = new ThreatMitigationEngine(createImmuneSystem(), createPolicyEngine(), {
      autoMitigate: true,
      cycleIntervalMs: 100,
    });

    await engine.tick();
    const history = engine.getHistory(5);
    expect(Array.isArray(history)).toBe(true);
  });

  it('supports registering custom mitigations', () => {
    const engine = new ThreatMitigationEngine(createImmuneSystem(), createPolicyEngine());

    const customId = 'T99' as const;
    engine.register({
      id: customId,
      description: 'Custom test mitigation',
      severity: 'low',
      subsystem: 'test',
      isActive: false,
      detect: async () => false,
      mitigate: async () => ({
        applied: false,
        description: 'no-op',
        evidence: [],
      }),
    });

    const registered = engine.get('T99');
    expect(registered).toBeDefined();
    expect(registered!.description).toBe('Custom test mitigation');
  });
});
