import { describe, it, expect } from 'vitest';
import { TraceLedger } from '../cognitive-plane/trace-engine/trace-ledger.js';
import { createTrace, endTrace, addTraceEvent } from '../cognitive-plane/trace-engine/cognitive-trace.js';
import { CognitiveReplay } from '../cognitive-plane/replay/cognitive-replay.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

function buildSessionTrace(ledger: TraceLedger): { root: ReturnType<typeof createTrace>; child: ReturnType<typeof createTrace> } {
  const root = createTrace({ name: 'session.start' });
  const child = createTrace({ name: 'tool.call', parent_span_id: root.span_id, trace_id: root.trace_id });
  ledger.append(root);
  ledger.append(child);
  return { root, child };
}

describe('CognitiveReplay.replayEvents', () => {
  it('flattens events chronologically with span context', () => {
    const ledger = new TraceLedger();
    const { root, child } = buildSessionTrace(ledger);

    const rootWithEvent = addTraceEvent(root, { type: 'session_start', attributes: [{ key: 'payload.id', value: 's1' }] });
    const childWithEvent = addTraceEvent(child, { type: 'tool_call', attributes: [{ key: 'payload.tool', value: 'eslint' }] });
    ledger.updateSpan(rootWithEvent.span_id, rootWithEvent);
    ledger.updateSpan(childWithEvent.span_id, childWithEvent);

    const replay = new CognitiveReplay(ledger);
    const entries = replay.replayEvents(root.trace_id);

    expect(entries).toHaveLength(2);
    expect(entries[0]!.type).toBe('session_start');
    expect(entries[1]!.type).toBe('tool_call');
    expect(entries[1]!.span_name).toBe('tool.call');
    expect(entries[1]!.span_id).toBe(child.span_id);
    expect(entries[1]!.trace_id).toBe(root.trace_id);
  });

  it('returns empty for unknown trace', () => {
    const replay = new CognitiveReplay(new TraceLedger());
    expect(replay.replayEvents('nope')).toEqual([]);
  });
});

describe('CognitiveReplay.resumeContext', () => {
  it('collects files, decisions, errors, and tool calls', () => {
    const ledger = new TraceLedger();
    const root = createTrace({ name: 'session.start' });
    const tool = createTrace({ name: 'tool.call', parent_span_id: root.span_id, trace_id: root.trace_id });
    const failed = createTrace({ name: 'test.run', parent_span_id: root.span_id, trace_id: root.trace_id });
    ledger.append(root);
    ledger.append(tool);
    ledger.append(failed);

    ledger.updateSpan(
      root.span_id,
      addTraceEvent(root, { type: 'decision', attributes: [{ key: 'payload.title', value: 'use prisma' }] }),
    );
    ledger.updateSpan(
      tool.span_id,
      addTraceEvent(tool, {
        type: 'tool_call',
        attributes: [
          { key: 'payload.tool', value: 'edit' },
          { key: 'payload.path', value: 'src/db.ts' },
        ],
      }),
    );
    ledger.updateSpan(
      failed.span_id,
      endTrace(addTraceEvent(failed, { type: 'test_fail', attributes: [] }), 'error', 'timeout'),
    );

    const replay = new CognitiveReplay(ledger);
    const ctx = replay.resumeContext(root.trace_id)!;

    expect(ctx.root_name).toBe('session.start');
    expect(ctx.files_touched).toContain('src/db.ts');
    expect(ctx.decisions).toHaveLength(1);
    expect(ctx.decisions[0]!.type).toBe('decision');
    expect(ctx.tool_calls).toHaveLength(1);
    expect(ctx.errors.length).toBeGreaterThanOrEqual(1);
    expect(ctx.status_summary['test.run']?.['error']).toBe(1);
    expect(ctx.continuation.trace_id).toBe(root.trace_id);
    expect(ctx.continuation.parent_span_id).toMatch(/^[0-9a-f]{16}$/);
    expect(ctx.continuation.traceparent).toContain(ctx.continuation.trace_id);
  });

  it('flags unended plan steps as pending', () => {
    const ledger = new TraceLedger();
    const root = createTrace({ name: 'session.start' });
    const plan = createTrace({ name: 'plan.step', parent_span_id: root.span_id, trace_id: root.trace_id });
    ledger.append(root);
    ledger.append(plan);
    ledger.updateSpan(
      plan.span_id,
      addTraceEvent(plan, { type: 'plan_step', attributes: [{ key: 'payload.step', value: 'write schema' }] }),
    );

    const replay = new CognitiveReplay(ledger);
    const ctx = replay.resumeContext(root.trace_id)!;
    expect(ctx.pending_plan_steps).toHaveLength(1);
    expect(ctx.pending_plan_steps[0]!.attributes.find((a) => a.key === 'payload.step')?.value).toBe('write schema');
  });

  it('returns null for unknown trace', () => {
    const replay = new CognitiveReplay(new TraceLedger());
    expect(replay.resumeContext('nope')).toBeNull();
  });
});

describe('CognitiveReplay.hydrate', () => {
  it('re-publishes recorded traces as events with lineage metadata', async () => {
    const ledger = new TraceLedger();
    const root = createTrace({ name: 'session.start' });
    const child = createTrace({
      name: 'tool.call',
      parent_span_id: root.span_id,
      trace_id: root.trace_id,
      attributes: [
        { key: 'agent.id', value: 'claude-code' },
        { key: 'session.id', value: 's42' },
      ],
    });
    ledger.append(root);
    ledger.append(child);

    ledger.updateSpan(
      root.span_id,
      addTraceEvent(root, {
        type: 'session_start',
        attributes: [
          { key: 'event.type', value: 'session:started' },
          { key: 'event.source', value: 'ide' },
          { key: 'payload.id', value: 's42' },
        ],
      }),
    );
    ledger.updateSpan(
      child.span_id,
      addTraceEvent(child, {
        type: 'tool_call',
        attributes: [
          { key: 'event.type', value: 'tool:called' },
          { key: 'event.source', value: 'claude-code' },
          { key: 'payload.tool', value: 'eslint' },
          { key: 'payload.pattern', value: '*.ts' },
        ],
      }),
    );

    const bus = new NeuralEventBus();
    const replay = new CognitiveReplay(ledger);
    const count = await replay.hydrate(bus, root.trace_id);

    expect(count).toBe(2);
    const history = bus.getHistory();
    const toolEvent = history.find((e) => e.type === 'tool:called')!;
    expect(toolEvent).toBeDefined();
    expect(toolEvent.payload.tool).toBe('eslint');
    expect(toolEvent.payload.pattern).toBe('*.ts');
    expect(toolEvent.metadata?.agent_id).toBe('claude-code');
    expect(toolEvent.metadata?.session_id).toBe('s42');
    expect(toolEvent.metadata?.replay_of).toBe(root.trace_id);
    expect(toolEvent.metadata?.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(toolEvent.metadata?.traceparent).toContain(root.trace_id);
  });

  it('publishes nothing for unknown traces', async () => {
    const replay = new CognitiveReplay(new TraceLedger());
    const count = await replay.hydrate(new NeuralEventBus(), 'nope');
    expect(count).toBe(0);
  });

  it('hydrated events feed downstream recorders without trace loops', async () => {
    const ledger = new TraceLedger();
    const root = createTrace({ name: 'session.start' });
    ledger.append(root);
    ledger.updateSpan(
      root.span_id,
      addTraceEvent(root, {
        type: 'session_start',
        attributes: [
          { key: 'event.type', value: 'session:started' },
          { key: 'event.source', value: 'ide' },
        ],
      }),
    );

    const bus = new NeuralEventBus();
    const replay = new CognitiveReplay(ledger);
    await replay.hydrate(bus, root.trace_id);

    const hydrated = bus.getHistory().filter((e) => e.type === 'session:started');
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0]!.metadata?.replay_of).toBe(root.trace_id);
  });
});
