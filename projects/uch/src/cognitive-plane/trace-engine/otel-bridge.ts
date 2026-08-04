import {
  trace,
  SpanKind as OtelSpanKind,
  SpanStatusCode,
  TraceFlags,
  ProxyTracerProvider,
  type Span,
  type SpanContext,
  type Tracer,
  type Attributes,
} from '@opentelemetry/api';
import { ROOT_CONTEXT } from '@opentelemetry/api';
import type {
  CognitiveTrace,
  TraceEvent,
  SpanKind,
  TraceStatus,
  TraceAttribute,
} from './cognitive-trace.js';
import { serializeTraceparent, parseTraceparent } from './traceparent.js';
import { generateSpanId } from './cognitive-trace.js';

export type { ParsedTraceparent } from './traceparent.js';
export { parseTraceparent, serializeTraceparent } from './traceparent.js';
export {
  generateTraceId,
  generateSpanId,
  normalizeTraceId,
  normalizeSpanId,
} from './cognitive-trace.js';

const TRACER_NAME = 'uccp';
const TRACER_VERSION = '0.3.0';

const KIND_MAP: Record<SpanKind, OtelSpanKind> = {
  internal: OtelSpanKind.INTERNAL,
  server: OtelSpanKind.SERVER,
  client: OtelSpanKind.CLIENT,
  producer: OtelSpanKind.PRODUCER,
  consumer: OtelSpanKind.CONSUMER,
};

const STATUS_MAP: Record<TraceStatus, SpanStatusCode> = {
  unset: SpanStatusCode.UNSET,
  ok: SpanStatusCode.OK,
  error: SpanStatusCode.ERROR,
};

function attributesToOtel(attributes: TraceAttribute[]): Attributes {
  const out: Attributes = {};
  for (const attr of attributes) {
    out[attr.key] = attr.value;
  }
  return out;
}

/** True when a real tracer provider has been registered via `setTracerProvider`. */
export function hasRegisteredTracerProvider(): boolean {
  const provider = trace.getTracerProvider();
  if (provider instanceof ProxyTracerProvider) {
    return provider.getDelegateTracer(TRACER_NAME, TRACER_VERSION) !== undefined;
  }
  return true;
}

/**
 * Bridges the cognitive trace ledger to the OpenTelemetry API.
 *
 * The ledger is the source of truth; this bridge is a projection. When no
 * tracer provider is registered (the default), every call is a no-op and the
 * bridge costs nothing. When a provider is registered (Langfuse, Jaeger,
 * OTLP, …), each cognitive trace is mirrored as a real OTel span with correct
 * parent/child linkage, events, attributes, and status.
 */
export class OtelBridge {
  private tracer: Tracer;
  private spans: Map<string, Span> = new Map();
  readonly enabled: boolean;

  constructor(tracerName = TRACER_NAME, version = TRACER_VERSION, enabled = true) {
    this.enabled = enabled && hasRegisteredTracerProvider();
    this.tracer = trace.getTracer(tracerName, version);
  }

  /** True when a provider is registered and spans will actually be exported. */
  get active(): boolean {
    return this.enabled;
  }

  /**
   * Start an OTel span mirroring a cognitive trace. Remote parents are
   * honored when `parent_span_id` belongs to a different trace (W3C
   * traceparent propagation).
   */
  startSpan(cognitiveTrace: CognitiveTrace): void {
    if (!this.enabled) return;

    let parentContext = ROOT_CONTEXT;
    if (cognitiveTrace.parent_span_id) {
      const parent: SpanContext = {
        traceId: cognitiveTrace.trace_id,
        spanId: cognitiveTrace.parent_span_id,
        traceFlags: TraceFlags.SAMPLED,
        isRemote: true,
      };
      parentContext = trace.setSpanContext(ROOT_CONTEXT, parent);
    }

    const span = this.tracer.startSpan(
      cognitiveTrace.name,
      {
        kind: KIND_MAP[cognitiveTrace.kind] ?? OtelSpanKind.INTERNAL,
        attributes: attributesToOtel(cognitiveTrace.attributes),
        startTime: cognitiveTrace.timestamp,
      },
      parentContext,
    );
    this.spans.set(cognitiveTrace.span_id, span);
  }

  /** Mirror a trace event as an OTel span event. */
  addEvent(spanId: string, event: TraceEvent): void {
    if (!this.enabled) return;
    const span = this.spans.get(spanId);
    if (!span) return;
    span.addEvent(event.type, attributesToOtel(event.attributes), event.timestamp);
  }

  /** End the mirrored OTel span with the trace's status. */
  endSpan(spanId: string, status: TraceStatus, statusMessage?: string, endTime?: Date): void {
    if (!this.enabled) return;
    const span = this.spans.get(spanId);
    if (!span) return;
    span.setStatus({ code: STATUS_MAP[status] ?? SpanStatusCode.UNSET, message: statusMessage });
    span.end(endTime ?? new Date());
    this.spans.delete(spanId);
  }

  /** One-shot export of a complete trace (loaded or replayed). */
  exportTrace(cognitiveTrace: CognitiveTrace): void {
    if (!this.enabled) return;
    this.startSpan(cognitiveTrace);
    for (const event of cognitiveTrace.events) {
      this.addEvent(cognitiveTrace.span_id, event);
    }
    if (cognitiveTrace.status !== 'unset') {
      this.endSpan(
        cognitiveTrace.span_id,
        cognitiveTrace.status,
        cognitiveTrace.status_message,
        cognitiveTrace.end_timestamp ?? undefined,
      );
    }
  }

  /** W3C traceparent for this trace, e.g. `00-<trace>-<span>-01`. */
  traceparentOf(cognitiveTrace: Pick<CognitiveTrace, 'trace_id' | 'span_id'>): string {
    return serializeTraceparent(cognitiveTrace.trace_id, cognitiveTrace.span_id);
  }

  /** Generate a fresh child span id for continuation of a trace. */
  nextSpanId(): string {
    return generateSpanId();
  }
}

export { parseTraceparent as parseW3CTraceparent, serializeTraceparent as serializeW3CTraceparent };
