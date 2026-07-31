import { describe, it, expect } from 'vitest';
import { EventLedger } from '../cognitive-recorder/event-ledger.js';
import { Recorder } from '../cognitive-recorder/recorder.js';
import { createActivity, completeActivity } from '../cognitive-recorder/cognitive-activity.js';
import type { CognitiveActivity } from '../cognitive-recorder/cognitive-activity.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { createProvenance } from '../kernel/types/provenance.js';

function makeContext(overrides?: Record<string, string>) {
  return {
    session_id: overrides?.session_id ?? 'test-session',
    agent_id: overrides?.agent_id ?? 'test-agent',
    workspace_id: overrides?.workspace_id ?? 'test-ws',
  };
}

describe('EventLedger', () => {
  it('appends and retrieves activities', () => {
    const ledger = new EventLedger();
    const act = createActivity({
      type: 'observe',
      context: makeContext(),
      provenance: createProvenance('system_log', 'test'),
      goal: 'test observation',
    });
    ledger.append(act);
    expect(ledger.count()).toBe(1);
    expect(ledger.getById(act.id)).toBeDefined();
  });

  it('rejects mutation through returned references', () => {
    const ledger = new EventLedger();
    const act = createActivity({
      type: 'plan',
      context: makeContext(),
      provenance: createProvenance('system_log', 'test'),
    });
    ledger.append(act);
    const retrieved = ledger.getById(act.id)!;
    expect(retrieved.outcome.status).toBe('running');
  });

  it('indexes by activity type', () => {
    const ledger = new EventLedger();
    ledger.append(createActivity({ type: 'observe', context: makeContext(), provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'plan', context: makeContext(), provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'execute', context: makeContext(), provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'observe', context: makeContext(), provenance: createProvenance('system_log', 't') }));

    expect(ledger.getByType('observe')).toHaveLength(2);
    expect(ledger.getByType('plan')).toHaveLength(1);
    expect(ledger.getByType('execute')).toHaveLength(1);
    expect(ledger.getByType('reflect')).toHaveLength(0);
  });

  it('indexes by session', () => {
    const ledger = new EventLedger();
    const ctxA = makeContext({ session_id: 'session-a' });
    const ctxB = makeContext({ session_id: 'session-b' });

    ledger.append(createActivity({ type: 'observe', context: ctxA, provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'plan', context: ctxB, provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'execute', context: ctxA, provenance: createProvenance('system_log', 't') }));

    expect(ledger.getBySession('session-a')).toHaveLength(2);
    expect(ledger.getBySession('session-b')).toHaveLength(1);
  });

  it('indexes by agent', () => {
    const ledger = new EventLedger();
    const ctx1 = makeContext({ agent_id: 'agent-1' });
    const ctx2 = makeContext({ agent_id: 'agent-2' });

    ledger.append(createActivity({ type: 'observe', context: ctx1, provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'plan', context: ctx2, provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'observe', context: ctx1, provenance: createProvenance('system_log', 't') }));

    expect(ledger.getByAgent('agent-1')).toHaveLength(2);
    expect(ledger.getByAgent('agent-2')).toHaveLength(1);
  });

  it('indexes by trace', () => {
    const ledger = new EventLedger();
    const traceId = 'trace-001';
    const act1 = createActivity({ type: 'observe', context: makeContext(), provenance: createProvenance('system_log', 't'), trace_id: traceId });
    const act2 = createActivity({ type: 'plan', context: makeContext(), provenance: createProvenance('system_log', 't'), trace_id: traceId, parent_id: act1.id });

    ledger.append(act1);
    ledger.append(act2);
    ledger.append(createActivity({ type: 'execute', context: makeContext(), provenance: createProvenance('system_log', 't') }));

    expect(ledger.getByTrace(traceId)).toHaveLength(2);
    expect(ledger.getTraceRoot(traceId)?.id).toBe(act1.id);
  });

  it('finds child activities by parent_id', () => {
    const ledger = new EventLedger();
    const parent = createActivity({ type: 'plan', context: makeContext(), provenance: createProvenance('system_log', 't') });
    const child1 = createActivity({ type: 'execute', context: makeContext(), provenance: createProvenance('system_log', 't'), parent_id: parent.id });
    const child2 = createActivity({ type: 'execute', context: makeContext(), provenance: createProvenance('system_log', 't'), parent_id: parent.id });

    ledger.append(parent);
    ledger.append(child1);
    ledger.append(child2);

    expect(ledger.getChildren(parent.id)).toHaveLength(2);
  });

  it('returns recent activities in reverse chronological order', () => {
    const ledger = new EventLedger();
    for (let i = 0; i < 10; i++) {
      ledger.append(createActivity({ type: 'observe', context: makeContext(), provenance: createProvenance('system_log', 't') }));
    }
    const recent = ledger.getRecent(5);
    expect(recent).toHaveLength(5);
  });

  it('queries by time range', () => {
    const ledger = new EventLedger();
    const past = new Date('2024-01-01');
    const future = new Date('2026-12-31');
    ledger.append(createActivity({ type: 'observe', context: makeContext(), provenance: createProvenance('system_log', 't') }));
    const results = ledger.getByTimeRange(past, future);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('provides ledger stats', () => {
    const ledger = new EventLedger();
    ledger.append(createActivity({ type: 'observe', context: makeContext({ agent_id: 'a1' }), provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'plan', context: makeContext({ agent_id: 'a1' }), provenance: createProvenance('system_log', 't') }));
    ledger.append(createActivity({ type: 'observe', context: makeContext({ agent_id: 'a2' }), provenance: createProvenance('system_log', 't') }));

    const stats = ledger.getStats();
    expect(stats.total_activities).toBe(3);
    expect(stats.by_type['observe']).toBe(2);
    expect(stats.by_type['plan']).toBe(1);
    expect(stats.by_agent['a1']).toBe(2);
    expect(stats.by_agent['a2']).toBe(1);
    expect(stats.time_range.earliest).toBeInstanceOf(Date);
    expect(stats.time_range.latest).toBeInstanceOf(Date);
  });
});

describe('CognitiveActivity', () => {
  it('creates activity with running status', () => {
    const act = createActivity({
      type: 'plan',
      context: makeContext(),
      provenance: createProvenance('system_log', 't'),
      goal: 'build feature',
    });
    expect(act.type).toBe('plan');
    expect(act.outcome.status).toBe('running');
    expect(act.goal).toBe('build feature');
    expect(act.span_id).toBeDefined();
    expect(act.trace_id).toBeDefined();
  });

  it('completes activity with outcome', () => {
    const act = createActivity({
      type: 'execute',
      context: makeContext(),
      provenance: createProvenance('system_log', 't'),
    });
    const completed = completeActivity(act, {
      status: 'success',
      summary: 'Task completed',
      result: { data: 'done' },
    });
    expect(completed.outcome.status).toBe('success');
    expect(completed.outcome.summary).toBe('Task completed');
    expect(completed.outcome.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('supports all activity types', () => {
    const types = [
      'observe', 'understand', 'remember', 'retrieve',
      'predict', 'plan', 'reflect', 'learn',
      'critique', 'simulate', 'execute', 'verify',
      'compress', 'consolidate', 'sleep', 'evolve',
      'converse', 'search', 'build', 'test', 'commit',
    ] as const;
    for (const type of types) {
      const act = createActivity({ type, context: makeContext(), provenance: createProvenance('system_log', 't') });
      expect(act.type).toBe(type);
    }
  });
});

describe('Recorder', () => {
  it('wires to event bus and records activities', async () => {
    const bus = new NeuralEventBus();
    const recorder = new Recorder(bus);

    await bus.publish({
      type: 'file:saved',
      source: 'test',
      payload: { path: '/test/file.ts' },
    });

    const stats = recorder.ledger.getStats();
    expect(stats.total_activities).toBe(1);
    expect(stats.by_type['observe']).toBe(1);
    recorder.disconnect();
  });

  it('records multiple event types as activities', async () => {
    const bus = new NeuralEventBus();
    const recorder = new Recorder(bus);

    await bus.publish({ type: 'git:commit', source: 'test', payload: { message: 'fix bug' } });
    await bus.publish({ type: 'test:passed', source: 'test', payload: { suite: 'unit' } });
    await bus.publish({ type: 'tool:called', source: 'test', payload: { tool: 'eslint' } });
    await bus.publish({ type: 'sleep:cycle', source: 'test', payload: {} });

    const stats = recorder.ledger.getStats();
    expect(stats.total_activities).toBe(4);
    expect(stats.by_type['commit']).toBe(1);
    expect(stats.by_type['test']).toBe(1);
    expect(stats.by_type['execute']).toBe(1);
    expect(stats.by_type['sleep']).toBe(1);
    recorder.disconnect();
  });

  it('tracks active activities', async () => {
    const bus = new NeuralEventBus();
    const recorder = new Recorder(bus);

    await bus.publish({ type: 'git:commit', source: 'test', payload: { message: 'wip' } });
    expect(recorder.getActiveActivities().length).toBeGreaterThanOrEqual(1);
    recorder.disconnect();
  });

  it('completes an activity and removes from active', () => {
    const bus = new NeuralEventBus();
    const recorder = new Recorder(bus);

    const act = createActivity({
      type: 'plan',
      context: makeContext(),
      provenance: createProvenance('system_log', 't'),
    });
    recorder.recordActivity(act);

    recorder.completeActivity(act.id, { done: true }, 'success');
    const completed = recorder.ledger.getById(act.id)!;
    expect(completed.outcome.status).toBe('success');
    recorder.disconnect();
  });

  it('disconnects from event bus cleanly', async () => {
    const bus = new NeuralEventBus();
    const recorder = new Recorder(bus);
    recorder.disconnect();

    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/test.ts' } });
    expect(recorder.ledger.count()).toBe(0);
  });
});
