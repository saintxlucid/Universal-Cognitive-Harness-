import { describe, it, expect } from 'vitest';
import { TraceLedger } from '../cognitive-plane/trace-engine/trace-ledger.js';
import { TraceRecorder } from '../cognitive-plane/trace-engine/trace-recorder.js';
import { createTrace, endTrace, addTraceEvent } from '../cognitive-plane/trace-engine/cognitive-trace.js';
import { CognitiveReplay } from '../cognitive-plane/replay/cognitive-replay.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

describe('TraceLedger', () => {
  it('appends and retrieves traces', () => {
    const ledger = new TraceLedger();
    const trace = createTrace({ name: 'test.span' });
    ledger.append(trace);
    expect(ledger.count()).toBe(1);
    expect(ledger.getByTraceId(trace.trace_id)).toBeDefined();
  });

  it('builds parent-child relationships', () => {
    const ledger = new TraceLedger();
    const parent = createTrace({ name: 'parent' });
    const child = createTrace({ name: 'child', parent_span_id: parent.span_id });
    const grandchild = createTrace({ name: 'grandchild', parent_span_id: child.span_id });

    ledger.append(parent);
    ledger.append(child);
    ledger.append(grandchild);

    const children = ledger.getChildren(parent.span_id);
    expect(children).toHaveLength(1);
    expect(children[0]!.name).toBe('child');

    const tree = ledger.getTraceTree(parent.trace_id);
    expect(tree).toHaveLength(3);
  });

  it('finds span by span_id', () => {
    const ledger = new TraceLedger();
    const trace = createTrace({ name: 'test' });
    ledger.append(trace);
    expect(ledger.getSpanByTraceId(trace.span_id)).toBeDefined();
  });

  it('returns traces by time range', () => {
    const ledger = new TraceLedger();
    ledger.append(createTrace({ name: 'a' }));
    ledger.append(createTrace({ name: 'b' }));
    const results = ledger.getByTimeRange(new Date('2024-01-01'), new Date('2028-01-01'));
    expect(results).toHaveLength(2);
  });

  it('returns recent traces', () => {
    const ledger = new TraceLedger();
    for (let i = 0; i < 10; i++) {
      ledger.append(createTrace({ name: `t${i}` }));
    }
    expect(ledger.getRecent(5)).toHaveLength(5);
  });

  it('provides stats', () => {
    const ledger = new TraceLedger();
    ledger.append(createTrace({ name: 'test', attributes: [{ key: 'agent.id', value: 'a1' }] }));
    ledger.append(createTrace({ name: 'test', attributes: [{ key: 'agent.id', value: 'a1' }] }));
    ledger.append(createTrace({ name: 'other', attributes: [{ key: 'agent.id', value: 'a2' }] }));

    const stats = ledger.getStats();
    expect(stats.total_traces).toBe(3);
    expect(stats.by_name['test']).toBe(2);
    expect(stats.by_name['other']).toBe(1);
    expect(stats.by_agent['a1']).toBe(2);
  });

  it('supports streaming', async () => {
    const ledger = new TraceLedger();
    ledger.append(createTrace({ name: 'a' }));
    ledger.append(createTrace({ name: 'b' }));
    const results: any[] = [];
    for await (const t of ledger.stream()) {
      results.push(t);
    }
    expect(results).toHaveLength(2);
  });

  it('updates existing traces', () => {
    const ledger = new TraceLedger();
    const trace = createTrace({ name: 'test' });
    ledger.append(trace);
    const completed = endTrace(trace, 'ok');
    ledger.update(trace.trace_id, completed);
    const retrieved = ledger.getByTraceId(trace.trace_id)!;
    expect(retrieved.status).toBe('ok');
    expect(retrieved.end_timestamp).not.toBeNull();
  });
});

describe('CognitiveTrace', () => {
  it('creates trace with unset status', () => {
    const trace = createTrace({ name: 'operation.test', kind: 'internal' });
    expect(trace.name).toBe('operation.test');
    expect(trace.kind).toBe('internal');
    expect(trace.status).toBe('unset');
    expect(trace.span_id).toBeDefined();
    expect(trace.trace_id).toBeDefined();
  });

  it('ends trace with status', () => {
    const trace = createTrace({ name: 'test' });
    const ended = endTrace(trace, 'ok', 'Completed successfully');
    expect(ended.status).toBe('ok');
    expect(ended.status_message).toBe('Completed successfully');
    expect(ended.end_timestamp).toBeInstanceOf(Date);
  });

  it('adds events to trace', () => {
    const trace = createTrace({ name: 'test' });
    const updated = addTraceEvent(trace, { type: 'tool_call', attributes: [{ key: 'tool', value: 'eslint' }] });
    expect(updated.events).toHaveLength(1);
    expect(updated.events[0]!.type).toBe('tool_call');
  });

  it('preserves original trace on add', () => {
    const trace = createTrace({ name: 'test' });
    addTraceEvent(trace, { type: 'tool_call', attributes: [] });
    expect(trace.events).toHaveLength(0);
  });

  it('supports client span kind', () => {
    const trace = createTrace({ name: 'file.read', kind: 'client' });
    expect(trace.kind).toBe('client');
  });
});

describe('TraceRecorder', () => {
  it('records trace from event bus', async () => {
    const bus = new NeuralEventBus();
    const recorder = new TraceRecorder(bus);

    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/test.ts' } });
    expect(recorder.ledger.count()).toBe(1);
    recorder.disconnect();
  });

  it('records multiple event types', async () => {
    const bus = new NeuralEventBus();
    const recorder = new TraceRecorder(bus);

    await bus.publish({ type: 'git:commit', source: 'test', payload: { message: 'fix' } });
    await bus.publish({ type: 'test:passed', source: 'test', payload: { suite: 'unit' } });
    await bus.publish({ type: 'tool:called', source: 'test', payload: { tool: 'eslint' } });

    const stats = recorder.ledger.getStats();
    expect(stats.total_traces).toBe(3);
    recorder.disconnect();
  });

  it('ends active traces', async () => {
    const bus = new NeuralEventBus();
    const recorder = new TraceRecorder(bus);

    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/test.ts' } });
    const active = recorder.getActiveTraces();
    expect(active.length).toBeGreaterThanOrEqual(1);

    recorder.endTrace(active[0]!.span_id, 'ok');
    expect(recorder.getActiveTraces()).toHaveLength(0);
    recorder.disconnect();
  });

  it('handles session lifecycle', async () => {
    const bus = new NeuralEventBus();
    const recorder = new TraceRecorder(bus);

    await bus.publish({ type: 'session:started', source: 'test', payload: { id: 's1' } });
    expect(recorder.ledger.count()).toBe(1);

    recorder.closeSession();
    recorder.disconnect();
  });

  it('disconnects cleanly', async () => {
    const bus = new NeuralEventBus();
    const recorder = new TraceRecorder(bus);
    recorder.disconnect();

    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/test.ts' } });
    expect(recorder.ledger.count()).toBe(0);
  });
});

describe('CognitiveReplay', () => {
  it('builds trace tree from ledger', () => {
    const ledger = new TraceLedger();
    const root = createTrace({ name: 'session.start' });
    const child = createTrace({ name: 'tool.call', parent_span_id: root.span_id });
    ledger.append(root);
    ledger.append(child);

    const replay = new CognitiveReplay(ledger);
    const tree = replay.getTraceTree(root.trace_id);
    expect(tree).not.toBeNull();
    expect(tree!.children).toHaveLength(1);
  });

  it('flattens trace tree for replay', () => {
    const ledger = new TraceLedger();
    const root = createTrace({ name: 'session' });
    const c1 = createTrace({ name: 'tool.call', parent_span_id: root.span_id });
    const c2 = createTrace({ name: 'tool.call', parent_span_id: root.span_id });
    ledger.append(root);
    ledger.append(c1);
    ledger.append(c2);

    const replay = new CognitiveReplay(ledger);
    const flat = replay.replay(root.trace_id);
    expect(flat).toHaveLength(3);
  });

  it('returns project timeline', () => {
    const ledger = new TraceLedger();
    ledger.append(createTrace({ name: 'session.start' }));
    ledger.append(createTrace({ name: 'git.commit' }));

    const replay = new CognitiveReplay(ledger);
    const timeline = replay.getProjectTimeline();
    expect(timeline.length).toBeGreaterThanOrEqual(2);
  });

  it('returns workspace state', () => {
    const ledger = new TraceLedger();
    ledger.append(createTrace({ name: 'session.start' }));
    ledger.append(createTrace({ name: 'file.save' }));

    const replay = new CognitiveReplay(ledger);
    const state = replay.getWorkspaceState();
    expect(state.total_traces).toBe(2);
    expect(state.recent_operations).toContain('session.start');
    expect(state.recent_operations).toContain('file.save');
  });

  it('returns empty for non-existent trace', () => {
    const ledger = new TraceLedger();
    const replay = new CognitiveReplay(ledger);
    expect(replay.getTraceTree('nonexistent')).toBeNull();
  });
});
