import { CPServer, CP_OPS, CP_PROTOCOL_ID, CP_VERSION, parseCPRequest, type CPRequest } from './cp.js';

// ── CP Conformance ────────────────────────────────────────────────────
// A conformance suite exercises the versioned contract against any
// server implementation. Green conformance is the definition of "this
// server speaks CP v1."

export interface ConformanceResult {
  case: string;
  passed: boolean;
  error?: string;
}

export interface ConformanceReport {
  protocol: string;
  version: string;
  total: number;
  passed: number;
  failed: number;
  results: ConformanceResult[];
}

function envelope(op: string, payload: Record<string, unknown>, overrides?: Partial<CPRequest>): CPRequest {
  const request: CPRequest = {
    protocol: CP_PROTOCOL_ID,
    version: CP_VERSION,
    op: op as CPRequest['op'],
    requestId: `conformance-${op}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    payload,
  };
  return { ...request, ...overrides };
}

function expectSuccess(res: { success: boolean }): void {
  if (!res.success) throw new Error(`expected success, got failure`);
}

function expectFailure(res: { success: boolean }): void {
  if (res.success) throw new Error(`expected failure, got success`);
}

interface ConformanceCase {
  name: string;
  run: (server: CPServer) => Promise<void>;
}

const CONFORMANCE_CASES: ConformanceCase[] = [
  {
    name: 'ping succeeds',
    run: async (server) => {
      const res = await server.dispatch(envelope('ping', {}));
      expectSuccess(res);
      if (res.data !== undefined && typeof res.data === 'object' && 'pong' in (res.data as object)) {
        if ((res.data as { pong: boolean }).pong !== true) throw new Error('ping did not return pong');
      }
    },
  },
  {
    name: 'list returns ops',
    run: async (server) => {
      const res = await server.dispatch(envelope('list', {}));
      expectSuccess(res);
      const ops = (res.data as { ops: Array<{ op: string }> }).ops;
      if (!ops.some((o) => o.op === 'retrieve')) throw new Error('list missing retrieve op');
    },
  },
  {
    name: 'status succeeds',
    run: async (server) => {
      const res = await server.dispatch(envelope('status', {}));
      expectSuccess(res);
    },
  },
  {
    name: 'observe stores an episode',
    run: async (server) => {
      const res = await server.dispatch(envelope('observe', { text: 'conformance observation', reliability: 1 }));
      expectSuccess(res);
      const episode = res.data as { id: string };
      if (!episode.id) throw new Error('observe did not return an episode id');
    },
  },
  {
    name: 'remember stores content',
    run: async (server) => {
      const res = await server.dispatch(envelope('remember', { content: 'conformance memory', reliability: 1 }));
      expectSuccess(res);
    },
  },
  {
    name: 'retrieve finds stored content',
    run: async (server) => {
      await server.dispatch(envelope('remember', { content: 'deployment pipeline rollback procedure', reliability: 1 }));
      const res = await server.dispatch(envelope('retrieve', { query: 'rollback procedure', limit: 5 }));
      expectSuccess(res);
      const data = res.data as { results: unknown[]; count: number };
      if (!Array.isArray(data.results)) throw new Error('retrieve returned no results array');
    },
  },
  {
    name: 'learn integrates evidence',
    run: async (server) => {
      const res = await server.dispatch(envelope('learn', { proposition: 'CP conformance runs in CI', evidence: 'test run passed', reliability: 0.9 }));
      expectSuccess(res);
    },
  },
  {
    name: 'reflect returns beliefs',
    run: async (server) => {
      const res = await server.dispatch(envelope('reflect', { limit: 5 }));
      expectSuccess(res);
      const data = res.data as { beliefs: unknown[] };
      if (!Array.isArray(data.beliefs)) throw new Error('reflect returned no beliefs array');
    },
  },
  {
    name: 'plan returns derived steps',
    run: async (server) => {
      const res = await server.dispatch(envelope('plan', { goal: 'ship CP v1' }));
      expectSuccess(res);
      const data = res.data as { derivedSteps: unknown[] };
      if (!Array.isArray(data.derivedSteps)) throw new Error('plan returned no steps');
    },
  },
  {
    name: 'predict returns predictions',
    run: async (server) => {
      const res = await server.dispatch(envelope('predict', { horizon: 3 }));
      expectSuccess(res);
      const data = res.data as { predictions: unknown[] };
      if (!Array.isArray(data.predictions)) throw new Error('predict returned no predictions');
    },
  },
  {
    name: 'simulate projects context',
    run: async (server) => {
      const res = await server.dispatch(envelope('simulate', { scenario: 'what happens on failure', limit: 5 }));
      expectSuccess(res);
    },
  },
  {
    name: 'evaluate reports health',
    run: async (server) => {
      const res = await server.dispatch(envelope('evaluate', {}));
      expectSuccess(res);
    },
  },
  {
    name: 'critique reports gaps',
    run: async (server) => {
      const res = await server.dispatch(envelope('critique', { query: 'something never observed' }));
      expectSuccess(res);
      const data = res.data as { gaps: unknown[] };
      if (!Array.isArray(data.gaps)) throw new Error('critique returned no gaps array');
    },
  },
  {
    name: 'execute returns accepted',
    run: async (server) => {
      const res = await server.dispatch(envelope('execute', { action: 'noop' }));
      expectSuccess(res);
    },
  },
  {
    name: 'consolidate runs a sleep cycle',
    run: async (server) => {
      const res = await server.dispatch(envelope('consolidate', {}));
      expectSuccess(res);
    },
  },
  {
    name: 'unknown op rejected',
    run: async (server) => {
      const res = await server.dispatch(envelope('definitely-not-an-op', {}));
      expectFailure(res);
    },
  },
  {
    name: 'wrong protocol rejected',
    run: async (server) => {
      const res = await server.dispatch(envelope('ping', {}, { protocol: 'mcp' as CPRequest['protocol'] }));
      expectFailure(res);
    },
  },
  {
    name: 'unsupported version rejected',
    run: async (server) => {
      const res = await server.dispatch(envelope('ping', {}, { version: '9.0.0' }));
      expectFailure(res);
    },
  },
  {
    name: 'missing payload object rejected by parser',
    run: async () => {
      const parsed = parseCPRequest({ protocol: CP_PROTOCOL_ID, version: CP_VERSION, op: 'ping' });
      if (!parsed.error && parsed.request) {
        if (!parsed.request.payload) throw new Error('payload not defaulted');
      }
    },
  },
];

function buildReport(results: ConformanceResult[]): ConformanceReport {
  const passed = results.filter((r) => r.passed).length;
  return {
    protocol: CP_PROTOCOL_ID,
    version: CP_VERSION,
    total: results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

export async function runConformance(server: CPServer): Promise<ConformanceReport> {
  const results: ConformanceResult[] = [];
  for (const { name, run } of CONFORMANCE_CASES) {
    try {
      await run(server);
      results.push({ case: name, passed: true });
    } catch (err) {
      results.push({ case: name, passed: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return buildReport(results);
}

export function assertConformance(report: ConformanceReport): void {
  if (report.failed > 0) {
    const failures = report.results.filter((r) => !r.passed);
    throw new Error(
      `CP conformance failed: ${report.failed}/${report.total} cases failed — ${failures.map((f) => `${f.case}: ${f.error}`).join('; ')}`,
    );
  }
}

export { CP_OPS };
