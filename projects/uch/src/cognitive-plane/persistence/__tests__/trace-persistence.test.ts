import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TracePersistence } from '../trace-persistence.js';
import { TraceLedger } from '../../trace-engine/trace-ledger.js';
import { createTrace } from '../../trace-engine/cognitive-trace.js';

const tempDirs: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-trace-persist-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('TracePersistence', () => {
  it('loads nothing from a missing file', async () => {
    const dir = tempDir();
    const persistence = new TracePersistence(path.join(dir, 'nope', 'traces.jsonl'));
    const ledger = new TraceLedger();
    expect(await persistence.loadInto(ledger)).toBe(0);
  });

  it('loads valid lines and normalizes legacy ids', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'traces.jsonl');
    const legacyId = 'a'.repeat(32);
    fs.writeFileSync(
      file,
      [
        JSON.stringify({
          trace_id: legacyId,
          span_id: 'b'.repeat(16),
          parent_span_id: undefined,
          name: 'legacy.span',
          kind: 'internal',
          timestamp: '2026-07-30T00:00:00.000Z',
          end_timestamp: null,
          attributes: [],
          events: [],
          status: 'ok',
        }),
        'not-json\n',
        '',
      ].join('\n'),
      'utf-8',
    );

    const persistence = new TracePersistence(file);
    const ledger = new TraceLedger();
    expect(await persistence.loadInto(ledger)).toBe(1);
    const traces = ledger.getByTimeRange(new Date(0), new Date('2030-01-01'));
    expect(traces).toHaveLength(1);
    expect(traces[0]!.trace_id).toBe(legacyId);
    expect(traces[0]!.span_id).toBe('b'.repeat(16));
  });

  it('round-trips appended traces to disk and flushes on close', async () => {
    const dir = tempDir();
    const file = path.join(dir, 'traces.jsonl');
    const persistence = new TracePersistence(file);
    persistence.open();
    const trace = createTrace({ name: 'persist.roundtrip' });
    persistence.append(trace);
    await persistence.close();

    const reloaded = new TracePersistence(file);
    const ledger = new TraceLedger();
    expect(await reloaded.loadInto(ledger)).toBe(1);
    expect(ledger.getByTraceId(trace.trace_id)).toBeDefined();
  });

  it('degrades on write errors instead of crashing', async () => {
    const dir = tempDir();
    const target = path.join(dir, 'occupied');
    fs.mkdirSync(target);

    const persistence = new TracePersistence(target);
    persistence.open();
    persistence.append(createTrace({ name: 'doomed.span' }));

    const deadline = Date.now() + 1000;
    while (persistence.writeError === null && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(persistence.writeError).not.toBeNull();
    // Degraded: further appends are safe no-ops, close must not throw.
    persistence.append(createTrace({ name: 'after.degrade' }));
    await expect(persistence.close()).resolves.toBeUndefined();
  });

  it('tracks backpressure when the sink falls behind', async () => {
    const dir = tempDir();
    const persistence = new TracePersistence(path.join(dir, 'traces.jsonl'));
    persistence.open();
    const trace = createTrace({ name: 'big.span' });
    trace.attributes.push({
      key: 'payload',
      value: { blob: 'x'.repeat(512 * 1024) },
    });
    persistence.append(trace);
    expect(persistence.bufferedBytes).toBeGreaterThan(0);
    await persistence.close();
  });
});
