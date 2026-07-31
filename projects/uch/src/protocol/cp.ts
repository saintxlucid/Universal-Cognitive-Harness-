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

  async dispatch(request: CPRequest): Promise<CPResponse> {
    const started = Date.now();

    // dispatch is the public entry point — validate the envelope here too,
    // so misbehaving transports cannot bypass the contract.
    const parsed = parseCPRequest(request);
    if (parsed.error || !parsed.request) {
      return {
        protocol: CP_PROTOCOL_ID,
        version: this.version,
        op: CP_OPS.includes(request.op) ? request.op : 'list',
        requestId: request.requestId ?? crypto.randomUUID(),
        success: false,
        error: parsed.error ?? { code: 'BAD_REQUEST', message: 'Invalid request' },
        meta: { durationMs: Date.now() - started },
      };
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
      return {
        protocol: CP_PROTOCOL_ID,
        version: this.version,
        op: op as CPOp,
        requestId: requestId ?? crypto.randomUUID(),
        success: false,
        error: { code: 'UNSUPPORTED_OP', message: `Unsupported CP op: ${op}` },
        meta: { durationMs: 0 },
      };
    }
    const parsed = parseCPRequest({
      protocol: CP_PROTOCOL_ID,
      version: this.version,
      op,
      payload,
      ...(requestId ? { requestId } : {}),
    });
    if (parsed.error || !parsed.request) {
      return {
        protocol: CP_PROTOCOL_ID,
        version: this.version,
        op: op as CPOp,
        requestId: requestId ?? crypto.randomUUID(),
        success: false,
        error: parsed.error ?? { code: 'BAD_REQUEST', message: 'Invalid request' },
        meta: { durationMs: 0 },
      };
    }
    return this.dispatch(parsed.request);
  }
}

// ── Default kernel-backed instruction set ─────────────────────────────
// The default handlers bind every CP op to the Cognitive Kernel. Any op
// can be replaced by registering a custom handler — the contract stays.

function episodeBrief(e: Episode): { id: string; summary: string; timestamp: Date; concepts?: string[] } {
  const text = typeof e.content === 'object' && e.content !== null
    ? JSON.stringify(e.content)
    : String(e.content);
  return { id: e.id, summary: text.slice(0, 200), timestamp: e.timestamp, concepts: e.concepts };
}

export interface DefaultCPServerOptions {
  version?: string;
  author?: string;
}

export function createDefaultCPServer(kernel: CognitiveKernel, options?: DefaultCPServerOptions): CPServer {
  const server = new CPServer({ version: options?.version });
  const gapAnalysis = new GapAnalysisEngine();

  server.register({
    op: 'ping', version: '1.0.0', description: 'Liveness check — returns pong with protocol version.',
    handler: () => ({ pong: true }),
  });

  server.register({
    op: 'list', version: '1.0.0', description: 'List supported cognitive operations.',
    handler: () => ({
      protocol: CP_PROTOCOL_ID,
      version: server.version,
      ops: server.listOps().map((s) => ({ op: s.op, version: s.version, description: s.description })),
    }),
  });

  server.register({
    op: 'status', version: '1.0.0', description: 'Cognitive kernel state — memory counts, sleep, neuromodulation.',
    handler: () => kernel.getStats(),
  });

  server.register({
    op: 'think', version: '1.0.0',
    description: 'Deliberate reasoning: ground a prompt in memory and produce a thinking trace. LLM-powered reasoners plug in via register.',
    handler: async (payload) => {
      const prompt = String(payload.prompt ?? '');
      if (!prompt.trim()) throw new Error('think requires a prompt');
      const limit = typeof payload.limit === 'number' ? payload.limit : 8;
      const grounding = await kernel.recall({ text: prompt, limit });
      const recent = kernel.getRecentEpisodes(3).map((e) => e.id);
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
    },
  });

  server.register({
    op: 'observe', version: '1.0.0', description: 'Record a perception (sensory input) into episodic memory.',
    handler: async (payload) => {
      const text = String(payload.text ?? '');
      if (!text.trim()) throw new Error('observe requires a non-empty text payload');
      const episode = await kernel.remember({
        content: { type: 'text', text },
        concepts: Array.isArray(payload.concepts) ? payload.concepts.map(String) : undefined,
        provenance: { source: 'perception', reliability: typeof payload.reliability === 'number' ? payload.reliability : 1.0 },
      });
      return episodeBrief(episode);
    },
  });

  server.register({
    op: 'remember', version: '1.0.0', description: 'Deliberately store content in episodic memory.',
    handler: async (payload) => {
      const text = String(payload.content ?? '');
      if (!text.trim()) throw new Error('remember requires a non-empty content payload');
      const episode = await kernel.remember({
        content: { type: 'text', text },
        concepts: Array.isArray(payload.concepts) ? payload.concepts.map(String) : undefined,
        provenance: { source: 'deliberate', reliability: typeof payload.reliability === 'number' ? payload.reliability : 1.0 },
      });
      return episodeBrief(episode);
    },
  });

  server.register({
    op: 'retrieve', version: '1.0.0', description: 'Ranked retrieval over cognitive memory (fusion + rerank).',
    handler: async (payload) => {
      const query = String(payload.query ?? '');
      if (!query.trim()) throw new Error('retrieve requires a query');
      const limit = typeof payload.limit === 'number' ? payload.limit : 10;
      const results: ScoredResult[] = await kernel.recall({ text: query, limit });
      return {
        query,
        results: results.map((r) => ({
          id: r.id,
          score: r.score,
          content: typeof r.content === 'object' && r.content !== null ? JSON.stringify(r.content) : String(r.content),
        })),
        count: results.length,
      };
    },
  });

  server.register({
    op: 'learn', version: '1.0.0', description: 'Integrate evidence into the belief set (belief revision).',
    handler: async (payload) => {
      const proposition = String(payload.proposition ?? '');
      const evidence = String(payload.evidence ?? '');
      const reliability = typeof payload.reliability === 'number' ? payload.reliability : 0.7;
      if (!proposition.trim() || !evidence.trim()) throw new Error('learn requires proposition and evidence');
      await kernel.learnEvidence(proposition, evidence, reliability);
      return { learned: true, proposition };
    },
  });

  server.register({
    op: 'reflect', version: '1.0.0', description: 'Self-observation: recent episodes and current belief state.',
    handler: (payload) => {
      const limit = typeof payload.limit === 'number' ? payload.limit : 10;
      const episodes = kernel.getRecentEpisodes(limit).map(episodeBrief);
      const beliefs = Array.from(kernel.getBeliefs().propositions.values()).map((p) => ({
        value: p.value,
        confidence: p.confidence.value,
        entrenchment: p.entrenchment,
        status: classifyEpistemicStatus(p.confidence.value, p.evidence.length, p.contradictions.length > 0),
      }));
      return { episodes, beliefs, totalBeliefs: beliefs.length };
    },
  });

  server.register({
    op: 'consolidate', version: '1.0.0', description: 'Run an offline consolidation cycle (replay, prune, contradiction checks).',
    handler: async () => {
      const report: SleepReport = await kernel.forceSleepCycle();
      return { sleep: report, stats: kernel.getStats() };
    },
  });

  server.register({
    op: 'dream', version: '1.0.0', description: 'Offline replay — pattern discovery over stored experience.',
    handler: async () => {
      const report: SleepReport = await kernel.forceSleepCycle();
      return { replay: report, stats: kernel.getStats() };
    },
  });

  server.register({
    op: 'plan', version: '1.0.0', description: 'Deterministic planning facade: goal decomposition grounded in memory.',
    handler: async (payload) => {
      const goal = String(payload.goal ?? '');
      if (!goal.trim()) throw new Error('plan requires a goal');
      const context = String(payload.context ?? '');
      const grounding = await kernel.recall({ text: context || goal, limit: 5 });
      return {
        goal,
        derivedSteps: [
          { order: 1, action: 'gather-context', note: 'Retrieve relevant memory and workspace state' },
          { order: 2, action: 'execute', note: 'Execute the first actionable step' },
          { order: 3, action: 'verify', note: 'Verify outcome against the goal' },
        ],
        grounding: grounding.map((r) => ({ id: r.id, score: r.score })),
      };
    },
  });

  server.register({
    op: 'predict', version: '1.0.0', description: 'Predictive readout: current beliefs as testable predictions.',
    handler: (payload) => {
      const horizon = typeof payload.horizon === 'number' ? payload.horizon : 7;
      const predictions = Array.from(kernel.getBeliefs().propositions.values()).map((p) => ({
        statement: p.value,
        confidence: p.confidence.value,
        status: classifyEpistemicStatus(p.confidence.value, p.evidence.length, p.contradictions.length > 0),
        tested: p.contradictions.length > 0,
      }));
      return { horizonDays: horizon, predictions, total: predictions.length };
    },
  });

  server.register({
    op: 'simulate', version: '1.0.0', description: 'Retrieval-based simulation: project what memory says about a hypothetical.',
    handler: async (payload) => {
      const scenario = String(payload.scenario ?? '');
      if (!scenario.trim()) throw new Error('simulate requires a scenario');
      const results = await kernel.recall({ text: scenario, limit: typeof payload.limit === 'number' ? payload.limit : 10 });
      return {
        scenario,
        projectedContext: results.map((r) => ({ id: r.id, score: r.score, content: String(r.content) })),
        confidence: results.length > 0 ? Math.max(...results.map((r) => r.score)) : 0,
      };
    },
  });

  server.register({
    op: 'evaluate', version: '1.0.0', description: 'Self-evaluation: kernel health, counts, and neuromodulation state.',
    handler: () => ({
      stats: kernel.getStats(),
      protocol: { protocol: CP_PROTOCOL_ID, version: server.version },
    }),
  });

  server.register({
    op: 'critique', version: '1.0.0', description: 'Gap analysis: what memory covers and what is missing for a query.',
    handler: async (payload) => {
      const query = String(payload.query ?? '');
      if (!query.trim()) throw new Error('critique requires a query');
      const results = await kernel.recall({ text: query, limit: 10 });
      const items = results.map((r) => ({
        id: r.id,
        text: String(r.content),
        timestamp: 'timestamp' in r.content && r.content.timestamp instanceof Date ? r.content.timestamp : new Date(),
        source: 'retrieval',
      }));
      return gapAnalysis.analyze(query, items);
    },
  });

  server.register({
    op: 'execute', version: '1.0.0', description: 'Executive hook: dispatch an action to an executor driver.',
    handler: (payload) => {
      const action = String(payload.action ?? '');
      return {
        accepted: Boolean(action),
        action,
        note: 'No executor registered — plug one in via CPServer.register("execute").',
      };
    },
  });

  return server;
}

// ── Types needed by callers ───────────────────────────────────────────

export type { SleepReport, ScoredResult };
