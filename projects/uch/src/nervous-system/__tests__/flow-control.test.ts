/**
 * Signal Flow Control — prototype tests (IDEA-0085).
 *
 * Coverage: preemption lanes (emergencies bypass bounded queues),
 * token-bucket rate limiting (RFC 2697 semantics, grant-derived
 * capacity), backpressure on queue saturation with ledgered refusal,
 * quality floor (throttle vs quarantine by budget health), and the
 * derived fabric report.
 */

import { describe, expect, it } from 'vitest';
import { SignalFlowController, flowControlReport } from '../flow-control.js';

const healthy = { grant: 1, budgetHealth: 'healthy' as const };

describe('preemption lanes (Law 16)', () => {
  it('emergency traffic bypasses a saturated queue', () => {
    const controller = new SignalFlowController({ queueDepth: 2 });
    controller.registerSource('verifier', healthy);
    controller.submit({ signalId: 'v1', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    controller.submit({ signalId: 'v2', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    const refused = controller.submit({ signalId: 'v3', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    expect(refused?.reason).toBe('backpressure');
    const emergency = controller.submit({ signalId: 'e1', source: 'verifier', type: 'agent:attached', priority: 3, tick: 1 });
    expect(emergency).toBeNull();
    expect(controller.delivered().some((s) => s.signalId === 'e1' && s.lane === 'immediate')).toBe(true);
  });

  it('emergency signals never queue behind background traffic', () => {
    const controller = new SignalFlowController({ queueDepth: 1 });
    controller.registerSource('watcher', healthy);
    controller.submit({ signalId: 'b1', source: 'watcher', type: 'file:saved', priority: 0, tick: 1 });
    controller.submit({ signalId: 'b2', source: 'watcher', type: 'file:saved', priority: 0, tick: 1 });
    const em = controller.submit({ signalId: 'e1', source: 'watcher', type: 'error:occurred', priority: 2, tick: 1 });
    // priority 2 is below the preemption tier (3) — it queues or refuses
    expect(em === null || em.reason === 'backpressure').toBe(true);
    const top = controller.submit({ signalId: 'e2', source: 'watcher', type: 'session:started', priority: 3, tick: 1 });
    expect(top).toBeNull();
    expect(controller.delivered().filter((s) => s.lane === 'immediate').map((s) => s.signalId)).toEqual(['e2']);
  });
});

describe('token buckets (per-source rate limiting)', () => {
  it('grant magnitude scales bucket capacity', () => {
    const controller = new SignalFlowController({ bucketCapacity: 10 });
    controller.registerSource('chatty', { grant: 2, budgetHealth: 'healthy' });
    controller.registerSource('quiet', { grant: 0.1, budgetHealth: 'healthy' });
    expect(controller.bucketOf('chatty')?.capacity).toBe(20);
    expect(controller.bucketOf('quiet')?.capacity).toBe(1);
  });

  it('a drained bucket rate-limits its source', () => {
    const controller = new SignalFlowController({ bucketCapacity: 2, refillRate: 0 });
    controller.registerSource('chatty', healthy);
    controller.tick(1);
    expect(controller.submit({ signalId: 's1', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 })).toBeNull();
    expect(controller.submit({ signalId: 's2', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 })).toBeNull();
    const refused = controller.submit({ signalId: 's3', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 });
    expect(refused?.reason).toBe('rate');
  });

  it('refill restores admission capacity per tick', () => {
    const controller = new SignalFlowController({ bucketCapacity: 1, refillRate: 1 });
    controller.registerSource('chatty', healthy);
    controller.tick(1);
    controller.submit({ signalId: 's1', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 });
    expect(controller.submit({ signalId: 's2', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 })?.reason).toBe('rate');
    controller.tick(2);
    expect(controller.submit({ signalId: 's3', source: 'chatty', type: 'terminal:output', priority: 0, tick: 2 })).toBeNull();
  });
});

describe('backpressure on queue saturation', () => {
  it('refuses with a ledgered backpressure reason when the queue is full', () => {
    const controller = new SignalFlowController({ queueDepth: 1 });
    controller.registerSource('verifier', healthy);
    controller.tick(1);
    controller.submit({ signalId: 's1', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    const refused = controller.submit({ signalId: 's2', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    expect(refused?.reason).toBe('backpressure');
    expect(controller.refusalsFor(1)).toHaveLength(1);
    expect(controller.isBackpressured('verifier')).toBe(true);
  });

  it('draining releases the queue', () => {
    const controller = new SignalFlowController({ queueDepth: 2 });
    controller.registerSource('verifier', healthy);
    controller.tick(1);
    controller.submit({ signalId: 's1', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    expect(controller.isBackpressured('verifier')).toBe(false);
    controller.submit({ signalId: 's2', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    expect(controller.isBackpressured('verifier')).toBe(true);
    const refused = controller.submit({ signalId: 's3', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    expect(refused?.reason).toBe('backpressure');
    const drained = controller.drain('verifier');
    expect(drained.map((s) => s.signalId)).toEqual(['s1', 's2']);
    expect(controller.queueOccupancy('verifier')).toBe(0);
  });
});

describe('quality floor (throttle vs quarantine)', () => {
  it('an exhausted budget quarantines the source', () => {
    const controller = new SignalFlowController({ quarantineOnExhaustion: true });
    controller.registerSource('verifier', { grant: 1, budgetHealth: 'exhausted' });
    controller.tick(1);
    const refused = controller.submit({ signalId: 's1', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 });
    expect(refused?.reason).toBe('quarantine');
  });

  it('a degraded budget still admits (throttle, not quarantine)', () => {
    const controller = new SignalFlowController({ quarantineOnExhaustion: true });
    controller.registerSource('verifier', { grant: 1, budgetHealth: 'degraded' });
    controller.tick(1);
    expect(controller.submit({ signalId: 's1', source: 'verifier', type: 'verify:request', priority: 1, tick: 1 })).toBeNull();
  });
});

describe('refusal ledger + derived report', () => {
  it('every refusal is ledgered with a reason (replay completeness)', () => {
    const controller = new SignalFlowController({ bucketCapacity: 1, refillRate: 0, queueDepth: 1 });
    controller.registerSource('chatty', healthy);
    controller.tick(1);
    controller.submit({ signalId: 's1', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 });
    controller.submit({ signalId: 's2', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 });
    const refusals = controller.refusalsFor(1);
    expect(refusals.length).toBeGreaterThan(0);
    for (const r of refusals) expect(['rate', 'backpressure', 'quarantine']).toContain(r.reason);
  });

  it('aggregates the fabric report', () => {
    const controller = new SignalFlowController({ bucketCapacity: 2, refillRate: 1, queueDepth: 1 });
    controller.registerSource('chatty', healthy);
    controller.tick(1);
    controller.submit({ signalId: 's1', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 });
    controller.submit({ signalId: 's2', source: 'chatty', type: 'terminal:output', priority: 0, tick: 1 });
    controller.submit({ signalId: 's3', source: 'chatty', type: 'terminal:output', priority: 0, tick: 2 });
    controller.submit({ signalId: 'e1', source: 'chatty', type: 'error:occurred', priority: 2, tick: 2 });
    // Delivered counts drained/preempted signals — the consumer's
    // consume() must run before the report sees them.
    controller.drain('chatty');
    const report = flowControlReport(controller, 2);
    expect(report.delivered).toBeGreaterThan(0);
    expect(report.refusalRate).toBeGreaterThan(0);
    expect(report.refusalRate).toBeLessThanOrEqual(1);
  });
});
