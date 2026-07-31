import type { CognitiveTrace, TraceEvent, SpanKind, TraceStatus } from '../../cognitive-plane/trace-engine/cognitive-trace.js';
import { TraceLedger } from '../../cognitive-plane/trace-engine/trace-ledger.js';

export interface OTLPExporterConfig {
  endpoint?: string;
  serviceName?: string;
  batchSize?: number;
  exportIntervalMs?: number;
}

interface OTLPSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  kind: number;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  status: { code: number; message?: string };
  attributes: Array<{ key: string; value: { stringValue?: string; intValue?: string; boolValue?: boolean } }>;
  events: Array<{ timeUnixNano: string; name: string; attributes: Array<{ key: string; value: { stringValue?: string } }> }>;
}

const SPAN_KIND_MAP: Record<SpanKind, number> = { internal: 1, server: 2, client: 3, producer: 4, consumer: 5 };
const STATUS_MAP: Record<TraceStatus, number> = { unset: 0, ok: 1, error: 2 };

function ns(date: Date): string {
  return String(date.getTime() * 1_000_000);
}

function toOtlpAttribute(key: string, value: string | number | boolean | string[] | number[]): { key: string; value: { stringValue?: string; intValue?: string; boolValue?: boolean } } {
  if (typeof value === 'string') return { key, value: { stringValue: value } };
  if (typeof value === 'number') return { key, value: { intValue: String(value) } };
  if (typeof value === 'boolean') return { key, value: { boolValue: value } };
  if (Array.isArray(value)) return { key, value: { stringValue: JSON.stringify(value) } };
  return { key, value: { stringValue: String(value) } };
}

function traceToOtlpSpan(trace: CognitiveTrace): OTLPSpan {
  return {
    traceId: trace.trace_id.replace(/-/g, ''),
    spanId: trace.span_id.replace(/-/g, ''),
    parentSpanId: trace.parent_span_id ? trace.parent_span_id.replace(/-/g, '') : null,
    name: trace.name,
    kind: SPAN_KIND_MAP[trace.kind] ?? 1,
    startTimeUnixNano: ns(trace.timestamp),
    endTimeUnixNano: ns(trace.end_timestamp ?? new Date()),
    status: { code: STATUS_MAP[trace.status] ?? 0, message: trace.status_message },
    attributes: trace.attributes.map((a) => toOtlpAttribute(a.key, a.value)),
    events: trace.events.map((e) => ({
      timeUnixNano: ns(e.timestamp),
      name: e.type,
      attributes: e.attributes.map((a) => ({ key: a.key, value: { stringValue: String(a.value) } })),
    })),
  };
}

export class OTLPExporter {
  private config: Required<OTLPExporterConfig>;
  private ledger: TraceLedger;
  private interval: ReturnType<typeof setInterval> | null = null;
  private pendingSpans: OTLPSpan[] = [];
  private lastExport: Date = new Date();

  constructor(ledger: TraceLedger, config?: OTLPExporterConfig) {
    this.ledger = ledger;
    this.config = {
      endpoint: config?.endpoint ?? 'http://localhost:4318/v1/traces',
      serviceName: config?.serviceName ?? 'uccp',
      batchSize: config?.batchSize ?? 64,
      exportIntervalMs: config?.exportIntervalMs ?? 5000,
    };
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.flush(), this.config.exportIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.flush();
  }

  enqueue(trace: CognitiveTrace): void {
    this.pendingSpans.push(traceToOtlpSpan(trace));
    if (this.pendingSpans.length >= this.config.batchSize) {
      this.flush();
    }
  }

  enqueueRecent(count = 10): void {
    const recent = this.ledger.getRecent(count);
    for (const trace of recent) {
      if (trace.end_timestamp && trace.end_timestamp > this.lastExport) {
        this.enqueue(trace);
      }
    }
    this.lastExport = new Date();
  }

  async flush(): Promise<{ exported: number; failed: number }> {
    if (this.pendingSpans.length === 0) return { exported: 0, failed: 0 };

    const batch = this.pendingSpans.splice(0, this.config.batchSize);

    try {
      const resourceSpans = {
        resource: { attributes: [{ key: 'service.name', value: { stringValue: this.config.serviceName } }] },
        scopeSpans: [{
          scope: { name: 'uccp.cognitive', version: '0.1.0' },
          spans: batch,
        }],
      };

      const body = JSON.stringify({ resourceSpans: [resourceSpans] });
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        return { exported: 0, failed: batch.length };
      }

      return { exported: batch.length, failed: 0 };
    } catch {
      this.pendingSpans.unshift(...batch);
      return { exported: 0, failed: batch.length };
    }
  }

  get pendingCount(): number {
    return this.pendingSpans.length;
  }

  getExportedCount(): number {
    return 0;
  }
}
