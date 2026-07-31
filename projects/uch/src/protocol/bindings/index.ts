import { CPServer, CP_PROTOCOL_ID, parseCPRequest, type CPErrorCode, type CPOp, type CPResponse } from '../cp.js';

// ── MCP binding ───────────────────────────────────────────────────────
// MCP is a transport binding of CP: the same semantic instruction set,
// exposed to any MCP-capable agent. No protocol logic lives here.

export interface CPToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export function createCPTools(server: CPServer): CPToolDef[] {
  return [
    {
      name: 'cp.list',
      description: 'List the cognitive operations exposed by the Cognitive Protocol (CP) v1.',
      inputSchema: { type: 'object', properties: {}, required: [] },
      handler: async () => ({
        protocol: CP_PROTOCOL_ID,
        version: server.version,
        ops: server.listOps().map((s) => ({ op: s.op, version: s.version, description: s.description })),
      }),
    },
    {
      name: 'cp.invoke',
      description: 'Invoke a Cognitive Protocol (CP) operation against the kernel — observe, remember, retrieve, learn, reflect, plan, predict, critique, consolidate, and more.',
      inputSchema: {
        type: 'object',
        properties: {
          op: {
            type: 'string',
            description: 'CP operation: observe, think, retrieve, remember, learn, reflect, consolidate, dream, plan, predict, simulate, evaluate, critique, execute, status, list, ping',
          },
          payload: { type: 'object', description: 'Operation payload (op-specific)' },
          requestId: { type: 'string', description: 'Optional client request id' },
        },
        required: ['op'],
      },
      handler: async (args) => {
        const response = await server.invoke(
          String(args.op),
          (args.payload as Record<string, unknown> | undefined) ?? {},
          typeof args.requestId === 'string' ? args.requestId : undefined,
        );
        return response;
      },
    },
  ];
}

// ── HTTP binding ──────────────────────────────────────────────────────
// Stateless: takes a raw HTTP body and returns the CP response.

function errorResponse(server: CPServer, body: unknown, code: CPErrorCode, message: string, requestId?: string): CPResponse {
  const raw = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  return {
    protocol: CP_PROTOCOL_ID,
    version: server.version,
    op: (typeof raw.op === 'string' ? raw.op : 'list') as CPOp,
    requestId: typeof raw.requestId === 'string' ? raw.requestId : (requestId ?? crypto.randomUUID()),
    success: false,
    error: { code, message },
    meta: { durationMs: 0 },
  };
}

export async function handleCPHTTP(server: CPServer, body: unknown): Promise<CPResponse> {
  const parsed = parseCPRequest(body);
  if (parsed.error || !parsed.request) {
    const code = parsed.error?.code ?? 'BAD_REQUEST';
    return errorResponse(server, body, code, parsed.error?.message ?? 'Invalid request');
  }
  return server.dispatch(parsed.request);
}

export function cpRouteInfo(server: CPServer): { protocol: string; version: string; ops: string[] } {
  return {
    protocol: CP_PROTOCOL_ID,
    version: server.version,
    ops: server.listOps().map((s) => s.op),
  };
}
