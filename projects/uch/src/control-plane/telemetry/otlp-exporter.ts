import type { CognitiveTrace, SpanKind, TraceStatus } from '../../cognitive-plane/trace-engine/cognitive-trace.js';

export interface OTLPExporterConfig {
  endpoint?: string;
  headers?: Record<string, string>;
  serviceName?: string;
  batchSize?: number;
  exportIntervalMs?: number;
}

export interface OTLPSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  attributes: { key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } }[];
  status?: { code: number; message?: string };
}

interface OTLPResourceSpan {
  resource: { attributes: { key: string; value: { stringValue: string } }[] };
  scopeSpans: { scope: { name: string }; spans: OTLPSpan[] }[];
}

const SPAN_KIND_MAP: Record<SpanKind, number> = { internal: 1, server: 2, client: 3, producer: 4, consumer: 5 };
const STATUS_MAP: Record<TraceStatus, number> = { unset: 0, ok: 1, error: 2 };

function ns(date: Date): string {
  return String(date.getTime() * 1_000_000);
}

function toOtlpAttribute(key: string, value: string | number | boolean | string[] | number[]): { key: string; value: { stringValue?: string; intValue?: string; doubleValue?: number; boolValue?: boolean } } {
  if (typeof value === 'string') return { key, value: { stringValue: value } };
  if (typeof value === 'number') return { key, value: { doubleValue: value } };
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  if (Array.isArray(value)) return { key, value: { stringValue: JSON.stringify(value) } };
  return { key, value: { stringValue: String(value) } };
}

/** Convert a CognitiveTrace into an OTLP-compliant span (hex IDs, nanosecond timestamps). */
export function traceToSpan(trace: CognitiveTrace): OTLPSpan {
  return {
    traceId: trace.trace_id.replace(/-/g, ''),
    spanId: trace.span_id.replace(/-/g, ''),
    parentSpanId: trace.parent_span_id ? trace.parent_span_id.replace(/-/g, '') : undefined,
    name: trace.name,
    kind: SPAN_KIND_MAP[trace.kind] ?? 1,
    startTimeUnixNano: ns(trace.timestamp),
    endTimeUnixNano: ns(trace.end_timestamp ?? new Date()),
    status: { code: STATUS_MAP[trace.status] ?? 0, message: trace.status_message },
    attributes: trace.attributes.map((a) => toOtlpAttribute(a.key, a.value)),
  };
}

export class OTLPExporter {
  private config: Required<OTLPExporterConfig>;
  private buffer: OTLPSpan[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: OTLPExporterConfig) {
    this.config = {
      endpoint: config?.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318/v1/traces',
      headers: config?.headers ?? {},
      serviceName: config?.serviceName ?? 'uch',
      batchSize: config?.batchSize ?? 64,
      exportIntervalMs: config?.exportIntervalMs ?? 5000,
    };
  }

  getEndpoint(): string {
    return this.config.endpoint;
  }

  /** Start the periodic export timer (idempotent). */
  start(): void {
    if (this.timer) return;
    if (!this.getEndpoint()) return;
    this.timer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush().catch(() => { /* silent fail */ });
      }
    }, this.config.exportIntervalMs);
  }

  /** Stop the periodic timer and flush pending spans. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush().catch(() => { /* silent */ });
  }

  isActive(): boolean {
    return !!this.timer && this.buffer.length > 0;
  }

  record(span: OTLPSpan): void {
    this.buffer.push(span);
    if (this.buffer.length >= this.config.batchSize) {
      this.flush().catch(() => { /* silent fail */ });
    }
  }

  async flush(): Promise<boolean> {
    if (this.buffer.length === 0) return true;
    const batch = this.buffer.splice(0, this.config.batchSize);

    try {
      const resourceSpans: OTLPResourceSpan = {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: this.config.serviceName } },
            { key: 'telemetry.sdk.name', value: { stringValue: 'uch' } },
            { key: 'telemetry.sdk.language', value: { stringValue: 'typescript' } },
          ],
        },
        scopeSpans: [{
          scope: { name: 'uch.cognitive' },
          spans: batch,
        }],
      };

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify({ resourceSpans: [resourceSpans] }),
      });

      if (!response.ok) {
        this.buffer.push(...batch);
        return false;
      }
      return true;
    } catch {
      this.buffer.push(...batch);
      return false;
    }
  }

  createSpan(name: string, traceId: string, attributes: Record<string, string | number | boolean> = {}): OTLPSpan {
    const now = new Date();
    return {
      traceId,
      spanId: Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join(''),
      name,
      kind: 1,
      startTimeUnixNano: ns(now),
      endTimeUnixNano: ns(now),
      attributes: Object.entries(attributes).map(([key, value]) => toOtlpAttribute(key, value)),
    };
  }

  shutdown(): void {
    this.stop();
  }
}
