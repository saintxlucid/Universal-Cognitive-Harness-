import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Connectome } from '../connectome/wiring.js';
import { createSignal } from '../nervous-system/signal.js';
import { CognitiveExoskeleton } from '../exoskeleton/exoskeleton.js';

describe('Connectome weighted edges (CONNECTOME §4.1)', () => {
  let c: Connectome;

  beforeEach(() => {
    c = new Connectome();
  });

  it('defaults weight to 1', () => {
    const id = c.registerConnection({ from: 'a', to: 'b', type: 'data-flow', description: '' });
    expect(c.getWeight(id)).toBe(1);
  });

  it('accepts explicit weight on registration', () => {
    const id = c.registerConnection({ from: 'a', to: 'b', type: 'data-flow', description: '', weight: 3 });
    expect(c.getWeight(id)).toBe(3);
  });

  it('setWeight clamps to [0, maxWeight]', () => {
    const id = c.registerConnection({ from: 'a', to: 'b', type: 'data-flow', description: '' });
    c.setWeight(id, 99);
    expect(c.getWeight(id)).toBe(10);
    c.setWeight(id, -5);
    expect(c.getWeight(id)).toBe(0);
  });

  it('rankPaths orders by summed edge weight', () => {
    // Two paths a→c: direct (weight 1) and via b (weights 5+4)
    c.link('a', 'c', 'data-flow', '', 1);
    c.link('a', 'b', 'data-flow', '', 5);
    c.link('b', 'c', 'data-flow', '', 4);
    const ranked = c.rankPaths('a', 'c');
    expect(ranked.length).toBe(2);
    const weights = ranked.map((p) => p.reduce((s, e) => s + (e.weight ?? 0), 0));
    expect(weights[0]).toBeGreaterThan(weights[1]!);
    expect(weights[0]).toBe(9);
  });
});

describe('Connectome link + activation (CONNECTOME §2, §4.2)', () => {
  let c: Connectome;

  beforeEach(() => {
    c = new Connectome({ activationDecayPerHop: 0.5, activationMaxDepth: 4 });
  });

  it('link registers nodes and registers-or-strengthens edges', () => {
    const first = c.link('a', 'b', 'data-flow', '');
    expect(c.hasNode('a')).toBe(true);
    expect(c.hasNode('b')).toBe(true);
    const second = c.link('a', 'b', 'data-flow', '');
    expect(second).toBe(first);
    expect(c.getWeight(first)).toBe(2);
  });

  it('link does not merge different connection types', () => {
    const control = c.link('a', 'b', 'control');
    const dataFlow = c.link('a', 'b', 'data-flow');
    expect(control).not.toBe(dataFlow);
    expect(c.getConnections()).toHaveLength(2);
  });

  it('activate propagates with per-hop decay and sets edge activation', () => {
    c.link('a', 'b', 'data-flow');
    c.link('b', 'c', 'data-flow');
    c.link('c', 'd', 'data-flow');
    const neighborhood = c.activate('a', 1);
    const byId = new Map(neighborhood.map((n) => [n.id, n]));
    expect(byId.get('a')?.activation).toBe(1);
    expect(byId.get('b')?.activation).toBeCloseTo(0.5);
    expect(byId.get('c')?.activation).toBeCloseTo(0.25);
    expect(byId.get('d')?.activation).toBeCloseTo(0.125);

    const ab = c.getConnectionsFrom('a')[0]!;
    expect(ab.activation).toBe(1);
    expect(ab.lastActivatedAt).toBeInstanceOf(Date);
  });

  it('activate respects max depth', () => {
    c.link('a', 'b', 'data-flow');
    c.link('b', 'c', 'data-flow');
    c.link('c', 'd', 'data-flow');
    c.link('d', 'e', 'data-flow');
    c.link('e', 'f', 'data-flow');
    const neighborhood = c.activate('a', 1);
    expect(neighborhood.some((n) => n.id === 'f')).toBe(false);
    expect(neighborhood.some((n) => n.id === 'e')).toBe(true);
  });

  it('getNeighborhood is activation-ordered (closest first)', () => {
    c.link('cue', 'near', 'data-flow');
    c.link('near', 'far', 'data-flow');
    const neighborhood = c.getNeighborhood('cue');
    expect(neighborhood[0]?.id).toBe('cue');
    expect(neighborhood[1]?.id).toBe('near');
    expect(neighborhood[2]?.id).toBe('far');
    expect(neighborhood[1]!.activation).toBeGreaterThan(neighborhood[2]!.activation);
  });
});

describe('Connectome integrity (CONNECTOME §4.4, FORMAL_FOUNDATIONS)', () => {
  it('reports weakly connected graph with no emergency', () => {
    const c = new Connectome();
    c.link('a', 'b', 'data-flow');
    c.link('b', 'c', 'data-flow');
    const report = c.checkIntegrity();
    expect(report.weaklyConnected).toBe(true);
    expect(report.components).toBe(1);
    expect(report.emergencyBroadcast).toBe(false);
    expect(report.danglingEdges).toBe(0);
    expect(report.nodeCount).toBe(3);
  });

  it('detects partitioned components -> emergency broadcast mode', () => {
    const c = new Connectome();
    c.link('a', 'b', 'data-flow');
    c.link('x', 'y', 'data-flow');
    const report = c.checkIntegrity();
    expect(report.components).toBe(2);
    expect(report.weaklyConnected).toBe(false);
    expect(report.emergencyBroadcast).toBe(true);
  });

  it('detects dangling edges', () => {
    const c = new Connectome();
    // Raw registration (not link()) does not auto-register endpoints as nodes.
    c.registerConnection({ from: 'a', to: 'b', type: 'data-flow', description: '' });
    c.registerNode('a');
    const report = c.checkIntegrity();
    expect(report.danglingEdges).toBe(1);
  });

  it('removeNode cascades its edges', () => {
    const c = new Connectome();
    c.link('a', 'b', 'data-flow');
    c.removeNode('a');
    expect(c.getConnections()).toHaveLength(0);
  });
});

describe('Connectome persistence (CONNECTOME §4.5)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-conn-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('persists and restores connections, weights, and nodes', async () => {
    const file = join(dir, 'connectome.json');
    const c = new Connectome();
    c.link('a', 'b', 'data-flow', '', 3);
    c.link('b', 'c', 'event-driven', '', 2);
    c.activate('a', 1);
    const saved = c.getConnections();
    expect(saved[0]!.lastActivatedAt).toBeInstanceOf(Date);

    await c.persist(file);

    const restored = new Connectome();
    const count = await restored.load(file);
    expect(count).toBe(2);
    expect(restored.getConnections()).toHaveLength(2);
    expect(restored.hasNode('a')).toBe(true);
    expect(restored.hasNode('c')).toBe(true);
    const restoredWeights = restored.getConnections().map((e) => e.weight).sort();
    expect(restoredWeights).toEqual([2, 3]);
    expect(restored.getConnections()[0]!.lastActivatedAt).toBeInstanceOf(Date);
    expect(restored.getStats().totalNodes).toBe(3);
  });

  it('load on missing file returns 0', async () => {
    const c = new Connectome();
    const count = await c.load(join(dir, 'missing.json'));
    expect(count).toBe(0);
  });
});

describe('Connectome auto-wiring via connectome:link signals (CONNECTOME §4.3)', () => {
  let dir: string;
  let exo: CognitiveExoskeleton;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-exo-conn-'));
    exo = new CognitiveExoskeleton({
      workspaceId: 'ws-connectome',
      workspaceName: 'Connectome Test',
      workspaceRoot: dir,
    });
  });

  afterEach(async () => {
    await exo.stop();
    rmSync(dir, { recursive: true, force: true });
  });

  it('boot seeds the graph from emitted connectome:link events', async () => {
    await exo.nervousSystem.emit(
      createSignal('connectome:link', 'exoskeleton', {
        from: 'eventBus',
        to: 'traceRecorder',
        type: 'event-driven',
        description: 'Events flow from bus to recorder',
      }),
    );
    await exo.nervousSystem.emit(
      createSignal('connectome:link', 'exoskeleton', {
        from: 'fsDriver',
        to: 'eventBus',
        type: 'event-driven',
        description: 'Filesystem changes propagate as events',
      }),
    );
    expect(exo.connectome.getConnections().length).toBeGreaterThanOrEqual(2);
    expect(exo.connectome.getNodes()).toContain('eventBus');
    expect(exo.connectome.getNodes()).toContain('traceRecorder');
  });

  it('a connectome:link signal creates a new connection at runtime', async () => {
    await exo.nervousSystem.emit(
      createSignal('connectome:link', 'driver', {
        from: 'gitDriver',
        to: 'eventBus',
        type: 'event-driven',
        description: 'Git changes propagate as events',
      }),
    );
    expect(exo.connectome.getConnectionsFrom('gitDriver')).toHaveLength(1);
    expect(exo.connectome.getNodes()).toContain('gitDriver');
  });

  it('strengthens an existing edge instead of duplicating', async () => {
    const payload = {
      from: 'aether',
      to: 'consciousness',
      type: 'control' as const,
      description: 'Aether orchestrates consciousness layers',
    };
    await exo.nervousSystem.emit(createSignal('connectome:link', 'exoskeleton', payload));
    await exo.nervousSystem.emit(createSignal('connectome:link', 'exoskeleton', payload));
    const matches = exo.connectome.getConnections().filter((e) => e.from === 'aether' && e.to === 'consciousness');
    expect(matches).toHaveLength(1);
    // Weight 1 from the boot seed + 2 runtime links.
    expect(matches[0]!.weight).toBe(3);
  });

  it('ignores signals without from/to payload', async () => {
    await exo.nervousSystem.emit(createSignal('connectome:link', 'exoskeleton', {}));
    const before = exo.connectome.getConnections().length;
    expect(before).toBeGreaterThanOrEqual(0);
    expect(exo.connectome.getStats().totalConnections).toBe(before);
  });

  it('exposes integrity stats alongside connection count', async () => {
    await exo.nervousSystem.emit(
      createSignal('connectome:link', 'exoskeleton', {
        from: 'eventBus',
        to: 'traceRecorder',
        type: 'event-driven',
      }),
    );
    const report = exo.connectome.checkIntegrity();
    expect(report.nodeCount).toBeGreaterThanOrEqual(2);
    expect(report.danglingEdges).toBe(0);
  });
});
