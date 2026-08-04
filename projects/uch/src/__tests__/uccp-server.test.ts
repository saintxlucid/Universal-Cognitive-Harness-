import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { UCCPServer } from '../cli/uccp.js';
import type { FileProfile } from '../suit/litmus/code-scorer.js';
import type { ReflexContext } from '../suit/instinct/reflex-engine.js';

function makeProfile(overrides: Partial<FileProfile> = {}): FileProfile {
  return {
    path: overrides.path ?? '/src/example.ts',
    language: overrides.language ?? 'typescript',
    lines: overrides.lines ?? 80,
    imports: overrides.imports ?? ['fs', 'path'],
    exports: overrides.exports ?? ['handler'],
    functions: overrides.functions ?? [{ name: 'handler', lines: 30, params: 2, complexity: 5 }],
    classes: overrides.classes ?? [],
    comments: overrides.comments ?? 8,
    todoCount: overrides.todoCount ?? 0,
    hasTests: overrides.hasTests ?? true,
    hasTypes: overrides.hasTypes ?? true,
    maxNesting: overrides.maxNesting ?? 3,
    duplicateScore: overrides.duplicateScore ?? 0,
    dependencyCount: overrides.dependencyCount ?? 3,
    securityPatterns: overrides.securityPatterns ?? [],
  };
}

function makeContext(overrides: Partial<ReflexContext> = {}): ReflexContext {
  return {
    action: overrides.action ?? 'create',
    targetType: overrides.targetType ?? 'file',
    name: overrides.name ?? 'InvoiceProcessor',
    existingAbstractions: overrides.existingAbstractions ?? ['UserService', 'AuthService'],
    existingDependencies: overrides.existingDependencies ?? ['express'],
    fileSize: overrides.fileSize ?? 100,
    complexity: overrides.complexity ?? 4,
    nestingDepth: overrides.nestingDepth ?? 2,
    architecturePatterns: overrides.architecturePatterns ?? ['layered'],
    allowedDependencies: overrides.allowedDependencies ?? ['express', 'zod'],
    forbiddenDependencies: overrides.forbiddenDependencies ?? [],
    maxFileSize: overrides.maxFileSize ?? 400,
    maxFunctionLines: overrides.maxFunctionLines ?? 80,
    maxNesting: overrides.maxNesting ?? 5,
    maxComplexity: overrides.maxComplexity ?? 10,
  };
}

async function fetchJson<T = unknown>(
  url: string,
  opts?: RequestInit,
): Promise<{ status: number; body: T }> {
  const response = await fetch(url, opts);
  return { status: response.status, body: (await response.json()) as T };
}

async function withServer<T>(
  callback: (baseUrl: string, server: UCCPServer) => Promise<T>,
): Promise<T> {
  const server = new UCCPServer({
    workspaceId: 'test-workspace',
    workspaceName: 'Test Workspace',
    workspaceRoot: process.cwd(),
    httpPort: 0,
    apiKey: 'test-key',
  });

  const anyServer = server as unknown as {
    startHttpServer: () => void;
    httpServer: import('node:http').Server | null;
  };
  anyServer.startHttpServer();
  const address = anyServer.httpServer?.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    return await callback(baseUrl, server);
  } finally {
    await new Promise<void>((resolve) => anyServer.httpServer?.close(() => resolve()));
  }
}

/**
 * Mint an admin bearer token in-process. The /api/token endpoint is gated by
 * the configured x-api-key; tests drive the Auth service directly through the
 * escape hatch: register the configured key, then create a token from it.
 */
async function adminToken(server: UCCPServer): Promise<string> {
  const auth = (server as unknown as { auth: import('../control-plane/auth/auth.js').Auth }).auth;
  auth.registerApiKey('test-key', {
    agentId: 'admin',
    agentType: 'cli',
    name: 'CLI Admin',
    permissions: ['*'],
  });
  const result = auth.createToken('test-key');
  if (!result.token) throw new Error('failed to mint admin token');
  return result.token;
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function corsPreflight(
  baseUrl: string,
  origin: string,
): Promise<{ status: number; allowOrigin: string | null }> {
  const res = await fetch(`${baseUrl}/api/status`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'GET' },
  });
  return { status: res.status, allowOrigin: res.headers.get('access-control-allow-origin') };
}

const hasDocker = (() => {
  try {
    const r = spawnSync('docker', ['--version'], { stdio: 'ignore' });
    return r.status === 0;
  } catch {
    return false;
  }
})();

const hasGitDir = fs.existsSync(join(process.cwd(), '.git'));
const uccpDescribe = hasDocker && hasGitDir ? describe : describe.skip;

uccpDescribe('UCCPServer HTTP API', () => {
  it('binds the HTTP server to loopback only', async () => {
    await withServer(async (_baseUrl, server) => {
      const anyServer = server as unknown as {
        httpServer: import('node:http').Server | null;
      };
      const address = anyServer.httpServer?.address() as AddressInfo;
      expect(address.address).toBe('127.0.0.1');
    });
  });

  it('throws when bound to a non-loopback host without an API key', () => {
    expect(
      () =>
        new UCCPServer({
          workspaceId: 'test-workspace',
          workspaceName: 'Test Workspace',
          workspaceRoot: process.cwd(),
          httpPort: 0,
          host: '0.0.0.0',
        }),
    ).toThrow(/API key/i);
  });

  it('accepts a non-loopback host when an API key is configured', () => {
    expect(
      () =>
        new UCCPServer({
          workspaceId: 'test-workspace',
          workspaceName: 'Test Workspace',
          workspaceRoot: process.cwd(),
          httpPort: 0,
          host: '0.0.0.0',
          apiKey: 'explicit-key',
        }),
    ).not.toThrow();
  });

  it('allows unauthenticated access on loopback (public by default)', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetchJson<Record<string, unknown>>(`${baseUrl}/api/status`);
      expect(response.status).toBe(200);
      expect(response.body.workspace).toBeDefined();
    });
  });

  it('rejects an invalid bearer token with 401', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetchJson<{ error: string }>(`${baseUrl}/api/status`, {
        headers: { Authorization: 'Bearer not-a-real-token' },
      });
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });

  it('returns suit status through GET /api/status with a valid token', async () => {
    await withServer(async (baseUrl) => {
      const token = await adminToken(server);
      const response = await fetchJson<{
        workspace: { id: string };
        suit: { litmus: { threshold: number }; instinct: { reflex_count: number } };
      }>(`${baseUrl}/api/status`, { headers: authHeaders(token) });
      expect(response.status).toBe(200);
      expect(response.body.workspace.id).toBe('test-workspace');
      expect(response.body.suit.litmus).toBeDefined();
      expect(response.body.suit.instinct).toBeDefined();
      expect(response.body.suit.litmus.threshold).toBeGreaterThanOrEqual(0);
      expect(response.body.suit.instinct.reflex_count).toBeGreaterThan(0);
    });
  });

  it('scores a file via POST /api/suit/litmus', async () => {
    await withServer(async (baseUrl) => {
      const token = await adminToken(server);
      const profile = makeProfile();
      const response = await fetchJson<{ path: string; composite: number; rejected: boolean }>(
        `${baseUrl}/api/suit/litmus`,
        {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(profile),
        },
      );

      expect(response.status).toBe(200);
      expect(response.body.path).toBe(profile.path);
      expect(typeof response.body.composite).toBe('number');
      expect(typeof response.body.rejected).toBe('boolean');
    });
  });

  it('returns 400 when litmus payload is missing', async () => {
    await withServer(async (baseUrl) => {
      const token = await adminToken(server);
      const response = await fetchJson<{ error: string }>(`${baseUrl}/api/suit/litmus`, {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing profile payload');
    });
  });

  it('returns 413 when the request body exceeds the limit', async () => {
    await withServer(async (baseUrl) => {
      const token = await adminToken(server);
      const oversized = JSON.stringify({ path: 'big', pad: 'x'.repeat(1_200_000) });
      const response = await fetch(`${baseUrl}/api/suit/litmus`, {
        method: 'POST',
        headers: authHeaders(token),
        body: oversized,
      });
      expect(response.status).toBe(413);
    });
  });

  it('evaluates reflexes via POST /api/suit/instinct', async () => {
    await withServer(async (baseUrl) => {
      const token = await adminToken(server);
      const context = makeContext();
      const response = await fetchJson<{ results: Array<{ reflex: string; passed: boolean }> }>(
        `${baseUrl}/api/suit/instinct`,
        {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify(context),
        },
      );

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.results)).toBe(true);
      expect(response.body.results.length).toBeGreaterThan(0);
      const namingReflex = response.body.results.find((item) => item.reflex === 'naming-reflex');
      expect(namingReflex).toBeDefined();
      expect(typeof namingReflex?.passed).toBe('boolean');
    });
  });

  it('reflects only loopback CORS origins on preflight', async () => {
    await withServer(async (baseUrl) => {
      const loopback = await corsPreflight(baseUrl, 'http://localhost:3000');
      expect(loopback.status).toBe(204);
      expect(loopback.allowOrigin).toBe('http://localhost:3000');

      const loopbackV6 = await corsPreflight(baseUrl, 'http://[::1]:3000');
      expect(loopbackV6.allowOrigin).toBe('http://[::1]:3000');
    });
  });

  it('emits no CORS allow-origin for foreign origins', async () => {
    await withServer(async (baseUrl) => {
      const foreign = await corsPreflight(baseUrl, 'http://evil.example');
      expect(foreign.status).toBe(204);
      expect(foreign.allowOrigin).toBeNull();

      const token = await adminToken(server);
      const response = await fetch(`${baseUrl}/api/status`, {
        headers: { ...authHeaders(token), Origin: 'http://evil.example' },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });
  });

  it('POST /api/token rejects an unknown api key with 401', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetchJson<{ error: string }>(`${baseUrl}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'wrong-key' },
        body: '{}',
      });
      expect(response.status).toBe(401);
      expect(response.body.error).toBeDefined();
    });
  });
});
