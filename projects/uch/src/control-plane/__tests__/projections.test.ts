import { describe, it, expect } from 'vitest';
import { ProjectionEngine, projectScope, type WorkspaceState } from '../projections.js';
import { GrantEngine, type CapabilityGrant } from '../../cognitive-runtime/grants.js';
import { createStandardCapabilityRegistry } from '../../workspace-manifest/attach.js';
import { attach } from '../../workspace-manifest/attach.js';
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

function sampleState(): WorkspaceState {
  return {
    workspace_id: 'ws-test',
    projects: ['proj-a', 'proj-b'],
    branches: {
      'proj-a': ['main-a', 'feature-x'],
      'proj-b': ['main-b'],
    },
    tasks: {
      'main-a': ['task-1', 'task-2'],
      'feature-x': ['task-3'],
      'main-b': ['task-4'],
    },
    sessions: {
      'task-1': ['sess-1a', 'sess-1b'],
      'task-2': ['sess-2a'],
      'task-3': ['sess-3a'],
      'task-4': ['sess-4a'],
    },
    capabilities: ['memory', 'knowledge', 'skills', 'deployment'],
  };
}

function grantWith(engine: GrantEngine, scope: Parameters<GrantEngine['issue']>[0]['scope'], operations?: string[]): CapabilityGrant {
  return engine.issue({
    actor: { type: 'agent', id: 'agent-1' },
    scope,
    operations: (operations ?? ['observe', 'retrieve']) as CapabilityGrant['operations'],
  });
}

describe('projectScope — containment', () => {
  it('workspace-scoped grant sees the full state', () => {
    const visible = projectScope({ workspace: 'ws-test' }, sampleState());
    expect(visible.projects).toEqual(['proj-a', 'proj-b']);
    expect(visible.branches).toEqual(['main-a', 'feature-x', 'main-b']);
    expect(visible.tasks).toEqual(['task-1', 'task-2', 'task-3', 'task-4']);
    expect(visible.sessions).toEqual(['sess-1a', 'sess-1b', 'sess-2a', 'sess-3a', 'sess-4a']);
  });

  it('project-scoped grant sees only that project subtree', () => {
    const visible = projectScope({ project: 'proj-a', workspace: 'ws-test' }, sampleState());
    expect(visible.projects).toEqual(['proj-a']);
    expect(visible.branches).toEqual(['main-a', 'feature-x']);
    expect(visible.tasks).toEqual(['task-1', 'task-2', 'task-3']);
    expect(visible.sessions).toEqual(['sess-1a', 'sess-1b', 'sess-2a', 'sess-3a']);
    expect(visible.sessions).not.toContain('sess-4a');
  });

  it('task-scoped grant sees only that task and its ancestors and sessions', () => {
    const visible = projectScope({ task: 'task-2', workspace: 'ws-test' }, sampleState());
    expect(visible.projects).toEqual(['proj-a']);
    expect(visible.branches).toEqual(['main-a']);
    expect(visible.tasks).toEqual(['task-2']);
    expect(visible.sessions).toEqual(['sess-2a']);
  });

  it('session-scoped grant sees only that session and its ancestors', () => {
    const visible = projectScope({ session: 'sess-1b', workspace: 'ws-test' }, sampleState());
    expect(visible.projects).toEqual(['proj-a']);
    expect(visible.branches).toEqual(['main-a']);
    expect(visible.tasks).toEqual(['task-1']);
    expect(visible.sessions).toEqual(['sess-1b']);
  });

  it('a pin unknown to the state sees nothing', () => {
    expect(projectScope({ session: 'ghost-session', workspace: 'ws-test' }, sampleState())).toEqual(
      { projects: [], branches: [], tasks: [], sessions: [] },
    );
    expect(projectScope({ task: 'ghost-task', workspace: 'ws-test' }, sampleState())).toEqual(
      { projects: [], branches: [], tasks: [], sessions: [] },
    );
  });

  it('grants for another workspace see nothing', () => {
    const visible = projectScope({ workspace: 'ws-other' }, sampleState());
    expect(visible).toEqual({ projects: [], branches: [], tasks: [], sessions: [] });
  });
});

describe('ProjectionEngine — capability authority intersection', () => {
  const engine = new ProjectionEngine({ capabilityRegistry: createStandardCapabilityRegistry() });

  function project(operations: string[], scope?: Parameters<GrantEngine['issue']>[0]['scope']) {
    const grants = new GrantEngine();
    return engine.project(
      grantWith(grants, scope ?? { workspace: 'ws-test' }, operations),
      sampleState(),
    );
  }

  it('includes only capabilities with at least one granted operation family', () => {
    const p = project(['observe', 'retrieve']);
    const names = p.capabilities.map((c) => c.name);
    expect(names).toContain('memory');
    expect(names).toContain('knowledge');
    expect(names).toContain('skills');
    expect(names).not.toContain('deployment'); // deployment authority is propose/commit only

    const memory = p.capabilities.find((c) => c.name === 'memory')!;
    expect(memory.operations).toEqual(['observe', 'retrieve']);
  });

  it('excludes every capability when the grant shares no operation families', () => {
    // 'delegate' is authorized by no capability in the sample state.
    const p = project(['delegate']);
    expect(p.capabilities).toEqual([]);
  });

  it('carries declared cost and retention on the projection', () => {
    const p = project(['observe', 'retrieve']);
    const memory = p.capabilities.find((c) => c.name === 'memory')!;
    expect(memory.cost?.maxTokensPerDay).toBe(100_000);
    expect(memory.retention?.maxAgeDays).toBe(90);
  });

  it('projects the granted scope, never a wider one', () => {
    const p = project(['observe'], { task: 'task-2', workspace: 'ws-test' });
    expect(p.scope).toEqual({ task: 'task-2', workspace: 'ws-test' });
    expect(p.visible.tasks).toEqual(['task-2']);
  });
});

describe('ProjectionEngine.projectAll', () => {
  it('projects one view per grant holder', () => {
    const grants = new GrantEngine();
    const broad = grantWith(grants, { workspace: 'ws-test' });
    const narrow = grantWith(grants, { task: 'task-2', workspace: 'ws-test' });
    const engine = new ProjectionEngine({ capabilityRegistry: createStandardCapabilityRegistry() });

    const projections = engine.projectAll([broad, narrow], sampleState());
    expect(projections).toHaveLength(2);
    expect(projections[0]!.visible.sessions).toHaveLength(5);
    expect(projections[1]!.visible.sessions).toEqual(['sess-2a']);
  });
});

describe('attach wiring — two clients, different projections (ADR-001 criterion #4)', () => {
  it('issues different projections of the same workspace state to two clients', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-proj-'));
    writeManifest(dir, sampleManifest());

    const clientA = await attach({
      agent_id: 'client-a',
      startDir: dir,
      workspaceState: sampleState(),
    });
    const clientB = await attach({
      agent_id: 'client-b',
      startDir: dir,
      workspaceState: sampleState(),
      grantScope: { task: 'task-2' },
    });

    expect(clientA.attached).toBe(true);
    expect(clientB.attached).toBe(true);
    expect(clientA.projection).toBeDefined();
    expect(clientB.projection).toBeDefined();

    const a = clientA.projection!;
    const b = clientB.projection!;

    expect(a.workspace_id).toBe('ws-test');
    expect(b.workspace_id).toBe('ws-test');
    expect(a.grant_id).not.toBe(b.grant_id);

    expect(a.visible.sessions).toEqual(['sess-1a', 'sess-1b', 'sess-2a', 'sess-3a', 'sess-4a']);
    expect(b.visible.tasks).toEqual(['task-2']);
    expect(b.visible.sessions).toEqual(['sess-2a']);

    const allContained = b.visible.sessions.every((s) => a.visible.sessions.includes(s));
    expect(allContained).toBe(true);
    expect(b.visible.sessions.length).toBeLessThan(a.visible.sessions.length);

    const bCapNames = b.capabilities.map((c) => c.name);
    const aCapNames = a.capabilities.map((c) => c.name);
    expect(bCapNames.every((n) => aCapNames.includes(n))).toBe(true);
    expect(bCapNames).toContain('memory');
  });

  it('omits the projection when no workspace state is provided', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-proj-nostate-'));
    writeManifest(dir, sampleManifest());
    const result = await attach({ agent_id: 'client-a', startDir: dir });
    expect(result.attached).toBe(true);
    expect(result.projection).toBeUndefined();
  });

  it('keeps grant scopes per-client and independent', async () => {
    const grants = new GrantEngine();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-proj-grants-'));
    writeManifest(dir, sampleManifest());

    const engine = new ProjectionEngine({ capabilityRegistry: createStandardCapabilityRegistry() });
    const grantA = grantWith(grants, { workspace: 'ws-test' }, ['observe']);
    const grantB = grantWith(grants, { session: 'sess-1b', workspace: 'ws-test' }, ['retrieve']);

    const pa = engine.project(grantA, sampleState());
    const pb = engine.project(grantB, sampleState());

    expect(pa.visible.sessions).toHaveLength(5);
    expect(pb.visible.sessions).toEqual(['sess-1b']);
    expect(pa.actor.id).toBe('agent-1');
    expect(pb.actor.id).toBe('agent-1');
  });
});
