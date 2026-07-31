import { describe, it, expect } from 'vitest';
import { EventGovernance } from '../event-governance.js';
import { PolicyEngine } from '../policies.js';
import { GrantEngine } from '../../cognitive-runtime/grants.js';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { attach, detach, createStandardCapabilityRegistry } from '../../workspace-manifest/attach.js';
import { writeManifest } from '../../workspace-manifest/loader.js';
import { MANIFEST_SCHEMA_VERSION, type WorkspaceManifest } from '../../workspace-manifest/manifest.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function sampleManifest(): WorkspaceManifest {
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    manifest_version: '0.1.0',
    workspace: { id: 'ws-test', name: 'test-workspace', purpose: 'testing' },
    runtime: { min_uch_version: '0.1.0' },
    capabilities: [{ name: 'memory', enabled: true }],
    drivers: [],
  };
}

function issueGrant(engine: GrantEngine, overrides?: Parameters<GrantEngine['issue']>[0]['scope']) {
  return engine.issue({
    actor: { type: 'agent', id: 'agent-1' },
    scope: overrides ?? { workspace: 'ws-test' },
    operations: ['observe', 'retrieve'],
  });
}

function driverObservation(overrides?: Record<string, unknown>) {
  return {
    event_id: 'git-commit-abc123',
    type: 'git:commit',
    source: 'agent-1',
    driver_id: 'git',
    source_authority: 'git',
    scope: { workspace: 'ws-test' },
    payload: { hash: 'abc123', message: 'fix: something' },
    ...overrides,
  };
}

describe('EventGovernance — provenance', () => {
  it('admits a driver observation and attaches a provenance link', () => {
    const governance = new EventGovernance();
    const decision = governance.admit(driverObservation());

    expect(decision.admitted).toBe(true);
    const event = decision.governed!;
    expect(event.provenance).toEqual({
      event_id: 'git-commit-abc123',
      driver_id: 'git',
      source_authority: 'git',
      emitted_at: event.timestamp,
    });
    expect(event.scope).toEqual({ workspace: 'ws-test' });
    expect(governance.admissionCount).toBe(1);
    expect(governance.events()).toHaveLength(1);
  });

  it('chains causal predecessors through parent_id', () => {
    const governance = new EventGovernance();
    governance.admit(driverObservation({ event_id: 'git:commit-1' }));
    const child = governance.admit(
      driverObservation({ event_id: 'git:commit-2', parent_id: 'git:commit-1' }),
    );

    expect(child.governed?.provenance.parent_id).toBe('git:commit-1');
    const [first, second] = governance.events();
    expect(first?.provenance.event_id).toBe('git:commit-1');
    expect(second?.provenance.event_id).toBe('git:commit-2');
    expect(second?.provenance.parent_id).toBe('git:commit-1');
  });

  it('publishes admitted events on the bus with provenance metadata', async () => {
    const bus = new NeuralEventBus();
    const governance = new EventGovernance({ eventBus: bus });
    const published: string[] = [];
    bus.subscribe('git:commit', (e) => published.push(e.id));

    const decision = await governance.admitAndPublish(driverObservation());
    expect(decision.admitted).toBe(true);
    expect(published).toHaveLength(1);
    const busEvent = bus.getHistory('git:commit')[0]!;
    const metadata = busEvent.metadata! as Record<string, unknown>;
    expect(metadata['governed']).toBe(true);
    expect((metadata['provenance'] as { driver_id: string }).driver_id).toBe('git');
  });
});

describe('EventGovernance — idempotency', () => {
  it('drops replayed events with the same event_id', async () => {
    const bus = new NeuralEventBus();
    const governance = new EventGovernance({ eventBus: bus });
    const published: string[] = [];
    bus.subscribe('git:commit', (e) => published.push(e.id));

    const first = await governance.admitAndPublish(driverObservation());
    const replay = await governance.admitAndPublish(driverObservation());

    expect(first.admitted).toBe(true);
    expect(replay.admitted).toBe(false);
    expect(replay.duplicate).toBe(true);
    expect(replay.reason).toContain('duplicate');
    expect(published).toHaveLength(1);
    expect(governance.duplicateCount).toBe(1);
    expect(governance.ledger().map((r) => r.decision)).toEqual(['admitted', 'duplicate']);
  });

  it('treats distinct event ids as distinct events', () => {
    const governance = new EventGovernance();
    governance.admit(driverObservation({ event_id: 'evt-1' }));
    const second = governance.admit(driverObservation({ event_id: 'evt-2' }));
    expect(second.admitted).toBe(true);
    expect(governance.duplicateCount).toBe(0);
  });
});

describe('EventGovernance — policy checks', () => {
  it('denies events blocked by a policy rule and records the denial', async () => {
    const bus = new NeuralEventBus();
    const policy = new PolicyEngine();
    policy.addRule({
      id: 'deny-deploy',
      effect: 'deny',
      principals: ['agent-1'],
      actions: ['deployment:*'],
      resources: ['*'],
      priority: 10,
    });
    const governance = new EventGovernance({ policyEngine: policy, eventBus: bus });
    const deniedEvents: string[] = [];
    bus.subscribe('governance:event_denied', (e) => deniedEvents.push(e.id));

    const decision = await governance.admitAndPublish(
      driverObservation({ event_id: 'dep-1', type: 'deployment:started', scope: { workspace: 'ws-test' } }),
    );

    expect(decision.admitted).toBe(false);
    expect(decision.reason).toContain('denied by policy rule deny-deploy');
    expect(governance.denialCount).toBe(1);
    expect(governance.denials()[0]?.reason).toContain('deny-deploy');
    expect(deniedEvents).toHaveLength(1);
    expect(bus.getHistory('governance:event_denied')[0]?.payload).toMatchObject({
      event_id: 'dep-1',
      type: 'deployment:started',
      source: 'agent-1',
    });
  });

  it('default-denies when a policy engine is present but no rule matches', () => {
    const governance = new EventGovernance({ policyEngine: new PolicyEngine() });
    const decision = governance.admit(driverObservation());
    expect(decision.admitted).toBe(false);
    expect(decision.reason).toContain('default deny');
  });

  it('allows events matching an explicit allow rule', () => {
    const policy = new PolicyEngine();
    policy.addRule({
      id: 'allow-git',
      effect: 'allow',
      principals: ['agent-1'],
      actions: ['git:*'],
      resources: ['*'],
      priority: 5,
    });
    const governance = new EventGovernance({ policyEngine: policy });
    const decision = governance.admit(driverObservation());
    expect(decision.admitted).toBe(true);
  });

  it('evaluates policy against the workspace resource', () => {
    const policy = new PolicyEngine();
    policy.addRule({
      id: 'allow-ws-test-only',
      effect: 'allow',
      principals: ['*'],
      actions: ['*'],
      resources: ['ws-test'],
      priority: 5,
    });
    const governance = new EventGovernance({ policyEngine: policy });
    expect(governance.admit(driverObservation()).admitted).toBe(true);
    expect(
      governance.admit(driverObservation({ event_id: 'evt-x', scope: { workspace: 'ws-other' } })).admitted,
    ).toBe(false);
  });
});

describe('EventGovernance — grant checks (cross-project isolation)', () => {
  it('denies observations outside the grant scope', () => {
    const grants = new GrantEngine();
    const grant = issueGrant(grants);
    const governance = new EventGovernance({ grantEngine: grants });

    const inside = governance.admit(
      driverObservation({ grant_id: grant.grant_id, actor: { type: 'agent', id: 'agent-1' } }),
    );
    expect(inside.admitted).toBe(true);

    const outside = governance.admit(
      driverObservation({
        event_id: 'git-commit-other',
        grant_id: grant.grant_id,
        actor: { type: 'agent', id: 'agent-1' },
        scope: { workspace: 'ws-other' },
      }),
    );
    expect(outside.admitted).toBe(false);
    expect(outside.reason).toContain('denied by grant');
  });

  it('denies observations after the grant is revoked (deletion propagation)', () => {
    const grants = new GrantEngine();
    const grant = issueGrant(grants);
    const governance = new EventGovernance({ grantEngine: grants });

    expect(
      governance.admit(driverObservation({ grant_id: grant.grant_id })).admitted,
    ).toBe(true);

    grants.revoke(grant.grant_id);
    const after = governance.admit(
      driverObservation({ event_id: 'git-commit-2', grant_id: grant.grant_id }),
    );
    expect(after.admitted).toBe(false);
    expect(after.reason).toContain('grant revoked');
  });

  it('enforces grant budget on the observation path', () => {
    const grants = new GrantEngine();
    const grant = grants.issue({
      actor: { type: 'agent', id: 'agent-1' },
      scope: { workspace: 'ws-test' },
      operations: ['observe'],
      constraints: { budget: { maxOperationsPerDay: 1 } },
    });
    const governance = new EventGovernance({ grantEngine: grants });

    expect(governance.admit(driverObservation({ grant_id: grant.grant_id })).admitted).toBe(true);
    const exhausted = governance.admit(
      driverObservation({ event_id: 'git-commit-2', grant_id: grant.grant_id }),
    );
    expect(exhausted.admitted).toBe(false);
    expect(exhausted.reason).toContain('denied by grant');
  });
});

describe('EventGovernance — staleness', () => {
  it('rejects observations older than the configured window', () => {
    const governance = new EventGovernance({ maxEventAgeMs: 60_000 });
    const fresh = governance.admit(driverObservation({ timestamp: new Date(Date.now() - 30_000) }));
    expect(fresh.admitted).toBe(true);

    const stale = governance.admit(
      driverObservation({ event_id: 'git-commit-old', timestamp: new Date(Date.now() - 120_000) }),
    );
    expect(stale.admitted).toBe(false);
    expect(stale.stale).toBe(true);
    expect(stale.reason).toContain('stale event');
    expect(governance.denialCount).toBe(1);
  });
});

describe('EventGovernance — observability', () => {
  it('keeps an audit ledger with counts', () => {
    const governance = new EventGovernance();
    governance.admit(driverObservation({ event_id: 'evt-1' }));
    governance.admit(driverObservation({ event_id: 'evt-1' }));

    expect(governance.admissionCount).toBe(1);
    expect(governance.duplicateCount).toBe(1);
    expect(governance.ledger().map((r) => r.decision)).toEqual(['admitted', 'duplicate']);
  });

  it('caps the ledger and seen-set at maxLedger', () => {
    const governance = new EventGovernance({ maxLedger: 5 });
    for (let i = 0; i < 10; i++) {
      governance.admit(driverObservation({ event_id: `evt-${i}` }));
    }
    expect(governance.ledger()).toHaveLength(5);
    expect(governance.admissionCount).toBe(10);
  });
});

describe('EventGovernance — attach wiring', () => {
  it('routes lifecycle events through the session governance gate', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-gov-'));
    writeManifest(dir, sampleManifest());
    const eventBus = new NeuralEventBus();
    const grantEngine = new GrantEngine();

    const result = await attach({
      agent_id: 'test-agent',
      startDir: dir,
      eventBus,
      grantEngine,
      capabilityRegistry: createStandardCapabilityRegistry(),
    });

    expect(result.attached).toBe(true);
    expect(result.governance).toBeDefined();
    expect(result.grant).toBeDefined();

    const ledgerDecisions = result.governance!.ledger().map((r) => r.decision);
    expect(ledgerDecisions).toContain('admitted');
    expect(ledgerDecisions).toHaveLength(2);

    const opened = eventBus.getHistory('workspace:opened')[0]!;
    expect(opened.metadata?.['governed']).toBe(true);
    expect((opened.metadata?.['provenance'] as { driver_id: string }).driver_id).toBe('workspace-manifest');

    const observation = await result.governance!.admitAndPublish({
      event_id: 'git-commit-1',
      type: 'git:commit',
      source: 'test-agent',
      driver_id: 'git',
      scope: { workspace: 'ws-test' },
      grant_id: result.grant!.grant_id,
      actor: { type: 'agent', id: 'test-agent' },
    });
    expect(observation.admitted).toBe(true);
    expect(eventBus.getHistory('git:commit')).toHaveLength(1);

    const crossProject = await result.governance!.admitAndPublish({
      event_id: 'git-commit-2',
      type: 'git:commit',
      source: 'test-agent',
      driver_id: 'git',
      scope: { workspace: 'ws-other' },
      grant_id: result.grant!.grant_id,
      actor: { type: 'agent', id: 'test-agent' },
    });
    expect(crossProject.admitted).toBe(false);
    expect(result.governance!.denialCount).toBe(1);

    await detach(result, { eventBus, grantEngine });
  });
});
