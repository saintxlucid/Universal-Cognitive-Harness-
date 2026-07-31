export interface ParsedTraceparent {
  version: string;
  trace_id: string;
  span_id: string;
  flags: string;
}

const HEX32 = /^[0-9a-f]{32}$/;
const HEX16 = /^[0-9a-f]{16}$/;
const HEX2 = /^[0-9a-f]{2}$/;
const INVALID_TRACE_ID = '00000000000000000000000000000000';
const INVALID_SPAN_ID = '0000000000000000';

/**
 * Parse a W3C `traceparent` header. Returns null for malformed headers,
 * non-v00 versions, or the W3C invalid (all-zero) ids.
 */
export function parseTraceparent(header: string | null | undefined): ParsedTraceparent | null {
  if (!header) return null;
  const parts = header.trim().split('-');
  if (parts.length !== 4) return null;

  const [version, trace_id, span_id, flags] = parts;
  if (!version || version !== '00') return null;
  if (!trace_id || !HEX32.test(trace_id) || trace_id === INVALID_TRACE_ID) return null;
  if (!span_id || !HEX16.test(span_id) || span_id === INVALID_SPAN_ID) return null;
  if (!flags || !HEX2.test(flags)) return null;

  return { version, trace_id, span_id, flags };
}

/** Serialize trace + span ids to a W3C `traceparent` header. */
export function serializeTraceparent(traceId: string, spanId: string, sampled = true): string {
  return `00-${traceId}-${spanId}-${sampled ? '01' : '00'}`;
}
