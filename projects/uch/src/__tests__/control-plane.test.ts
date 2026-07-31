import { describe, it, expect } from 'vitest';
import { Lifecycle } from '../control-plane/lifecycle.js';
import { PolicyEngine } from '../control-plane/policies.js';

describe('Lifecycle', () => {
  it('registers services and resolves dependency order', async () => {
    const lc = new Lifecycle();
    const order: string[] = [];

    lc.register({
      name: 'database',
      version: '1.0',
      dependencies: [],
      start: async () => { order.push('database'); },
      stop: async () => { order.push('database-stop'); },
    });
    lc.register({
      name: 'server',
      version: '1.0',
      dependencies: ['database'],
      start: async () => { order.push('server'); },
      stop: async () => { order.push('server-stop'); },
    });

    await lc.startAll();
    expect(order).toEqual(['database', 'server']);

    await lc.stopAll();
    expect(order).toEqual(['database', 'server', 'server-stop', 'database-stop']);
  });

  it('tracks service status', () => {
    const lc = new Lifecycle();
    lc.register({
      name: 'svc', version: '1.0', dependencies: [],
      start: async () => {},
      stop: async () => {},
    });

    expect(lc.getStatus('svc')).toBe('stopped');
  });

  it('handles start failure', async () => {
    const lc = new Lifecycle();
    lc.register({
      name: 'failing', version: '1.0', dependencies: [],
      start: async () => { throw new Error('fail'); },
      stop: async () => {},
    });

    const result = await lc.start('failing');
    expect(result).toBe(false);
    expect(lc.getStatus('failing')).toBe('failed');
  });

  it('return false for unknown service', async () => {
    const lc = new Lifecycle();
    expect(await lc.start('unknown')).toBe(false);
    expect(lc.getStatus('unknown')).toBeUndefined();
  });

  it('reports all service status', async () => {
    const lc = new Lifecycle();
    lc.register({ name: 'a', version: '1.0', dependencies: [], start: async () => {}, stop: async () => {} });
    lc.register({ name: 'b', version: '1.0', dependencies: ['a'], start: async () => {}, stop: async () => {} });

    await lc.startAll();
    const allStatus = lc.getAllStatus();
    expect(allStatus).toHaveLength(2);
    expect(allStatus[0]!.name).toBe('a');
    expect(allStatus[1]!.name).toBe('b');
  });
});

describe('PolicyEngine', () => {
  it('allows matching actions', () => {
    const engine = new PolicyEngine();
    engine.addRule({ id: 'r1', effect: 'allow', principals: ['*'], actions: ['read'], resources: ['*'], priority: 1 });

    const result = engine.evaluate({ principal: 'agent-1', action: 'read', resource: 'memory' });
    expect(result.allowed).toBe(true);
  });

  it('denies when no rule matches', () => {
    const engine = new PolicyEngine();
    const result = engine.evaluate({ principal: 'agent-1', action: 'write', resource: 'memory' });
    expect(result.allowed).toBe(false);
  });

  it('deny rules override allow when higher priority', () => {
    const engine = new PolicyEngine();
    engine.addRule({ id: 'allow-all', effect: 'allow', principals: ['*'], actions: ['*'], resources: ['*'], priority: 1 });
    engine.addRule({ id: 'deny-write', effect: 'deny', principals: ['*'], actions: ['write'], resources: ['*'], priority: 10 });

    expect(engine.evaluate({ principal: 'agent-1', action: 'read', resource: 'any' }).allowed).toBe(true);
    expect(engine.evaluate({ principal: 'agent-1', action: 'write', resource: 'any' }).allowed).toBe(false);
  });

  it('matches namespaced wildcard actions like git:*', () => {
    const engine = new PolicyEngine();
    engine.addRule({ id: 'allow-git', effect: 'allow', principals: ['agent-*'], actions: ['git:*'], resources: ['ws-*'], priority: 1 });

    expect(engine.evaluate({ principal: 'agent-1', action: 'git:commit', resource: 'ws-test' }).allowed).toBe(true);
    expect(engine.evaluate({ principal: 'agent-1', action: 'git:push', resource: 'ws-test' }).allowed).toBe(true);
    expect(engine.evaluate({ principal: 'agent-2', action: 'git:commit', resource: 'ws-other' }).allowed).toBe(true);
    expect(engine.evaluate({ principal: 'agent-1', action: 'deployment:started', resource: 'ws-test' }).allowed).toBe(false);
    expect(engine.evaluate({ principal: 'other', action: 'git:commit', resource: 'ws-test' }).allowed).toBe(false);
    expect(engine.evaluate({ principal: 'agent-1', action: 'git:commit', resource: 'other-ws' }).allowed).toBe(false);
  });

  it('evaluates conditions', () => {
    const engine = new PolicyEngine();
    engine.addRule({
      id: 'r1', effect: 'allow', principals: ['*'], actions: ['read'], resources: ['memory'],
      conditions: { role: 'admin' }, priority: 1,
    });

    expect(engine.evaluate({ principal: 'agent-1', action: 'read', resource: 'memory', context: { role: 'admin' } }).allowed).toBe(true);
    expect(engine.evaluate({ principal: 'agent-1', action: 'read', resource: 'memory', context: { role: 'guest' } }).allowed).toBe(false);
  });

  it('removes rules', () => {
    const engine = new PolicyEngine();
    engine.addRule({ id: 'r1', effect: 'allow', principals: ['*'], actions: ['*'], resources: ['*'], priority: 1 });
    expect(engine.getAllRules()).toHaveLength(1);
    engine.removeRule('r1');
    expect(engine.getAllRules()).toHaveLength(0);
  });

  it('clears all rules', () => {
    const engine = new PolicyEngine();
    engine.addRule({ id: 'r1', effect: 'allow', principals: ['*'], actions: ['*'], resources: ['*'], priority: 1 });
    engine.addRule({ id: 'r2', effect: 'deny', principals: ['*'], actions: ['*'], resources: ['*'], priority: 2 });
    engine.clear();
    expect(engine.getAllRules()).toHaveLength(0);
  });
});
