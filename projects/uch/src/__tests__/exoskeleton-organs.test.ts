import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CognitiveExoskeleton } from '../exoskeleton/exoskeleton.js';
import { Connectome } from '../connectome/wiring.js';
import { ActionSelector } from '../basal_ganglia/action-selector.js';
import { Neocortex } from '../neocortex/pattern-learner.js';
import { CortexKernel } from '../cortex_kernel/integrator.js';
import { Consciousness } from '../aether/consciousness.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { NervousSystem } from '../nervous-system/nervous-system.js';
import { EndocrineSystem } from '../cognitive-core/endocrine.js';
import { ImmuneSystem } from '../cognitive-core/immune.js';
import { PolicyEngine } from '../control-plane/policies.js';
import { Auth } from '../control-plane/auth/auth.js';
import { ReflexEngine } from '../suit/instinct/reflex-engine.js';
import { SleepCycle, type SleepMemorySource, type DistilledSkill, type SleepSkillSink } from '../sleep_cycle/cycle.js';
import { AetherCore } from '../aether/aether-core.js';

describe('Connectome', () => {
  let c: Connectome;

  beforeEach(() => {
    c = new Connectome();
  });

  it('registers and retrieves connections', () => {
    c.registerConnection({
      from: 'a', to: 'b', type: 'event-driven', description: 'test',
    });
    expect(c.getConnections()).toHaveLength(1);
    expect(c.getConnectionsFrom('a')).toHaveLength(1);
    expect(c.getConnectionsTo('b')).toHaveLength(1);
  });

  it('removes connections', () => {
    const id = c.registerConnection({
      from: 'x', to: 'y', type: 'control', description: 'test',
    });
    expect(c.removeConnection(id)).toBe(true);
    expect(c.getConnections()).toHaveLength(0);
  });

  it('finds paths between nodes', () => {
    c.registerConnection({ from: 'a', to: 'b', type: 'data-flow', description: '' });
    c.registerConnection({ from: 'b', to: 'c', type: 'data-flow', description: '' });
    c.registerConnection({ from: 'a', to: 'c', type: 'data-flow', description: '' });
    const paths = c.findPaths('a', 'c');
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it('returns stats', () => {
    c.registerConnection({ from: 'a', to: 'b', type: 'event-driven', description: '' });
    const stats = c.getStats();
    expect(stats.totalConnections).toBe(1);
  });
});

describe('ActionSelector', () => {
  let sel: ActionSelector;

  beforeEach(() => {
    sel = new ActionSelector();
  });

  it('enqueues and selects actions by priority', () => {
    sel.enqueue({ name: 'low', priority: 1, estimatedCost: 0.1, dependencies: [], handler: async () => {} });
    sel.enqueue({ name: 'high', priority: 10, estimatedCost: 0.1, dependencies: [], handler: async () => {} });
    const result = sel.select();
    expect(result.selected?.name).toBe('high');
  });

  it('respects resource budget', () => {
    sel.enqueue({ name: 'expensive', priority: 10, estimatedCost: 0.9, dependencies: [], handler: async () => {} });
    const result = sel.select(0.5);
    expect(result.selected).toBeNull();
  });

  it('tracks in-flight actions', () => {
    const id = sel.enqueue({ name: 'test', priority: 5, estimatedCost: 0.1, dependencies: [], handler: async () => {} });
    sel.select();
    expect(sel.getInFlight()).toHaveLength(1);
    sel.complete(id);
    expect(sel.getInFlight()).toHaveLength(0);
  });

  it('returns stats', () => {
    sel.enqueue({ name: 'a', priority: 1, estimatedCost: 0.1, dependencies: [], handler: async () => {} });
    const stats = sel.getStats();
    expect(stats.queued).toBe(1);
  });
});

describe('Neocortex', () => {
  let nc: Neocortex;

  beforeEach(() => {
    nc = new Neocortex();
  });

  it('learns and retrieves patterns', () => {
    nc.learnPattern('circular-dependency', 'architecture');
    nc.learnPattern('circular-dependency', 'architecture');
    const related = nc.findRelated('architecture');
    expect(related.length).toBeGreaterThanOrEqual(1);
    expect(related[0]!.observed).toBe(2);
  });

  it('registers and uses skills', () => {
    const id = nc.registerSkill('refactoring', 'engineering');
    nc.useSkill(id);
    nc.useSkill(id);
    const skills = nc.getSkills();
    expect(skills[0]!.proficiency).toBeGreaterThan(0.1);
  });

  it('returns status', () => {
    nc.learnPattern('test', 'ctx');
    const status = nc.getStatus();
    expect(status.patterns).toBe(1);
  });
});

describe('CortexKernel', () => {
  let cons: Consciousness;
  let ck: CortexKernel;
  let kernel: CognitiveKernel;
  let execBrain: ExecutiveBrain;
  let bus: NeuralEventBus;

  beforeEach(() => {
    cons = new Consciousness();
    kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    bus = new NeuralEventBus();
    execBrain = new ExecutiveBrain({ eventBus: bus });
    ck = new CortexKernel(cons, kernel, execBrain, bus);
  });

  it('produces insights from reflex layer', () => {
    for (let i = 0; i < 10; i++) {
      cons.observe('reflex', `alert-${i}`, 'test');
    }
    const insights = ck.integrate();
    expect(insights.length).toBeGreaterThanOrEqual(1);
  });

  it('returns insights', () => {
    ck.integrate();
    expect(ck.getInsights().length).toBeGreaterThanOrEqual(0);
  });

  it('returns status', () => {
    const status = ck.getStatus();
    expect(typeof status.totalIntegrations).toBe('number');
  });
});

describe('EndocrineSystem', () => {
  let ns: NervousSystem;
  let cons: Consciousness;
  let endo: EndocrineSystem;

  beforeEach(() => {
    ns = new NervousSystem({ trackEnergy: false });
    cons = new Consciousness();
    endo = new EndocrineSystem(ns, cons);
  });

  it('initializes with default signals', () => {
    const signals = endo.getSignals();
    expect(signals.urgency).toBe(0.5);
    expect(signals.confidence).toBe(0.8);
  });

  it('allows setting signals', () => {
    endo.setSignal('urgency', 0.9);
    expect(endo.getSignals().urgency).toBe(0.9);
  });

  it('clamps signals to [0, 1]', () => {
    endo.setSignal('confidence', 1.5);
    expect(endo.getSignals().confidence).toBe(1);
    endo.setSignal('confidence', -0.5);
    expect(endo.getSignals().confidence).toBe(0);
  });

  it('updates urgency from consciousness state', async () => {
    for (let i = 0; i < 8; i++) cons.observe('reflex', `alert-${i}`, 'test');
    await endo.tick();
    expect(endo.getSignals().urgency).toBeGreaterThan(0.5);
  });

  it('tracks history', async () => {
    await endo.tick();
    expect(endo.getHistory()).toHaveLength(1);
  });

  it('returns status', () => {
    const status = endo.getStatus();
    expect(status.current).toBeDefined();
  });

  it('can be destroyed', () => {
    endo.destroy();
    // Should not throw
  });
});

describe('ImmuneSystem', () => {
  let policies: PolicyEngine;
  let auth: Auth;
  let reflex: ReflexEngine;
  let immune: ImmuneSystem;

  beforeEach(() => {
    policies = new PolicyEngine();
    auth = new Auth();
    reflex = new ReflexEngine();
    immune = new ImmuneSystem(policies, auth, reflex);
  });

  it('allows permitted actions', async () => {
    policies.addRule({
      id: 'allow-read', effect: 'allow', principals: ['*'],
      actions: ['read'], resources: ['*'], priority: 1,
    });
    const result = await immune.evaluateAction('test-agent', 'read', 'file.ts');
    expect(result.allowed).toBe(true);
  });

  it('blocks denied actions', async () => {
    policies.addRule({
      id: 'deny-delete', effect: 'deny', principals: ['*'],
      actions: ['delete'], resources: ['*'], priority: 10,
    });
    const result = await immune.evaluateAction('test-agent', 'delete', 'file.ts');
    expect(result.allowed).toBe(false);
  });

  it('reports threats on block', async () => {
    policies.addRule({
      id: 'deny-all', effect: 'deny', principals: ['*'],
      actions: ['*'], resources: ['*'], priority: 1,
    });
    await immune.evaluateAction('bad-agent', 'write', 'secret.txt');
    expect(immune.getThreats().length).toBeGreaterThanOrEqual(1);
  });

  it('returns status', () => {
    const status = immune.getStatus();
    expect(status.scanCount).toBeGreaterThanOrEqual(0);
  });
});

describe('SleepCycle', () => {
  let ns: NervousSystem;
  let eventBus: NeuralEventBus;
  let aether: AetherCore;
  let sleep: SleepCycle;

  beforeEach(() => {
    ns = new NervousSystem({ trackEnergy: false });
    eventBus = new NeuralEventBus();
    aether = new AetherCore(eventBus, { tickIntervalMs: 50000 });
    sleep = new SleepCycle(ns, aether, null, null, undefined, 60000);
  });

  afterEach(() => {
    sleep.stopNapCycle();
  });

  it('starts in awake phase', () => {
    expect(sleep.phase).toBe('awake');
  });

  it('completes a nap cycle', async () => {
    const report = await sleep.nap();
    expect(report.phase).toBe('napping');
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof report.memoriesConsolidated).toBe('number');
  });

  it('completes a deep sleep cycle', async () => {
    const report = await sleep.deepSleep();
    expect(report.phase).toBe('deep-sleep');
  });

  it('starts and stops nap timer', () => {
    sleep.startNapCycle();
    const status1 = sleep.getStatus();
    expect(status1.napTimerActive).toBe(true);
    sleep.stopNapCycle();
    const status2 = sleep.getStatus();
    expect(status2.napTimerActive).toBe(false);
  });

  it('returns reports', async () => {
    await sleep.nap();
    expect(sleep.getReports(1)).toHaveLength(1);
  });

  it('distills skills from a memory source', async () => {
    const source: SleepMemorySource = {
      async listUnconsolidated() {
        return [
          { id: 'e1', content: 'debugging failed test runs requires reproducing the failure first', importance: 0.8, timestamp: new Date() },
          { id: 'e2', content: 'reproducing failed test runs before fixing avoids wasted effort', importance: 0.9, timestamp: new Date() },
          { id: 'e3', content: 'failed test runs reproduce locally then fix incrementally', importance: 0.7, timestamp: new Date() },
        ];
      },
      async markConsolidated(ids: string[]) {
        expect(ids.length).toBeGreaterThan(0);
      },
    };
    const published: DistilledSkill[] = [];
    const sink: SleepSkillSink = {
      async publish(skill: DistilledSkill) {
        published.push(skill);
      },
    };

    const distilling = new SleepCycle(ns, aether, source, sink);
    const report = await distilling.nap();

    expect(report.memoriesConsolidated).toBe(3);
    expect(report.patternsLearned).toBeGreaterThan(0);
    expect(report.skillsBenchmarked).toBeGreaterThan(0);
    expect(report.tokenReductionPct).toBeGreaterThanOrEqual(50);
    expect(published.length).toBeGreaterThan(0);
    expect(published[0]!.provenance.length).toBeGreaterThanOrEqual(2);
    expect(distilling.getDistilledSkills().length).toBe(published.length);
  });

  it('reports zero consolidation when no memory source is attached', async () => {
    const bare = new SleepCycle(ns, aether);
    const report = await bare.nap();
    expect(report.memoriesConsolidated).toBe(0);
    expect(report.skillsDistilled).toBe(0);
  });
});

describe('CognitiveExoskeleton fast path', () => {
  it('resolves status and health requests without an LLM', () => {
    const root = mkdtempSync(join(tmpdir(), 'uch-exo-'));
    try {
      const exo = new CognitiveExoskeleton({
        workspaceId: 'ws-test',
        workspaceName: 'Test Workspace',
        workspaceRoot: root,
      });
      const status = exo.resolveFastPath('what is the current status?');
      expect(status?.routine).toBe('status-routine');
      expect(status?.output).toContain('running=');

      const health = exo.resolveFastPath('is the system healthy?');
      expect(health?.routine).toBe('health-routine');

      const miss = exo.resolveFastPath('write a sonnet about retrieval');
      expect(miss).toBeNull();

      const stats = exo.getStats().reflex as {
        totalCalls: number;
        resolved: number;
        routines: string[];
      };
      expect(stats.totalCalls).toBe(3);
      expect(stats.resolved).toBe(2);
      expect(stats.routines).toContain('status-routine');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
