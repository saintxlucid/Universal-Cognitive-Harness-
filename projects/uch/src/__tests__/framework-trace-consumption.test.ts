import { describe, it, expect } from 'vitest';
import { NervousSystem } from '../nervous-system/nervous-system.js';
import { AetherCore } from '../aether/aether-core.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { SleepCycle, type SleepFrameworkSource, type SleepMemorySource } from '../sleep_cycle/cycle.js';
import { FrameworkTraceRecorder } from '../cognitive-plane/frameworks/tracing/trace-recorder.js';
import { CognitiveExoskeleton } from '../exoskeleton/exoskeleton.js';

describe('Sleep cycle framework-trace consumption (blueprint §5.1)', () => {
  it('consolidates dominant-framework patterns above the frequency threshold', async () => {
    const ns = new NervousSystem();
    const aether = new AetherCore(new NeuralEventBus());
    const source: SleepMemorySource = {
      async listUnconsolidated(_limit = 200) {
        return [
          { id: 'a', content: 'decision routing episode with decision matrix', importance: 0.7, timestamp: new Date() },
          { id: 'b', content: 'another decision routing episode', importance: 0.7, timestamp: new Date() },
        ];
      },
      async markConsolidated(ids: string[]) { void ids; },
    };
    const frameworkSource: SleepFrameworkSource = {
      getDominantPerProblemType: () => [
        { problemType: 'data-rich', engine: 'decision-matrix', count: 5 },
        { problemType: 'time-critical', engine: 'intuitive', count: 1 },
      ],
    };
    const sleep = new SleepCycle(ns, aether, source, null, { patternMinFrequency: 2 }, 60000, frameworkSource);

    const report = await sleep.nap();

    expect(report.frameworkPatternsLearned).toBe(1);
    expect(report.dominantFrameworks).toEqual([
      { problemType: 'data-rich', engine: 'decision-matrix', count: 5 },
    ]);
  });

  it('learns nothing when the source has no recurring patterns', async () => {
    const ns = new NervousSystem();
    const aether = new AetherCore(new NeuralEventBus());
    const source: SleepMemorySource = {
      async listUnconsolidated() { return []; },
      async markConsolidated() {},
    };
    const frameworkSource: SleepFrameworkSource = {
      getDominantPerProblemType: () => [{ problemType: 'general', engine: 'ideal', count: 1 }],
    };
    const sleep = new SleepCycle(ns, aether, source, null, undefined, 60000, frameworkSource);

    const report = await sleep.nap();

    expect(report.frameworkPatternsLearned).toBe(0);
    expect(report.dominantFrameworks).toEqual([]);
  });

  it('runs without a framework source', async () => {
    const ns = new NervousSystem();
    const aether = new AetherCore(new NeuralEventBus());
    const source: SleepMemorySource = {
      async listUnconsolidated() { return []; },
      async markConsolidated() {},
    };
    const sleep = new SleepCycle(ns, aether, source, null, undefined, 60000);

    const report = await sleep.nap();

    expect(report.frameworkPatternsLearned).toBe(0);
  });
});

describe('Framework trace events on the neural event bus (blueprint §5.1)', () => {
  it('records selection and completion traces as events', async () => {
    const bus = new NeuralEventBus();
    const tracer = new FrameworkTraceRecorder(bus);
    const seen: string[] = [];
    bus.subscribe(['framework:selected', 'framework:completed', 'framework:error'], (event) => {
      seen.push(event.type);
    });

    tracer.recordSelection({
      problem: 'choose a vendor',
      profile: { dataAvailability: 0.9 },
      result: {
        selected: { id: 'decision-matrix', family: 'decisions', name: 'Decision Matrix', purpose: 'x', bestFor: [], whenNotToUse: [], stages: [], selection: { contexts: ['analytical'] }, source: 'x' },
        family: 'decisions',
        runnerUp: null,
        rationale: 'fits',
        alternatives: ['rational'],
      },
      durationMs: 2,
    });
    tracer.recordCompletion({
      engine: 'pros-cons', family: 'decisions', problem: 'go or no-go',
      profile: {}, result: { verdict: 'adopt' }, verdict: 'adopt',
    });
    tracer.recordError({ engine: 'rca-focus', family: 'rca', problem: 'x', message: 'boom' });

    expect(seen).toContain('framework:selected');
    expect(seen).toContain('framework:completed');
    expect(seen).toContain('framework:error');
    expect(tracer.getStats().traceCount).toBe(3);
    expect(tracer.getStats().usageByFramework.map((f) => f.engine)).toEqual(
      expect.arrayContaining(['decision-matrix', 'pros-cons', 'rca-focus']),
    );
  });
});

describe('Connectome auto-wiring from framework events (blueprint §5.1)', () => {
  it('links problem-type nodes to framework nodes on completion', async () => {
    const exo = new CognitiveExoskeleton({
      workspaceId: 'ws-test',
      workspaceName: 'test',
      workspaceRoot: 'X:\\DAIRA\\.tmp\\opencode',
    });

    exo.frameworkTracer.recordCompletion({
      engine: 'decision-matrix',
      family: 'decisions',
      problem: 'vendor selection',
      profile: { dataAvailability: 0.9 },
      result: { winner: 'A' },
      verdict: 'adopt',
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    const connections = exo.connectome.getConnections();
    const fwLink = connections.find((c) => c.from === 'problem-type:data-rich' && c.to === 'framework:decision-matrix');
    expect(fwLink).toBeDefined();
    expect(fwLink?.type).toBe('reference');
  });

  it('strengthens the same edge on repeat completions', async () => {
    const exo = new CognitiveExoskeleton({
      workspaceId: 'ws-test',
      workspaceName: 'test',
      workspaceRoot: 'X:\\DAIRA\\.tmp\\opencode',
    });

    for (let i = 0; i < 3; i++) {
      exo.frameworkTracer.recordCompletion({
        engine: 'intuitive', family: 'decisions', problem: 'server down',
        profile: { timePressure: 0.95 }, result: { verdict: 'act' }, verdict: 'act',
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 50));

    const connections = exo.connectome.getConnections();
    const fwLink = connections.find((c) => c.from === 'problem-type:time-critical' && c.to === 'framework:intuitive');
    expect(fwLink).toBeDefined();
    expect(fwLink?.weight ?? 1).toBeGreaterThan(1);
  });
});

describe('Reflex fast-path framework routines (blueprint §5.3)', () => {
  it('resolves decide requests to the pros-cons engine without the LLM', () => {
    const exo = new CognitiveExoskeleton({
      workspaceId: 'ws-test',
      workspaceName: 'test',
      workspaceRoot: 'X:\\DAIRA\\.tmp\\opencode',
    });
    const result = exo.resolveFastPath('decide: pros: fast, cheap; cons: risky');
    expect(result?.routine).toBe('framework-decide');
    const parsed = JSON.parse(result.output) as { verdict: string };
    expect(parsed.verdict).toBe('adopt');
  });

  it('resolves decide with profile flags to model selection', () => {
    const exo = new CognitiveExoskeleton({
      workspaceId: 'ws-test',
      workspaceName: 'test',
      workspaceRoot: 'X:\\DAIRA\\.tmp\\opencode',
    });
    const result = exo.resolveFastPath('framework select vendor data=0.9 time=0.1');
    expect(result?.routine).toBe('framework-decide');
    const parsed = JSON.parse(result.output) as { selected: string; family: string };
    expect(['decision-matrix', 'rational', 'cost-benefit']).toContain(parsed.selected);
    expect(parsed.family).toBe('decisions');
  });

  it('resolves rca requests to the F.O.C.U.S. engine', () => {
    const exo = new CognitiveExoskeleton({
      workspaceId: 'ws-test',
      workspaceName: 'test',
      workspaceRoot: 'X:\\DAIRA\\.tmp\\opencode',
    });
    const result = exo.resolveFastPath('rca: production defects; fact: log shows timeout at 14:02');
    expect(result?.routine).toBe('framework-rca');
    const parsed = JSON.parse(result.output) as { focus: string };
    expect(parsed.focus).toContain('production defects');
  });

  it('resolves plan requests to the Productivity OS planner', () => {
    const exo = new CognitiveExoskeleton({
      workspaceId: 'ws-test',
      workspaceName: 'test',
      workspaceRoot: 'X:\\DAIRA\\.tmp\\opencode',
    });
    const result = exo.resolveFastPath('plan: task: fix login, task: ship docs');
    expect(result?.routine).toBe('framework-plan');
    const parsed = JSON.parse(result.output) as { mit: string[] };
    expect(parsed.mit).toContain('fix login');
  });

  it('resolves gap and dikw requests to their engines', () => {
    const exo = new CognitiveExoskeleton({
      workspaceId: 'ws-test',
      workspaceName: 'test',
      workspaceRoot: 'X:\\DAIRA\\.tmp\\opencode',
    });
    const gap = exo.resolveFastPath('research gap on AI pricing');
    expect(gap?.routine).toBe('framework-gap');
    const dikw = exo.resolveFastPath('dikw: datum: sales up 20%, datum: churn down 5%');
    expect(dikw?.routine).toBe('framework-dikw');
  });

  it('records framework traces for routine invocations', () => {
    const exo = new CognitiveExoskeleton({
      workspaceId: 'ws-test',
      workspaceName: 'test',
      workspaceRoot: 'X:\\DAIRA\\.tmp\\opencode',
    });
    exo.resolveFastPath('rca: incident 42');
    const stats = exo.frameworkTracer.getStats();
    expect(stats.usageByFramework.some((f) => f.engine === 'rca-focus')).toBe(true);
    expect(exo.getStats().frameworks).toBeDefined();
  });
});
