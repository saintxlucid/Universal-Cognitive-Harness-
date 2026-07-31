import { describe, it, expect } from 'vitest';
import { InferenceFabric } from '../accelerators/fabric.js';
import { CognitiveScheduler } from '../accelerators/scheduler.js';
import { ACCELERATORS } from '../accelerators/implementations.js';
import {
  VIRTUAL_PROCESSORS,
  getVirtualProcessor,
  resolveVirtualCpu,
  requiredTier,
  resolveProvider,
} from '../accelerators/virtual-processors.js';
import type { ProviderRosterEntry } from '../accelerators/virtual-processors.js';
import type { InferenceProvider, ProviderModel } from '../accelerators/types.js';

const ROSTER: ProviderRosterEntry[] = [
  {
    providerId: 'cerebras',
    label: 'Cerebras',
    available: true,
    healthy: true,
    consecutiveFailures: 0,
    avgLatencyMs: 120,
    models: [
      { tier: 'standard', model: 'llama-3.3-70b', costRank: 0 },
      { tier: 'deep', model: 'llama-3.3-70b', costRank: 0 },
    ],
  },
  {
    providerId: 'openai',
    label: 'OpenAI',
    available: true,
    healthy: true,
    consecutiveFailures: 0,
    avgLatencyMs: 300,
    models: [
      { tier: 'tiny', model: 'gpt-4o-mini', costRank: 1 },
      { tier: 'standard', model: 'gpt-4o-mini', costRank: 1 },
      { tier: 'deep', model: 'gpt-4o', costRank: 2 },
    ],
  },
  {
    providerId: 'anthropic',
    label: 'Anthropic',
    available: true,
    healthy: false,
    consecutiveFailures: 2,
    avgLatencyMs: null,
    models: [
      { tier: 'tiny', model: 'claude-3-5-haiku-latest', costRank: 1 },
      { tier: 'deep', model: 'claude-sonnet-4-5', costRank: 2 },
    ],
  },
];

function mockProvider(id: string, roster?: ProviderModel[]): InferenceProvider {
  return {
    id,
    label: `Mock ${id}`,
    roster,
    isAvailable: () => true,
    complete: async (params) => {
      // Health probes must not be mistaken for dispatch calls by assertions.
      if (params.user === 'ping') return 'pong';
      return JSON.stringify({
        entities: [`${id}Entity`],
        topics: ['mock'],
        confidence: 0.9,
        importance: 0.7,
      });
    },
  };
}

function failingProvider(id: string, roster?: ProviderModel[]): InferenceProvider {
  return {
    id,
    label: `Failing ${id}`,
    roster,
    isAvailable: () => true,
    complete: async (params) => {
      if (params.user === 'ping') return 'pong';
      throw new Error('provider down');
    },
  };
}

describe('Virtual Processors — registry', () => {
  it('exposes the ten-processor namespace', () => {
    expect(VIRTUAL_PROCESSORS).toHaveLength(10);
    const ids = VIRTUAL_PROCESSORS.map((p) => p.id);
    expect(ids).toContain('reasoning.cpu');
    expect(ids).toContain('memory.cpu');
    expect(ids).toContain('engineering.cpu');
    expect(ids).toContain('security.cpu');
    expect(ids).toContain('creativity.cpu');
    expect(ids).toContain('planning.cpu');
    expect(ids).toContain('research.cpu');
    expect(ids).toContain('reflection.cpu');
    expect(ids).toContain('classification.cpu');
    expect(ids).toContain('embedding.cpu');
  });

  it('looks up processors by id', () => {
    expect(getVirtualProcessor('security.cpu')?.minTier).toBe('deep');
    expect(getVirtualProcessor('classification.cpu')?.minTier).toBe('tiny');
    expect(getVirtualProcessor('nope.cpu' as never)).toBeUndefined();
  });

  it('every processor has a role, affinity and tier contract', () => {
    for (const cpu of VIRTUAL_PROCESSORS) {
      expect(cpu.role.length).toBeGreaterThan(0);
      expect(cpu.description.length).toBeGreaterThan(0);
      expect(['tiny', 'standard', 'deep']).toContain(cpu.minTier);
      expect(['tiny', 'standard', 'deep']).toContain(cpu.defaultTier);
    }
  });
});

describe('Virtual Processors — affinity routing (Level 4)', () => {
  it('deep reasoning routes to reasoning.cpu', () => {
    expect(resolveVirtualCpu({ complexity: 0.5, reasoningNeeded: 0.9 }).id).toBe('reasoning.cpu');
  });

  it('high risk routes to security.cpu', () => {
    expect(resolveVirtualCpu({ risk: 0.7, verificationNeeded: 0.8 }).id).toBe('security.cpu');
  });

  it('creative requests route to creativity.cpu', () => {
    expect(resolveVirtualCpu({ creativityNeeded: 0.9 }).id).toBe('creativity.cpu');
  });

  it('knowledge-heavy requests route to memory.cpu', () => {
    expect(resolveVirtualCpu({ knowledgeNeeded: 0.9 }).id).toBe('memory.cpu');
  });

  it('flat profiles land on classification.cpu (frugal default home)', () => {
    expect(resolveVirtualCpu({}).id).toBe('classification.cpu');
  });

  it('explicitly zeroed profiles also land on classification.cpu', () => {
    expect(
      resolveVirtualCpu({
        complexity: 0,
        reasoningNeeded: 0,
        knowledgeNeeded: 0,
        creativityNeeded: 0,
        verificationNeeded: 0,
        risk: 0,
      }).id,
    ).toBe('classification.cpu');
  });

  it('routing is deterministic for identical profiles', () => {
    const profile = { complexity: 0.7, reasoningNeeded: 0.6, verificationNeeded: 0.5, risk: 0.4 };
    const first = resolveVirtualCpu(profile).id;
    for (let i = 0; i < 20; i++) {
      expect(resolveVirtualCpu(profile).id).toBe(first);
    }
  });
});

describe('Virtual Processors — tier requirements', () => {
  it('demands deep for deep reasoning', () => {
    expect(requiredTier({ reasoningNeeded: 0.8 })).toBe('deep');
  });

  it('demands deep for high verification', () => {
    expect(requiredTier({ verificationNeeded: 0.8 })).toBe('deep');
  });

  it('demands tiny below the frugality gate', () => {
    expect(
      requiredTier({
        complexity: 0.1,
        reasoningNeeded: 0.1,
        creativityNeeded: 0.1,
        verificationNeeded: 0.1,
      }),
    ).toBe('tiny');
  });

  it('uses the processor default otherwise', () => {
    const cpu = getVirtualProcessor('memory.cpu')!;
    expect(requiredTier({ complexity: 0.5 }, cpu)).toBe('standard');
  });

  it('respects a processor floor even for trivial profiles', () => {
    const cpu = getVirtualProcessor('security.cpu')!;
    expect(requiredTier({ complexity: 0.1, reasoningNeeded: 0.1 }, cpu)).toBe('deep');
  });
});

describe('Virtual Processors — provider selection', () => {
  it('picks the cheapest healthy provider at the required tier', () => {
    const cpu = getVirtualProcessor('reasoning.cpu')!;
    const selection = resolveProvider({ complexity: 0.5, reasoningNeeded: 0.8 }, ROSTER, cpu);
    expect(selection.providerIds).toEqual(['cerebras']);
    expect(selection.model).toBe('llama-3.3-70b');
    expect(selection.tier).toBe('deep');
  });

  it('never selects an unhealthy provider when alternatives exist', () => {
    const selection = resolveProvider({ reasoningNeeded: 0.8 }, ROSTER);
    expect(selection.providerIds).not.toContain('anthropic');
  });

  it('tiny-tier requests never route to deep-only providers', () => {
    const selection = resolveProvider(
      { complexity: 0.1, verificationNeeded: 0.1 },
      ROSTER,
      getVirtualProcessor('classification.cpu')!,
    );
    expect(selection.providerIds).toEqual(['openai']);
    expect(selection.model).toBe('gpt-4o-mini');
  });

  it('verification demands multiple independent providers', () => {
    const selection = resolveProvider({ verificationNeeded: 0.9 }, ROSTER);
    expect(selection.providerIds.length).toBeGreaterThanOrEqual(2);
    expect(selection.providerIds).toContain('cerebras');
    expect(selection.providerIds).toContain('openai');
  });

  it('empty roster yields a deterministic no-provider selection', () => {
    const selection = resolveProvider({ reasoningNeeded: 0.9 }, []);
    expect(selection.providerIds).toEqual([]);
    expect(selection.model).toBe('none');
  });

  it('prefers fewer consecutive failures over cheaper cost', () => {
    const roster: ProviderRosterEntry[] = [
      {
        providerId: 'flaky',
        label: 'Flaky',
        available: true,
        healthy: true,
        consecutiveFailures: 1,
        avgLatencyMs: 50,
        models: [{ tier: 'standard', model: 'm1', costRank: 0 }],
      },
      {
        providerId: 'solid',
        label: 'Solid',
        available: true,
        healthy: true,
        consecutiveFailures: 0,
        avgLatencyMs: 200,
        models: [{ tier: 'standard', model: 'm2', costRank: 1 }],
      },
    ];
    const selection = resolveProvider(
      { complexity: 0.5 },
      roster,
      getVirtualProcessor('engineering.cpu')!,
    );
    expect(selection.providerIds).toEqual(['solid']);
  });
});

describe('Cognitive Scheduler — virtual processor integration', () => {
  it('plan attaches virtualCpu, tier and provider for deep reasoning', () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(
      mockProvider('cerebras', [
        { tier: 'standard', model: 'llama-3.3-70b', costRank: 0 },
        { tier: 'deep', model: 'llama-3.3-70b', costRank: 0 },
      ]),
    );
    fabric.registerProvider(
      mockProvider('openai', [
        { tier: 'tiny', model: 'gpt-4o-mini', costRank: 1 },
        { tier: 'deep', model: 'gpt-4o', costRank: 2 },
      ]),
    );
    const scheduler = new CognitiveScheduler(fabric);
    const strategy = scheduler.plan(
      { complexity: 0.5, reasoningNeeded: 0.8 },
      { roster: fabric.roster() },
    );
    expect(strategy.kind).toBe('large_model');
    expect(strategy.virtualCpu).toBe('reasoning.cpu');
    expect(strategy.tier).toBe('deep');
    expect(strategy.preferredProviderId).toBe('cerebras');
    expect(strategy.model).toBe('llama-3.3-70b');
  });

  it('plan works without a roster (provider-agnostic)', () => {
    const scheduler = new CognitiveScheduler(new InferenceFabric(false));
    const strategy = scheduler.plan({ complexity: 0.5, reasoningNeeded: 0.8 });
    expect(strategy.virtualCpu).toBe('reasoning.cpu');
    expect(strategy.tier).toBe('deep');
    expect(strategy.preferredProviderId).toBeUndefined();
  });

  it('dispatch routes to the preferred provider and model', async () => {
    const fabric = new InferenceFabric(false);
    const seen: Array<{ id: string; model?: string }> = [];
    fabric.registerProvider({
      id: 'openai',
      label: 'OpenAI',
      roster: [
        { tier: 'tiny', model: 'gpt-4o-mini', costRank: 1 },
        { tier: 'deep', model: 'gpt-4o', costRank: 2 },
      ],
      isAvailable: () => true,
      complete: async (params) => {
        if (params.user === 'ping') return 'pong';
        seen.push({ id: 'openai', model: params.model });
        return JSON.stringify({
          entities: ['AuthService'],
          topics: ['auth'],
          confidence: 0.9,
          importance: 0.8,
        });
      },
    });
    fabric.registerProvider({
      id: 'cerebras',
      label: 'Cerebras',
      roster: [
        { tier: 'standard', model: 'llama-3.3-70b', costRank: 0 },
        { tier: 'deep', model: 'llama-3.3-70b', costRank: 0 },
      ],
      isAvailable: () => true,
      complete: async (params) => {
        if (params.user === 'ping') return 'pong';
        seen.push({ id: 'cerebras', model: params.model });
        return JSON.stringify({
          entities: ['CerebrasEntity'],
          topics: ['mock'],
          confidence: 0.9,
          importance: 0.7,
        });
      },
    });
    const scheduler = new CognitiveScheduler(fabric);
    const result = await scheduler.dispatch(
      ACCELERATORS.semantic,
      { text: 'deep reasoning about AuthService' },
      { complexity: 0.5, reasoningNeeded: 0.8 },
    );
    expect(result.strategy.virtualCpu).toBe('reasoning.cpu');
    expect(result.provider).toBe('cerebras');
    expect(seen[0]).toEqual({ id: 'cerebras', model: 'llama-3.3-70b' });
  });

  it('falls back to the next provider when the preferred one fails', async () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(failingProvider('broken', [{ tier: 'deep', model: 'x', costRank: 0 }]));
    fabric.registerProvider(mockProvider('healthy', [{ tier: 'deep', model: 'y', costRank: 1 }]));
    const scheduler = new CognitiveScheduler(fabric);
    const result = await scheduler.dispatch(
      ACCELERATORS.semantic,
      { text: 'verify this thoroughly' },
      { complexity: 0.5, verificationNeeded: 0.9 },
    );
    expect(result.strategy.kind).toBe('multi_model');
    expect(result.fired).toBe(true);
    expect(result.provider).toBe('healthy');
    expect(result.strategy.providerCount).toBeGreaterThanOrEqual(2);
  });

  it('strategy stays serializable with routing fields', () => {
    const fabric = new InferenceFabric(false);
    fabric.registerProvider(
      mockProvider('openai', [{ tier: 'deep', model: 'gpt-4o', costRank: 1 }]),
    );
    const scheduler = new CognitiveScheduler(fabric);
    const strategy = scheduler.plan(
      { complexity: 0.5, reasoningNeeded: 0.8 },
      { roster: fabric.roster() },
    );
    const clone = JSON.parse(JSON.stringify(strategy));
    expect(clone).toEqual(strategy);
  });
});
