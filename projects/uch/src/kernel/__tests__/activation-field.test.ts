import { describe, it, expect, beforeEach } from 'vitest';
import { ActivationField } from '../activation/activation-field.js';
import { Connectome } from '../activation/connectome.js';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { CognitiveKernel } from '../cognitive-kernel.js';

describe('Connectome', () => {
  let connectome: Connectome;

  beforeEach(() => {
    connectome = new Connectome();
  });

  it('links entities and returns weights', () => {
    connectome.link('a', 'b', 0.7);
    expect(connectome.getWeight('a', 'b')).toBeCloseTo(0.7);
    expect(connectome.getWeight('b', 'a')).toBeCloseTo(0.7);
    expect(connectome.edgeCount()).toBe(1);
    expect(connectome.neighbors('a')).toEqual([{ id: 'b', weight: 0.7 }]);
  });

  it('is undirected and idempotent', () => {
    connectome.link('a', 'b', 0.4);
    connectome.link('b', 'a', 0.9);
    expect(connectome.edgeCount()).toBe(1);
    expect(connectome.getWeight('a', 'b')).toBeCloseTo(0.4);
  });

  it('strengthens on co-activation (Hebbian plasticity)', () => {
    connectome.link('a', 'b', 0.5);
    connectome.strengthen('a', 'b', 0.9, 0.8, Date.now());
    expect(connectome.getWeight('a', 'b')).toBeGreaterThan(0.5);
    expect(connectome.getWeight('a', 'b')).toBeLessThanOrEqual(1.0);
  });

  it('does not strengthen below coactivation threshold', () => {
    connectome.link('a', 'b', 0.5);
    connectome.strengthen('a', 'b', 0.1, 0.1, Date.now());
    expect(connectome.getWeight('a', 'b')).toBeCloseTo(0.5);
  });

  it('decays passive connections on tick', () => {
    connectome.link('a', 'b', 0.9);
    connectome.decayAll();
    expect(connectome.getWeight('a', 'b')).toBeLessThan(0.9);
  });

  it('unlinks edges', () => {
    connectome.link('a', 'b');
    connectome.unlink('a', 'b');
    expect(connectome.edgeCount()).toBe(0);
    expect(connectome.getWeight('a', 'b')).toBe(0);
  });

  it('clear removes all edges', () => {
    connectome.link('a', 'b');
    connectome.link('b', 'c');
    connectome.clear();
    expect(connectome.edgeCount()).toBe(0);
  });
});

describe('ActivationField', () => {
  let now: number;
  let clock: () => number;
  let field: ActivationField;

  beforeEach(() => {
    now = 1_000_000;
    clock = () => now;
    field = new ActivationField({}, undefined, clock);
  });

  it('registers entities with default metrics', () => {
    const entity = field.register({ id: 'c1', label: 'Rust' });
    expect(entity.id).toBe('c1');
    expect(entity.kind).toBe('concept');
    expect(entity.activation).toBe(0);
    expect(entity.metrics.novelty).toBe(0.5);
    expect(entity.metrics.confidence).toBe(0.5);
    expect(entity.metrics.utility).toBe(0.5);
    expect(entity.archived).toBe(false);
  });

  it('is idempotent on duplicate registration', () => {
    field.register({ id: 'c1', label: 'Rust' });
    field.register({ id: 'c1', label: 'Rust' });
    expect(field.getStats().entityCount).toBe(1);
  });

  it('decays activation exponentially at half-life', () => {
    field.register({ id: 'c1', label: 'x', activation: 0.8, halfLifeMs: 1000 });
    now += 1000;
    field.tick(1000);
    expect(field.get('c1')!.activation).toBeCloseTo(0.4, 5);
    now += 1000;
    field.tick(1000);
    expect(field.get('c1')!.activation).toBeCloseTo(0.2, 5);
  });

  it('does not fire below spike threshold', () => {
    field.register({ id: 'c1', label: 'x', activation: 0.3 });
    const result = field.spike('c1');
    expect(result.fired).toBe(false);
    expect(result.activation).toBe(0.3);
  });

  it('fires above threshold and propagates to neighbors', () => {
    field.register({ id: 'a', label: 'a', activation: 0.9, halfLifeMs: 999_999_999 });
    field.register({ id: 'b', label: 'b', halfLifeMs: 999_999_999 });
    field.link('a', 'b', 1.0);
    const result = field.spike('a', 0.1);
    expect(result.fired).toBe(true);
    expect(field.get('a')!.activation).toBe(1);
    expect(field.get('b')!.activation).toBeCloseTo(0.2, 5);
    expect(result.propagatedTo).toContain('b');
  });

  it('stops propagation when energy is exhausted', () => {
    field = new ActivationField(
      { energyPool: 1, spikeCost: 1, edgePropagationCost: 0.1, energyRegenPerMs: 0 },
      undefined,
      clock,
    );
    field.register({ id: 'a', label: 'a', activation: 0.9, halfLifeMs: 999_999_999 });
    field.register({ id: 'b', label: 'b', halfLifeMs: 999_999_999 });
    field.register({ id: 'c', label: 'c', halfLifeMs: 999_999_999 });
    field.link('a', 'b', 1.0);
    field.link('a', 'c', 1.0);
    const result = field.spike('a', 0.1);
    expect(result.fired).toBe(true);
    expect(result.propagatedTo.length).toBeLessThan(2);
    expect(field.getStats().energyRemaining).toBe(0);
    const second = field.spike('a');
    expect(second.fired).toBe(false);
  });

  it('regenerates energy over time', () => {
    field = new ActivationField(
      { energyPool: 1, spikeCost: 1, edgePropagationCost: 0.1, energyRegenPerMs: 0.01 },
      undefined,
      clock,
    );
    field.register({ id: 'a', label: 'a', activation: 0.9, halfLifeMs: 999_999_999 });
    field.spike('a', 0.1);
    expect(field.getStats().energyRemaining).toBe(0);
    now += 100;
    field.tick(100);
    expect(field.getStats().energyRemaining).toBe(1);
    expect(field.spike('a').fired).toBe(true);
  });

  it('strengthens connectome edges through repeated co-activation', () => {
    field = new ActivationField(
      { connectome: { coactivationThreshold: 0.05, plasticityRate: 0.1 } },
      undefined,
      clock,
    );
    field.register({ id: 'a', label: 'a', activation: 0.9, halfLifeMs: 999_999_999 });
    field.register({ id: 'b', label: 'b', halfLifeMs: 999_999_999 });
    field.link('a', 'b', 0.5);
    field.spike('a', 0.1);
    const afterFirst = field.connectome.getWeight('a', 'b');
    field.spike('a');
    const afterSecond = field.connectome.getWeight('a', 'b');
    expect(afterSecond).toBeGreaterThan(afterFirst);
  });

  it('updates importance from reward, prediction and reuse', () => {
    field.register({ id: 'c1', label: 'Rust', utility: 1 });
    for (let i = 0; i < 4; i++) {
      field.spike('c1', 0.9);
    }
    field.recordPrediction('c1', 1, true);
    const entity = field.get('c1')!;
    expect(entity.metrics.utility).toBe(1);
    expect(entity.metrics.predictionScore).toBeCloseTo(0.65, 5);
    const reuseFreq = 1 - Math.exp(-4 * 0.25);
    expect(entity.metrics.importance).toBeCloseTo(0.65 * 0.5 * reuseFreq, 5);
  });

  it('tracks curiosity as novelty times unactivated potential', () => {
    field.register({ id: 'c1', label: 'new-thing', novelty: 1 });
    const entity = field.get('c1')!;
    expect(entity.metrics.curiosity).toBeCloseTo(1 * (1 - 0), 5);
    field.spike('c1', 0.9);
    expect(field.get('c1')!.metrics.curiosity).toBe(0);
  });

  it('computes novelty from a similarity function', () => {
    const simField = new ActivationField(
      { similarityFn: (a, b) => (a === b ? 0.9 : 0.1) },
      undefined,
      clock,
    );
    simField.register({ id: 'a', label: 'Rust' });
    const second = simField.register({ id: 'b', label: 'Rust' });
    const novel = simField.register({ id: 'c', label: 'Zig' });
    expect(second.metrics.novelty).toBeCloseTo(0.1, 5);
    expect(novel.metrics.novelty).toBeCloseTo(0.9, 5);
  });

  it('archives dormant entities and compact removes them', () => {
    field = new ActivationField(
      { archiveThreshold: 0.05, archiveMinAgeMs: 5000, defaultHalfLifeMs: 1000 },
      undefined,
      clock,
    );
    field.register({ id: 'dormant', label: 'old', activation: 0.8 });
    field.register({ id: 'active', label: 'new', activation: 0.9, halfLifeMs: 999_999_999 });
    now += 5000;
    field.tick(5000);
    expect(field.get('dormant')!.archived).toBe(true);
    expect(field.get('active')!.archived).toBe(false);
    const removed = field.compact();
    expect(removed).toBe(1);
    expect(field.getStats().entityCount).toBe(1);
  });

  it('ranks retrieval by activation and importance', () => {
    field.register({ id: 'hot', label: 'rust', activation: 0.9, utility: 1, predictionScore: 1 });
    field.register({ id: 'cold', label: 'zig', activation: 0.1, halfLifeMs: 999_999_999 });
    const results = field.retrieve('', 10);
    expect(results[0]!.id).toBe('hot');
    expect(results[1]!.id).toBe('cold');
  });

  it('boosts label matches in retrieval', () => {
    field.register({ id: 'match', label: 'rust compiler', activation: 0.4, halfLifeMs: 999_999_999 });
    field.register({ id: 'other', label: 'garbage', activation: 0.35, halfLifeMs: 999_999_999 });
    const results = field.retrieve('rust');
    expect(results[0]!.id).toBe('match');
  });

  it('records predictions and emits events', () => {
    const bus = new NeuralEventBus();
    const events: string[] = [];
    bus.subscribe('prediction:made', (e) => events.push(e.payload.entityId as string));
    const fieldWithBus = new ActivationField({}, bus, clock);
    fieldWithBus.register({ id: 'c1', label: 'x' });
    fieldWithBus.recordPrediction('c1', 0.8, true);
    expect(events).toContain('c1');
    expect(fieldWithBus.get('c1')!.metrics.predictionScore).toBeCloseTo(0.59, 5);
  });

  it('emits ingest, spike and consolidation events', () => {
    const bus = new NeuralEventBus();
    const ingest: string[] = [];
    const spikes: string[] = [];
    const consolidations: string[] = [];
    bus.subscribe('memory:ingest', (e) => ingest.push(e.payload.entityId as string));
    bus.subscribe('cognitive:state_changed', (e) => spikes.push(e.payload.entityId as string));
    bus.subscribe('memory:consolidate', (e) => consolidations.push(e.payload.entityId as string));
    const fieldWithBus = new ActivationField(
      { archiveThreshold: 0.05, archiveMinAgeMs: 1000, defaultHalfLifeMs: 100 },
      bus,
      clock,
    );
    fieldWithBus.register({ id: 'c1', label: 'x', activation: 0.8 });
    fieldWithBus.spike('c1', 0.2);
    expect(ingest).toContain('c1');
    expect(spikes).toContain('c1');
    now += 1000;
    fieldWithBus.tick(1000);
    expect(consolidations).toContain('c1');
  });

  it('exposes field statistics', () => {
    field.register({ id: 'a', label: 'a', activation: 0.5 });
    field.register({ id: 'b', label: 'b', activation: 0.5 });
    field.link('a', 'b');
    const stats = field.getStats();
    expect(stats.entityCount).toBe(2);
    expect(stats.edgeCount).toBe(1);
    expect(stats.meanActivation).toBeCloseTo(0.5, 5);
    expect(stats.maxActivation).toBeCloseTo(0.5, 5);
  });

  it('clears the field and resets energy', () => {
    field.register({ id: 'a', label: 'a', activation: 0.9 });
    field.spike('a', 0.1);
    field.clear();
    const stats = field.getStats();
    expect(stats.entityCount).toBe(0);
    expect(stats.energyRemaining).toBe(100);
  });

  it('evicts oldest entities when at capacity', () => {
    field = new ActivationField({ maxEntities: 3 }, undefined, clock);
    field.register({ id: 'a', label: 'a' });
    field.register({ id: 'b', label: 'b' });
    field.register({ id: 'c', label: 'c' });
    field.register({ id: 'd', label: 'd' });
    expect(field.getStats().entityCount).toBeLessThanOrEqual(3);
  });
});

describe('CognitiveKernel activation integration', () => {
  it('wires concepts, episodes and relationships into the field', async () => {
    const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
    const rust = kernel.addConcept({ name: 'Rust', concept_type: 'entity', definition: 'systems language' });
    const zig = kernel.addConcept({ name: 'Zig', concept_type: 'entity', definition: 'another systems language' });
    kernel.addRelationship({ source: rust.id, target: zig.id, relationship: 'similar_to', source_episode: 'ep1' });
    await kernel.remember({
      content: { type: 'text', text: 'Karim prefers systems languages' },
      concepts: [rust.id],
    });

    const field = kernel.getActivationField();
    expect(field.get(rust.id)).toBeDefined();
    expect(field.get(zig.id)).toBeDefined();
    expect(field.connectome.getWeight(rust.id, zig.id)).toBeGreaterThan(0);

    const stats = kernel.getStats();
    expect(stats.activation.entityCount).toBeGreaterThanOrEqual(3);

    const recall = await kernel.recall({ text: 'systems', topK: 3 });
    expect(recall.length).toBeGreaterThan(0);
  });
});
