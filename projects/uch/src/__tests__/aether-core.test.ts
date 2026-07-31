import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AetherCore } from '../aether/aether-core.js';
import { Consciousness } from '../aether/consciousness.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

describe('Consciousness', () => {
  let c: Consciousness;

  beforeEach(() => {
    c = new Consciousness();
  });

  it('starts with reflex and working layers active', () => {
    const state = c.getState();
    expect(state.activeLayers).toContain('reflex');
    expect(state.activeLayers).toContain('working');
  });

  it('observes a thought', () => {
    const t = c.observe('working', 'test thought', 'test', ['test-tag']);
    expect(t.layer).toBe('working');
    expect(t.content).toBe('test thought');
    expect(t.priority).toBe(0.8);
    expect(t.acknowledged).toBe(false);
  });

  it('assigns priority by layer', () => {
    expect(c.observe('reflex', '', '', []).priority).toBe(1.0);
    expect(c.observe('working', '', '', []).priority).toBe(0.8);
    expect(c.observe('strategic', '', '', []).priority).toBe(0.6);
    expect(c.observe('reflective', '', '', []).priority).toBe(0.4);
    expect(c.observe('meta', '', '', []).priority).toBe(0.2);
  });

  it('acknowledges a thought', () => {
    const t = c.observe('reflex', 'danger', 'test');
    expect(c.acknowledge(t.id)).toBe(true);
    expect(c.getUnacknowledged()).toHaveLength(0);
  });

  it('returns false for unknown thought id', () => {
    expect(c.acknowledge('nope')).toBe(false);
  });

  it('focuses attention', () => {
    c.focus('security');
    c.focus('performance');
    expect(c.getState().attentionFocus).toContain('security');
    expect(c.getState().attentionFocus).toContain('performance');
  });

  it('unfocuses attention', () => {
    c.focus('security');
    c.focus('performance');
    c.unfocus('security');
    expect(c.getState().attentionFocus).not.toContain('security');
  });

  it('activates and deactivates layers', () => {
    c.activateLayer('strategic');
    expect(c.getState().activeLayers).toContain('strategic');
    c.deactivateLayer('strategic');
    expect(c.getState().activeLayers).not.toContain('strategic');
  });

  it('filters thoughts by layer', () => {
    c.observe('reflex', 'r1', 't');
    c.observe('reflex', 'r2', 't');
    c.observe('working', 'w1', 't');
    expect(c.getByLayer('reflex')).toHaveLength(2);
    expect(c.getByLayer('working')).toHaveLength(1);
  });

  it('returns stats', () => {
    c.observe('reflex', 'x', 't');
    const stats = c.getStats();
    expect(stats.totalThoughts).toBe(1);
    expect(stats.activeLayers).toContain('reflex');
  });

  it('updates urgency based on unacknowledged thoughts', () => {
    for (let i = 0; i < 8; i++) c.observe('reflex', `alert-${i}`, 'test');
    expect(c.getState().urgency).toBeGreaterThan(0.5);
  });
});

describe('AetherCore', () => {
  let eventBus: NeuralEventBus;
  let aether: AetherCore;

  beforeEach(() => {
    eventBus = new NeuralEventBus();
    aether = new AetherCore(eventBus, { tickIntervalMs: 50000 });
  });

  afterEach(() => {
    aether.stop();
  });

  it('starts in idle state', () => {
    expect(aether.getState().running).toBe(false);
    expect(aether.getState().ticksCompleted).toBe(0);
  });

  it('starts and stops', () => {
    aether.start();
    expect(aether.getState().running).toBe(true);
    expect(aether.getState().startedAt).toBeInstanceOf(Date);
    expect(aether.phase).toBe('active');

    aether.stop();
    expect(aether.getState().running).toBe(false);
    expect(aether.phase).toBe('idle');
  });

  it('registers and ticks subsystems', async () => {
    const tickFn = vi.fn();
    const statusFn = vi.fn(() => ({ ok: true }));
    aether.register('test-sub', { name: 'test-sub', tick: tickFn, status: statusFn });

    aether.start();
    expect(aether.getState().subsystems).toContain('test-sub');
    aether.stop();
  });

  it('registers and handles failing subsystems gracefully', async () => {
    const failing = {
      name: 'fail',
      tick: async () => {
        throw new Error('subsystem error');
      },
      status: () => ({}),
    };
    aether.register('fail-sub', failing);
    aether.start();
    aether.stop();
    // Should not throw
  });

  it('observes thoughts through aether', () => {
    aether.start();
    aether.observeThought('working', 'analysis complete', 'test');
    const state = aether.getState();
    expect(state.consciousness.totalThoughts).toBe(2); // 1 from start + 1 from observe
  });

  it('tracks agent count', () => {
    aether.setAgentCount(3);
    expect(aether.getState().connectedAgents).toBe(3);
  });

  it('returns stats', () => {
    aether.start();
    const stats = aether.getStats();
    expect(stats.running).toBe(true);
    expect(stats.consciousness).toBeDefined();
    aether.stop();
  });

  it('publishes events on start and stop', () => {
    const published: string[] = [];
    eventBus.subscribe((e) => {
      published.push(e.type);
    });

    aether.start();
    expect(published).toContain('aether:started');

    aether.stop();
    expect(published).toContain('aether:stopped');
  });
});
