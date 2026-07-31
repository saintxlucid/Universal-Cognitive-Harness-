import { describe, it, expect } from 'vitest';
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

describe('UCCPServer HTTP API', () => {
  it('returns suit status through GET /api/status', async () => {
    await withServer(async (baseUrl) => {
      const response = await fetchJson<{
        workspace: { id: string };
        suit: { litmus: { threshold: number }; instinct: { reflex_count: number } };
      }>(`${baseUrl}/api/status`);
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
      const profile = makeProfile();
      const response = await fetchJson<{ path: string; composite: number; rejected: boolean }>(
        `${baseUrl}/api/suit/litmus`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
      const response = await fetchJson<{ error: string }>(`${baseUrl}/api/suit/litmus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing profile payload');
    });
  });

  it('evaluates reflexes via POST /api/suit/instinct', async () => {
    await withServer(async (baseUrl) => {
      const context = makeContext();
      const response = await fetchJson<{ results: Array<{ reflex: string; passed: boolean }> }>(
        `${baseUrl}/api/suit/instinct`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
});
