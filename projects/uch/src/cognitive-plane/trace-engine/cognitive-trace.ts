export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

export type TraceStatus = 'unset' | 'ok' | 'error';

export type TraceEventType =
  | 'prompt_sent' | 'response_received'
  | 'tool_call' | 'tool_result'
  | 'file_read' | 'file_write' | 'file_delete'
  | 'terminal_command' | 'terminal_output'
  | 'git_commit' | 'git_branch' | 'git_push' | 'git_pull'
  | 'build_start' | 'build_finish' | 'build_failure'
  | 'test_start' | 'test_pass' | 'test_fail'
  | 'mcp_request' | 'mcp_response'
  | 'agent_attach' | 'agent_detach'
  | 'session_start' | 'session_end'
  | 'diagnostic' | 'human_feedback'
  | 'decision' | 'plan_step' | 'reflection';

export interface TraceAttribute {
  key: string;
  value: string | number | boolean | string[] | number[];
}

export interface TraceEvent {
  id: string;
  timestamp: Date;
  type: TraceEventType;
  attributes: TraceAttribute[];
  span_id: string;
}

export interface CognitiveTrace {
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  name: string;
  kind: SpanKind;
  timestamp: Date;
  end_timestamp: Date | null;
  status: TraceStatus;
  status_message?: string;
  attributes: TraceAttribute[];
  events: TraceEvent[];
  links: Array<{ trace_id: string; span_id: string; attributes?: TraceAttribute[] }>;
}

function randomHexBytes(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += b.toString(16).padStart(2, '0');
  return out;
}

/** 128-bit trace id, 32 lowercase hex chars — W3C `traceparent` field 1. */
export function generateTraceId(): string {
  return randomHexBytes(16);
}

/** 64-bit span id, 16 lowercase hex chars — W3C `traceparent` field 2. */
export function generateSpanId(): string {
  return randomHexBytes(8);
}

/** Strip non-hex characters and normalize to exactly 32 hex chars (trace id). */
export function normalizeTraceId(traceId: string): string {
  const hex = traceId.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  return (hex + '0'.repeat(32)).slice(0, 32);
}

/** Strip non-hex characters and normalize to exactly 16 hex chars (span id). */
export function normalizeSpanId(spanId: string): string {
  const hex = spanId.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  return (hex + '0'.repeat(16)).slice(0, 16);
}

export function createTrace(params: {
  name: string;
  kind?: SpanKind;
  parent_span_id?: string;
  trace_id?: string;
  attributes?: TraceAttribute[];
}): CognitiveTrace {
  return {
    trace_id: normalizeTraceId(params.trace_id ?? generateTraceId()),
    span_id: generateSpanId(),
    parent_span_id: params.parent_span_id ? normalizeSpanId(params.parent_span_id) : null,
    name: params.name,
    kind: params.kind ?? 'internal',
    timestamp: new Date(),
    end_timestamp: null,
    status: 'unset',
    attributes: params.attributes ?? [],
    events: [],
    links: [],
  };
}

export function endTrace(trace: CognitiveTrace, status: TraceStatus = 'ok', statusMessage?: string): CognitiveTrace {
  return {
    ...trace,
    end_timestamp: new Date(),
    status,
    status_message: statusMessage,
  };
}

export function addTraceEvent(trace: CognitiveTrace, event: Omit<TraceEvent, 'id' | 'timestamp' | 'span_id'>): CognitiveTrace {
  return {
    ...trace,
    events: [
      ...trace.events,
      {
        ...event,
        id: crypto.randomUUID(),
        timestamp: new Date(),
        span_id: trace.span_id,
      },
    ],
  };
}
