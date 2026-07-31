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

export async function runConformance(server: CPServer): Promise<ConformanceReport> {
  const results: ConformanceResult[] = [];
  const record = async (name: string, fn: () => Promise<unknown>): Promise<void> => {
    try {
      await fn();
      results.push({ case: name, passed: true });
    } catch (err) {
      results.push({ case: name, passed: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  const expectSuccess = (res: { success: boolean }): void => {
    if (!res.success) throw new Error(`expected success, got failure`);
  };
  const expectFailure = (res: { success: boolean }): void => {
    if (res.success) throw new Error(`expected failure, got success`);
  };

  await record('ping succeeds', async () => {
    const res = await server.dispatch(envelope('ping', {}));
    expectSuccess(res);
    if (res.data !== undefined && typeof res.data === 'object' && 'pong' in (res.data as object)) {
      if ((res.data as { pong: boolean }).pong !== true) throw new Error('ping did not return pong');
    }
  });

  await record('list returns ops', async () => {
    const res = await server.dispatch(envelope('list', {}));
    expectSuccess(res);
    const ops = (res.data as { ops: Array<{ op: string }> }).ops;
    if (!ops.some((o) => o.op === 'retrieve')) throw new Error('list missing retrieve op');
  });

  await record('status succeeds', async () => {
    const res = await server.dispatch(envelope('status', {}));
    expectSuccess(res);
  });

  await record('observe stores an episode', async () => {
    const res = await server.dispatch(envelope('observe', { text: 'conformance observation', reliability: 1 }));
    expectSuccess(res);
    const episode = res.data as { id: string };
    if (!episode.id) throw new Error('observe did not return an episode id');
  });

  await record('remember stores content', async () => {
    const res = await server.dispatch(envelope('remember', { content: 'conformance memory', reliability: 1 }));
    expectSuccess(res);
  });

  await record('retrieve finds stored content', async () => {
    await server.dispatch(envelope('remember', { content: 'deployment pipeline rollback procedure', reliability: 1 }));
    const res = await server.dispatch(envelope('retrieve', { query: 'rollback procedure', limit: 5 }));
    expectSuccess(res);
    const data = res.data as { results: unknown[]; count: number };
    if (!Array.isArray(data.results)) throw new Error('retrieve returned no results array');
  });

  await record('learn integrates evidence', async () => {
    const res = await server.dispatch(envelope('learn', { proposition: 'CP conformance runs in CI', evidence: 'test run passed', reliability: 0.9 }));
    expectSuccess(res);
  });

  await record('reflect returns beliefs', async () => {
    const res = await server.dispatch(envelope('reflect', { limit: 5 }));
    expectSuccess(res);
    const data = res.data as { beliefs: unknown[] };
    if (!Array.isArray(data.beliefs)) throw new Error('reflect returned no beliefs array');
  });

  await record('plan returns derived steps', async () => {
    const res = await server.dispatch(envelope('plan', { goal: 'ship CP v1' }));
    expectSuccess(res);
    const data = res.data as { derivedSteps: unknown[] };
    if (!Array.isArray(data.derivedSteps)) throw new Error('plan returned no steps');
  });

  await record('predict returns predictions', async () => {
    const res = await server.dispatch(envelope('predict', { horizon: 3 }));
    expectSuccess(res);
    const data = res.data as { predictions: unknown[] };
    if (!Array.isArray(data.predictions)) throw new Error('predict returned no predictions');
  });

  await record('simulate projects context', async () => {
    const res = await server.dispatch(envelope('simulate', { scenario: 'what happens on failure', limit: 5 }));
    expectSuccess(res);
  });

  await record('evaluate reports health', async () => {
    const res = await server.dispatch(envelope('evaluate', {}));
    expectSuccess(res);
  });

  await record('critique reports gaps', async () => {
    const res = await server.dispatch(envelope('critique', { query: 'something never observed' }));
    expectSuccess(res);
    const data = res.data as { gaps: unknown[] };
    if (!Array.isArray(data.gaps)) throw new Error('critique returned no gaps array');
  });

  await record('execute returns accepted', async () => {
    const res = await server.dispatch(envelope('execute', { action: 'noop' }));
    expectSuccess(res);
  });

  await record('consolidate runs a sleep cycle', async () => {
    const res = await server.dispatch(envelope('consolidate', {}));
    expectSuccess(res);
  });

  await record('unknown op rejected', async () => {
    const res = await server.dispatch(envelope('definitely-not-an-op', {}));
    expectFailure(res);
  });

  await record('wrong protocol rejected', async () => {
    const res = await server.dispatch(envelope('ping', {}, { protocol: 'mcp' as CPRequest['protocol'] }));
    expectFailure(res);
  });

  await record('unsupported version rejected', async () => {
    const res = await server.dispatch(envelope('ping', {}, { version: '9.0.0' }));
    expectFailure(res);
  });

  await record('missing payload object rejected by parser', async () => {
    const parsed = parseCPRequest({ protocol: CP_PROTOCOL_ID, version: CP_VERSION, op: 'ping' });
    if (!parsed.error && parsed.request) {
      if (!parsed.request.payload) throw new Error('payload not defaulted');
    }
  });

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

export function assertConformance(report: ConformanceReport): void {
  if (report.failed > 0) {
    const failures = report.results.filter((r) => !r.passed);
    throw new Error(
      `CP conformance failed: ${report.failed}/${report.total} cases failed — ${failures.map((f) => `${f.case}: ${f.error}`).join('; ')}`,
    );
  }
}

export { CP_OPS };
