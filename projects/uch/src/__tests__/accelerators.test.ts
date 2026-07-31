import { describe, it, expect, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { InferenceFabric } from '../accelerators/fabric.js';
import { ACCELERATORS } from '../accelerators/implementations.js';
import type { InferenceProvider, ProviderGateway } from '../accelerators/types.js';
import { CognitiveConstitution } from '../cognitive-plane/constitution/constitution.js';

function mockProvider(id: string, opts?: { fail?: boolean; latencyMs?: number; available?: boolean }): InferenceProvider {
  return {
    id,
    label: `Mock ${id}`,
    isAvailable: () => opts?.available ?? true,
    complete: async () => {
      if (opts?.fail) throw new Error(`provider ${id} failed`);
      if (opts?.latencyMs) await new Promise((r) => setTimeout(r, opts.latencyMs!));
      return JSON.stringify({ entities: ['MockEntity'], topics: ['mock'], confidence: 0.9, importance: 0.7 });
    },
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Cognitive Accelerators — deterministic fallbacks', () => {
  it('CA-01 semantic: structured output without any provider', async () => {
    const result = await ACCELERATORS.semantic.fallback({ text: 'The PaymentService uses a Redis cache for sessions.' });
    expect(result.entities).toContain('PaymentService');
    expect(result.topics.length).toBeGreaterThan(0);
    expect(result.importance).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('CA-02 compression: produces a shorter summary with ratio', async () => {
    const long = 'This is a very long sentence about memory consolidation that repeats itself. ' +
      'It contains a second sentence about knowledge graph repair and maintenance. ' +
      'It also mentions neural pruning and duplicate elimination across the cortex. '.repeat(5);
    const result = await ACCELERATORS.compression.fallback({ text: long, maxWords: 50 });
    expect(result.summary.length).toBeLessThan(long.length);
    expect(result.ratio).toBeGreaterThan(0);
    expect(result.ratio).toBeLessThanOrEqual(1);
    expect(Array.isArray(result.preservedPoints)).toBe(true);
  });

  it('CA-03 reasoning: detects contradictory premises deterministically', async () => {
    const result = await ACCELERATORS.reasoning.fallback({
      question: 'Is the system safe?',
      premises: ['The system never permits unsigned access', 'The system must always permit unsigned access'],
    });
    expect(result.undetermined).toBe(false);
    expect(result.conclusion).toContain('contradict');
    expect(result.steps.length).toBe(2);
  });

  it('CA-04 prediction: honest abstention without inference', async () => {
    const result = await ACCELERATORS.prediction.fallback({ context: 'x', question: 'y' });
    expect(result.prediction).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('CA-05 memory: finds exact duplicates and recommends merge', async () => {
    const result = await ACCELERATORS.memory.fallback({
      memories: ['Use vitest for all tests', 'Use vitest for all tests', 'Deploy via GitHub Actions'],
    });
    expect(result.duplicates).toContain('Use vitest for all tests');
    expect(result.merge.length).toBe(1);
    expect(result.recommendedAction.length).toBeGreaterThan(0);
  });

  it('CA-06 ontology: infers relationships from shared tokens', async () => {
    const result = await ACCELERATORS.ontology.fallback({ objects: ['Redis cache', 'Redis session store', 'PostgreSQL database'] });
    expect(result.relationships.length).toBeGreaterThan(0);
    expect(result.relationships[0]).toHaveProperty('from');
    expect(result.relationships[0]).toHaveProperty('to');
    expect(result.relationships[0]).toHaveProperty('strength');
  });

  it('CA-07 classification: classifies by keyword overlap', async () => {
    const result = await ACCELERATORS.classification.fallback({
      text: 'The authentication service rejected the token because it expired.',
      categories: ['security', 'database', 'ui'],
    });
    expect(result.label).toBe('security');
    expect(result.confidence).toBeGreaterThan(0);
  });
});

describe('Inference Fabric — routing and health', () => {
  it('returns deterministic fallback when no providers exist (fired=false)', async () => {
    const fabric = new InferenceFabric(false);
    const result = await fabric.dispatch(ACCELERATORS.semantic, { text: 'Hello World from the kernel' });
    expect(result.fired).toBe(false);
    expect(result.fallbackUsed).toBe(true);
    expect(result.provider).toBe('deterministic');
    expect(result.output.entities.length).toBeGreaterThan(0);
  });

  it('dispatches to a healthy provider (fired=true)', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('alpha'));
    const result = await fabric.dispatch(ACCELERATORS.semantic, { text: 'Analyze this' });
    expect(result.fired).toBe(true);
    expect(result.fallbackUsed).toBe(false);
    expect(result.provider).toBe('alpha');
    expect(result.confidence).toBeCloseTo(0.9);
  });

  it('reroutes to a healthy provider when the first fails', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('broken', { fail: true }));
    fabric.registerProvider(mockProvider('healthy'));
    const result = await fabric.dispatch(ACCELERATORS.semantic, { text: 'x' });
    expect(result.fired).toBe(true);
    expect(result.provider).toBe('healthy');
    const brokenHealth = fabric.healthStatus().find((h) => h.providerId === 'broken');
    expect(brokenHealth?.totalFailures).toBe(1);
  });

  it('marks providers unhealthy after repeated failures and falls back', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('doomed', { fail: true }));
    await fabric.dispatch(ACCELERATORS.semantic, { text: 'x' });
    await fabric.dispatch(ACCELERATORS.semantic, { text: 'x' });
    await fabric.dispatch(ACCELERATORS.semantic, { text: 'x' });
    const doomed = fabric.healthStatus().find((h) => h.providerId === 'doomed');
    expect(doomed?.consecutiveFailures).toBeGreaterThanOrEqual(2);
    expect(doomed?.cooldownUntil).not.toBeNull();
    const result = await fabric.dispatch(ACCELERATORS.semantic, { text: 'x' });
    expect(result.fired).toBe(false);
    expect(result.fallbackUsed).toBe(true);
  });

  it('prefers the lower-latency healthy provider', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(mockProvider('slow', { latencyMs: 40 }));
    fabric.registerProvider(mockProvider('fast', { latencyMs: 5 }));
    const result = await fabric.dispatch(ACCELERATORS.semantic, { text: 'x' });
    expect(result.provider).toBe('fast');
  });

  it('skipInference forces deterministic path even with healthy providers (action potential gate)', async () => {
    const fabric = new InferenceFabric(false);
    let calls = 0;
    fabric.registerProvider({
      id: 'counter', label: 'Counter', isAvailable: () => true,
      complete: async () => { calls += 1; return '{"entities":[]}'; },
    });
    const result = await fabric.dispatch(ACCELERATORS.semantic, { text: 'x' }, { skipInference: true });
    expect(result.fired).toBe(false);
    expect(calls).toBe(0);
  });

  it('supports multiple providers registered from env keys', () => {
    vi.stubEnv('CEREBRAS_API_KEY_1', 'ck-1');
    vi.stubEnv('CEREBRAS_API_KEY_2', 'ck-2');
    const fabric = new InferenceFabric(true);
    const ids = fabric.healthStatus().map((h) => h.providerId);
    expect(ids).toContain('cerebras-1');
    expect(ids).toContain('cerebras-2');
  });
});

describe('Coprocessor Workspace Isolation — constitution law', () => {
  it('enacts the immutable isolation law', () => {
    const constitution = new CognitiveConstitution();
    const law = constitution.getAll().find((l) => l.name === 'Coprocessor Workspace Isolation');
    expect(law).toBeDefined();
    expect(law?.severity).toBe('immutable');
    expect(law?.check).toBe('no_workspace_mutation');
  });

  it('flags workspace mutation attempts', () => {
    const constitution = new CognitiveConstitution();
    const violations = constitution.checkCompliance('accelerator-test', { workspaceMutation: true });
    expect(violations.some((v) => v.lawName === 'Coprocessor Workspace Isolation')).toBe(true);
  });

  it('does not flag read-only acceleration', () => {
    const constitution = new CognitiveConstitution();
    const violations = constitution.checkCompliance('accelerator-test', { workspaceMutation: false });
    expect(violations.some((v) => v.lawName === 'Coprocessor Workspace Isolation')).toBe(false);
  });
});

describe('Coprocessor Workspace Isolation — structural enforcement', () => {
  it('accelerator modules never import workspace-mutating capabilities', async () => {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'accelerators');
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    const forbidden = [
      "from 'node:fs'", "from 'fs'",
      "from 'node:child_process'", "from 'child_process'",
      "from '../coding/", "from '../agentic/", "from '../exoskeleton/",
      "from '../git/", "from '../drivers/",
    ];
    for (const file of files) {
      const source = await fs.readFile(path.join(dir, file), 'utf8');
      for (const pattern of forbidden) {
        expect(source, `${file} imports forbidden capability ${pattern}`).not.toContain(pattern);
      }
    }
  });
});

describe('Accelerator integration — gateway returns provider metadata', () => {
  it('execute receives provider via gateway and returns structured output', async () => {
    const gateway: ProviderGateway = {
      isAvailable: () => true,
      complete: async () => JSON.stringify({ entities: ['AuthService'], topics: ['auth'], importance: 0.8, confidence: 0.95 }),
    };
    const output = await ACCELERATORS.semantic.execute({ text: 'The AuthService handles login.' }, gateway);
    expect(output.entities).toContain('AuthService');
    expect(output.confidence).toBeCloseTo(0.95);
  });
});
