import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CognitiveCore } from '../cognitive-core/cognitive-core.js';
import { PolicyEngine } from '../control-plane/policies.js';
import { Auth } from '../control-plane/auth/auth.js';
import { ReflexEngine } from '../suit/instinct/reflex-engine.js';

const TEST_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('CognitiveCore', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-core-'));
  });

  afterEach(async () => {
    await new Promise((r) => setTimeout(r, 10));
    rmSync(dir, { recursive: true, force: true });
  });

  it('constructs without any LLM or driver configuration', () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    expect(core).toBeDefined();
  });

  it('exposes the full organ surface', () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    expect(core.eventBus).toBeDefined();
    expect(core.nervousSystem).toBeDefined();
    expect(core.metabolism).toBeDefined();
    expect(core.consciousness).toBeDefined();
    expect(core.aether).toBeDefined();
    expect(core.kernel).toBeDefined();
    expect(core.workspace).toBeDefined();
    expect(core.executive).toBeDefined();
    expect(core.traceRecorder).toBeDefined();
    expect(core.replay).toBeDefined();
    expect(core.signals).toBeDefined();
    expect(core.persistence).toBeDefined();
    expect(core.immuneSystem).toBeDefined();
    expect(core.endocrineSystem).toBeDefined();
    expect(core.sleepCycle).toBeDefined();
    expect(core.actionSelector).toBeDefined();
    expect(core.connectome).toBeDefined();
    expect(core.hippocampus).toBeDefined();
    expect(core.neocortex).toBeDefined();
    expect(core.cortexKernel).toBeDefined();
    expect(core.policies).toBeDefined();
    expect(core.auth).toBeDefined();
  });

  it('registers exactly the six metabolism components', () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    const names = core.metabolism.getAllBudgets().map((b) => b.componentId);
    expect(names).toEqual(['exoskeleton', 'aether', 'endocrine', 'immune', 'sleep-cycle', 'reflex']);
  });

  it('registers endocrine, immune, hippocampus on the aether', () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    const subsystems = core.aether.getState().subsystems;
    expect(subsystems).toContain('endocrine');
    expect(subsystems).toContain('immune');
    expect(subsystems).toContain('hippocampus');
  });

  it('uses the configured agentId as kernel provenance', async () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
      agentId: 'exoskeleton',
    });
    await core.kernel.remember({
      content: { type: 'text', text: 'agent-probe' },
      provenance: { source: 'test', reliability: 0.5 },
    });
    expect(core.kernel.getRecentEpisodes(1)[0]!.agent_id).toBe('exoskeleton');
  });

  it('defaults the kernel agentId to cognitive-core', async () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    await core.kernel.remember({
      content: { type: 'text', text: 'agent-probe-default' },
      provenance: { source: 'test', reliability: 0.5 },
    });
    expect(core.kernel.getRecentEpisodes(1)[0]!.agent_id).toBe('cognitive-core');
  });

  it('wires the connectome boot seeds', async () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(core.connectome.getConnections().length).toBeGreaterThanOrEqual(2);
    expect(core.connectome.getNodes()).toContain('eventBus');
    expect(core.connectome.getNodes()).toContain('traceRecorder');
  });

  it('accepts injected governance instances', () => {
    const policies = new PolicyEngine();
    const auth = new Auth();
    const reflex = new ReflexEngine();
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
      policies,
      auth,
      reflexEngine: reflex,
    });
    expect(core.policies).toBe(policies);
    expect(core.auth).toBe(auth);
    expect(core.immuneSystem).toBeDefined();
  });

  it('creates fresh governance defaults when nothing is injected', () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    expect(core.policies).toBeDefined();
    expect(core.auth).toBeDefined();
    expect(core.immuneSystem).toBeDefined();
  });

  it('starts and stops cleanly', async () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    await core.start();
    expect(core.getState().running).toBe(true);
    expect(core.getState().startedAt).not.toBeNull();
    expect(core.aether.getState().running).toBe(true);
    await core.stop();
    expect(core.getState().running).toBe(false);
    expect(core.aether.getState().running).toBe(false);
  });

  it('emits aether:started on start', async () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    const received: string[] = [];
    core.eventBus.subscribe('aether:started', (event) => {
      received.push(event.type);
    });
    await core.start();
    expect(received).toContain('aether:started');
    await core.stop();
  });

  it('reports cognitive stats', async () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    await core.start();
    await core.stop();
    const stats = core.getStats();
    expect(stats).toHaveProperty('aether');
    expect(stats).toHaveProperty('nervousSystem');
    expect(stats).toHaveProperty('metabolism');
    expect(stats).toHaveProperty('endocrine');
    expect(stats).toHaveProperty('immune');
    expect(stats).toHaveProperty('sleep');
    expect(stats).toHaveProperty('connectome');
    expect(stats).toHaveProperty('actionSelector');
    expect(stats).toHaveProperty('hippocampus');
    expect(stats).toHaveProperty('neocortex');
    expect(typeof stats.aether).toBe('object');
    expect(typeof stats.connectome).toBe('number');
  });

  it('persists the trace file to the workspace root', async () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
      traceFile: join(dir, 'traces.jsonl'),
    });
    await core.start();
    await new Promise((r) => setTimeout(r, 10));
    expect(existsSync(join(dir, 'traces.jsonl'))).toBe(true);
    await core.stop();
  });

  it('exposes replay and signals over the trace ledger', async () => {
    const core = new CognitiveCore({
      workspaceId: 'ws-core',
      workspaceName: 'Core Test',
      workspaceRoot: dir,
    });
    await core.start();
    const replayed = core.replay.getProjectTimeline();
    const listed = core.signals.getRecent();
    expect(Array.isArray(replayed)).toBe(true);
    expect(Array.isArray(listed)).toBe(true);
    await core.stop();
  });
});

describe('Import firewall', () => {
  it('blocks llm, agentic, drivers, and exoskeleton imports', async () => {
    const files = ['cognitive-core.ts', 'index.ts', 'immune.ts', 'endocrine.ts'];
    const forbidden = ['../llm/', '../agentic/', '../drivers/', '../exoskeleton/'];
    for (const file of files) {
      const source = await readFile(join(TEST_ROOT, 'src/cognitive-core', file), 'utf8');
      const importLines = source.split('\n').filter((l) => l.includes("from '../"));
      for (const line of importLines) {
        for (const prefix of forbidden) {
          expect(line.includes(prefix), `${file} must not import ${prefix}`).toBe(false);
        }
        if (line.includes('../suit/')) {
          expect(
            line,
            `${file} may only import the reflex-engine leaf from suit/`,
          ).toContain('../suit/instinct/reflex-engine.js');
        }
      }
    }
  });
});
