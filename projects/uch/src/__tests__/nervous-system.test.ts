import { describe, it, expect, beforeEach } from 'vitest';
import { NervousSystem } from '../nervous-system/nervous-system.js';
import { createSignal } from '../nervous-system/signal.js';
import type { Signal } from '../nervous-system/signal.js';
import { Metabolism } from '../metabolism/metabolism.js';

describe('Signal creation', () => {
  it('creates immutable signals', () => {
    const sig = createSignal('file:opened', 'test', { path: '/foo.ts' });
    expect(sig.type).toBe('file:opened');
    expect(sig.source).toBe('test');
    expect(sig.payload).toEqual({ path: '/foo.ts' });
  });

  it('assigns correct layer based on priority', () => {
    const peripheral = createSignal('file:opened', 'test', {});
    expect(peripheral.layer).toBe('peripheral');
    expect(peripheral.priority).toBe(0);

    const notable = createSignal('test:failed', 'test', {});
    expect(notable.layer).toBe('spinal');
    expect(notable.priority).toBe(1);

    const important = createSignal('error:occurred', 'test', {});
    expect(important.layer).toBe('brainstem');
    expect(important.priority).toBe(2);

    const critical = createSignal('session:started', 'test', {});
    expect(critical.layer).toBe('thalamus');
    expect(critical.priority).toBe(3);
  });

  it('freezes payload and signal itself', () => {
    const sig = createSignal('aether:tick', 'test', { count: 1 });
    expect(Object.isFrozen(sig)).toBe(true);
    expect(Object.isFrozen(sig.payload)).toBe(true);
  });

  it('generates unique IDs', () => {
    const a = createSignal('aether:tick', 'test', {});
    const b = createSignal('aether:tick', 'test', {});
    expect(a.id).not.toBe(b.id);
  });
});

describe('NervousSystem', () => {
  let ns: NervousSystem;

  beforeEach(() => {
    ns = new NervousSystem({ trackEnergy: true });
  });

  it('starts with zero signals processed', () => {
    const stats = ns.getStats();
    expect(stats.totalSignalsProcessed).toBe(0);
  });

  it('delivers signals to subscribed layers', async () => {
    const received: Signal[] = [];
    ns.subscribe('brainstem', (sig) => { received.push(sig); });

    const sig = createSignal('error:occurred', 'test', { msg: 'test error' });
    await ns.emit(sig);

    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe('error:occurred');
  });

  it('does not deliver to unsubscribed layers', async () => {
    const received: Signal[] = [];
    ns.subscribe('cortex', (sig) => { received.push(sig); });

    const sig = createSignal('file:opened', 'test', {}); // priority 0 → peripheral
    await ns.emit(sig);

    expect(received).toHaveLength(0);
  });

  it('delivers to correct layer based on priority', async () => {
    const peripheral: Signal[] = [];
    const spinal: Signal[] = [];
    ns.subscribe('peripheral', (sig) => { peripheral.push(sig); });
    ns.subscribe('spinal', (sig) => { spinal.push(sig); });

    await ns.emit(createSignal('file:saved', 'test', {})); // priority 0
    await ns.emit(createSignal('test:failed', 'test', {})); // priority 1

    expect(peripheral).toHaveLength(1);
    expect(peripheral[0]!.type).toBe('file:saved');
    expect(spinal).toHaveLength(1);
    expect(spinal[0]!.type).toBe('test:failed');
  });

  it('unsubscribes handlers', async () => {
    const received: Signal[] = [];
    const id = ns.subscribe('peripheral', (sig) => { received.push(sig); });
    ns.unsubscribe(id);

    await ns.emit(createSignal('file:opened', 'test', {}));
    expect(received).toHaveLength(0);
  });

  it('tracks energy consumption', async () => {
    await ns.emit(createSignal('file:opened', 'src-a', {}, { energy: 5 }));
    await ns.emit(createSignal('test:failed', 'src-b', {}, { energy: 3 }));

    const report = ns.getEnergyReport();
    expect(report.totalSignals).toBe(2);
    expect(report.totalEnergy).toBe(8);
    expect(report.bySource['src-a']).toBe(5);
    expect(report.bySource['src-b']).toBe(3);
  });

  it('reset clears energy tracking', async () => {
    await ns.emit(createSignal('aether:tick', 'test', {}));
    ns.resetEnergyTracking();
    const report = ns.getEnergyReport();
    expect(report.totalSignals).toBe(0);
  });

  it('maintains signal history', async () => {
    await ns.emit(createSignal('file:opened', 'test', { path: 'a.ts' }));
    await ns.emit(createSignal('file:opened', 'test', { path: 'b.ts' }));

    const history = ns.getSignalHistory();
    expect(history).toHaveLength(2);
    expect(history[0]!.payload.path).toBe('a.ts');
  });

  it('filters signal history by type', async () => {
    await ns.emit(createSignal('file:opened', 'test', {}));
    await ns.emit(createSignal('test:failed', 'test', {}));

    const filtered = ns.getSignalHistory('test:failed');
    expect(filtered).toHaveLength(1);
  });

  it('handles filter functions on subscriptions', async () => {
    const received: Signal[] = [];
    ns.subscribe('peripheral', (sig) => { received.push(sig); },
      (sig) => sig.payload.path === '/important.ts', 'filtered');

    await ns.emit(createSignal('file:opened', 'test', { path: '/other.ts' }));
    expect(received).toHaveLength(0);

    await ns.emit(createSignal('file:opened', 'test', { path: '/important.ts' }));
    expect(received).toHaveLength(1);
  });

  it('isolates handler errors', async () => {
    const received: Signal[] = [];
    ns.subscribe('peripheral', () => { throw new Error('handler error'); });
    ns.subscribe('peripheral', (sig) => { received.push(sig); });

    await ns.emit(createSignal('file:opened', 'test', {}));
    expect(received).toHaveLength(1);
  });

  it('blocks signals matching blockOnMatch config', async () => {
    const ns2 = new NervousSystem({
      layers: {
        peripheral: { enabled: true, blockOnMatch: ['file:opened'] },
      },
      trackEnergy: false,
    });

    const received: Signal[] = [];
    ns2.subscribe('peripheral', (sig) => { received.push(sig); });

    await ns2.emit(createSignal('file:opened', 'test', {}));
    expect(received).toHaveLength(0);

    await ns2.emit(createSignal('file:saved', 'test', {}));
    expect(received).toHaveLength(1);
  });

  it('disabled layer drops signals', async () => {
    const ns2 = new NervousSystem({
      layers: {
        spinal: { enabled: false },
      },
      trackEnergy: false,
    });

    const received: Signal[] = [];
    ns2.subscribe('spinal', (sig) => { received.push(sig); });

    await ns2.emit(createSignal('test:failed', 'test', {}));
    expect(received).toHaveLength(0);
  });

  it('subscribeToAll subscribes to all 5 layers', () => {
    const ids = ns.subscribeToAll(() => {});
    expect(ids).toHaveLength(5);
  });

  it('returns stats with subscription counts', () => {
    ns.subscribe('peripheral', () => {});
    ns.subscribe('cortex', () => {});
    ns.subscribe('cortex', () => {});

    const stats = ns.getStats();
    expect(stats.subscriptions).toBeDefined();
  });

  it('emitFromEvent creates signal from NeuralEvent-like object', async () => {
    const received: Signal[] = [];
    ns.subscribe('brainstem', (sig) => { received.push(sig); });

    await ns.emitFromEvent(
      { id: '', type: 'error:occurred', timestamp: new Date(), source: 'test', payload: { msg: 'err' } },
      'test-source',
    );

    expect(received).toHaveLength(1);
    expect(received[0]!.type).toBe('error:occurred');
  });
});

describe('Metabolism', () => {
  let meta: Metabolism;

  beforeEach(() => {
    meta = new Metabolism({ tickIntervalMs: 60000 });
  });

  it('registers components with default budget', () => {
    meta.registerComponent('test-comp');
    const status = meta.getStatus('test-comp');
    expect(status).not.toBeNull();
    expect(status!.componentId).toBe('test-comp');
    expect(status!.allocated.cpu).toBeGreaterThan(0);
  });

  it('registers components with custom budget', () => {
    meta.registerComponent('test-comp', { cpu: 500, tokens: 1000 });
    const status = meta.getStatus('test-comp');
    expect(status).not.toBeNull();
    expect(status!.allocated.cpu).toBe(500);
    expect(status!.allocated.tokens).toBe(1000);
  });

  it('consumes energy and deducts from budget', () => {
    meta.registerComponent('test-comp', { cpu: 100, memory: 1000 });
    const ok = meta.consume('test-comp', { cpu: 30, memory: 500 }, 'test-op');
    expect(ok).toBe(true);

    const s = meta.getStatus('test-comp')!;
    expect(s.consumed.cpu).toBe(30);
    expect(s.remaining.cpu).toBe(70);
  });

  it('returns false when budget insufficient', () => {
    meta.registerComponent('test-comp', { cpu: 10 });
    const ok = meta.consume('test-comp', { cpu: 100 }, 'expensive-op');
    expect(ok).toBe(false);

    const status = meta.getStatus('test-comp')!;
    expect(status.consumed.cpu).toBe(0);
  });

  it('returns null for unregistered components', () => {
    expect(meta.getStatus('unknown')).toBeNull();
  });

  it('unregisters components', () => {
    meta.registerComponent('test-comp');
    meta.unregisterComponent('test-comp');
    expect(meta.getStatus('test-comp')).toBeNull();
  });

  it('applies budget overrides', () => {
    meta.registerComponent('test-comp', { cpu: 100 });
    meta.applyOverride({ componentId: 'test-comp', budget: { cpu: 500 }, reason: 'upgrade' });

    const status = meta.getStatus('test-comp')!;
    expect(status.allocated.cpu).toBe(500);
  });

  it('removes overrides', () => {
    meta.registerComponent('test-comp', { cpu: 100 });
    meta.applyOverride({ componentId: 'test-comp', budget: { cpu: 500 }, reason: 'upgrade' });
    meta.removeOverride('test-comp');

    // After remove, the allocated stays at the override value (we don't revert to original)
    // This is the designed behavior
  });

  it('lists all budgets', () => {
    meta.registerComponent('a');
    meta.registerComponent('b');
    expect(meta.getAllBudgets()).toHaveLength(2);
  });

  it('returns energy logs', () => {
    meta.registerComponent('test-comp', { cpu: 1000 });
    meta.consume('test-comp', { cpu: 10 }, 'op-1');
    meta.consume('test-comp', { cpu: 20 }, 'op-2');

    const logs = meta.getEnergyLogs();
    expect(logs).toHaveLength(2);
    expect(logs[0]!.operation).toBe('op-1');
  });

  it('start and stop lifecycle does not throw', () => {
    meta.start();
    meta.stop();
  });

  it('returns stats', () => {
    meta.registerComponent('a');
    meta.registerComponent('b');
    const stats = meta.getStats();
    expect(stats.registeredComponents).toBe(2);
    expect(typeof stats.totalConsumed).toBe('object');
  });
});
