import { describe, it, expect } from 'vitest';
import { InferenceFabric } from '../accelerators/fabric.js';
import { CognitiveScheduler, RISK_HUMAN_APPROVAL } from '../accelerators/scheduler.js';
import { ACCELERATORS } from '../accelerators/implementations.js';
import { normalizeProfile, DEFAULT_PROFILE } from '../accelerators/profile.js';
import type { InferenceProvider } from '../accelerators/types.js';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';

function mockProvider(id: string, opts?: { fail?: boolean }): InferenceProvider {
  return {
    id,
    label: `Mock ${id}`,
    isAvailable: () => true,
    complete: async () => {
      if (opts?.fail) throw new Error(`provider ${id} failed`);
      return JSON.stringify({ entities: [`${id}Entity`], topics: ['mock'], confidence: 0.9, importance: 0.7 });
    },
  };
}

describe('Cognitive Scheduler — strategy planning', () => {
  it('trivial task plans deterministic (frugality gate)', () => {
    const scheduler = new CognitiveScheduler(new InferenceFabric(false));
    const strategy = scheduler.plan({ complexity: 0.1, reasoningNeeded: 0.1, creativityNeeded: 0.1, verificationNeeded: 0.1 });
    expect(strategy.kind).toBe('deterministic');
    expect(strategy.rationale).toContain('frugality');
  });

  it('high risk plans human approval', () => {
    const scheduler = new CognitiveScheduler(new InferenceFabric(false));
    const strategy = scheduler.plan({ risk: 0.9 });
    expect(strategy.kind).toBe('human_approval');
    expect(strategy.rationale).toContain('approval');
  });

  it('deep reasoning plans large model', () => {
    const scheduler = new CognitiveScheduler(new InferenceFabric(false));
    const strategy = scheduler.plan({ complexity: 0.5, reasoningNeeded: 0.8 });
    expect(strategy.kind).toBe('large_model');
    expect(strategy.maxTokens).toBeGreaterThan(800);
  });

  it('high verification plans multi-model', () => {
    const scheduler = new CognitiveScheduler(new InferenceFabric(false));
    const strategy = scheduler.plan({ complexity: 0.5, verificationNeeded: 0.8 });
    expect(strategy.kind).toBe('multi_model');
    expect(strategy.retries).toBeGreaterThanOrEqual(2);
  });

  it('routine cognition plans small model', () => {
    const scheduler = new CognitiveScheduler(new InferenceFabric(false));
    const strategy = scheduler.plan({ complexity: 0.5, reasoningNeeded: 0.3, verificationNeeded: 0.2 });
    expect(strategy.kind).toBe('small_model');
  });

  it('cache hit plans cached when not trivial', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('alpha'));
    const scheduler = new CognitiveScheduler(fabric);
    await scheduler.dispatch(ACCELERATORS.semantic, { text: 'cache me please' }, { complexity: 0.5 });
    const key = scheduler.cacheKey('semantic', { text: 'cache me please' });
    const strategy = scheduler.plan({ complexity: 0.5 }, { cacheKey: key });
    expect(strategy.kind).toBe('cached');
  });

  it('risk threshold constant is 0.8', () => {
    expect(RISK_HUMAN_APPROVAL).toBe(0.8);
  });
});

describe('Cognitive Scheduler — dispatch', () => {
  it('deterministic strategy never calls providers', async () => {
    const fabric = new InferenceFabric(false);
    let calls = 0;
    fabric.registerProvider({
      id: 'counter', label: 'Counter', isAvailable: () => true,
      complete: async () => { calls += 1; return '{"entities":[]}'; },
    });
    const scheduler = new CognitiveScheduler(fabric);
    const result = await scheduler.dispatch(ACCELERATORS.semantic, { text: 'a trivial hello' }, { complexity: 0.1 });
    expect(result.strategy.kind).toBe('deterministic');
    expect(result.fired).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(calls).toBe(0);
  });

  it('caches and replays successful reasoning without re-firing providers', async () => {
    const fabric = new InferenceFabric(false);
    let calls = 0;
    fabric.registerProvider({
      id: 'alpha', label: 'Alpha', isAvailable: () => true,
      complete: async () => {
        calls += 1;
        return JSON.stringify({ entities: ['AuthService'], topics: ['auth'], confidence: 0.9, importance: 0.8 });
      },
    });
    const scheduler = new CognitiveScheduler(fabric);
    await scheduler.dispatch(ACCELERATORS.semantic, { text: 'warmup for the probe' }, { complexity: 0.5 });
    calls = 0;
    const first = await scheduler.dispatch(ACCELERATORS.semantic, { text: 'The AuthService handles login.' }, { complexity: 0.5, reasoningNeeded: 0.5 });
    expect(first.fired).toBe(true);
    expect(first.cached).toBe(false);

    const second = await scheduler.dispatch(ACCELERATORS.semantic, { text: 'The AuthService handles login.' }, { complexity: 0.5, reasoningNeeded: 0.5 });
    expect(second.cached).toBe(true);
    expect(second.strategy.kind).toBe('cached');
    expect(second.provider).toBe('alpha');
    expect(second.output.entities).toContain('AuthService');
    expect(calls).toBe(1);
  });

  it('cache expires after TTL', async () => {
    const fabric = new InferenceFabric(false);
    let calls = 0;
    fabric.registerProvider({
      id: 'alpha', label: 'Alpha', isAvailable: () => true,
      complete: async () => { calls += 1; return '{"entities":["E"],"topics":["t"],"confidence":0.5,"importance":0.5}'; },
    });
    const scheduler = new CognitiveScheduler(fabric, 20);
    await scheduler.dispatch(ACCELERATORS.semantic, { text: 'warmup for the probe' }, { complexity: 0.5 });
    calls = 0;
    await scheduler.dispatch(ACCELERATORS.semantic, { text: 'expiring thought' }, { complexity: 0.5 });
    await new Promise((r) => setTimeout(r, 40));
    const second = await scheduler.dispatch(ACCELERATORS.semantic, { text: 'expiring thought' }, { complexity: 0.5 });
    expect(second.cached).toBe(false);
    expect(calls).toBe(2);
  });

  it('different inputs never share cache entries', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('alpha'));
    const scheduler = new CognitiveScheduler(fabric);
    await scheduler.dispatch(ACCELERATORS.semantic, { text: 'first input here' }, { complexity: 0.5 });
    const key = scheduler.cacheKey('semantic', { text: 'second input there' });
    expect(scheduler.hasCached(key)).toBe(false);
  });

  it('human approval returns deterministic fallback with approvalNeeded', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('alpha'));
    const scheduler = new CognitiveScheduler(fabric);
    const result = await scheduler.dispatch(ACCELERATORS.semantic, { text: 'delete production' }, { risk: 0.9 });
    expect(result.approvalNeeded).toBe(true);
    expect(result.strategy.kind).toBe('human_approval');
    expect(result.fired).toBe(false);
  });

  it('multi-model strategy reroutes across providers for verification', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('broken', { fail: true }));
    fabric.registerProvider(mockProvider('healthy'));
    const scheduler = new CognitiveScheduler(fabric);
    const result = await scheduler.dispatch(ACCELERATORS.semantic, { text: 'verify this thoroughly' }, { complexity: 0.5, verificationNeeded: 0.9 });
    expect(result.strategy.kind).toBe('multi_model');
    expect(result.fired).toBe(true);
    expect(result.provider).toBe('healthy');
  });

  it('clearCache empties the cognitive cache', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('alpha'));
    const scheduler = new CognitiveScheduler(fabric);
    await scheduler.dispatch(ACCELERATORS.semantic, { text: 'clear me' }, { complexity: 0.5 });
    expect(scheduler.cacheSize()).toBe(1);
    scheduler.clearCache();
    expect(scheduler.cacheSize()).toBe(0);
  });
});

describe('Cognitive Scheduler — profile contract', () => {
  it('normalizes partial profiles with defaults', () => {
    const profile = normalizeProfile({ complexity: 0.7, urgency: 'high' });
    expect(profile.complexity).toBe(0.7);
    expect(profile.urgency).toBe('high');
    expect(profile.risk).toBe(DEFAULT_PROFILE.risk);
    expect(profile.reasoningNeeded).toBe(DEFAULT_PROFILE.reasoningNeeded);
  });

  it('clamps out-of-range values', () => {
    const profile = normalizeProfile({ complexity: 1.5, risk: -1, verificationNeeded: 2 });
    expect(profile.complexity).toBe(1);
    expect(profile.risk).toBe(0);
    expect(profile.verificationNeeded).toBe(1);
  });

  it('empty profile equals defaults', () => {
    expect(normalizeProfile()).toEqual(DEFAULT_PROFILE);
  });

  it('profile is serializable (JSON round trip)', () => {
    const profile = normalizeProfile({ complexity: 0.7, urgency: 'high', risk: 0.5, reasoningNeeded: 0.9 });
    const clone = normalizeProfile(JSON.parse(JSON.stringify(profile)));
    expect(clone).toEqual(profile);
  });
});

describe('Cognitive Scheduler — frugality constitution law', () => {
  it('enacts the Frugal Inference by Default law', () => {
    const constitution = new CognitiveConstitution();
    const law = constitution.getAll().find((l) => l.name === 'Frugal Inference by Default');
    expect(law).toBeDefined();
    expect(law?.severity).toBe('foundational');
    expect(law?.check).toBe('frugal_inference');
  });

  it('flags inference without frugality', () => {
    const constitution = new CognitiveConstitution();
    const violations = constitution.checkCompliance('scheduler-test', { frugalInference: false });
    expect(violations.some((v) => v.lawName === 'Frugal Inference by Default')).toBe(true);
  });

  it('passes frugal dispatches', () => {
    const constitution = new CognitiveConstitution();
    const violations = constitution.checkCompliance('scheduler-test', { frugalInference: true });
    expect(violations.some((v) => v.lawName === 'Frugal Inference by Default')).toBe(false);
  });
});
