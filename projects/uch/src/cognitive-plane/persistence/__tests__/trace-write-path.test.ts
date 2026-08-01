import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NeuralEventBus } from '../../../event-bus/neural-event-bus.js';
import { TraceRecorder } from '../../trace-engine/trace-recorder.js';
import { TraceLedger } from '../../trace-engine/trace-ledger.js';
import { TracePersistence } from '../trace-persistence.js';

describe('Trace write path (W-01: ledger → persistence sink)', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uch-trace-write-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('fires the sink with the stored copy of every appended trace', async () => {
    const bus = new NeuralEventBus();
    const seen: string[] = [];
    const recorder = new TraceRecorder(bus, {
      onTrace: (trace) => seen.push(trace.span_id),
    });

    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/a.ts' } });
    await bus.publish({ type: 'git:commit', source: 'test', payload: { message: 'm' } });

    expect(seen).toHaveLength(2);
    const ledgerSpans = new Set(recorder.ledger.getRecent(10).map((t) => t.span_id));
    expect(seen.every((spanId) => ledgerSpans.has(spanId))).toBe(true);
    recorder.disconnect();
  });

  it('persists recorded traces to the journal file and reloads them', async () => {
    const file = join(dir, 'traces.jsonl');
    const bus = new NeuralEventBus();
    const persistence = new TracePersistence(file);
    const recorder = new TraceRecorder(bus, {
      onTrace: (trace) => persistence.append(trace),
    });

    persistence.open();
    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/a.ts' } });
    await bus.publish({ type: 'test:passed', source: 'test', payload: { suite: 'unit' } });
    await bus.publish({ type: 'tool:called', source: 'test', payload: { tool: 'eslint' } });
    await persistence.close();
    recorder.disconnect();

    const lines = readFileSync(file, 'utf-8')
      .split('\n')
      .filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(3);

    const ledger = new TraceLedger();
    const reloaded = new TracePersistence(file);
    const count = await reloaded.loadInto(ledger);
    expect(count).toBe(3);
    expect(ledger.count()).toBe(3);
    const stats = ledger.getStats();
    expect(stats.total_traces).toBe(3);
    expect(stats.time_range.earliest).toBeInstanceOf(Date);
  });

  it('does not echo loaded traces back to the file on boot (no duplication)', async () => {
    const file = join(dir, 'traces.jsonl');
    const bus = new NeuralEventBus();
    const persistence = new TracePersistence(file);

    // Session 1: record three traces.
    const recorder1 = new TraceRecorder(bus, {
      onTrace: (trace) => persistence.append(trace),
    });
    persistence.open();
    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/a.ts' } });
    await bus.publish({ type: 'git:commit', source: 'test', payload: { message: 'm' } });
    await bus.publish({ type: 'build:finished', source: 'test', payload: { ok: true } });
    await persistence.close();
    recorder1.disconnect();

    // Session 2: same persistence (sink attached), loadInto must not rewrite.
    const persistence2 = new TracePersistence(file);
    const recorder2 = new TraceRecorder(bus, {
      onTrace: (trace) => persistence2.append(trace),
    });
    persistence2.open();
    await persistence2.loadInto(recorder2.ledger);
    // One new trace in session 2.
    await bus.publish({ type: 'test:passed', source: 'test', payload: { suite: 'unit' } });
    await persistence2.close();
    recorder2.disconnect();

    const lines = readFileSync(file, 'utf-8')
      .split('\n')
      .filter((l) => l.trim().length > 0);
    expect(lines).toHaveLength(4);
  });

  it('append is a no-op before open()', async () => {
    const file = join(dir, 'traces.jsonl');
    const persistence = new TracePersistence(file);
    const bus = new NeuralEventBus();
    const recorder = new TraceRecorder(bus, {
      onTrace: (trace) => persistence.append(trace),
    });

    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/a.ts' } });
    expect(persistence.size).toBe(0);
    recorder.disconnect();
  });
});
