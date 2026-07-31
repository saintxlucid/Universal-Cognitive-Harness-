import { describe, it, expect } from 'vitest';
import {
  EvolutionEngine, BenchmarkEngine, ExperimentEngine, MutationEngine,
  type Benchmarkable, type MutableSubsystem, type BenchmarkMetric,
} from '../cognitive-plane/evolution/index.js';

describe('BenchmarkEngine', () => {
  it('runs a single benchmark', async () => {
    const be = new BenchmarkEngine();
    const sub: Benchmarkable = {
      name: 'test-sub',
      runBenchmark: async () => [{ name: 'throughput', value: 100, unit: 'ops/s', higherIsBetter: true }],
      getConfig: () => ({ threshold: 0.5 }),
    };
    be.register(sub);
    const run = await be.runSingle('test-sub');
    expect(run.subsystem).toBe('test-sub');
    expect(run.metrics[0]!.value).toBe(100);
    expect(run.durationMs).toBeGreaterThanOrEqual(0);
    expect(run.timestamp).toBeInstanceOf(Date);
  });

  it('runs all registered benchmarks', async () => {
    const be = new BenchmarkEngine();
    be.register({ name: 'a', runBenchmark: async () => [{ name: 'm1', value: 1, unit: 'ms', higherIsBetter: false }], getConfig: () => ({}) });
    be.register({ name: 'b', runBenchmark: async () => [{ name: 'm2', value: 2, unit: 'ms', higherIsBetter: false }], getConfig: () => ({}) });
    const runs = await be.runAll();
    expect(runs).toHaveLength(2);
  });

  it('throws for unknown subsystem', async () => {
    const be = new BenchmarkEngine();
    await expect(be.runSingle('nope')).rejects.toThrow('Unknown subsystem');
  });

  it('compares two runs', async () => {
    const be = new BenchmarkEngine();
    be.register({ name: 's', runBenchmark: async () => [{ name: 'x', value: 50, unit: 'ms', higherIsBetter: false }], getConfig: () => ({}) });
    await be.runSingle('s');
    be.register({ name: 's', runBenchmark: async () => [{ name: 'x', value: 40, unit: 'ms', higherIsBetter: false }], getConfig: () => ({}) });
    await be.runSingle('s');
    const comp = be.compare('s');
    expect(comp['x']?.improved).toBe(true);
  });

  it('limits history', async () => {
    const be = new BenchmarkEngine(3);
    be.register({ name: 'h', runBenchmark: async () => [{ name: 'm', value: 1, unit: '', higherIsBetter: true }], getConfig: () => ({}) });
    for (let i = 0; i < 5; i++) await be.runSingle('h');
    expect(be.getHistory('h')).toHaveLength(3);
  });
});

describe('ExperimentEngine', () => {
  it('designs and runs an experiment', async () => {
    const ee = new ExperimentEngine();
    ee.design({
      name: 'cache-size', hypothesis: 'Larger cache improves throughput',
      description: 'Test cache size 100 vs 1000', controlLabel: 'small', treatmentLabel: 'large',
      durationMs: 1000, metrics: ['throughput'], minSampleSize: 2,
    });

    for (let i = 0; i < 3; i++) {
      ee.recordTrial('cache-size', 'control', [{ name: 'throughput', value: 80 + i, unit: 'ops/s', higherIsBetter: true }]);
      ee.recordTrial('cache-size', 'treatment', [{ name: 'throughput', value: 90 + i, unit: 'ops/s', higherIsBetter: true }]);
    }

    const result = await ee.analyze('cache-size');
    expect(result).not.toBeNull();
    expect(result!.conclusions['throughput']?.winner).toBe('treatment');
    expect(result!.conclusions['throughput']?.improvement).toBeGreaterThan(0);
  });

  it('returns null when below min sample size', async () => {
    const ee = new ExperimentEngine();
    ee.design({ name: 'quick', hypothesis: '', description: '', controlLabel: 'c', treatmentLabel: 't', durationMs: 100, metrics: ['m'], minSampleSize: 10 });
    ee.recordTrial('quick', 'control', [{ name: 'm', value: 1, unit: '', higherIsBetter: true }]);
    ee.recordTrial('quick', 'treatment', [{ name: 'm', value: 2, unit: '', higherIsBetter: true }]);
    expect(await ee.analyze('quick')).toBeNull();
  });

  it('handles tie experiments', async () => {
    const ee = new ExperimentEngine();
    ee.design({ name: 'tie', hypothesis: '', description: '', controlLabel: 'c', treatmentLabel: 't', durationMs: 100, metrics: ['m'], minSampleSize: 2 });
    for (let i = 0; i < 3; i++) {
      ee.recordTrial('tie', 'control', [{ name: 'm', value: 50, unit: '', higherIsBetter: true }]);
      ee.recordTrial('tie', 'treatment', [{ name: 'm', value: 50, unit: '', higherIsBetter: true }]);
    }
    const result = await ee.analyze('tie');
    expect(result!.conclusions['m']?.winner).toBe('tie');
  });
});

describe('MutationEngine', () => {
  it('proposes and applies a mutation', () => {
    const me = new MutationEngine();
    let currentConfig: Record<string, unknown> = { threshold: 0.5 };
    const sub: MutableSubsystem = {
      name: 'test-sub',
      getConfig: () => ({ ...currentConfig }),
      applyConfig: (delta) => { currentConfig = { ...currentConfig, ...delta }; },
      rollbackConfig: () => { currentConfig = { threshold: 0.5 }; },
    };
    me.register(sub);

    const mut = me.propose({ subsystem: 'test-sub', type: 'param-tune', description: 'Tune threshold', configDelta: { threshold: 0.7 }, expectedImpact: 'Better precision', risk: 'low' });
    expect(mut.applied).toBe(false);

    expect(me.apply(mut.id)).toBe(true);
    expect(mut.applied).toBe(true);
    expect(currentConfig.threshold).toBe(0.7);
  });

  it('rolls back a mutation', () => {
    const me = new MutationEngine();
    let config = { alpha: 1 };
    me.register({ name: 's', getConfig: () => ({ ...config }), applyConfig: (d) => { config = { ...config, ...d }; }, rollbackConfig: () => { config = { alpha: 1 }; } });
    const mut = me.propose({ subsystem: 's', type: 'config-change', description: 'Change alpha', configDelta: { alpha: 2 }, expectedImpact: '', risk: 'low' });
    me.apply(mut.id);
    expect(config.alpha).toBe(2);
    me.rollback(mut.id);
    expect(config.alpha).toBe(1);
    expect(mut.rollbacked).toBe(true);
  });

  it('generates proposals from config', () => {
    const me = new MutationEngine();
    me.register({ name: 't', getConfig: () => ({ rate: 0.1, limit: 50 }), applyConfig: () => {}, rollbackConfig: () => {} });
    const proposals = me.generateProposals({});
    expect(proposals.length).toBeGreaterThanOrEqual(2);
    expect(proposals.every((p) => p.type === 'param-tune')).toBe(true);
  });

  it('generates proposals only for numeric config values', () => {
    const me = new MutationEngine();
    me.register({ name: 's', getConfig: () => ({ enabled: true, name: 'foo' }), applyConfig: () => {}, rollbackConfig: () => {} });
    expect(me.generateProposals({})).toHaveLength(0);
  });
});

describe('EvolutionEngine (integration)', () => {
  it('runs a full evolution cycle', async () => {
    const evo = new EvolutionEngine();
    let config = { threshold: 0.5 };
    evo.registerSubsystem('classifier', {
      name: 'classifier',
      runBenchmark: async (): Promise<BenchmarkMetric[]> => {
        const t = config.threshold as number;
        return [
          { name: 'precision', value: 0.8 + t * 0.1, unit: 'score', higherIsBetter: true },
          { name: 'recall', value: 0.7 - t * 0.05, unit: 'score', higherIsBetter: true },
        ];
      },
      getConfig: () => ({ ...config }),
    }, {
      name: 'classifier',
      getConfig: () => ({ ...config }),
      applyConfig: (d) => { config = { ...config, ...d }; },
      rollbackConfig: () => { config = { threshold: 0.5 }; },
    });

    const report = await evo.runEvolutionCycle();
    expect(report.cycleId).toBe(1);
    expect(report.baselineRuns.length).toBeGreaterThanOrEqual(1);
    expect(report.afterRuns.length).toBeGreaterThanOrEqual(1);
    expect(report.mutationsProposed).toBeGreaterThanOrEqual(1);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('runs a controlled experiment via evolution engine', async () => {
    const evo = new EvolutionEngine();
    evo.registerSubsystem('search', {
      name: 'search',
      runBenchmark: async () => [{ name: 'latency', value: 20, unit: 'ms', higherIsBetter: false }],
      getConfig: () => ({ mode: 'fast' }),
    }, {
      name: 'search', getConfig: () => ({ mode: 'fast' }), applyConfig: () => {}, rollbackConfig: () => {},
    });

    evo.registerSubsystem('search-v2', {
      name: 'search-v2',
      runBenchmark: async () => [{ name: 'latency', value: 15, unit: 'ms', higherIsBetter: false }],
      getConfig: () => ({ mode: 'deep' }),
    }, {
      name: 'search-v2', getConfig: () => ({ mode: 'deep' }), applyConfig: () => {}, rollbackConfig: () => {},
    });

    const result = await evo.runExperiment({
      name: 'search-mode', hypothesis: 'Deep search is faster', description: '',
      controlLabel: 'search', treatmentLabel: 'search-v2',
      durationMs: 100, metrics: ['latency'], minSampleSize: 2,
    });

    expect(result).not.toBeNull();
    expect(result!.conclusions['latency']?.winner).toBe('control');
  });
});

describe('EvolutionEngine stats', () => {
  it('returns stats object', () => {
    const evo = new EvolutionEngine();
    const stats = evo.getStats();
    expect(stats.cycles).toBe(0);
    expect(stats.benchmark).toBeDefined();
    expect(stats.mutation).toBeDefined();
  });

  it('measures adaptation counts after cycles', async () => {
    const evo = new EvolutionEngine();
    evo.registerSubsystem('dummy', {
      name: 'dummy', runBenchmark: async () => [{ name: 'm', value: 1, unit: '', higherIsBetter: true }], getConfig: () => ({ x: 1 }),
    }, {
      name: 'dummy', getConfig: () => ({ x: 1 }), applyConfig: () => {}, rollbackConfig: () => {},
    });
    await evo.runEvolutionCycle();
    expect(evo.getCycleCount()).toBe(1);
    expect(evo.getAdaptations()).toHaveLength(1);
  });
});
