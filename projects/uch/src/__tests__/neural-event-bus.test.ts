import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

describe('NeuralEventBus', () => {
  let bus: NeuralEventBus;

  beforeEach(() => {
    bus = new NeuralEventBus(100);
  });

  it('publishes events and adds to history', async () => {
    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: 'main.ts' } });
    expect(bus.getHistory().length).toBe(1);
    expect(bus.getHistory()[0]!.type).toBe('file:saved');
  });

  it('fires subscribed handlers', async () => {
    const calls: string[] = [];
    bus.subscribe('file:saved', (event) => {
      calls.push(event.payload.path as string);
    });
    await bus.publish({ type: 'file:saved', source: 'editor', payload: { path: 'app.ts' } });
    expect(calls.length).toBe(1);
    expect(calls[0]).toBe('app.ts');
  });

  it('supports multiple event types per subscription', async () => {
    const calls: string[] = [];
    bus.subscribe(['file:saved', 'file:created'], (event) => {
      calls.push(event.type);
    });
    await bus.publish({ type: 'file:saved', source: 'e', payload: {} });
    await bus.publish({ type: 'file:created', source: 'e', payload: {} });
    expect(calls.length).toBe(2);
  });

  it('supports event type filtering in history', async () => {
    await bus.publish({ type: 'git:commit', source: 's', payload: {} });
    await bus.publish({ type: 'file:saved', source: 's', payload: {} });
    expect(bus.getHistory('git:commit').length).toBe(1);
  });

  it('isolates handler failures', async () => {
    const calls: string[] = [];
    bus.subscribe('test:passed', () => {
      throw new Error('fail');
    });
    bus.subscribe('test:passed', () => {
      calls.push('ok');
    });
    await bus.publish({ type: 'test:passed', source: 's', payload: {} });
    expect(calls).toEqual(['ok']);
  });

  it('applies filters to subscriptions', async () => {
    const calls: string[] = [];
    bus.subscribe(
      'agent:attached',
      (e) => {
        calls.push(e.payload.agent_id as string);
      },
      (e) => e.payload.agent_id === 'allowed',
    );
    await bus.publish({ type: 'agent:attached', source: 's', payload: { agent_id: 'allowed' } });
    await bus.publish({ type: 'agent:attached', source: 's', payload: { agent_id: 'blocked' } });
    expect(calls).toEqual(['allowed']);
  });

  it('unsubscribes handlers', async () => {
    const calls: string[] = [];
    const id = bus.subscribe('error:occurred', () => {
      calls.push('hit');
    });
    bus.unsubscribe(id);
    await bus.publish({ type: 'error:occurred', source: 's', payload: {} });
    expect(calls.length).toBe(0);
  });

  it('enforces max history limit', async () => {
    const small = new NeuralEventBus(3);
    for (let i = 0; i < 5; i++) {
      await small.publish({ type: 'file:saved', source: 's', payload: { i } });
    }
    expect(small.getHistory().length).toBe(3);
  });

  it('returns recent events', async () => {
    for (let i = 0; i < 5; i++) {
      await bus.publish({ type: 'file:saved', source: 's', payload: { i } });
    }
    const recent = bus.getRecent(2);
    expect(recent.length).toBe(2);
  });

  it('clears history', async () => {
    await bus.publish({ type: 'file:saved', source: 's', payload: {} });
    bus.clearHistory();
    expect(bus.getHistory().length).toBe(0);
  });

  it('tracks subscription count', () => {
    expect(bus.getSubscriptionCount()).toBe(0);
    bus.subscribe('file:saved', () => {});
    bus.subscribe('git:commit', () => {});
    expect(bus.getSubscriptionCount()).toBe(2);
  });

  it('publishes events with id and timestamp', async () => {
    await bus.publish({ type: 'session:started', source: 'uch', payload: {} });
    const event = bus.getHistory()[0]!;
    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it('routes module-targeted events to registered module subscribers', async () => {
    const calls: string[] = [];
    bus.registerModule('memory', ['remember']);
    bus.subscribeToModule('memory', (event) => {
      calls.push(event.payload.observation as string);
    });

    await bus.publishToModule('memory', {
      type: 'memory:ingest',
      source: 'test',
      payload: { observation: 'remember this' },
    });

    expect(calls).toEqual(['remember this']);
  });

  it('routes protocol events to protocol subscribers', async () => {
    const calls: string[] = [];
    bus.subscribeToProtocol('memory:ingest', (event) => {
      calls.push(event.payload.protocol as string);
    });

    await bus.publishProtocol('memory:ingest', 'test', { observation: 'protocol route' }, [
      'memory',
    ]);

    expect(calls).toEqual(['memory:ingest']);
  });
});
