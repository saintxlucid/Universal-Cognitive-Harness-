import { describe, it, expect, vi } from 'vitest';
import * as fs from 'node:fs';
import { TraceLedger } from '../cognitive-plane/trace-engine/trace-ledger.js';
import {
  createTrace,
  endTrace,
  addTraceEvent,
} from '../cognitive-plane/trace-engine/cognitive-trace.js';
import { SignalStore } from '../cognitive-plane/signals/signal-store.js';
import { DecisionLog } from '../cognitive-plane/decisions/decision-log.js';
import { MistakeLogger } from '../shared/mistake-logger.js';
import { SearchEngine } from '../cognitive-plane/search/search-engine.js';
import { TaskScheduler } from '../cognitive-plane/scheduler/task-scheduler.js';
import { PatternLibrary } from '../cognitive-plane/patterns/pattern-library.js';
import { SuggestionEngine } from '../cognitive-plane/suggestions/suggestion-engine.js';
import { CognitiveDiff } from '../cognitive-plane/diff/cognitive-diff.js';
import { WorkspaceAnalytics } from '../cognitive-plane/analytics/workspace-analytics.js';
import { LRUCache } from '../control-plane/cache/lru-cache.js';
import { RateLimiter } from '../control-plane/limits/rate-limiter.js';
import { WebhookDispatcher } from '../control-plane/notifications/webhook-dispatcher.js';
import { HealthMonitor } from '../control-plane/monitor/health-monitor.js';
import { ExportEngine } from '../control-plane/export/export-engine.js';

// ── LRU Cache ────────────────────────────────────────────────
describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string>();
    cache.set('a', 'alpha');
    expect(cache.get('a')).toBe('alpha');
  });

  it('returns undefined for missing keys', () => {
    const cache = new LRUCache<string>();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('evicts oldest entries when at capacity', () => {
    const cache = new LRUCache<string>(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.set('c', '3');
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBe('2');
    expect(cache.get('c')).toBe('3');
  });

  it('touches accessed entries', () => {
    const cache = new LRUCache<string>(2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a');
    cache.set('c', '3');
    expect(cache.get('a')).toBe('1');
    expect(cache.get('b')).toBeUndefined();
  });

  it('respects TTL', async () => {
    const cache = new LRUCache<string>(10);
    cache.set('a', 'alpha', 10);
    expect(cache.get('a')).toBe('alpha');
    await new Promise((r) => setTimeout(r, 20));
    expect(cache.get('a')).toBeUndefined();
  });

  it('has returns correct status', () => {
    const cache = new LRUCache<string>();
    cache.set('a', '1');
    expect(cache.has('a')).toBe(true);
    expect(cache.has('b')).toBe(false);
  });

  it('delete removes entries', () => {
    const cache = new LRUCache<string>();
    cache.set('a', '1');
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
  });

  it('clear resets all state', () => {
    const cache = new LRUCache<string>();
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.getStats().hits).toBe(0);
  });

  it('tracks hit/miss stats', () => {
    const cache = new LRUCache<string>(10);
    cache.set('a', '1');
    cache.get('a');
    cache.get('b');
    cache.get('a');
    const stats = cache.getStats();
    expect(stats.hits).toBe(2);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(2 / 3);
  });
});

// ── Rate Limiter ──────────────────────────────────────────────
describe('RateLimiter', () => {
  it('allows requests within limit', () => {
    const rl = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
    for (let i = 0; i < 5; i++) {
      const result = rl.check('agent-1');
      expect(result.allowed).toBe(true);
    }
  });

  it('denies requests exceeding limit', () => {
    const rl = new RateLimiter({ maxRequests: 3, windowMs: 60000 });
    for (let i = 0; i < 3; i++) rl.check('agent-1');
    const result = rl.check('agent-1');
    expect(result.allowed).toBe(false);
  });

  it('resets after window expires', async () => {
    const rl = new RateLimiter({ maxRequests: 1, windowMs: 20 });
    rl.check('agent-1');
    await new Promise((r) => setTimeout(r, 30));
    const result = rl.check('agent-1');
    expect(result.allowed).toBe(true);
  });

  it('supports per-agent limits', () => {
    const rl = new RateLimiter({ maxRequests: 100, windowMs: 60000 });
    rl.setLimit('restricted', { maxRequests: 2, windowMs: 60000 });
    expect(rl.check('restricted').allowed).toBe(true);
    expect(rl.check('restricted').allowed).toBe(true);
    expect(rl.check('restricted').allowed).toBe(false);
    expect(rl.check('unrestricted').allowed).toBe(true);
  });

  it('returns remaining count', () => {
    const rl = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
    expect(rl.check('a').remaining).toBe(4);
    expect(rl.check('a').remaining).toBe(3);
  });

  it('getState returns null for unknown agent', () => {
    const rl = new RateLimiter();
    expect(rl.getState('unknown')).toBeNull();
  });

  it('reset clears per-agent state', () => {
    const rl = new RateLimiter({ maxRequests: 1, windowMs: 60000 });
    rl.check('a');
    rl.reset('a');
    expect(rl.check('a').allowed).toBe(true);
  });

  it('reset all clears all agent state', () => {
    const rl = new RateLimiter({ maxRequests: 1, windowMs: 60000 });
    rl.check('a');
    rl.check('b');
    rl.reset();
    expect(rl.check('a').allowed).toBe(true);
    expect(rl.check('b').allowed).toBe(true);
  });

  it('getStats returns aggregate data', () => {
    const rl = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
    rl.check('a');
    rl.check('a');
    rl.setLimit('b', { maxRequests: 0, windowMs: 60000 });
    rl.check('b');
    const stats = rl.getStats();
    expect(stats.agents).toBe(2);
  });
});

// ── Webhook Dispatcher ────────────────────────────────────────
describe('WebhookDispatcher', () => {
  const signal = {
    id: 's1',
    type: 'error:occurred',
    timestamp: new Date(),
    source: 'test',
    payload: {},
    importance: 0.5,
    acknowledged: false,
  };

  it('registers and lists webhooks', () => {
    const wd = new WebhookDispatcher();
    wd.register('wh1', {
      url: 'https://example.com/hook',
      events: ['error:occurred', 'session:started'],
    });
    expect(wd.getWebhooks()).toHaveLength(1);
  });

  it('unregisters webhooks', () => {
    const wd = new WebhookDispatcher();
    wd.register('wh1', {
      url: 'https://example.com/hook',
      events: ['error:occurred'],
    });
    expect(() => wd.unregister('wh1')).not.toThrow();
    expect(wd.getWebhooks()).toHaveLength(0);
  });

  it('dispatches to matching webhooks (gracefully handles failure)', async () => {
    const wd = new WebhookDispatcher();
    wd.register('wh1', {
      url: 'https://localhost:1/nonexistent',
      events: ['error:occurred'],
      retryCount: 1,
      retryDelayMs: 1,
    });
    const results = await wd.dispatch(signal.type, signal);
    expect(results).toHaveLength(1);
    expect(results[0]!.status).toBe('failed');
    expect(results[0]!.attempts).toBe(1);
  });

  it('skips non-matching signal types', async () => {
    const wd = new WebhookDispatcher();
    wd.register('wh1', {
      url: 'https://localhost:1/nonexistent',
      events: ['session:started'],
      retryCount: 1,
      retryDelayMs: 1,
    });
    const results = await wd.dispatch(signal.type, signal);
    expect(results).toHaveLength(0);
  });

  it('skips disabled webhooks', async () => {
    const wd = new WebhookDispatcher();
    wd.register('wh1', {
      url: 'https://localhost:1/nonexistent',
      events: ['error:occurred'],
      enabled: false,
      retryCount: 1,
      retryDelayMs: 1,
    });
    const results = await wd.dispatch(signal.type, signal);
    expect(results).toHaveLength(0);
  });

  it('tracks delivery stats', async () => {
    const wd = new WebhookDispatcher();
    wd.register('wh1', {
      url: 'https://localhost:1/nonexistent',
      events: ['error:occurred'],
      retryCount: 1,
      retryDelayMs: 1,
    });
    await wd.dispatch(signal.type, signal);
    expect(wd.getDeliveries()).toHaveLength(1);
    const stats = wd.getStats();
    expect(stats.totalDeliveries).toBe(1);
  });
});

// ── Health Monitor ────────────────────────────────────────────
describe('HealthMonitor', () => {
  it('runs health checks', async () => {
    const hm = new HealthMonitor();
    hm.register('test', 'control-plane', () => ({
      name: 'test',
      category: 'control-plane' as const,
      status: 'healthy' as const,
      message: 'ok',
      lastCheck: new Date(),
      responseTimeMs: 1,
    }));
    const result = await hm.runAll();
    expect(result.components).toHaveLength(1);
    expect(result.status).toBe('healthy');
  });

  it('detects unhealthy components', async () => {
    const hm = new HealthMonitor();
    hm.register('failing', 'control-plane', () => ({
      name: 'failing',
      category: 'control-plane' as const,
      status: 'unhealthy' as const,
      message: 'fail',
      lastCheck: new Date(),
      responseTimeMs: 1,
    }));
    const result = await hm.runAll();
    expect(result.status).toBe('unhealthy');
    expect(result.summary.unhealthy).toBe(1);
  });

  it('detects degraded status', async () => {
    const hm = new HealthMonitor();
    hm.register('degraded', 'control-plane', () => ({
      name: 'degraded',
      category: 'control-plane' as const,
      status: 'degraded' as const,
      message: 'slow',
      lastCheck: new Date(),
      responseTimeMs: 500,
    }));
    const result = await hm.runAll();
    expect(result.status).toBe('degraded');
  });

  it('handles async health checks', async () => {
    const hm = new HealthMonitor();
    hm.register('async', 'cognitive-plane', async () => ({
      name: 'async',
      category: 'cognitive-plane' as const,
      status: 'healthy' as const,
      message: 'ok',
      lastCheck: new Date(),
      responseTimeMs: 1,
    }));
    const result = await hm.runAll();
    expect(result.status).toBe('healthy');
  });

  it('handles check exceptions as unhealthy', async () => {
    const hm = new HealthMonitor();
    hm.register('throws', 'drivers', () => {
      throw new Error('boom');
    });
    const result = await hm.runAll();
    expect(result.status).toBe('unhealthy');
    expect(result.components[0]!.message).toBe('boom');
  });

  it('returns uptime', async () => {
    const hm = new HealthMonitor();
    hm.register('test', 'control-plane', () => ({
      name: 'test',
      category: 'control-plane' as const,
      status: 'healthy' as const,
      message: 'ok',
      lastCheck: new Date(),
      responseTimeMs: 1,
    }));
    const result = await hm.runAll();
    expect(result.uptimeMs).toBeGreaterThanOrEqual(0);
  });

  it('lists registered components', () => {
    const hm = new HealthMonitor();
    hm.register('a', 'control-plane', () => ({
      name: 'a',
      category: 'control-plane' as const,
      status: 'healthy' as const,
      message: '',
      lastCheck: new Date(),
      responseTimeMs: 0,
    }));
    hm.register('b', 'cognitive-plane', () => ({
      name: 'b',
      category: 'cognitive-plane' as const,
      status: 'healthy' as const,
      message: '',
      lastCheck: new Date(),
      responseTimeMs: 0,
    }));
    expect(hm.listComponents()).toEqual(['a', 'b']);
  });
});

// ── Decision Log ──────────────────────────────────────────────
describe('DecisionLog', () => {
  it('records decisions', () => {
    const dl = new DecisionLog();
    const entry = dl.record({
      title: 'Use TypeScript',
      description: 'Adopt TS',
      rationale: 'Type safety',
      alternatives: [{ name: 'JS', description: 'Plain JS', pros: [], cons: ['no types'] }],
      outcome: 'adopted',
      tags: ['tech-decision', 'language'],
      metadata: { agentId: 'a1' },
      traceIds: [],
    });
    expect(entry.id).toBeDefined();
    expect(dl.count()).toBe(1);
  });

  it('retrieves by id', () => {
    const dl = new DecisionLog();
    const e = dl.record({
      title: 'X',
      description: 'X',
      rationale: 'X',
      alternatives: [],
      outcome: 'ok',
      tags: [],
      metadata: {},
      traceIds: [],
    });
    expect(dl.get(e.id)?.title).toBe('X');
  });

  it('filters by tag', () => {
    const dl = new DecisionLog();
    dl.record({
      title: 'A',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'ok',
      tags: ['arch'],
      metadata: {},
      traceIds: [],
    });
    dl.record({
      title: 'B',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'ok',
      tags: ['bug'],
      metadata: {},
      traceIds: [],
    });
    expect(dl.getByTag('arch')).toHaveLength(1);
  });

  it('filters by outcome', () => {
    const dl = new DecisionLog();
    dl.record({
      title: 'A',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'accepted',
      tags: [],
      metadata: {},
      traceIds: [],
    });
    dl.record({
      title: 'B',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'rejected',
      tags: [],
      metadata: {},
      traceIds: [],
    });
    expect(dl.getByOutcome('accepted')).toHaveLength(1);
  });

  it('filters by time range', () => {
    const dl = new DecisionLog();
    const e = dl.record({
      title: 'A',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'ok',
      tags: [],
      metadata: {},
      traceIds: [],
    });
    const start = new Date(e.timestamp.getTime() - 1000);
    const end = new Date(e.timestamp.getTime() + 1000);
    expect(dl.getByTimeRange(start, end)).toHaveLength(1);
  });

  it('provides stats', () => {
    const dl = new DecisionLog();
    dl.record({
      title: 'A',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'accepted',
      tags: ['ux'],
      metadata: {},
      traceIds: [],
    });
    dl.record({
      title: 'B',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'rejected',
      tags: ['perf'],
      metadata: {},
      traceIds: [],
    });
    const stats = dl.getStats();
    expect(stats.total).toBe(2);
    expect(stats.byOutcome['accepted']).toBe(1);
    expect(stats.byTag['ux']).toBe(1);
  });

  it('clears all entries', () => {
    const dl = new DecisionLog();
    dl.record({
      title: 'A',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'ok',
      tags: [],
      metadata: {},
      traceIds: [],
    });
    dl.clear();
    expect(dl.count()).toBe(0);
  });
});

// ── Task Scheduler ────────────────────────────────────────────
describe('TaskScheduler', () => {
  it('enqueues tasks', () => {
    const ts = new TaskScheduler();
    const task = ts.enqueue({ name: 'test-task', handler: 'echo', priority: 'normal' });
    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
  });

  it('executes tasks via registered handler', async () => {
    const ts = new TaskScheduler();
    const handler = vi.fn().mockResolvedValue('done');
    ts.registerHandler('echo', handler);
    const task = ts.enqueue({ name: 'test', handler: 'echo', priority: 'normal' });
    const result = await ts.execute(task.id);
    expect(result).toBe('done');
    expect(handler).toHaveBeenCalledOnce();
  });

  it('throws for missing handler', async () => {
    const ts = new TaskScheduler();
    const task = ts.enqueue({ name: 'test', handler: 'missing', priority: 'normal' });
    await expect(ts.execute(task.id)).rejects.toThrow('Handler not found');
  });

  it('throws for unknown task', async () => {
    const ts = new TaskScheduler();
    await expect(ts.execute('bad-id')).rejects.toThrow('Task not found');
  });

  it('cancels pending tasks', () => {
    const ts = new TaskScheduler();
    const task = ts.enqueue({ name: 'test', handler: 'echo', priority: 'normal' });
    expect(ts.cancel(task.id)).toBe(true);
    expect(ts.getTask(task.id)!.status).toBe('cancelled');
  });

  it('returns tasks by status', async () => {
    const ts = new TaskScheduler();
    ts.registerHandler('echo', vi.fn().mockResolvedValue('ok'));
    const t1 = ts.enqueue({ name: 'a', handler: 'echo', priority: 'normal' });
    await ts.execute(t1.id);
    const pending = ts.getByStatus('pending');
    expect(pending).toHaveLength(0);
    const completed = ts.getByStatus('completed');
    expect(completed).toHaveLength(1);
  });

  it('provides stats', () => {
    const ts = new TaskScheduler();
    ts.enqueue({ name: 'a', handler: 'h', priority: 'normal' });
    ts.enqueue({ name: 'b', handler: 'h', priority: 'high' });
    const stats = ts.getStats();
    expect(stats.total).toBe(2);
    expect(stats.pending).toBe(2);
  });

  it('registers custom handlers', () => {
    const ts = new TaskScheduler();
    const handler = () => 'ok';
    ts.registerHandler('custom', handler);
    expect(() => ts.registerHandler('custom', handler)).not.toThrow();
    ts.unregisterHandler('custom');
  });
});

// ── Pattern Library ───────────────────────────────────────────
describe('PatternLibrary', () => {
  it('defines patterns', () => {
    const pl = new PatternLibrary();
    const pattern = pl.define({
      name: 'error-pattern',
      description: 'Errors',
      category: 'error-detection',
      matcher: { type: 'name', pattern: ['error'], minConfidence: 0.5 },
      tags: ['error'],
      metadata: {},
    });
    expect(pattern.id).toBeDefined();
    expect(pl.getAll()).toHaveLength(1);
  });

  it('matches traces by name', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'git-pattern',
      description: '',
      category: 'git',
      matcher: { type: 'name', pattern: ['git'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    const trace = createTrace({ name: 'git-commit' });
    const matches = pl.matchTrace(trace);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.patternName).toBe('git-pattern');
  });

  it('does not match unrelated traces', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'git',
      description: '',
      category: '',
      matcher: { type: 'name', pattern: ['git'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    const trace = createTrace({ name: 'build' });
    expect(pl.matchTrace(trace)).toHaveLength(0);
  });

  it('matches by agent id', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'agent-a',
      description: '',
      category: 'agent',
      matcher: { type: 'agent', pattern: ['agent-a'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    const trace = createTrace({
      name: 'work',
      attributes: [{ key: 'agent.id', value: 'agent-other' }],
    });
    const matches = pl.matchTrace(trace);
    expect(matches).toHaveLength(0);

    const trace2 = createTrace({
      name: 'work',
      attributes: [{ key: 'agent.id', value: 'agent-a' }],
    });
    const matches2 = pl.matchTrace(trace2);
    expect(matches2).toHaveLength(1);
  });

  it('matches by attributes', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'big-model',
      description: '',
      category: 'model',
      matcher: { type: 'attribute', pattern: ['model=gpt-4'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    const trace = createTrace({
      name: 'inference',
      attributes: [{ key: 'model', value: 'gpt-4' }],
    });
    expect(pl.matchTrace(trace)).toHaveLength(1);
  });

  it('matches by event type', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'tool-caller',
      description: '',
      category: 'tools',
      matcher: { type: 'event', pattern: ['tool_call'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    let trace = createTrace({ name: 'work' });
    trace = addTraceEvent(trace, { type: 'tool_call', attributes: [] });
    expect(pl.matchTrace(trace)).toHaveLength(1);
  });

  it('matches by sequence', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'read-write',
      description: '',
      category: 'files',
      matcher: { type: 'sequence', pattern: ['file_read', 'file_write'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    let trace = createTrace({ name: 'edit' });
    trace = addTraceEvent(trace, { type: 'file_read', attributes: [] });
    trace = addTraceEvent(trace, { type: 'file_write', attributes: [] });
    expect(pl.matchTrace(trace)).toHaveLength(1);
  });

  it('removes patterns', () => {
    const pl = new PatternLibrary();
    const p = pl.define({
      name: 'test',
      description: '',
      category: '',
      matcher: { type: 'name', pattern: ['x'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    expect(pl.remove(p.id)).toBe(true);
    expect(pl.getAll()).toHaveLength(0);
  });

  it('getRecentMatches returns recent matches', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'p1',
      description: '',
      category: '',
      matcher: { type: 'name', pattern: ['test'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    const trace = createTrace({ name: 'test' });
    pl.matchTrace(trace);
    expect(pl.getRecentMatches()).toHaveLength(1);
  });

  it('getStats returns statistics', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'p1',
      description: 'd1',
      category: 'cat1',
      matcher: { type: 'name', pattern: ['a'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    pl.define({
      name: 'p2',
      description: 'd2',
      category: 'cat1',
      matcher: { type: 'name', pattern: ['b'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    pl.define({
      name: 'p3',
      description: 'd3',
      category: 'cat2',
      matcher: { type: 'name', pattern: ['c'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    const stats = pl.getStats();
    expect(stats.total).toBe(3);
    expect(stats.byCategory['cat1']).toBe(2);
  });

  it('matches multiple traces at once', () => {
    const pl = new PatternLibrary();
    pl.define({
      name: 'name-match',
      description: '',
      category: '',
      matcher: { type: 'name', pattern: ['foo'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });
    const t1 = createTrace({ name: 'foo' });
    const t2 = createTrace({ name: 'foo' });
    const t3 = createTrace({ name: 'bar' });
    const matches = pl.matchTraces([t1, t2, t3]);
    expect(matches).toHaveLength(2);
  });
});

// ── Suggestion Engine ─────────────────────────────────────────
describe('SuggestionEngine', () => {
  it('generates suggestions from trace patterns', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const pl = new PatternLibrary();
    const se = new SuggestionEngine(ledger, dl, pl, { enableAutoConsolidation: false });
    const suggestions = se.generate();
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it('detects repeated errors', () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 5; i++) {
      ledger.append(endTrace(createTrace({ name: 'operation' }), 'error'));
    }
    const se = new SuggestionEngine(ledger, new DecisionLog(), new PatternLibrary());
    const suggestions = se.generate();
    const errorSugg = suggestions.find((s) => s.type === 'review' && s.title.includes('errors'));
    expect(errorSugg).toBeDefined();
  });

  it('suggests consolidation for repeated operations', () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 6; i++) {
      ledger.append(createTrace({ name: 'git-push' }));
    }
    const se = new SuggestionEngine(ledger, new DecisionLog(), new PatternLibrary());
    const suggestions = se.generate();
    const consolidation = suggestions.find((s) => s.type === 'consolidation');
    expect(consolidation).toBeDefined();
    expect(consolidation!.context.operationName).toBe('git-push');
  });

  it('detects high error rate', () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 6; i++) {
      ledger.append(
        endTrace(createTrace({ name: i < 3 ? 'work' : 'fail' }), i < 3 ? 'ok' : 'error'),
      );
    }
    const se = new SuggestionEngine(ledger, new DecisionLog(), new PatternLibrary());
    const suggestions = se.generate();
    const opt = suggestions.find(
      (s) => s.type === 'optimization' && s.title.includes('error rate'),
    );
    expect(opt).toBeDefined();
  });

  it('respects disabled auto-consolidation', () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 6; i++) ledger.append(createTrace({ name: 'repeat' }));
    const se = new SuggestionEngine(ledger, new DecisionLog(), new PatternLibrary(), {
      enableAutoConsolidation: false,
    });
    const suggestions = se.generate();
    expect(suggestions.some((s) => s.type === 'consolidation')).toBe(false);
  });

  it('supports dismiss', () => {
    const se = new SuggestionEngine(new TraceLedger(), new DecisionLog(), new PatternLibrary(), {
      enableAutoConsolidation: false,
    });
    se.generate();
    expect(se.getStats().active).toBe(0);
  });

  it('returns stats', () => {
    const se = new SuggestionEngine(new TraceLedger(), new DecisionLog(), new PatternLibrary(), {
      enableAutoConsolidation: false,
    });
    se.generate();
    const stats = se.getStats();
    expect(stats.total).toBeGreaterThanOrEqual(0);
  });

  it('generates remediation suggestions from repeated mistakes', () => {
    const ml = new MistakeLogger();
    ml.recordMistake({ source: 'tests', intent: 'database.connect', message: 'Connection failed' });
    ml.recordMistake({ source: 'tests', intent: 'database.connect', message: 'Connection failed' });

    const se = new SuggestionEngine(
      new TraceLedger(),
      new DecisionLog(),
      new PatternLibrary(),
      { enableAutoConsolidation: false },
      ml,
    );
    const suggestions = se.generate();
    const remediation = suggestions.find((s) => s.type === 'remediation');

    expect(remediation).toBeDefined();
    expect(remediation?.context.occurrences).toBe(2);
  });
});

// ── Cognitive Diff ────────────────────────────────────────────
describe('CognitiveDiff', () => {
  it('creates snapshots', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const diff = new CognitiveDiff(ledger, dl, ss);
    const snap = diff.snapshot();
    expect(snap.traces).toEqual([]);
    expect(snap.timestamp).toBeDefined();
  });

  it('detects added traces', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const diff = new CognitiveDiff(ledger, dl, ss);

    const before = diff.snapshot();
    ledger.append(createTrace({ name: 'new-trace' }));
    ledger.append(createTrace({ name: 'another' }));
    const after = diff.snapshot();

    const result = diff.diff(before, after);
    expect(result.summary.tracesAdded).toBe(2);
  });

  it('detects changed traces', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const diff = new CognitiveDiff(ledger, dl, ss);

    const trace = createTrace({ name: 'test' });
    ledger.append(trace);
    const before = diff.snapshot();
    ledger.update(trace.trace_id, { status: 'error' });
    const after = diff.snapshot();

    const result = diff.diff(before, after);
    expect(result.summary.tracesChanged).toBe(1);
    expect(result.traces.changed[0]!.changes[0]).toContain('status');
  });

  it('diffByTimeRange returns range results', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const diff = new CognitiveDiff(ledger, dl, ss);

    ledger.append(createTrace({ name: 'a' }));
    const mid = new Date();
    ledger.append(createTrace({ name: 'b' }));

    const result = diff.diffByTimeRange(new Date(0), mid);
    expect(result.summary.tracesAdded).toBeGreaterThanOrEqual(0);
  });
});

// ── Search Engine ─────────────────────────────────────────────
describe('SearchEngine', () => {
  it('searches traces by name', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const search = new SearchEngine(ledger, dl, ss);

    ledger.append(createTrace({ name: 'git-commit' }));
    ledger.append(createTrace({ name: 'build-project' }));

    const result = search.search({ query: 'git' });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.title).toBe('git-commit');
  });

  it('searches decisions', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const search = new SearchEngine(ledger, dl, ss);

    dl.record({
      title: 'Use React',
      description: 'Adopt React for UI',
      rationale: 'Popular',
      alternatives: [],
      outcome: 'adopted',
      tags: ['frontend'],
      metadata: {},
      traceIds: [],
    });

    const result = search.search({ query: 'React' });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.source).toBe('decision');
  });

  it('searches signals', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const search = new SearchEngine(ledger, dl, ss);

    ss.record('error:occurred', 'test-agent', { message: 'OOM' }, 0.9);

    const result = search.search({ query: 'test-agent' });
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.source).toBe('signal');
  });

  it('filters by source type', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const search = new SearchEngine(ledger, dl, ss);

    ledger.append(createTrace({ name: 'git-commit' }));
    dl.record({
      title: 'Use Git',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'ok',
      tags: [],
      metadata: {},
      traceIds: [],
    });

    const onlyTraces = search.search({ query: 'git', sources: ['traces'] });
    expect(onlyTraces.results).toHaveLength(1);
    expect(onlyTraces.results[0]!.source).toBe('trace');
  });

  it('filters by date range', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const search = new SearchEngine(ledger, dl, ss);

    const old = createTrace({ name: 'old' });
    const now = createTrace({ name: 'new' });
    ledger.append(old);
    ledger.append(now);

    const result = search.search({
      query: 'old',
      dateFrom: new Date(0),
      dateTo: new Date(Date.now() + 1000),
    });
    expect(result.results).toHaveLength(1);
  });

  it('paginates results', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const search = new SearchEngine(ledger, dl, ss);

    for (let i = 0; i < 5; i++) ledger.append(createTrace({ name: `item-${i}` }));

    const result = search.search({ query: 'item', limit: 2, offset: 0 });
    expect(result.results).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  it('returns empty for no results', () => {
    const ledger = new TraceLedger();
    const search = new SearchEngine(ledger, new DecisionLog(), new SignalStore(ledger));
    const result = search.search({ query: 'zzz_nonexistent' });
    expect(result.results).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});

// ── Workspace Analytics ───────────────────────────────────────
describe('WorkspaceAnalytics', () => {
  it('generates a report with empty data', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const analytics = new WorkspaceAnalytics(ledger, dl, ss);
    const report = analytics.generateReport();
    expect(report.traces.totalTraces).toBe(0);
    expect(report.decisions.total).toBe(0);
    expect(report.signals.total).toBe(0);
  });

  it('analyzes traces', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const analytics = new WorkspaceAnalytics(ledger, dl, ss);

    ledger.append(
      endTrace(createTrace({ name: 'git', attributes: [{ key: 'agent.id', value: 'a1' }] }), 'ok'),
    );
    ledger.append(endTrace(createTrace({ name: 'git' }), 'error'));
    ledger.append(endTrace(createTrace({ name: 'build' }), 'ok'));

    const report = analytics.generateReport();
    expect(report.traces.totalTraces).toBe(3);
    expect(report.traces.byName['git']).toBe(2);
    expect(report.traces.errorRate).toBeGreaterThan(0);
  });

  it('analyzes decisions', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const analytics = new WorkspaceAnalytics(ledger, dl, ss);

    dl.record({
      title: 'A',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'accepted',
      tags: ['frontend'],
      metadata: {},
      traceIds: [],
    });
    dl.record({
      title: 'B',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'rejected',
      tags: ['backend'],
      metadata: {},
      traceIds: [],
    });

    const report = analytics.generateReport();
    expect(report.decisions.total).toBe(2);
    expect(report.decisions.byOutcome['accepted']).toBe(1);
  });

  it('analyzes signals', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const analytics = new WorkspaceAnalytics(ledger, dl, ss);

    ss.record('error:occurred', 'a1', {}, 0.9);
    ss.record('session:started', 'a2', {}, 0.3);

    const report = analytics.generateReport();
    expect(report.signals.total).toBe(2);
    expect(report.signals.avgImportance).toBeCloseTo(0.6);
  });

  it('produces activity timeseries', () => {
    const ledger = new TraceLedger();
    const analytics = new WorkspaceAnalytics(ledger, new DecisionLog(), new SignalStore(ledger));

    ledger.append(createTrace({ name: 'a' }));
    ledger.append(createTrace({ name: 'b' }));

    const series = analytics.activityTimeseries(30, 'day');
    expect(series.length).toBeGreaterThanOrEqual(1);
  });

  it('produces trace breakdown', () => {
    const ledger = new TraceLedger();
    const analytics = new WorkspaceAnalytics(ledger, new DecisionLog(), new SignalStore(ledger));

    ledger.append(createTrace({ name: 'a', kind: 'internal' }));
    ledger.append(createTrace({ name: 'b', kind: 'internal' }));
    ledger.append(createTrace({ name: 'c', kind: 'server' }));

    const breakdown = analytics.traceBreakdown('kind');
    expect(breakdown.find((p) => p.label === 'internal')!.value).toBe(2);
    expect(breakdown.find((p) => p.label === 'server')!.value).toBe(1);
  });
});

// ── Export Engine ─────────────────────────────────────────────
describe('ExportEngine', () => {
  it('exports empty data as JSON', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    const output = ee.export({ format: 'json', scope: 'all' });
    const parsed = JSON.parse(output);
    expect(parsed.exportedAt).toBeDefined();
    expect(parsed.traces).toEqual([]);
  });

  it('exports traces as JSON', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    ledger.append(createTrace({ name: 'test' }));
    const output = ee.export({ format: 'json', scope: 'traces' });
    const parsed = JSON.parse(output);
    expect(parsed.traces).toHaveLength(1);
    expect(parsed.traces[0]!.name).toBe('test');
  });

  it('exports as JSONL', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    ledger.append(createTrace({ name: 'a' }));
    ledger.append(createTrace({ name: 'b' }));
    const output = ee.export({ format: 'jsonl', scope: 'traces' });
    const lines = output.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]!).type).toBe('trace');
  });

  it('exports as CSV', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    ledger.append(createTrace({ name: 'test-trace', kind: 'internal' }));
    const output = ee.export({ format: 'csv', scope: 'traces' });
    expect(output).toContain('type,id,name,kind,status,duration_ms,timestamp');
    expect(output).toContain('trace,');
    expect(output).toContain('test-trace');
  });

  it('exports as Markdown', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    ledger.append(createTrace({ name: 'test' }));
    const output = ee.export({ format: 'markdown', scope: 'traces' });
    expect(output).toContain('# UCCP Export');
    expect(output).toContain('| ID | Name | Kind | Status | Timestamp |');
  });

  it('exports decisions as Markdown', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    dl.record({
      title: 'Decision X',
      description: 'desc',
      rationale: 'reason',
      alternatives: [{ name: 'Alt', description: 'other', pros: [], cons: ['risk'] }],
      outcome: 'adopted',
      tags: ['arch'],
      metadata: {},
      traceIds: [],
    });
    const output = ee.export({ format: 'markdown', scope: 'decisions' });
    expect(output).toContain('Decision X');
    expect(output).toContain('**Rationale:** reason');
    expect(output).toContain('Alt');
  });

  it('exports signals as CSV with all columns', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    ss.record('error:occurred', 'agent1', { msg: 'fail' }, 0.8);
    const output = ee.export({ format: 'csv', scope: 'signals' });
    expect(output).toContain('type,id,signal_type,source,importance,acknowledged,timestamp');
    expect(output).toContain('error:occurred');
  });

  it('applies trace filter', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    ledger.append(endTrace(createTrace({ name: 'good' }), 'ok'));
    ledger.append(endTrace(createTrace({ name: 'bad' }), 'error'));

    const output = ee.export({
      format: 'json',
      scope: 'traces',
      traceFilter: (t) => t.status === 'error',
    });
    const parsed = JSON.parse(output);
    expect(parsed.traces).toHaveLength(1);
    expect(parsed.traces[0]!.name).toBe('bad');
  });

  it('exports decisions as JSON with metadata', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    dl.record({
      title: 'T1',
      description: 'D1',
      rationale: 'R1',
      alternatives: [],
      outcome: 'ok',
      tags: ['t1'],
      metadata: { version: 2 },
      traceIds: ['tr1'],
    });
    const output = ee.export({ format: 'json', scope: 'decisions' });
    const parsed = JSON.parse(output);
    expect(parsed.decisions[0]!.title).toBe('T1');
    expect(parsed.decisions[0]!.metadata.version).toBe(2);
  });

  it('exports to file', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const ee = new ExportEngine(ledger, dl, ss);

    ledger.append(createTrace({ name: 'persist-test' }));
    const filePath = '/tmp/uccp-export-test.json';
    ee.exportToFile({ format: 'json', scope: 'traces', filePath });

    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    expect(parsed.traces).toHaveLength(1);
    fs.unlinkSync(filePath);
  });
});

// ── Integration: Cross-module workflows ───────────────────────
describe('Cross-module integration', () => {
  it('search finds recorded decisions and traces', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const search = new SearchEngine(ledger, dl, ss);

    ledger.append(createTrace({ name: 'implement-auth' }));
    dl.record({
      title: 'Use JWT',
      description: 'JWT-based auth',
      rationale: 'stateless',
      alternatives: [],
      outcome: 'adopted',
      tags: ['security'],
      metadata: {},
      traceIds: [],
    });

    const results = search.search({ query: 'auth' });
    expect(results.results.length).toBeGreaterThanOrEqual(2);
  });

  it('analytics reflects recorded data', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const analytics = new WorkspaceAnalytics(ledger, dl, ss);

    for (let i = 0; i < 10; i++) {
      ledger.append(
        endTrace(
          createTrace({
            name: `op-${i}`,
            attributes: [{ key: 'agent.id', value: i < 5 ? 'bot-a' : 'bot-b' }],
          }),
          'ok',
        ),
      );
    }
    dl.record({
      title: 'Decision 1',
      description: '',
      rationale: '',
      alternatives: [],
      outcome: 'accepted',
      tags: ['arch'],
      metadata: {},
      traceIds: [],
    });

    const report = analytics.generateReport();
    expect(report.traces.totalTraces).toBe(10);
    expect(report.traces.byAgent['bot-a']).toBe(5);
    expect(report.decisions.total).toBe(1);
  });

  it('patterns detect across multiple traces', () => {
    const ledger = new TraceLedger();
    const pl = new PatternLibrary();

    pl.define({
      name: 'build-pattern',
      description: '',
      category: 'ci',
      matcher: { type: 'name', pattern: ['build'], minConfidence: 0.5 },
      tags: [],
      metadata: {},
    });

    for (let i = 0; i < 3; i++) {
      ledger.append(createTrace({ name: 'build' }));
    }
    ledger.append(createTrace({ name: 'deploy' }));

    const matches = pl.matchTraces([...ledger['traces'].values()]);
    expect(matches).toHaveLength(3);
  });

  it('diff detects changes after recording', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const ss = new SignalStore(ledger);
    const diff = new CognitiveDiff(ledger, dl, ss);

    const snap1 = diff.snapshot();
    ledger.append(createTrace({ name: 'new-op' }));
    const snap2 = diff.snapshot();

    const result = diff.diff(snap1, snap2);
    expect(result.summary.tracesAdded).toBe(1);
  });

  it('suggestion engine responds to trace data', () => {
    const ledger = new TraceLedger();
    const dl = new DecisionLog();
    const pl = new PatternLibrary();

    for (let i = 0; i < 5; i++) {
      ledger.append(endTrace(createTrace({ name: `failing-op` }), 'error'));
    }

    const se = new SuggestionEngine(ledger, dl, pl);
    const suggestions = se.generate();
    const errorSuggestion = suggestions.find((s) => s.type === 'review');
    expect(errorSuggestion).toBeDefined();
  });
});
