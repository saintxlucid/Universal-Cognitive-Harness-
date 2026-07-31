import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralEventBus, type NeuralEvent } from '../neural-event-bus.js';

describe('NeuralEventBus — edge cases', () => {
  let bus: NeuralEventBus;

  beforeEach(() => {
    bus = new NeuralEventBus(10);
  });

  // ── Wildcard subscriptions ──

  it('supports wildcard (*) subscriptions matching all events', async () => {
    const calls: string[] = [];
    bus.subscribe((event) => {
      calls.push(event.type);
    });
    await bus.publish({ type: 'file:saved', source: 's', payload: {} });
    await bus.publish({ type: 'git:commit', source: 's', payload: {} });
    await bus.publish({ type: 'error:occurred', source: 's', payload: {} });
    expect(calls).toEqual(['file:saved', 'git:commit', 'error:occurred']);
  });

  it('wildcard subscriber fires alongside typed subscribers', async () => {
    const wildcardCalls: string[] = [];
    const typedCalls: string[] = [];
    bus.subscribe((event) => { wildcardCalls.push(event.type); });
    bus.subscribe('file:saved', () => { typedCalls.push('file:saved'); });

    await bus.publish({ type: 'file:saved', source: 's', payload: {} });
    expect(wildcardCalls).toContain('file:saved');
    expect(typedCalls).toContain('file:saved');
  });

  // ── Module routing ──

  it('routes module-targeted events to registered subscribers', async () => {
    const calls: string[] = [];
    bus.registerModule('memory', ['memory:ingest', 'memory:recall']);
    bus.subscribeToModule('memory', (event) => {
      calls.push(event.type);
    });
    await bus.publishToModule('memory', {
      type: 'memory:ingest',
      source: 'uch',
      payload: { observation: 'test' },
    });
    expect(calls).toEqual(['memory:ingest']);
  });

  it('does not route module events to subscribers of other modules', async () => {
    const calls: string[] = [];
    bus.registerModule('workspace', []);
    bus.subscribeToModule('workspace', (event) => { calls.push(event.type); });
    await bus.publishToModule('memory', {
      type: 'memory:ingest',
      source: 'uch',
      payload: {},
    });
    expect(calls).toHaveLength(0);
  });

  it('module subscription applies filters', async () => {
    const calls: string[] = [];
    bus.registerModule('filtered', []);
    bus.subscribeToModule(
      'filtered',
      (event) => { calls.push(event.source); },
      (event) => event.source === 'allowed',
    );
    await bus.publishToModule('filtered', {
      type: 'file:saved', source: 'allowed', payload: {},
    });
    await bus.publishToModule('filtered', {
      type: 'file:saved', source: 'blocked', payload: {},
    });
    expect(calls).toEqual(['allowed']);
  });

  // ── Protocol subscriptions ──

  it('routes protocol events to protocol subscribers', async () => {
    const calls: string[] = [];
    bus.subscribeToProtocol('my:protocol', (event) => {
      calls.push(event.payload.protocol as string);
    });
    await bus.publishProtocol('my:protocol', 'test', { key: 'val' }, ['module1']);
    expect(calls).toEqual(['my:protocol']);
  });

  it('protocol events include metadata targets', async () => {
    let captured: NeuralEvent | undefined;
    bus.subscribeToProtocol('my:proto', (event) => { captured = event; });
    await bus.publishProtocol('my:proto', 'src', { data: 1 }, ['t1', 't2']);
    expect(captured?.metadata?.targets).toEqual(['t1', 't2']);
    expect(captured?.metadata?.protocol).toBe('my:proto');
  });

  // ── Handler isolation ──

  it('isolates handler failures across typed, wildcard, and module subscribers', async () => {
    const calls: string[] = [];
    bus.subscribe('file:saved', () => { throw new Error('oops'); });
    bus.subscribe((event) => { if (event.type === 'file:saved') throw new Error('wildcard fail'); });
    bus.subscribe('file:saved', () => { calls.push('ok'); });
    bus.registerModule('test', []);
    bus.subscribeToModule('test', () => { throw new Error('module fail'); });

    // Two events: one regular publish and one module-targeted publish.
    // The non-module publish triggers typed + wildcard subscribers.
    // The module publish triggers typed + wildcard + module subscribers.
    // Both trigger the third subscriber (typed 'file:saved'), so 'ok' appears twice.
    await bus.publish({ type: 'file:saved', source: 's', payload: {} });
    await bus.publishToModule('test', {
      type: 'file:saved', source: 's', payload: {},
    });
    expect(calls).toEqual(['ok', 'ok']);
  });

  // ── Max history ──

  it('enforces max history limit', async () => {
    const small = new NeuralEventBus(3);
    for (let i = 0; i < 10; i++) {
      await small.publish({ type: 'file:saved', source: 's', payload: { i } });
    }
    expect(small.getHistory().length).toBe(3);
  });

  it('keeps the most recent events after trimming', async () => {
    const small = new NeuralEventBus(3);
    for (let i = 0; i < 10; i++) {
      await small.publish({ type: 'file:saved', source: 's', payload: { i } });
    }
    const history = small.getHistory();
    expect(history.map((e) => e.payload.i)).toEqual([7, 8, 9]);
  });

  // ── Subscription lifecycle ──

  it('unsubscribe removes subscriptions across all maps', async () => {
    const calls: string[] = [];
    const id1 = bus.subscribe('file:saved', () => { calls.push('typed'); });
    const id2 = bus.subscribe(() => { calls.push('wildcard'); });
    bus.registerModule('m', []);
    const id3 = bus.subscribeToModule('m', () => { calls.push('module'); });
    const id4 = bus.subscribeToProtocol('p', () => { calls.push('protocol'); });

    bus.unsubscribe(id1);
    bus.unsubscribe(id2);
    bus.unsubscribe(id3);
    bus.unsubscribe(id4);

    await bus.publish({ type: 'file:saved', source: 's', payload: {} });
    await bus.publishToModule('m', { type: 'file:saved', source: 's', payload: {} });
    await bus.publishProtocol('p', 's', {});

    expect(calls).toHaveLength(0);
  });

  it('getSubscriptionCount returns consolidated count', () => {
    expect(bus.getSubscriptionCount()).toBe(0);
    bus.subscribe('file:saved', () => {});
    bus.subscribe(() => {});
    bus.registerModule('m', []);
    bus.subscribeToModule('m', () => {});
    bus.subscribeToProtocol('p', () => {});
    expect(bus.getSubscriptionCount()).toBe(4);
  });

  // ── getHistory / getRecent ──

  it('getHistory filters by event type', async () => {
    await bus.publish({ type: 'git:commit', source: 's', payload: {} });
    await bus.publish({ type: 'file:saved', source: 's', payload: {} });
    expect(bus.getHistory('git:commit')).toHaveLength(1);
    expect(bus.getHistory('file:saved')).toHaveLength(1);
    expect(bus.getHistory('error:occurred')).toHaveLength(0);
  });

  it('getRecent returns the last N events', async () => {
    for (let i = 0; i < 10; i++) {
      await bus.publish({ type: 'file:saved', source: 's', payload: { i } });
    }
    expect(bus.getRecent(3)).toHaveLength(3);
    expect(bus.getRecent(100)).toHaveLength(10);
  });

  it('clearHistory empties the history', async () => {
    await bus.publish({ type: 'file:saved', source: 's', payload: {} });
    bus.clearHistory();
    expect(bus.getHistory()).toHaveLength(0);
  });

  // ── Event metadata ──

  it('publish assigns id and timestamp', async () => {
    await bus.publish({ type: 'session:started', source: 'uch', payload: {} });
    const event = bus.getHistory()[0]!;
    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.type).toBe('session:started');
  });

  // ── High throughput ──

  it('handles concurrent publishes without crashing', async () => {
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(
        bus.publish({ type: 'file:saved', source: 's', payload: { i } }),
      );
    }
    await Promise.all(promises);
    expect(bus.getHistory().length).toBeLessThanOrEqual(10);
  });
});
