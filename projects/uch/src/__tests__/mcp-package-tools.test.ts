import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { MCPStdioServer } from '../mcp/stdio-server.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import type { CognitivePackageManifest } from '../control-plane/packages/package-manifest.js';

interface ToolEntry {
  name: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

const PACKAGE_TOOLS = [
  'package-install', 'package-update', 'package-revoke',
  'package-list', 'package-audit', 'package-attach',
];

function createServer(config?: { packageStorePath?: string }): MCPStdioServer {
  const bus = new NeuralEventBus();
  const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
  const workspace = new WorkspaceBrain({ workspace_id: 'test', name: 'test', root_path: '/test', eventBus: bus });
  const executive = new ExecutiveBrain({ eventBus: bus });
  const bio = new BiologicalFunctions(kernel, workspace, executive);
  return new MCPStdioServer({ kernel, bio, executive, workspace, ...config });
}

function tool(server: MCPStdioServer, name: string): ToolEntry {
  const tools = (server as unknown as { tools: Map<string, ToolEntry> }).tools;
  const entry = tools.get(name);
  if (!entry) throw new Error(`tool not registered: ${name}`);
  return entry;
}

function basePackage(overrides?: Partial<CognitivePackageManifest>): CognitivePackageManifest {
  return {
    schema: 'uch.package.v1',
    name: 'uch-driver-opencode',
    version: '1.2.0',
    kind: 'driver',
    entry: 'src/index.js',
    level_claims: { hooks: 4, cot: 3, otel: 0 },
    requires: { substrate: '>=0.2.0' },
    capabilities: ['observe:workspace', 'retrieve:cognitive-state'],
    permissions: ['read:session-digest'],
    retention: { reasoning_days: 30 },
    provenance: {
      author: 'uch-team',
      signature: 'ed25519:c2lnbmF0dXJlLXBsYWNlaG9sZGVy',
      source: 'https://example.test/tarball/abc123',
      published_at: '2026-08-01T00:00:00Z',
    },
    payload: ['src/index.js', 'hooks/hook.mjs'],
    ...overrides,
  };
}

describe('MCP package tools', () => {
  it('registers all package tools', () => {
    const server = createServer();
    for (const name of PACKAGE_TOOLS) {
      expect(tool(server, name).name).toBe(name);
    }
  });

  it('package-install admits a signed, capability-granted driver package and installs it', async () => {
    const server = createServer();
    const result = (await tool(server, 'package-install').handler({ manifest: basePackage() })) as {
      admitted: boolean;
      installed: boolean;
      package: { name: string; version: string };
    };
    expect(result.admitted).toBe(true);
    expect(result.installed).toBe(true);
    expect(result.package.name).toBe('uch-driver-opencode');
    expect(result.package.version).toBe('1.2.0');
  });

  it('package-install denies a capability outside the grant', async () => {
    const server = createServer();
    const pkg = basePackage({ capabilities: ['admin:everything'] });
    const result = (await tool(server, 'package-install').handler({ manifest: pkg })) as {
      admitted: boolean;
      violations: string[];
    };
    expect(result.admitted).toBe(false);
    expect(result.violations).toContain('capability-not-granted:admin:everything');
  });

  it('package-install denies an unsigned executing package (signature mandatory)', async () => {
    const server = createServer();
    const pkg = basePackage({ provenance: { ...basePackage().provenance, signature: undefined } });
    const result = (await tool(server, 'package-install').handler({ manifest: pkg })) as {
      admitted: boolean;
      violations: string[];
    };
    expect(result.admitted).toBe(false);
    expect(result.violations).toContain('signature-missing');
  });

  it('package-install rejects a malformed manifest without installing', async () => {
    const server = createServer();
    const result = (await tool(server, 'package-install').handler({ manifest: { schema: 'uch.package.v9' } })) as {
      admitted: boolean;
      violations: string[];
    };
    expect(result.admitted).toBe(false);
    expect(result.violations.some((v) => v.startsWith('schema'))).toBe(true);
  });

  it('package-install is atomic: a denied package is not listed', async () => {
    const server = createServer();
    const pkg = basePackage({ capabilities: ['admin:everything'] });
    await tool(server, 'package-install').handler({ manifest: pkg });
    const list = (await tool(server, 'package-list').handler({})) as { count: number; packages: unknown[] };
    expect(list.count).toBe(0);
  });

  it('package-update gates the new version and leaves the prior version on denial', async () => {
    const server = createServer();
    await tool(server, 'package-install').handler({ manifest: basePackage() });
    const bad = basePackage({ version: '9.9.9', capabilities: ['admin:everything'] });
    const denied = (await tool(server, 'package-update').handler({ manifest: bad })) as { admitted: boolean };
    expect(denied.admitted).toBe(false);
    const list = (await tool(server, 'package-list').handler({})) as {
      packages: Array<{ version: string }>;
    };
    expect(list.packages.map((p) => p.version)).toEqual(['1.2.0']);
  });

  it('package-update installs a new gated version', async () => {
    const server = createServer();
    await tool(server, 'package-install').handler({ manifest: basePackage() });
    const updated = (await tool(server, 'package-update').handler({
      manifest: basePackage({ version: '2.0.0' }),
    })) as { updated: boolean };
    expect(updated.updated).toBe(true);
    const list = (await tool(server, 'package-list').handler({})) as {
      packages: Array<{ version: string }>;
    };
    expect(list.packages.map((p) => p.version).sort()).toEqual(['1.2.0', '2.0.0']);
  });

  it('package-attach activates a package; package-revoke stops new activation', async () => {
    const server = createServer();
    await tool(server, 'package-install').handler({ manifest: basePackage() });
    const attached = (await tool(server, 'package-attach').handler({ name: 'uch-driver-opencode' })) as {
      attached: boolean;
    };
    expect(attached.attached).toBe(true);
    const revoked = (await tool(server, 'package-revoke').handler({ name: 'uch-driver-opencode' })) as {
      revoked: boolean;
    };
    expect(revoked.revoked).toBe(true);
    const after = (await tool(server, 'package-attach').handler({ name: 'uch-driver-opencode' })) as {
      attached: boolean;
    };
    expect(after.attached).toBe(false);
  });

  it('package-audit records install, update, and revoke in order', async () => {
    const server = createServer();
    await tool(server, 'package-install').handler({ manifest: basePackage() });
    await tool(server, 'package-update').handler({ manifest: basePackage({ version: '2.0.0' }) });
    await tool(server, 'package-revoke').handler({ name: 'uch-driver-opencode' });
    const audit = (await tool(server, 'package-audit').handler({})) as {
      count: number;
      audit: Array<{ action: string }>;
    };
    expect(audit.count).toBe(3);
    expect(audit.audit.map((e) => e.action)).toEqual(['install', 'update', 'revoke']);
  });

  it('persists installs across servers when a package store path is configured', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-mcp-pkg-'));
    const storePath = path.join(dir, 'packages.json');
    try {
      const first = createServer({ packageStorePath: storePath });
      await tool(first, 'package-install').handler({ manifest: basePackage() });

      const second = createServer({ packageStorePath: storePath });
      const list = (await tool(second, 'package-list').handler({})) as {
        count: number;
        packages: Array<{ name: string; version: string }>;
      };
      expect(list.count).toBe(1);
      expect(list.packages[0]?.name).toBe('uch-driver-opencode');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('denies a planted impostor package (T13 dependency confusion) via content hash', async () => {
    const server = createServer();
    const impostor = basePackage({
      name: 'uch-driver-opencode',
      provenance: { ...basePackage().provenance, signature: undefined, source: 'https://evil.test/tarball/f00d' },
    });
    const result = (await tool(server, 'package-install').handler({
      manifest: impostor,
      grantedCapabilities: ['admin:everything'],
    })) as { admitted: boolean; violations: string[] };
    expect(result.admitted).toBe(false);
    expect(result.violations.some((v) => v.startsWith('signature-missing'))).toBe(true);
  });
});
