import { describe, it, expect } from 'vitest';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { ProductivityKernel } from '../productivity-kernel/productivity-kernel.js';
import { SignalFusionEngine } from '../cortex_kernel/signal-fusion-engine.js';
import { CodeGovernanceGate } from '../kernel/constitution/code-governance-gate.js';
import {
  createWiredProductivityKernel,
  createWiredSignalFusionEngine,
  createWiredCodeGovernanceGate,
} from '../cognitive-runtime/organ-wiring.js';

describe('E1: organ event types + event-driven workflow wiring', () => {
  it('publishes productivity:task_captured and productivity:day_planned to the bus', async () => {
    const bus = new NeuralEventBus();
    const received: string[] = [];
    bus.subscribe(
      ['productivity:task_captured', 'productivity:day_planned'],
      (event) => {
        received.push(event.type);
      },
    );

    const kernel = createWiredProductivityKernel(bus);
    kernel.capture('write release notes', 2);
    kernel.initializeDay([
      { name: 'ship the payments fix', urgency: 'urgent', importance: 'important', durationMin: 60 },
    ]);
    await new Promise((r) => setTimeout(r, 10));

    expect(received).toContain('productivity:task_captured');
    expect(received).toContain('productivity:day_planned');
  });

  it('publishes signal:fused with recommendation bands', async () => {
    const bus = new NeuralEventBus();
    let payload: Record<string, unknown> | undefined;
    bus.subscribe('signal:fused', (event) => {
      payload = event.payload;
    });

    const engine = createWiredSignalFusionEngine(bus);
    engine.fuse([
      {
        name: 'Alpha',
        factors: [
          { id: 'quality' as const, label: 'quality', score: 0.8 },
          { id: 'fundamentals' as const, label: 'fundamentals', score: 0.7 },
          { id: 'momentum' as const, label: 'momentum', score: 0.6 },
        ],
      },
      {
        name: 'Beta',
        factors: [{ id: 'momentum' as const, label: 'momentum', score: 0.3 }],
      },
    ]);
    await new Promise((r) => setTimeout(r, 10));

    expect(payload).toBeDefined();
    expect(payload!.buy).toEqual(['Alpha']);
    expect(payload!.risk_flags).toBeGreaterThan(0);
  });

  it('publishes governance:code_reviewed with verdict and score', async () => {
    const bus = new NeuralEventBus();
    let payload: Record<string, unknown> | undefined;
    bus.subscribe('governance:code_reviewed', (event) => {
      payload = event.payload;
    });

    const gate = createWiredCodeGovernanceGate(bus);
    gate.review({
      change: 'rewrites the same logic in three places with duplicated code',
      target: 'src/pricing/discount.ts',
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(payload).toBeDefined();
    expect(payload!.target).toBe('src/pricing/discount.ts');
    expect(payload!.verdict).toBe('block');
  });

  it('emits no events when organs are unwired (default-off observability)', () => {
    const bus = new NeuralEventBus();
    let count = 0;
    bus.subscribe((event) => {
      if (
        event.type === 'signal:fused' ||
        event.type === 'governance:code_reviewed' ||
        event.type === 'productivity:task_captured' ||
        event.type === 'productivity:day_planned'
      ) {
        count++;
      }
    });

    const kernel = new ProductivityKernel();
    const engine = new SignalFusionEngine();
    const gate = new CodeGovernanceGate();
    kernel.capture('a');
    engine.fuse([
      {
        name: 'Alpha',
        factors: [{ id: 'quality' as const, label: 'quality', score: 0.8 }],
      },
    ]);
    gate.review({ change: 'clean minimal change', target: 'a.ts' });

    expect(count).toBe(0);
  });
});
