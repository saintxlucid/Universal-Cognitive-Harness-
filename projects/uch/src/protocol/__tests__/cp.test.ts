import { describe, it, expect } from 'vitest';
import { CognitiveKernel } from '../../kernel/cognitive-kernel.js';
import {
  CPServer,
  CP_PROTOCOL_ID,
  CP_VERSION,
  CP_OPS,
  createDefaultCPServer,
  parseCPRequest,
  isCompatibleVersion,
} from '../index.js';
import { runConformance, assertConformance } from '../conformance.js';

function makeKernel(): CognitiveKernel {
  return new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
}

describe('CP envelope', () => {
  it('validates a well-formed request', () => {
    const parsed = parseCPRequest({
      protocol: CP_PROTOCOL_ID,
      version: CP_VERSION,
      op: 'ping',
      payload: {},
    });
    expect(parsed.error).toBeUndefined();
    expect(parsed.request?.op).toBe('ping');
    expect(parsed.request?.requestId).toBeDefined();
  });

  it('rejects wrong protocol', () => {
    const parsed = parseCPRequest({ protocol: 'mcp', version: CP_VERSION, op: 'ping', payload: {} });
    expect(parsed.error?.code).toBe('BAD_REQUEST');
  });

  it('rejects unsupported version', () => {
    const parsed = parseCPRequest({ protocol: CP_PROTOCOL_ID, version: '9.0.0', op: 'ping', payload: {} });
    expect(parsed.error?.code).toBe('UNSUPPORTED_VERSION');
  });

  it('rejects unknown op', () => {
    const parsed = parseCPRequest({ protocol: CP_PROTOCOL_ID, version: CP_VERSION, op: 'bogus', payload: {} });
    expect(parsed.error?.code).toBe('UNSUPPORTED_OP');
  });

  it('accepts same-major versions', () => {
    expect(isCompatibleVersion('1.2.3')).toBe(true);
    expect(isCompatibleVersion('2.0.0')).toBe(false);
    expect(isCompatibleVersion('0.9.0')).toBe(false);
  });
});

describe('CPServer', () => {
  it('registers, lists and unregisters handlers', () => {
    const server = new CPServer();
    server.register({ op: 'ping', version: '1.0.0', description: 'liveness', handler: () => ({ pong: true }) });
    expect(server.has('ping')).toBe(true);
    expect(server.listOps().map((s) => s.op)).toContain('ping');
    server.unregister('ping');
    expect(server.has('ping')).toBe(false);
  });

  it('dispatches to handlers with the full envelope', async () => {
    const server = new CPServer();
    server.register({
      op: 'ping', version: '1.0.0', description: 'liveness', handler: () => ({ pong: true }),
    });
    const res = await server.dispatch({
      protocol: CP_PROTOCOL_ID,
      version: CP_VERSION,
      op: 'ping',
      requestId: 'r1',
      timestamp: new Date().toISOString(),
      payload: {},
    });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ pong: true });
    expect(res.requestId).toBe('r1');
    expect(res.meta.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns UNSUPPORTED_OP when no handler is registered', async () => {
    const server = new CPServer();
    const res = await server.invoke('retrieve', { query: 'x' });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('UNSUPPORTED_OP');
  });

  it('wraps handler errors as HANDLER_ERROR', async () => {
    const server = new CPServer();
    server.register({ op: 'ping', version: '1.0.0', description: 'x', handler: () => { throw new Error('boom'); } });
    const res = await server.invoke('ping', {});
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('HANDLER_ERROR');
    expect(res.error?.message).toContain('boom');
  });

  it('invoke builds envelopes and stays safe for unknown ops', async () => {
    const server = new CPServer();
    server.register({ op: 'ping', version: '1.0.0', description: 'liveness', handler: () => ({ pong: true }) });
    const ok = await server.invoke('ping', {});
    expect(ok.success).toBe(true);
    const bad = await server.invoke('nope', {});
    expect(bad.success).toBe(false);
    expect(bad.error?.code).toBe('UNSUPPORTED_OP');
  });
});

describe('default CP server (kernel-backed)', () => {
  it('implements every CP op', () => {
    const server = createDefaultCPServer(makeKernel());
    const ops = server.listOps().map((s) => s.op);
    for (const op of CP_OPS) {
      expect(ops, `missing op ${op}`).toContain(op);
    }
  });

  it('observe stores and retrieve finds', async () => {
    const server = createDefaultCPServer(makeKernel());
    const observed = await server.invoke('observe', { text: 'the deploy pipeline uses canary releases' });
    expect(observed.success).toBe(true);
    const retrieved = await server.invoke('retrieve', { query: 'canary releases', limit: 5 });
    expect(retrieved.success).toBe(true);
    const results = (retrieved.data as { results: unknown[] }).results;
    expect(results.length).toBeGreaterThan(0);
  });

  it('learn integrates beliefs visible in reflect', async () => {
    const server = createDefaultCPServer(makeKernel());
    const learned = await server.invoke('learn', {
      proposition: 'CP v1 is the stable contract',
      evidence: 'conformance suite passed',
      reliability: 0.95,
    });
    expect(learned.success).toBe(true);
    const reflected = await server.invoke('reflect', { limit: 5 });
    const beliefs = (reflected.data as { beliefs: Array<{ value: string }> }).beliefs;
    expect(beliefs.some((b) => b.value === 'CP v1 is the stable contract')).toBe(true);
  });

  it('plan, predict, simulate, evaluate, critique, execute all succeed', async () => {
    const server = createDefaultCPServer(makeKernel());
    for (const [op, payload] of [
      ['plan', { goal: 'ship the kernel' }],
      ['predict', { horizon: 7 }],
      ['simulate', { scenario: 'cold start' }],
      ['evaluate', {}],
      ['critique', { query: 'nothing about this ever existed' }],
      ['execute', { action: 'noop' }],
    ] as const) {
      const res = await server.invoke(op, payload);
      expect(res.success, `${op}: ${res.error?.message}`).toBe(true);
    }
  });

  it('consolidate and dream run sleep cycles', async () => {
    const server = createDefaultCPServer(makeKernel());
    const consolidate = await server.invoke('consolidate', {});
    expect(consolidate.success).toBe(true);
    const dream = await server.invoke('dream', {});
    expect(dream.success).toBe(true);
  });

  it('handler replacement swaps a cognitive module without touching others', async () => {
    const server = createDefaultCPServer(makeKernel());
    server.register({
      op: 'plan', version: '2.0.0', description: 'custom planner',
      handler: () => ({ goal: 'custom', derivedSteps: [{ order: 1, action: 'custom-step' }] }),
    });
    const res = await server.invoke('plan', { goal: 'x' });
    expect((res.data as { goal: string }).goal).toBe('custom');
    const ping = await server.invoke('ping', {});
    expect(ping.success).toBe(true);
  });
});

describe('CP conformance', () => {
  it('passes the full conformance suite against the default server', async () => {
    const server = createDefaultCPServer(makeKernel());
    const report = await runConformance(server);
    expect(report.failed).toBe(0);
    expect(report.total).toBeGreaterThan(15);
    expect(() => assertConformance(report)).not.toThrow();
  });

  it('fails conformance when a core op is broken', async () => {
    const server = new CPServer();
    server.register({ op: 'ping', version: '1.0.0', description: 'broken ping', handler: () => { throw new Error('kaput'); } });
    const report = await runConformance(server);
    expect(report.failed).toBeGreaterThan(0);
    expect(() => assertConformance(report)).toThrow(/CP conformance failed/);
  });
});
