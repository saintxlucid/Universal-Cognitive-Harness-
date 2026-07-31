import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { trace, SpanKind as OtelSpanKind, SpanStatusCode, type Attributes, type SpanOptions, type Context, type Tracer, type TracerProvider } from '@opentelemetry/api';
import {
  OtelBridge,
  hasRegisteredTracerProvider,
  parseTraceparent,
  serializeTraceparent,
  generateTraceId,
  generateSpanId,
  normalizeSpanId,
  normalizeTraceId,
} from '../cognitive-plane/trace-engine/otel-bridge.js';
import { createTrace, endTrace, addTraceEvent, type SpanKind } from '../cognitive-plane/trace-engine/cognitive-trace.js';
import { TraceRecorder } from '../cognitive-plane/trace-engine/trace-recorder.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

interface RecordedSpanEvent {
  name: string;
  attributes?: Attributes;
  time?: number | Date;
}

class RecordingSpan {
  name: string;
  kind: SpanKind | undefined;
  attributes: Attributes = {};
  events: RecordedSpanEvent[] = [];
  status: { code: SpanStatusCode; message?: string } | undefined;
  ended = false;
  endTime: number | Date | undefined;
  parentContext: SpanOptions & { context?: Context } = {};

  constructor(name: string, options?: SpanOptions, parentContext?: Context) {
    this.name = name;
    this.kind = options?.kind;
    this.attributes = { ...(options?.attributes ?? {}) };
    this.parentContext = options ?? {};
    this.parentContext.context = parentContext;
  }

  setAttribute(key: string, value: unknown): this {
    this.attributes[key] = value as never;
    return this;
  }

  addEvent(name: string, attributes?: Attributes, time?: number | Date): this {
    this.events.push({ name, attributes, time });
    return this;
  }

  setStatus(status: { code: SpanStatusCode; message?: string }): this {
    this.status = status;
    return this;
  }

  end(endTime?: number | Date): void {
    this.ended = true;
    this.endTime = endTime;
  }

  recordException(): void {}
  updateName(name: string): void {
    this.name = name;
  }
  isRecording(): boolean {
    return true;
  }
  spanContext(): { traceId: string; spanId: string; traceFlags: number } {
    return { traceId: '', spanId: '', traceFlags: 0 };
  }
}

class RecordingTracer implements Tracer {
  spans: RecordingSpan[] = [];

  startSpan(name: string, options?: SpanOptions, parentContext?: Context): RecordingSpan {
    const span = new RecordingSpan(name, options, parentContext);
    this.spans.push(span);
    return span;
  }

  startActiveSpan(): never {
    throw new Error('not used in tests');
  }
}

class RecordingTracerProvider implements TracerProvider {
  tracer: RecordingTracer;

  constructor(tracer: RecordingTracer) {
    this.tracer = tracer;
  }

  getTracer(): RecordingTracer {
    return this.tracer;
  }
}

describe('trace id generation (W3C)', () => {
  it('generates 128-bit trace ids (32 hex chars)', () => {
    const id = generateTraceId();
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toBe(generateTraceId());
  });

  it('generates 64-bit span ids (16 hex chars)', () => {
    const id = generateSpanId();
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    expect(id).not.toBe(generateSpanId());
  });

  it('creates W3C-conformant ids in cognitive traces', () => {
    const t = createTrace({ name: 'test' });
    expect(t.trace_id).toMatch(/^[0-9a-f]{32}$/);
    expect(t.span_id).toMatch(/^[0-9a-f]{16}$/);
  });

  it('normalizes legacy UUID ids on load', () => {
    const legacyUuid = '3f2b9a01-6d8e-4c2a-b9f1-0a1b2c3d4e5f';
    expect(normalizeSpanId(legacyUuid)).toMatch(/^[0-9a-f]{16}$/);
    expect(normalizeSpanId(legacyUuid)).toBe('3f2b9a016d8e4c2a');
    expect(normalizeTraceId(legacyUuid)).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe('traceparent', () => {
  it('parses a valid header', () => {
    const parsed = parseTraceparent(`00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`);
    expect(parsed).toEqual({
      version: '00',
      trace_id: 'a'.repeat(32),
      span_id: 'b'.repeat(16),
      flags: '01',
    });
  });

  it('rejects malformed headers', () => {
    expect(parseTraceparent(undefined)).toBeNull();
    expect(parseTraceparent('')).toBeNull();
    expect(parseTraceparent('00-abc')).toBeNull();
    expect(parseTraceparent('01-abc-def-01')).toBeNull();
    expect(parseTraceparent(`00-${'g'.repeat(32)}-${'b'.repeat(16)}-01`)).toBeNull();
    expect(parseTraceparent(`00-${'0'.repeat(32)}-${'b'.repeat(16)}-01`)).toBeNull();
    expect(parseTraceparent(`00-${'a'.repeat(32)}-${'0'.repeat(16)}-01`)).toBeNull();
  });

  it('roundtrips through serialize', () => {
    const traceId = generateTraceId();
    const spanId = generateSpanId();
    const header = serializeTraceparent(traceId, spanId);
    expect(parseTraceparent(header)).toEqual({
      version: '00',
      trace_id: traceId,
      span_id: spanId,
      flags: '01',
    });
  });
});

describe('OtelBridge', () => {
  let provider: RecordingTracerProvider;
  let tracer: RecordingTracer;

  beforeEach(() => {
    tracer = new RecordingTracer();
    provider = new RecordingTracerProvider(tracer);
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(() => {
    trace.disable();
  });

  it('detects a registered tracer provider', () => {
    expect(hasRegisteredTracerProvider()).toBe(true);
  });

  it('mirrors a cognitive trace to a real OTel span', () => {
    const bridge = new OtelBridge('test', '1.0.0', true);
    const traceObj = createTrace({ name: 'file.save', kind: 'client', attributes: [{ key: 'file.path', value: '/a.ts' }] });
    const withEvent = addTraceEvent(traceObj, { type: 'file_write', attributes: [] });

    bridge.startSpan(withEvent);
    expect(tracer.spans).toHaveLength(1);
    expect(tracer.spans[0]!.name).toBe('file.save');
    expect(tracer.spans[0]!.kind).toBe(OtelSpanKind.CLIENT);
    expect(tracer.spans[0]!.attributes['file.path']).toBe('/a.ts');

    bridge.endSpan(withEvent.span_id, 'ok', 'Saved');
    expect(tracer.spans[0]!.ended).toBe(true);
    expect(tracer.spans[0]!.status?.code).toBe(SpanStatusCode.OK);
  });

  it('links child spans to their remote parent context', () => {
    const bridge = new OtelBridge('test', '1.0.0', true);
    const root = createTrace({ name: 'session.start' });
    const child = createTrace({ name: 'tool.call', parent_span_id: root.span_id, trace_id: root.trace_id });

    bridge.startSpan(root);
    bridge.startSpan(child);

    const parentOfChild = trace.getSpanContext(tracer.spans[1]!.parentContext.context as Context);
    expect(parentOfChild?.spanId).toBe(root.span_id);
    expect(parentOfChild?.isRemote).toBe(true);
  });

  it('exports a complete trace in one call', () => {
    const bridge = new OtelBridge('test', '1.0.0', true);
    const ended = endTrace(
      addTraceEvent(createTrace({ name: 'git.commit' }), { type: 'git_commit', attributes: [] }),
      'error',
      'merge conflict',
    );
    bridge.exportTrace(ended);

    expect(tracer.spans).toHaveLength(1);
    expect(tracer.spans[0]!.events).toHaveLength(1);
    expect(tracer.spans[0]!.events[0]!.name).toBe('git_commit');
    expect(tracer.spans[0]!.status?.code).toBe(SpanStatusCode.ERROR);
    expect(tracer.spans[0]!.status?.message).toBe('merge conflict');
  });
});

describe('TraceRecorder OTel propagation', () => {
  let tracer: RecordingTracer;
  let bus: NeuralEventBus;

  beforeEach(() => {
    tracer = new RecordingTracer();
    trace.setGlobalTracerProvider(new RecordingTracerProvider(tracer));
    bus = new NeuralEventBus();
  });

  afterEach(() => {
    trace.disable();
  });

  it('continues a remote trace when traceparent is present', async () => {
    const remoteTraceId = generateTraceId();
    const remoteSpanId = generateSpanId();
    const emitter = new OtelBridge('test', '1.0.0', true);
    const recorder = new TraceRecorder(bus, { emitter });

    await bus.publish({
      type: 'tool:called',
      source: 'mcp-client',
      payload: { tool: 'search' },
      metadata: {
        traceparent: serializeTraceparent(remoteTraceId, remoteSpanId),
      },
    });

    const spans = recorder.ledger.getRecent(10);
    expect(spans).toHaveLength(1);
    expect(spans[0]!.trace_id).toBe(remoteTraceId);
    expect(spans[0]!.parent_span_id).toBe(remoteSpanId);
    expect(tracer.spans).toHaveLength(1);
    expect(tracer.spans[0]!.attributes['uccp.trace.remote_parent']).toBe(true);
    recorder.disconnect();
  });

  it('falls back to session span as parent without traceparent', async () => {
    const emitter = new OtelBridge('test', '1.0.0', true);
    const recorder = new TraceRecorder(bus, { emitter });

    await bus.publish({ type: 'session:started', source: 'test', payload: { id: 's1' } });
    await bus.publish({ type: 'file:saved', source: 'test', payload: { path: '/a.ts' } });

    const spans = recorder.ledger.getRecent(10);
    const fileSpan = spans.find((t) => t.name === 'file.save')!;
    const sessionSpan = spans.find((t) => t.name === 'session.start')!;
    expect(fileSpan.parent_span_id).toBe(sessionSpan.span_id);
    recorder.disconnect();
  });

  it('ends mirrored OTel spans when traces end', async () => {
    const emitter = new OtelBridge('test', '1.0.0', true);
    const recorder = new TraceRecorder(bus, { emitter });

    await bus.publish({ type: 'test:failed', source: 'test', payload: { suite: 'unit' } });
    const active = recorder.getActiveTraces();
    expect(active.length).toBeGreaterThanOrEqual(1);
    expect(tracer.spans.some((s) => !s.ended)).toBe(true);

    recorder.endTrace(active[0]!.span_id, 'error', 'assertion failed');
    expect(tracer.spans.find((s) => s.name === 'test.run')?.ended).toBe(true);
    expect(tracer.spans.find((s) => s.name === 'test.run')?.status?.code).toBe(SpanStatusCode.ERROR);
    recorder.disconnect();
  });

  it('exposes the session traceparent for outbound propagation', async () => {
    const recorder = new TraceRecorder(bus);
    await bus.publish({ type: 'session:started', source: 'test', payload: { id: 's1' } });
    const header = recorder.getSessionTraceparent();
    expect(header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    const parsed = parseTraceparent(header);
    expect(parsed?.span_id).toBe(recorder.ledger.getRecent(1)[0]?.span_id);
    recorder.disconnect();
  });
});
