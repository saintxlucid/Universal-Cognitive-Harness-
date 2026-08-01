import type { NeuralEvent, EventType } from '../../event-bus/neural-event-bus.js';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { TraceLedger } from './trace-ledger.js';
import {
  createTrace,
  endTrace,
  addTraceEvent,
  type CognitiveTrace,
  type TraceEventType,
  type SpanKind,
  type TraceAttribute,
} from './cognitive-trace.js';
import { parseTraceparent, serializeTraceparent } from './traceparent.js';
import type { OtelBridge } from './otel-bridge.js';

export interface TraceRecorderOptions {
  /** Optional OTel bridge — mirrors ledger traces into OpenTelemetry when a provider is registered. */
  emitter?: OtelBridge;
  /** Optional persistence sink — fired with the stored copy of every appended trace. */
  onTrace?: (trace: CognitiveTrace) => void;
}

const EVENT_TO_SPAN: Record<string, { name: string; kind: SpanKind }> = {
  'file:saved': { name: 'file.save', kind: 'client' },
  'file:opened': { name: 'file.open', kind: 'client' },
  'file:created': { name: 'file.create', kind: 'client' },
  'file:deleted': { name: 'file.delete', kind: 'client' },
  'git:commit': { name: 'git.commit', kind: 'client' },
  'git:branch_changed': { name: 'git.branch', kind: 'client' },
  'git:push': { name: 'git.push', kind: 'client' },
  'git:pull': { name: 'git.pull', kind: 'client' },
  'terminal:executed': { name: 'terminal.exec', kind: 'client' },
  'test:passed': { name: 'test.run', kind: 'internal' },
  'test:failed': { name: 'test.run', kind: 'internal' },
  'test:started': { name: 'test.run', kind: 'internal' },
  'build:started': { name: 'build.run', kind: 'internal' },
  'build:finished': { name: 'build.run', kind: 'internal' },
  'build:failed': { name: 'build.run', kind: 'internal' },
  'prompt:sent': { name: 'llm.prompt', kind: 'client' },
  'prompt:responded': { name: 'llm.response', kind: 'server' },
  'tool:called': { name: 'tool.call', kind: 'client' },
  'tool:result': { name: 'tool.result', kind: 'server' },
  'error:occurred': { name: 'error', kind: 'internal' },
  'agent:attached': { name: 'agent.attach', kind: 'internal' },
  'agent:detached': { name: 'agent.detach', kind: 'internal' },
  'session:started': { name: 'session.start', kind: 'internal' },
  'session:ended': { name: 'session.end', kind: 'internal' },
  'framework:selected': { name: 'framework.select', kind: 'internal' },
  'framework:completed': { name: 'framework.complete', kind: 'internal' },
  'framework:error': { name: 'framework.error', kind: 'internal' },
};

function eventToTraceEventType(eventType: string): TraceEventType {
  const map: Record<string, TraceEventType> = {
    'file:saved': 'file_write',
    'file:opened': 'file_read',
    'file:created': 'file_write',
    'file:deleted': 'file_delete',
    'git:commit': 'git_commit',
    'git:branch_changed': 'git_branch',
    'git:push': 'git_push',
    'git:pull': 'git_pull',
    'terminal:executed': 'terminal_command',
    'prompt:sent': 'prompt_sent',
    'prompt:responded': 'response_received',
    'tool:called': 'tool_call',
    'tool:result': 'tool_result',
    'test:passed': 'test_pass',
    'test:failed': 'test_fail',
    'test:started': 'test_start',
    'build:started': 'build_start',
    'build:finished': 'build_finish',
    'build:failed': 'build_failure',
    'agent:attached': 'agent_attach',
    'agent:detached': 'agent_detach',
    'session:started': 'session_start',
    'session:ended': 'session_end',
    'framework:selected': 'framework_select',
    'framework:completed': 'framework_complete',
    'framework:error': 'framework_error',
  };
  return map[eventType] ?? 'diagnostic';
}

export class TraceRecorder {
  readonly ledger: TraceLedger;
  private eventBus: NeuralEventBus;
  private emitter?: OtelBridge;
  private unsubscribers: string[] = [];
  private activeSpans: Map<string, CognitiveTrace> = new Map();
  private sessionSpanId: string | null = null;

  constructor(eventBus: NeuralEventBus, options: TraceRecorderOptions = {}) {
    this.ledger = new TraceLedger(options.onTrace ?? null);
    this.eventBus = eventBus;
    this.emitter = options.emitter;
    this.wireEventBus();
  }

  private wireEventBus(): void {
    const eventTypes = Object.keys(EVENT_TO_SPAN) as EventType[];
    const sub = this.eventBus.subscribe(eventTypes, (event: NeuralEvent) => {
      const spanDef = EVENT_TO_SPAN[event.type];
      if (!spanDef) return;

      const attributes: TraceAttribute[] = [
        { key: 'event.type', value: event.type },
        { key: 'event.source', value: event.source },
      ];

      for (const [k, v] of Object.entries(event.payload)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          attributes.push({ key: `payload.${k}`, value: v });
        }
      }

      if (event.metadata?.agent_id) {
        attributes.push({ key: 'agent.id', value: event.metadata.agent_id });
      }
      if (event.metadata?.session_id) {
        attributes.push({ key: 'session.id', value: event.metadata.session_id });
      }
      if (event.metadata?.workspace_id) {
        attributes.push({ key: 'workspace.id', value: event.metadata.workspace_id });
      }

      // W3C traceparent propagation: a remote parent (from an MCP/ACP/IDE
      // driver) continues the same trace instead of starting a new one.
      const remoteParent = parseTraceparent(event.metadata?.traceparent);
      let parentSpanId = this.sessionSpanId;
      let traceId: string | undefined;
      if (remoteParent) {
        traceId = remoteParent.trace_id;
        parentSpanId = remoteParent.span_id;
        attributes.push({ key: 'uccp.trace.remote_parent', value: true });
      }

      const trace = createTrace({
        name: spanDef.name,
        kind: spanDef.kind,
        parent_span_id: parentSpanId ?? undefined,
        trace_id: traceId,
        attributes,
      });

      const traceEventType = eventToTraceEventType(event.type);
      const updated = addTraceEvent(trace, {
        type: traceEventType,
        attributes,
      });

      this.ledger.append(updated);
      this.activeSpans.set(trace.span_id, updated);
      this.emitter?.startSpan(updated);
      const firstEvent = updated.events[0];
      if (firstEvent) {
        this.emitter?.addEvent(trace.span_id, firstEvent);
      }

      if (event.type === 'session:started') {
        this.sessionSpanId = trace.span_id;
      }
    });

    this.unsubscribers.push(sub);
  }

  recordTrace(trace: CognitiveTrace): string {
    this.ledger.append(trace);
    this.emitter?.exportTrace(trace);
    return trace.trace_id;
  }

  endTrace(spanId: string, status: 'ok' | 'error' = 'ok', statusMessage?: string): void {
    const trace = this.activeSpans.get(spanId);
    if (!trace) return;

    const completed = endTrace(trace, status, statusMessage);
    this.ledger.updateSpan(spanId, completed);
    this.emitter?.endSpan(spanId, status, statusMessage, completed.end_timestamp ?? undefined);
    this.activeSpans.delete(spanId);
  }

  /** W3C traceparent of the current session root, for outbound propagation. */
  getSessionTraceparent(): string | null {
    if (!this.sessionSpanId) return null;
    const span = this.ledger.getSpanByTraceId(this.sessionSpanId);
    if (!span) return null;
    return serializeTraceparent(span.trace_id, span.span_id);
  }

  getActiveTraces(): CognitiveTrace[] {
    return [...this.activeSpans.values()];
  }

  closeSession(): void {
    if (this.sessionSpanId) {
      this.endTrace(this.sessionSpanId, 'ok');
      this.sessionSpanId = null;
    }
  }

  disconnect(): void {
    for (const sub of this.unsubscribers) {
      this.eventBus.unsubscribe(sub);
    }
    this.unsubscribers = [];
    this.activeSpans.clear();
  }
}
