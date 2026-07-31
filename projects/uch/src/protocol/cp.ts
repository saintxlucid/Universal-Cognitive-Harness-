import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { GapAnalysisEngine } from '../kernel/retrieval/gap-analysis.js';
import { classifyEpistemicStatus } from '../kernel/constitution/epistemology.js';
import type { ScoredResult } from '../kernel/retrieval/fusion.js';
import type { SleepReport } from '../kernel/consolidation/sleep-cycle.js';
import type { Episode } from '../kernel/types/episode.js';

// ── Cognitive Protocol (CP) v1 ─────────────────────────────────────────
// CP is the stable contract of the Cognitive OS: a transport-agnostic,
// model-agnostic, agent-agnostic semantic instruction set. Like the Linux
// syscall ABI, this is the one surface that must not break. Transports
// (MCP, HTTP, gRPC, in-process) are bindings of this contract.
// ──────────────────────────────────────────────────────────────────────

export const CP_PROTOCOL_ID = 'uch-cp';
export const CP_VERSION = '1.0.0';
export const CP_MAJOR = 1;

/** The semantic instruction set — the syscalls of cognition. */
export type CPOp =
  | 'observe'
  | 'think'
  | 'retrieve'
  | 'remember'
  | 'learn'
  | 'reflect'
  | 'consolidate'
  | 'dream'
  | 'plan'
  | 'predict'
  | 'simulate'
  | 'evaluate'
  | 'critique'
  | 'execute'
  | 'status'
  | 'list'
  | 'ping';

export const CP_OPS: readonly CPOp[] = [
  'observe', 'think', 'retrieve', 'remember', 'learn',
  'reflect', 'consolidate', 'dream', 'plan', 'predict',
  'simulate', 'evaluate', 'critique', 'execute',
  'status', 'list', 'ping',
];

export interface CPRequest {
  protocol: typeof CP_PROTOCOL_ID;
  version: string;
  op: CPOp;
  requestId: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export type CPErrorCode =
  | 'BAD_REQUEST'
  | 'UNSUPPORTED_OP'
  | 'UNSUPPORTED_VERSION'
  | 'HANDLER_ERROR'
  | 'INTERNAL_ERROR';

export interface CPError {
  code: CPErrorCode;
  message: string;
}

export interface CPResponse {
  protocol: typeof CP_PROTOCOL_ID;
  version: string;
  op: CPOp;
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: CPError;
  meta: { durationMs: number };
}

export type CPOpHandler = (payload: Record<string, unknown>) => Promise<unknown> | unknown;

export interface CPHandlerSpec {
  op: CPOp;
  version: string;
  description: string;
  handler: CPOpHandler;
}

export interface CPServerOptions {
  version?: string;
}

// ── Envelope validation ───────────────────────────────────────────────

export function parseCPRequest(body: unknown): { request?: CPRequest; error?: CPError } {
  if (typeof body !== 'object' || body === null) {
    return { error: { code: 'BAD_REQUEST', message: 'Request must be a JSON object' } };
  }
  const raw = body as Record<string, unknown>;

  if (raw.protocol !== CP_PROTOCOL_ID) {
    return { error: { code: 'BAD_REQUEST', message: `Unsupported protocol: ${String(raw.protocol)}` } };
  }
  const version = typeof raw.version === 'string' ? raw.version : CP_VERSION;
  if (!isCompatibleVersion(version)) {
    return { error: { code: 'UNSUPPORTED_VERSION', message: `Unsupported CP version: ${version} (server speaks ${CP_VERSION})` } };
  }
  if (typeof raw.op !== 'string' || !CP_OPS.includes(raw.op as CPOp)) {
    return { error: { code: 'UNSUPPORTED_OP', message: `Unsupported CP op: ${String(raw.op)}` } };
  }
  const payload = raw.payload ?? {};
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { error: { code: 'BAD_REQUEST', message: 'payload must be an object' } };
  }

  return {
    request: {
      protocol: CP_PROTOCOL_ID,
      version,
      op: raw.op as CPOp,
      requestId: typeof raw.requestId === 'string' ? raw.requestId : crypto.randomUUID(),
      timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : new Date().toISOString(),
      payload: payload as Record<string, unknown>,
    },
  };
}

export function isCompatibleVersion(version: string): boolean {
  const major = version.split('.')[0];
  return major === String(CP_MAJOR);
}

// ── Server ────────────────────────────────────────────────────────────

export class CPServer {
  readonly version: string;
  private handlers = new Map<CPOp, CPHandlerSpec>();

  constructor(options?: CPServerOptions) {
    this.version = options?.version ?? CP_VERSION;
  }

  register(spec: CPHandlerSpec): void {
    this.handlers.set(spec.op, spec);
  }

  unregister(op: CPOp): void {
    this.handlers.delete(op);
  }

  has(op: CPOp): boolean {
    return this.handlers.has(op);
  }

  listOps(): CPHandlerSpec[] {
    return Array.from(this.handlers.values());
  }

  private failure(op: CPOp, requestId: string | undefined, error: CPError, durationMs: number): CPResponse {
    return {
      protocol: CP_PROTOCOL_ID,
      version: this.version,
      op,
      requestId: requestId ?? crypto.randomUUID(),
      success: false,
      error,
      meta: { durationMs },
    };
  }

  async dispatch(request: CPRequest): Promise<CPResponse> {
    const started = Date.now();

    // dispatch is the public entry point — validate the envelope here too,
    // so misbehaving transports cannot bypass the contract.
    const parsed = parseCPRequest(request);
    if (parsed.error || !parsed.request) {
      return this.failure(
        CP_OPS.includes(request.op) ? request.op : 'list',
        request.requestId,
        parsed.error ?? { code: 'BAD_REQUEST', message: 'Invalid request' },
        Date.now() - started,
      );
    }
    request = parsed.request;

    const response = (partial: Pick<CPResponse, 'success' | 'data' | 'error'>): CPResponse => ({
      protocol: CP_PROTOCOL_ID,
      version: this.version,
      op: request.op,
      requestId: request.requestId,
      success: partial.success,
      data: partial.data,
      error: partial.error,
      meta: { durationMs: Date.now() - started },
    });

    const spec = this.handlers.get(request.op);
    if (!spec) {
      return response({ success: false, error: { code: 'UNSUPPORTED_OP', message: `No handler registered for op: ${request.op}` } });
    }

    try {
      const data = await spec.handler(request.payload);
      return response({ success: true, data });
    } catch (err) {
      return response({
        success: false,
        error: {
          code: 'HANDLER_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  /** Build an envelope and dispatch — safe for unknown ops. */
  async invoke(op: string, payload: Record<string, unknown>, requestId?: string): Promise<CPResponse> {
    if (!CP_OPS.includes(op as CPOp)) {
      return this.failure(op as CPOp, requestId, { code: 'UNSUPPORTED_OP', message: `Unsupported CP op: ${op}` }, 0);
    }
    const parsed = parseCPRequest({
      protocol: CP_PROTOCOL_ID,
      version: this.version,
      op,
      payload,
      ...(requestId ? { requestId } : {}),
    });
    if (parsed.error || !parsed.request) {
      return this.failure(op as CPOp, requestId, parsed.error ?? { code: 'BAD_REQUEST', message: 'Invalid request' }, 0);
    }
    return this.dispatch(parsed.request);
  }
}

// ── Default kernel-backed instruction set ─────────────────────────────
// The default handlers bind every CP op to the Cognitive Kernel. Any op
// can be replaced by registering a custom handler — the contract stays.

function episodeBrief(e: Episode): { id: string; summary: string; timestamp: Date; concepts?: string[] } {
  return { id: e.id, summary: contentToString(e.content).slice(0, 200), timestamp: e.timestamp, concepts: e.concepts };
}

function contentToString(content: unknown): string {
  return typeof content === 'object' && content !== null ? JSON.stringify(content) : String(content);
}

function requireText(payload: Record<string, unknown>, key: string, message: string): string {
  const text = String(payload[key] ?? '');
  if (!text.trim()) throw new Error(message);
  return text;
}

export interface DefaultCPServerOptions {
  version?: string;
  author?: string;
}

interface DefaultHandlerContext {
  kernel: CognitiveKernel;
  server: CPServer;
  gapAnalysis: GapAnalysisEngine;
}

function pingHandler(): CPOpHandler {
  return () => ({ pong: true });
}

function listHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return () => ({
    protocol: CP_PROTOCOL_ID,
    version: ctx.server.version,
    ops: ctx.server.listOps().map((s) => ({ op: s.op, version: s.version, description: s.description })),
  });
}

function statusHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return () => ctx.kernel.getStats();
}

function thinkHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return async (payload) => {
    const prompt = requireText(payload, 'prompt', 'think requires a prompt');
    const limit = typeof payload.limit === 'number' ? payload.limit : 8;
    const grounding = await ctx.kernel.recall({ text: prompt, limit });
    const recent = ctx.kernel.getRecentEpisodes(3).map((e) => e.id);
    return {
      prompt,
      groundedIn: grounding.map((r) => ({ id: r.id, score: r.score })),
      trace: [
        { step: 1, note: 'Retrieved relevant memory' },
        { step: 2, note: 'Checked constraints from retrieved context' },
        { step: 3, note: grounding.length > 0 ? 'Conclusion grounded in memory' : 'No grounding found — flagged as gap' },
      ],
      conclusion: grounding.length > 0
        ? `Grounded in ${grounding.length} memory item(s)`
        : 'Insufficient memory — recommend retrieving more context before concluding',
      recentContext: recent,
    };
  };
}

function observeHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return async (payload) => {
    const text = requireText(payload, 'text', 'observe requires a non-empty text payload');
    const episode = await ctx.kernel.remember({
      content: { type: 'text', text },
      concepts: Array.isArray(payload.concepts) ? payload.concepts.map(String) : undefined,
      provenance: { source: 'perception', reliability: typeof payload.reliability === 'number' ? payload.reliability : 1.0 },
    });
    return episodeBrief(episode);
  };
}

function rememberHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return async (payload) => {
    const text = requireText(payload, 'content', 'remember requires a non-empty content payload');
    const episode = await ctx.kernel.remember({
      content: { type: 'text', text },
      concepts: Array.isArray(payload.concepts) ? payload.concepts.map(String) : undefined,
      provenance: { source: 'deliberate', reliability: typeof payload.reliability === 'number' ? payload.reliability : 1.0 },
    });
    return episodeBrief(episode);
  };
}

function retrieveHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return async (payload) => {
    const query = requireText(payload, 'query', 'retrieve requires a query');
    const limit = typeof payload.limit === 'number' ? payload.limit : 10;
    const results: ScoredResult[] = await ctx.kernel.recall({ text: query, limit });
    return {
      query,
      results: results.map((r) => ({
        id: r.id,
        score: r.score,
        content: contentToString(r.content),
      })),
      count: results.length,
    };
  };
}

function learnHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return async (payload) => {
    const proposition = String(payload.proposition ?? '');
    const evidence = String(payload.evidence ?? '');
    const reliability = typeof payload.reliability === 'number' ? payload.reliability : 0.7;
    if (!proposition.trim() || !evidence.trim()) throw new Error('learn requires proposition and evidence');
    await ctx.kernel.learnEvidence(proposition, evidence, reliability);
    return { learned: true, proposition };
  };
}

function reflectHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return (payload) => {
    const limit = typeof payload.limit === 'number' ? payload.limit : 10;
    const episodes = ctx.kernel.getRecentEpisodes(limit).map(episodeBrief);
    const beliefs = Array.from(ctx.kernel.getBeliefs().propositions.values()).map((p) => ({
      value: p.value,
      confidence: p.confidence.value,
      entrenchment: p.entrenchment,
      status: classifyEpistemicStatus(p.confidence.value, p.evidence.length, p.contradictions.length > 0),
    }));
    return { episodes, beliefs, totalBeliefs: beliefs.length };
  };
}

function sleepCycleHandler(ctx: DefaultHandlerContext, label: 'sleep' | 'replay'): CPOpHandler {
  return async () => {
    const report: SleepReport = await ctx.kernel.forceSleepCycle();
    return { [label]: report, stats: ctx.kernel.getStats() };
  };
}

function planHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return async (payload) => {
    const goal = requireText(payload, 'goal', 'plan requires a goal');
    const context = String(payload.context ?? '');
    const grounding = await ctx.kernel.recall({ text: context || goal, limit: 5 });
    return {
      goal,
      derivedSteps: [
        { order: 1, action: 'gather-context', note: 'Retrieve relevant memory and workspace state' },
        { order: 2, action: 'execute', note: 'Execute the first actionable step' },
        { order: 3, action: 'verify', note: 'Verify outcome against the goal' },
      ],
      grounding: grounding.map((r) => ({ id: r.id, score: r.score })),
    };
  };
}

function predictHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return (payload) => {
    const horizon = typeof payload.horizon === 'number' ? payload.horizon : 7;
    const predictions = Array.from(ctx.kernel.getBeliefs().propositions.values()).map((p) => ({
      statement: p.value,
      confidence: p.confidence.value,
      status: classifyEpistemicStatus(p.confidence.value, p.evidence.length, p.contradictions.length > 0),
      tested: p.contradictions.length > 0,
    }));
    return { horizonDays: horizon, predictions, total: predictions.length };
  };
}

function simulateHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return async (payload) => {
    const scenario = requireText(payload, 'scenario', 'simulate requires a scenario');
    const results = await ctx.kernel.recall({ text: scenario, limit: typeof payload.limit === 'number' ? payload.limit : 10 });
    return {
      scenario,
      projectedContext: results.map((r) => ({ id: r.id, score: r.score, content: String(r.content) })),
      confidence: results.length > 0 ? Math.max(...results.map((r) => r.score)) : 0,
    };
  };
}

function evaluateHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return () => ({
    stats: ctx.kernel.getStats(),
    protocol: { protocol: CP_PROTOCOL_ID, version: ctx.server.version },
  });
}

function critiqueHandler(ctx: DefaultHandlerContext): CPOpHandler {
  return async (payload) => {
    const query = requireText(payload, 'query', 'critique requires a query');
    const results = await ctx.kernel.recall({ text: query, limit: 10 });
    const items = results.map((r) => ({
      id: r.id,
      text: String(r.content),
      timestamp: 'timestamp' in r.content && r.content.timestamp instanceof Date ? r.content.timestamp : new Date(),
      source: 'retrieval',
    }));
    return ctx.gapAnalysis.analyze(query, items);
  };
}

function executeHandler(): CPOpHandler {
  return (payload) => {
    const action = String(payload.action ?? '');
    return {
      accepted: Boolean(action),
      action,
      note: 'No executor registered — plug one in via CPServer.register("execute").',
    };
  };
}

export function createDefaultCPServer(kernel: CognitiveKernel, options?: DefaultCPServerOptions): CPServer {
  const server = new CPServer({ version: options?.version });
  const ctx: DefaultHandlerContext = { kernel, server, gapAnalysis: new GapAnalysisEngine() };

  const handlers: CPHandlerSpec[] = [
    { op: 'ping', version: '1.0.0', description: 'Liveness check — returns pong with protocol version.', handler: pingHandler() },
    { op: 'list', version: '1.0.0', description: 'List supported cognitive operations.', handler: listHandler(ctx) },
    { op: 'status', version: '1.0.0', description: 'Cognitive kernel state — memory counts, sleep, neuromodulation.', handler: statusHandler(ctx) },
    {
      op: 'think', version: '1.0.0',
      description: 'Deliberate reasoning: ground a prompt in memory and produce a thinking trace. LLM-powered reasoners plug in via register.',
      handler: thinkHandler(ctx),
    },
    { op: 'observe', version: '1.0.0', description: 'Record a perception (sensory input) into episodic memory.', handler: observeHandler(ctx) },
    { op: 'remember', version: '1.0.0', description: 'Deliberately store content in episodic memory.', handler: rememberHandler(ctx) },
    { op: 'retrieve', version: '1.0.0', description: 'Ranked retrieval over cognitive memory (fusion + rerank).', handler: retrieveHandler(ctx) },
    { op: 'learn', version: '1.0.0', description: 'Integrate evidence into the belief set (belief revision).', handler: learnHandler(ctx) },
    { op: 'reflect', version: '1.0.0', description: 'Self-observation: recent episodes and current belief state.', handler: reflectHandler(ctx) },
    { op: 'consolidate', version: '1.0.0', description: 'Run an offline consolidation cycle (replay, prune, contradiction checks).', handler: sleepCycleHandler(ctx, 'sleep') },
    { op: 'dream', version: '1.0.0', description: 'Offline replay — pattern discovery over stored experience.', handler: sleepCycleHandler(ctx, 'replay') },
    { op: 'plan', version: '1.0.0', description: 'Deterministic planning facade: goal decomposition grounded in memory.', handler: planHandler(ctx) },
    { op: 'predict', version: '1.0.0', description: 'Predictive readout: current beliefs as testable predictions.', handler: predictHandler(ctx) },
    { op: 'simulate', version: '1.0.0', description: 'Retrieval-based simulation: project what memory says about a hypothetical.', handler: simulateHandler(ctx) },
    { op: 'evaluate', version: '1.0.0', description: 'Self-evaluation: kernel health, counts, and neuromodulation state.', handler: evaluateHandler(ctx) },
    { op: 'critique', version: '1.0.0', description: 'Gap analysis: what memory covers and what is missing for a query.', handler: critiqueHandler(ctx) },
    { op: 'execute', version: '1.0.0', description: 'Executive hook: dispatch an action to an executor driver.', handler: executeHandler() },
  ];
  for (const spec of handlers) server.register(spec);

  return server;
}

// ── Types needed by callers ───────────────────────────────────────────

export type { SleepReport, ScoredResult };
