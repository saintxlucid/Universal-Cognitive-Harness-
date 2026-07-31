import { describe, it, expect } from 'vitest';
import { SignalStore } from '../cognitive-plane/signals/signal-store.js';
import { TraceLedger } from '../cognitive-plane/trace-engine/trace-ledger.js';
import { createTrace } from '../cognitive-plane/trace-engine/cognitive-trace.js';

describe('SignalStore', () => {
  it('records signals', () => {
    const ledger = new TraceLedger();
    const store = new SignalStore(ledger);
    store.record('session:started', 'test', { workspaceId: 'ws-1' }, 0.5);
    expect(store.count()).toBe(1);
  });

  it('returns recent signals', () => {
    const ledger = new TraceLedger();
    const store = new SignalStore(ledger);
    store.record('agent:attached', 'test', { agentId: 'a1' });
    store.record('workspace:opened', 'test', { id: 'ws-1' });
    expect(store.getRecent()).toHaveLength(2);
  });

  it('filters by type', () => {
    const ledger = new TraceLedger();
    const store = new SignalStore(ledger);
    store.record('session:started', 'test', {});
    store.record('error:occurred', 'test', { msg: 'error' });
    store.record('session:ended', 'test', {});
    expect(store.getByType('error:occurred')).toHaveLength(1);
  });

  it('tracks unacknowledged signals', () => {
    const ledger = new TraceLedger();
    const store = new SignalStore(ledger);
    store.record('error:occurred', 'test', { msg: 'critical' }, 0.9);
    expect(store.getUnacknowledged()).toHaveLength(1);
    store.acknowledgeAll();
    expect(store.getUnacknowledged()).toHaveLength(0);
  });

  it('acknowledges individual signals', () => {
    const ledger = new TraceLedger();
    const store = new SignalStore(ledger);
    const signal = store.record('error:occurred', 'test', {}, 0.9);
    expect(store.acknowledge(signal.id)).toBe(true);
    expect(store.getUnacknowledged()).toHaveLength(0);
  });

  it('auto-triggers replay for high importance signals with trace', () => {
    const ledger = new TraceLedger();
    const trace = createTrace({ name: 'test' });
    ledger.append(trace);

    const store = new SignalStore(ledger);
    store.record('error:occurred', 'test', { traceId: trace.trace_id }, 0.9);

    const triggers = store.getTriggers();
    expect(triggers.length).toBeGreaterThanOrEqual(1);
    expect(triggers[0]!.traceId).toBe(trace.trace_id);
  });

  it('returns stats', () => {
    const ledger = new TraceLedger();
    const store = new SignalStore(ledger);
    store.record('session:started', 'test', {});
    store.record('error:occurred', 'test', {});
    store.record('error:occurred', 'test', {});

    const stats = store.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byType['session:started']).toBe(1);
    expect(stats.byType['error:occurred']).toBe(2);
  });

  it('persists and loads', async () => {
    const ledger = new TraceLedger();
    const store = new SignalStore(ledger);
    store.record('session:started', 'test', { id: 's1' });
    store.record('error:occurred', 'test', { msg: 'fail' });

    await store.persist('/tmp/test-signals.json');
    const store2 = new SignalStore(new TraceLedger());
    const count = await store2.load('/tmp/test-signals.json');

    expect(count).toBe(2);
    expect(store2.getByType('session:started')).toHaveLength(1);
  });
});
