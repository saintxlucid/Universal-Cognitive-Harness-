import { describe, it, expect } from 'vitest';
import { CapabilityRegistry, type Capability } from '../capability-registry.js';
import {
  GrantEngine,
  GRANT_SCHEMA_VERSION,
  type IssueGrantRequest,
  type CapabilityScope,
} from '../grants.js';

function sampleGrant(overrides?: Partial<IssueGrantRequest>): IssueGrantRequest {
  return {
    actor: { type: 'agent', id: 'agent-1' },
    scope: { workspace: 'ws-test' },
    operations: ['observe', 'retrieve'],
    ...overrides,
  };
}

function scopeWith(overrides: CapabilityScope = {}): CapabilityScope {
  return { workspace: 'ws-test', ...overrides };
}

describe('GrantEngine.issue', () => {
  it('issues a grant with the CIC schema version and defaults', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant());

    expect(grant.schema_version).toBe(GRANT_SCHEMA_VERSION);
    expect(grant.grant_id).toMatch(/^grant-/);
    expect(grant.actor).toEqual({ type: 'agent', id: 'agent-1' });
    expect(grant.scope).toEqual(scopeWith());
    expect(grant.operations).toEqual(['observe', 'retrieve']);
    expect(grant.revoked).toBe(false);
    expect(grant.expires_at).toBeNull();
    expect(grant.usage).toEqual({ tokens: 0, operations: 0, calls: 0 });
    expect(engine.count()).toBe(1);
  });

  it('issues unique grant ids', () => {
    const engine = new GrantEngine();
    const a = engine.issue(sampleGrant());
    const b = engine.issue(sampleGrant());
    expect(a.grant_id).not.toBe(b.grant_id);
  });

  it('applies ttl as an expiration date', () => {
    const base = new Date('2026-07-31T12:00:00Z');
    const engine = new GrantEngine(() => base);
    const grant = engine.issue(sampleGrant({ ttlMs: 60_000 }));
    expect(grant.expires_at).toEqual(new Date('2026-07-31T12:01:00Z'));
  });

  it('rejects a grant with no operations', () => {
    const engine = new GrantEngine();
    expect(() => engine.issue(sampleGrant({ operations: [] }))).toThrow(
      'grant requires at least one operation',
    );
  });
});

describe('GrantEngine.authorize', () => {
  it('denies an unknown grant id', () => {
    const engine = new GrantEngine();
    const decision = engine.authorize({
      grantId: 'grant-nope',
      operation: 'retrieve',
    });
    expect(decision.granted).toBe(false);
    expect(decision.reason).toContain('no such grant');
  });

  it('denies a revoked grant', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant());
    engine.revoke(grant.grant_id);
    const decision = engine.authorize({ grantId: grant.grant_id, operation: 'retrieve' });
    expect(decision.granted).toBe(false);
    expect(decision.reason).toBe('grant revoked');
  });

  it('denies an expired grant', () => {
    let now = new Date('2026-07-31T12:00:00Z');
    const engine = new GrantEngine(() => now);
    const grant = engine.issue(sampleGrant({ ttlMs: 1_000 }));
    now = new Date('2026-07-31T12:00:02Z');
    const decision = engine.authorize({ grantId: grant.grant_id, operation: 'retrieve' });
    expect(decision.granted).toBe(false);
    expect(decision.reason).toBe('grant expired');
  });

  it('denies an actor that does not hold the grant', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant());
    const decision = engine.authorize({
      grantId: grant.grant_id,
      actor: { type: 'agent', id: 'other-agent' },
      operation: 'retrieve',
    });
    expect(decision.granted).toBe(false);
    expect(decision.reason).toContain('does not hold this grant');
  });

  it('denies an operation outside the grant', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant({ operations: ['observe'] }));
    const decision = engine.authorize({ grantId: grant.grant_id, operation: 'commit' });
    expect(decision.granted).toBe(false);
    expect(decision.reason).toContain('not granted');
  });

  it('authorizes a valid operation and increments usage', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant());
    const decision = engine.authorize({
      grantId: grant.grant_id,
      actor: { type: 'agent', id: 'agent-1' },
      operation: 'retrieve',
      scope: { workspace: 'ws-test' },
      estimatedTokens: 250,
    });
    expect(decision.granted).toBe(true);
    expect(decision.grant?.usage).toEqual({ tokens: 250, operations: 1, calls: 1 });
  });
});

describe('scope cascade (CIC §2.2)', () => {
  it('allows a request scoped inside the granted scope', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant({ scope: { workspace: 'ws-test' } }));

    for (const scope of [
      { workspace: 'ws-test' },
      { project: 'proj-a', workspace: 'ws-test' },
      { branch: 'main', workspace: 'ws-test' },
      { task: 'task-1', workspace: 'ws-test' },
      { session: 'sess-1', workspace: 'ws-test' },
    ]) {
      const decision = engine.authorize({ grantId: grant.grant_id, operation: 'observe', scope });
      expect(decision.granted).toBe(true);
    }
  });

  it('allows a session-scoped grant to authorize at session granularity only', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(
      sampleGrant({ scope: { session: 'sess-1', workspace: 'ws-test' } }),
    );

    const sameSession = engine.authorize({
      grantId: grant.grant_id,
      operation: 'observe',
      scope: { session: 'sess-1' },
    });
    expect(sameSession.granted).toBe(true);

    const otherSession = engine.authorize({
      grantId: grant.grant_id,
      operation: 'observe',
      scope: { session: 'sess-2' },
    });
    expect(otherSession.granted).toBe(false);
    expect(otherSession.reason).toContain('outside the granted scope');
  });

  it('rejects a request broader than the granted scope', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant({ scope: { task: 'task-1' } }));

    const otherTask = engine.authorize({
      grantId: grant.grant_id,
      operation: 'observe',
      scope: { task: 'task-2' },
    });
    expect(otherTask.granted).toBe(false);

    const differentWorkspace = engine.authorize({
      grantId: grant.grant_id,
      operation: 'observe',
      scope: { workspace: 'ws-other' },
    });
    expect(differentWorkspace.granted).toBe(false);
  });
});

describe('rate limit (CIC constraints.rateLimit)', () => {
  it('enforces maxPerSecond', () => {
    let now = new Date('2026-07-31T12:00:00Z');
    const engine = new GrantEngine(() => now);
    const grant = engine.issue(
      sampleGrant({ constraints: { rateLimit: { maxPerSecond: 2 } } }),
    );

    expect(engine.authorize({ grantId: grant.grant_id, operation: 'observe' }).granted).toBe(true);
    expect(engine.authorize({ grantId: grant.grant_id, operation: 'observe' }).granted).toBe(true);
    const denied = engine.authorize({ grantId: grant.grant_id, operation: 'observe' });
    expect(denied.granted).toBe(false);
    expect(denied.reason).toContain('rate limit exceeded');

    now = new Date('2026-07-31T12:00:01.100Z');
    expect(engine.authorize({ grantId: grant.grant_id, operation: 'observe' }).granted).toBe(true);
  });

  it('allows unlimited calls when no rate limit is set', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant());
    for (let i = 0; i < 100; i++) {
      expect(engine.authorize({ grantId: grant.grant_id, operation: 'observe' }).granted).toBe(true);
    }
  });
});

describe('budget (CIC constraints.budget)', () => {
  it('enforces maxTokensPerSession', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(
      sampleGrant({ constraints: { budget: { maxTokensPerSession: 1_000 } } }),
    );

    expect(
      engine.authorize({ grantId: grant.grant_id, operation: 'retrieve', estimatedTokens: 600 }).granted,
    ).toBe(true);
    const denied = engine.authorize({
      grantId: grant.grant_id,
      operation: 'retrieve',
      estimatedTokens: 600,
    });
    expect(denied.granted).toBe(false);
    expect(denied.reason).toContain('session token budget exceeded');
  });

  it('enforces maxTokensPerDay', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(
      sampleGrant({ constraints: { budget: { maxTokensPerDay: 100 } } }),
    );

    expect(
      engine.authorize({ grantId: grant.grant_id, operation: 'retrieve', estimatedTokens: 60 }).granted,
    ).toBe(true);
    const denied = engine.authorize({
      grantId: grant.grant_id,
      operation: 'retrieve',
      estimatedTokens: 60,
    });
    expect(denied.granted).toBe(false);
    expect(denied.reason).toContain('daily token budget exceeded');
  });

  it('enforces maxOperationsPerDay', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(
      sampleGrant({ constraints: { budget: { maxOperationsPerDay: 2 } } }),
    );

    expect(engine.authorize({ grantId: grant.grant_id, operation: 'observe' }).granted).toBe(true);
    expect(engine.authorize({ grantId: grant.grant_id, operation: 'observe' }).granted).toBe(true);
    const denied = engine.authorize({ grantId: grant.grant_id, operation: 'observe' });
    expect(denied.granted).toBe(false);
    expect(denied.reason).toContain('daily operation budget exceeded');
  });
});

describe('retention (CIC constraints.retention)', () => {
  it('allows objects within the retention window', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(
      sampleGrant({ constraints: { retention: { maxAgeDays: 30 } } }),
    );
    const decision = engine.checkRetention(grant.grant_id, 30);
    expect(decision.allowed).toBe(true);
  });

  it('denies objects older than the retention window', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(
      sampleGrant({ constraints: { retention: { maxAgeDays: 30 } } }),
    );
    const decision = engine.checkRetention(grant.grant_id, 31);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('exceeds retention limit');
  });

  it('is permissive when no retention constraint is set', () => {
    const engine = new GrantEngine();
    const grant = engine.issue(sampleGrant());
    expect(engine.checkRetention(grant.grant_id, 10_000).allowed).toBe(true);
  });

  it('reports an unknown grant', () => {
    const engine = new GrantEngine();
    expect(engine.checkRetention('grant-nope', 1).allowed).toBe(false);
  });
});

describe('GrantEngine revoke/list', () => {
  it('revoke returns false for unknown grants and stops tracking', () => {
    const engine = new GrantEngine();
    expect(engine.revoke('grant-nope')).toBe(false);

    const grant = engine.issue(sampleGrant());
    expect(engine.revoke(grant.grant_id)).toBe(true);
    expect(engine.revoke(grant.grant_id)).toBe(true);
    expect(engine.get(grant.grant_id)?.revoked).toBe(true);
  });

  it('listActive excludes revoked and expired grants', () => {
    let now = new Date('2026-07-31T12:00:00Z');
    const engine = new GrantEngine(() => now);
    const live = engine.issue(sampleGrant());
    engine.issue(sampleGrant({ ttlMs: 1_000 }));
    const revoked = engine.issue(sampleGrant());

    now = new Date('2026-07-31T12:00:05Z');
    engine.revoke(revoked.grant_id);

    const active = engine.listActive().map((g) => g.grant_id);
    expect(active).toEqual([live.grant_id]);
    expect(engine.list()).toHaveLength(3);
  });
});

describe('CapabilityRegistry scoped semantics', () => {
  const scopedCapability: Capability = {
    name: 'memory',
    version: '1.0.0',
    description: 'Episodic memory access',
    requires: [],
    provides: ['memory'],
    enabled: true,
    scope: { workspace: '*' },
    authority: ['observe', 'retrieve', 'propose', 'consolidate'],
    cost: {
      maxTokensPerDay: 100_000,
      maxTokensPerSession: 10_000,
      maxOperationsPerDay: 1_000,
    },
    retention: { maxAgeDays: 90 },
  };

  it('stores and returns scope, authority, cost, and retention', () => {
    const registry = new CapabilityRegistry();
    registry.register(scopedCapability);

    expect(registry.getScope('memory')).toEqual({ workspace: '*' });
    expect(registry.getAuthority('memory')).toEqual([
      'observe',
      'retrieve',
      'propose',
      'consolidate',
    ]);
    expect(registry.getCost('memory')).toEqual({
      maxTokensPerDay: 100_000,
      maxTokensPerSession: 10_000,
      maxOperationsPerDay: 1_000,
    });
    expect(registry.getRetention('memory')).toEqual({ maxAgeDays: 90 });
  });

  it('returns defaults for capabilities without declared semantics', () => {
    const registry = new CapabilityRegistry();
    registry.register({
      name: 'plain',
      version: '1.0.0',
      description: '',
      requires: [],
      provides: ['plain'],
      enabled: true,
    });

    expect(registry.getScope('plain')).toBeUndefined();
    expect(registry.getAuthority('plain')).toEqual([]);
    expect(registry.getCost('plain')).toBeUndefined();
    expect(registry.getRetention('plain')).toBeUndefined();
  });

  it('returns undefined for unknown capabilities', () => {
    const registry = new CapabilityRegistry();
    expect(registry.getScope('nope')).toBeUndefined();
    expect(registry.getAuthority('nope')).toEqual([]);
    expect(registry.getCost('nope')).toBeUndefined();
    expect(registry.getRetention('nope')).toBeUndefined();
  });

  it('checks dependencies against enabled capabilities', () => {
    const registry = new CapabilityRegistry();
    registry.register({ ...scopedCapability, name: 'base' });
    registry.register({
      name: 'dependent',
      version: '1.0.0',
      description: '',
      requires: ['base'],
      provides: ['dependent'],
      enabled: true,
    });
    registry.register({
      name: 'broken',
      version: '1.0.0',
      description: '',
      requires: ['missing-cap'],
      provides: ['broken'],
      enabled: true,
    });

    expect(registry.checkDependency('dependent').satisfied).toBe(true);
    const broken = registry.checkDependency('broken');
    expect(broken.satisfied).toBe(false);
    expect(broken.missing).toEqual(['missing-cap']);
  });

  it('getEnabled filters disabled capabilities', () => {
    const registry = new CapabilityRegistry();
    registry.register({ ...scopedCapability, name: 'on' });
    registry.register({ ...scopedCapability, name: 'off', enabled: false });

    expect(registry.getEnabled().map((c) => c.name)).toEqual(['on']);
  });
});
