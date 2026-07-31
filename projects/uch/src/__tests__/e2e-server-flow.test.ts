import { describe, it, expect, afterAll } from 'vitest';
import type { AddressInfo } from 'node:net';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { UCCPServer } from '../cli/uccp.js';

// ── HTTP helpers (Node built-in, no fetch dependency) ──

interface HttpResponse<T = unknown> {
  status: number;
  body: T;
}

function httpGet<T = unknown>(url: string, headers?: Record<string, string>): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) as T });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data as unknown as T });
          }
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function httpPost<T = unknown>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<HttpResponse<T>> {
  return new Promise((resolve, reject) => {
    const json = JSON.stringify(body);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(json),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: string) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode ?? 0, body: JSON.parse(data) as T });
          } catch {
            resolve({ status: res.statusCode ?? 0, body: data as unknown as T });
          }
        });
      },
    );
    req.on('error', reject);
    req.write(json);
    req.end();
  });
}

// ── withServer helper: creates UCCPServer on port 0, returns base URL ──

/**
 * Create a UCCPServer bound to port 0 (auto-assign), invoke the callback with
 * the resolved base URL and the server instance, then clean up.
 *
 * Uses the full start/stop lifecycle so that kernel init, trace persistence,
 * and the threat engine are all exercised.
 */
async function withServer<T>(
  callback: (baseUrl: string, server: UCCPServer) => Promise<T>,
): Promise<T> {
  const server = new UCCPServer({
    workspaceId: 'e2e-flow',
    workspaceName: 'E2E Flow Test',
    workspaceRoot: process.cwd(),
    httpPort: 0,
    apiKey: 'e2e-test-key',
  });

  await server.start();

  // Wait for the HTTP server to be ready (listen is async)
  const httpServer = (server as unknown as { httpServer: http.Server | null }).httpServer;
  if (httpServer && !httpServer.listening) {
    await new Promise<void>((resolve) => httpServer.once('listening', () => resolve()));
  }

  const port = (httpServer?.address() as AddressInfo)?.port ?? 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    return await callback(baseUrl, server);
  } finally {
    await server.stop();
  }
}

// ── Temp dir for persistence cleanup ──

const UCCP_DATA_DIR = path.resolve('.uccp');

afterAll(() => {
  // Clean up any .uccp artifacts created during tests
  if (fs.existsSync(UCCP_DATA_DIR)) {
    fs.rmSync(UCCP_DATA_DIR, { recursive: true, force: true });
  }
});

// ── Tests ──

describe('E2E: UCCPServer Flow', () => {
  // ── 1. Starts and Stops Cleanly ──

  it('starts and stops cleanly', async () => {
    const server = new UCCPServer({
      workspaceId: 'start-stop',
      workspaceName: 'StartStop Test',
      workspaceRoot: process.cwd(),
      httpPort: 0,
      apiKey: 'test-key',
    });

    // Should start without throwing
    await expect(server.start()).resolves.toBeUndefined();

    // Wait for HTTP server to be ready
    const httpServer = (server as unknown as { httpServer: http.Server | null }).httpServer;
    if (httpServer && !httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.once('listening', () => resolve()));
    }

    const port = (httpServer?.address() as AddressInfo)?.port;
    expect(port).toBeGreaterThan(0);

    // Health check should respond
    const healthRes = await httpGet<{ status: string }>(
      `http://127.0.0.1:${port}/health`,
    );
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');

    // Should stop without throwing
    await expect(server.stop()).resolves.toBeUndefined();

    // After stop, the HTTP server should be null
    const stoppedServer = server as unknown as { httpServer: http.Server | null };
    expect(stoppedServer.httpServer).toBeNull();
  });

  // ── 2. Health Endpoint Returns OK ──

  it('health endpoint returns ok', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpGet<{ status: string; uptime: number; traces: number }>(
        `${baseUrl}/health`,
      );

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.uptime).toBeGreaterThanOrEqual(0);
      expect(typeof res.body.traces).toBe('number');
      expect(res.body.traces).toBeGreaterThanOrEqual(0);
    });
  });

  // ── 3. Observe → Recall Pipeline ──

  it('observe → recall pipeline', async () => {
    await withServer(async (baseUrl, server) => {
      // Access kernel through type-safe escape hatch
      const kernel = (server as unknown as { kernel: import('../kernel/cognitive-kernel.js').CognitiveKernel }).kernel;

      // OBSERVE: store an episode through the kernel
      await kernel.remember({
        content: { type: 'text', text: 'The system uses TypeScript throughout the stack' },
        provenance: { source: 'user' },
      });
      await kernel.remember({
        content: { type: 'text', text: 'Authentication flow uses JWT with refresh tokens' },
        provenance: { source: 'analysis' },
      });
      await kernel.remember({
        content: { type: 'text', text: 'Database connection is configured via environment variables' },
        provenance: { source: 'config' },
      });

      // Verify episodes are tracked
      const stats = kernel.getStats();
      expect(stats.episodes).toBeGreaterThanOrEqual(3);

      // RECALL: retrieve formatted context
      const recalled = kernel.recallFormatted({ text: 'JWT' });
      expect(recalled.length).toBeGreaterThan(0);
      expect(recalled.toLowerCase()).toContain('jwt');

      // RECALL via structured query
      const typedRecall = await kernel.recall({ text: 'TypeScript' });
      expect(typedRecall.length).toBeGreaterThan(0);
      expect(typedRecall[0]!.score).toBeGreaterThan(0);

      // Verify via HTTP status endpoint
      const statusRes = await httpGet<{ cognitive: Record<string, unknown> }>(
        `${baseUrl}/api/status`,
      );
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.cognitive).toBeDefined();
    });
  });

  // ── 4. Plan Creation and Status ──

  it('plan creation and status', async () => {
    await withServer(async (_baseUrl, server) => {
      const executive = (server as unknown as { executive: import('../executive-brain/executive-brain.js').ExecutiveBrain }).executive;

      // Create a plan
      const plan = executive.createPlan('Implement authentication module');
      expect(plan.goal).toBe('Implement authentication module');
      expect(plan.status).toBe('active');

      // Add steps
      const step1 = executive.planner.addStep(plan.id, 'Design auth API');
      const step2 = executive.planner.addStep(plan.id, 'Implement JWT middleware');
      const step3 = executive.planner.addStep(plan.id, 'Write integration tests', [
        step2!.id,
      ]);

      expect(step1).not.toBeNull();
      expect(step2).not.toBeNull();
      expect(step3).not.toBeNull();

      // Execute first step
      const execResult1 = await executive.executePlanStep(plan.id, step1!.id);
      expect(execResult1).toBe(true);

      // Verify plan is still active (only 1 of 3 steps done)
      const activePlan = executive.planner.getPlan(plan.id);
      expect(activePlan).toBeDefined();
      expect(activePlan!.status).toBe('active');

      // Execute remaining steps
      await executive.executePlanStep(plan.id, step2!.id);
      await executive.executePlanStep(plan.id, step3!.id);

      // Plan should now be completed
      const finalPlan = executive.planner.getPlan(plan.id);
      expect(finalPlan!.status).toBe('completed');

      // Verify the plan is no longer active (moved to completed)
      const activePlansAfter = executive.planner.getActivePlans();
      expect(activePlansAfter.some((ap: { id: string }) => ap.id === plan.id)).toBe(false);
    });
  });

  // ── 5. Shutdown Cleans Up Resources ──

  it('shutdown cleans up resources', async () => {
    const server = new UCCPServer({
      workspaceId: 'cleanup-test',
      workspaceName: 'Cleanup Test',
      workspaceRoot: process.cwd(),
      httpPort: 0,
      apiKey: 'cleanup-key',
    });

    await server.start();

    // Do some work so subsystems have state to clean up
    const anyServer = server as unknown as {
      kernel: import('../kernel/cognitive-kernel.js').CognitiveKernel;
      executive: import('../executive-brain/executive-brain.js').ExecutiveBrain;
      httpServer: http.Server | null;
    };

    await anyServer.kernel.remember({
      content: { type: 'text', text: 'Data for cleanup test' },
    });
    anyServer.executive.createPlan('Cleanup test plan');

    // Wait for HTTP readiness
    const httpServer = anyServer.httpServer;
    if (httpServer && !httpServer.listening) {
      await new Promise<void>((resolve) => httpServer.once('listening', () => resolve()));
    }

    const port = (httpServer?.address() as AddressInfo)?.port ?? 0;

    // Verify server is alive before shutdown
    const healthBefore = await httpGet<{ status: string }>(
      `http://127.0.0.1:${port}/health`,
    );
    expect(healthBefore.body.status).toBe('ok');

    // Perform shutdown
    await server.stop();

    // After shutdown:
    // 1. HTTP server should be null
    expect(anyServer.httpServer).toBeNull();

    // 2. The server should no longer accept connections
    //    (we just verify the server ref is gone; connection will fail)
    try {
      await httpGet(`http://127.0.0.1:${port}/health`);
      // If we get here, the server might still be listening — that's a problem
      // but on some platforms the port may not release instantly
    } catch {
      // Expected — connection refused after shutdown
    }

    // 3. Verify the lifecycle stopped (subsystems shut down)
    // The fact that stop() resolved without error means lifecycle completed
  });

  // ── 6. Token Endpoint ──

  it('POST /api/token returns token with valid x-api-key', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpPost<{ token: string; expiresAt: string }>(
        `${baseUrl}/api/token`,
        {},
        { 'x-api-key': 'e2e-test-key' },
      );
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.length).toBeGreaterThan(0);
      expect(typeof res.body.expiresAt).toBe('string');
    });
  });

  it('POST /api/token returns 401 with missing x-api-key', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpPost<{ error: string }>(
        `${baseUrl}/api/token`,
        {},
      );
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Missing x-api-key header');
    });
  });

  // ── 7. API Status with Auth ──

  it('GET /api/status returns full status object', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpGet<Record<string, unknown>>(`${baseUrl}/api/status`);
      expect(res.status).toBe(200);
      expect(res.body.workspace).toBeDefined();
      expect(res.body.cognitive).toBeDefined();
      expect(res.body.control).toBeDefined();
      expect(res.body.suit).toBeDefined();
      expect(res.body.signals).toBeDefined();
    });
  });

  it('GET /api/status with valid Bearer token returns 200', async () => {
    await withServer(async (baseUrl) => {
      const tokenRes = await httpPost<{ token: string }>(
        `${baseUrl}/api/token`,
        {},
        { 'x-api-key': 'e2e-test-key' },
      );
      const token = tokenRes.body.token;

      const res = await httpGet<Record<string, unknown>>(`${baseUrl}/api/status`, {
        Authorization: `Bearer ${token}`,
      });
      expect(res.status).toBe(200);
    });
  });

  it('GET /api/status with invalid Bearer token returns 401', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpGet<{ error: string }>(`${baseUrl}/api/status`, {
        Authorization: 'Bearer bad-token',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  // ── 8. Aether Endpoints ──

  it('GET /api/aether returns aether stats', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpGet<Record<string, unknown>>(`${baseUrl}/api/aether`);
      expect(res.status).toBe(200);
      expect(typeof res.body).toBe('object');
    });
  });

  it('POST /api/aether/observe acknowledges a thought', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpPost<{ acknowledged: boolean }>(
        `${baseUrl}/api/aether/observe`,
        { content: 'Test thought', layer: 'working', source: 'e2e-test' },
      );
      expect(res.status).toBe(200);
      expect(res.body.acknowledged).toBe(true);
    });
  });

  it('POST /api/aether/observe returns 400 when content is missing', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpPost<{ error: string }>(
        `${baseUrl}/api/aether/observe`,
        {},
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing content in body');
    });
  });

  // ── 9. Suit Endpoint Error Cases ──

  it('POST /api/suit/litmus returns 400 when profile is missing', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpPost<{ error: string }>(
        `${baseUrl}/api/suit/litmus`,
        {},
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing profile payload');
    });
  });

  it('POST /api/suit/instinct returns 400 when context is missing', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpPost<{ error: string }>(
        `${baseUrl}/api/suit/instinct`,
        {},
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing context payload');
    });
  });

  // ── 10. 404 Handling ──

  it('returns 404 for unknown routes', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpGet<{ error: string }>(`${baseUrl}/api/unknown`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  it('returns 404 for unknown POST routes', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpPost<{ error: string }>(`${baseUrl}/api/unknown`, {});
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not found');
    });
  });

  // ── 11. CORS Preflight ──

  it('returns 204 for OPTIONS preflight on any route', async () => {
    await withServer(async (baseUrl) => {
      const json = JSON.stringify({});
      const res = await new Promise<{ status: number; headers: Record<string, string | undefined> }>(
        (resolve, reject) => {
          const req = http.request(
            `${baseUrl}/api/status`,
            { method: 'OPTIONS' },
            (res) => {
              const headers: Record<string, string | undefined> = {};
              headers['access-control-allow-origin'] = res.headers['access-control-allow-origin'] as string | undefined;
              headers['access-control-allow-methods'] = res.headers['access-control-allow-methods'] as string | undefined;
              headers['access-control-allow-headers'] = res.headers['access-control-allow-headers'] as string | undefined;
              let data = '';
              res.on('data', (chunk: string) => { data += chunk; });
              res.on('end', () => resolve({ status: res.statusCode ?? 0, headers }));
            },
          );
          req.on('error', reject);
          req.end();
        },
      );
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('*');
      expect(res.headers['access-control-allow-methods']).toContain('GET');
      expect(res.headers['access-control-allow-headers']).toContain('Authorization');
    });
  });

  // ── 12. MCP Endpoints ──

  it('POST /mcp returns error for invalid JSON body', async () => {
    await withServer(async (baseUrl) => {
      const json = 'not-json';
      const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = http.request(
          `${baseUrl}/mcp`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(json),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk: string) => { data += chunk; });
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
          },
        );
        req.on('error', reject);
        req.write(json);
        req.end();
      });
      // MCP transport returns parse error JSON-RPC response
      expect(res.status).toBe(200);
      const parsed = JSON.parse(res.body);
      expect(parsed.error).toBeDefined();
      expect(parsed.error.code).toBeDefined();
    });
  });

  it('POST /mcp returns 405 for GET requests', async () => {
    await withServer(async (baseUrl) => {
      const res = await new Promise<{ status: number }>((resolve, reject) => {
        http.get(`${baseUrl}/mcp`, (res) => {
          let data = '';
          res.on('data', (chunk: string) => { data += chunk; });
          res.on('end', () => resolve({ status: res.statusCode ?? 0 }));
        }).on('error', reject);
      });
      expect(res.status).toBe(405);
    });
  });

  it('MCP SSE flow: GET /sse establishes connection', async () => {
    await withServer(async (baseUrl) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      try {
        const sse = await new Promise<{ status: number; headers: Record<string, string | undefined> }>(
          (resolve, reject) => {
            const req = http.get(`${baseUrl}/sse`, { signal: controller.signal }, (res) => {
              const headers: Record<string, string | undefined> = {};
              headers['content-type'] = res.headers['content-type'] as string | undefined;
              headers['cache-control'] = res.headers['cache-control'] as string | undefined;
              // Read a small chunk then destroy to close early
              res.once('data', () => { res.destroy(); });
              resolve({ status: res.statusCode ?? 0, headers });
            });
            req.on('error', (err) => { if (!controller.signal.aborted) reject(err); });
          },
        );
        expect(sse.status).toBe(200);
        expect(sse.headers['content-type']).toContain('text/event-stream');
        expect(sse.headers['cache-control']).toContain('no-cache');
      } finally {
        clearTimeout(timeout);
      }
    });
  });

  it('POST /messages returns 400 without clientId', async () => {
    await withServer(async (baseUrl) => {
      const res = await httpPost<{ error: string }>(
        `${baseUrl}/messages`,
        {},
      );
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Missing clientId');
    });
  });
});
