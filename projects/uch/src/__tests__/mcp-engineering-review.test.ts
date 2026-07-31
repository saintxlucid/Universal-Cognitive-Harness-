import { describe, it, expect } from 'vitest';
import { MCPStdioServer } from '../mcp/stdio-server.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

interface ToolEntry {
  name: string;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

interface ReviewOutcome {
  targetId: string;
  score: number;
  summary: string;
  findings: Array<{
    tier: string;
    severity: string;
    conceptId: string;
    message: string;
    evidence: string[];
    suggestion: string[];
    gate: 'veto' | 'advisory';
  }>;
}

function createServer(): MCPStdioServer {
  const bus = new NeuralEventBus();
  const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
  const workspace = new WorkspaceBrain({ workspace_id: 'test', name: 'test', root_path: '/test', eventBus: bus });
  const executive = new ExecutiveBrain({ eventBus: bus });
  const bio = new BiologicalFunctions(kernel, workspace, executive);
  return new MCPStdioServer({ kernel, bio, executive, workspace });
}

function tool(server: MCPStdioServer, name: string): ToolEntry {
  const tools = (server as unknown as { tools: Map<string, ToolEntry> }).tools;
  const entry = tools.get(name);
  if (!entry) throw new Error(`tool not registered: ${name}`);
  return entry;
}

describe('MCP engineering-review tool', () => {
  it('registers the tool', () => {
    const server = createServer();
    expect(tool(server, 'engineering-review')).toBeDefined();
  });

  it('flags a SPOF design with a veto finding', async () => {
    const server = createServer();
    const result = (await tool(server, 'engineering-review').handler({
      change: 'The message broker has no failover and no standby; if it dies the pipeline stops.',
      kind: 'architecture',
    })) as ReviewOutcome;
    expect(result.findings.some((f) => f.conceptId === 'sys.spof' && f.gate === 'veto')).toBe(true);
    expect(result.score).toBeLessThan(100);
  });

  it('auto-detects a code diff and surfaces unrecovered network I/O', async () => {
    const server = createServer();
    const result = (await tool(server, 'engineering-review').handler({
      change: '+const r = await fetch("https://api.example.com/v1/users");\n+return await r.json();',
    })) as ReviewOutcome;
    expect(result.findings.some((f) => f.conceptId === 'failure.network-loss' && f.gate === 'veto')).toBe(true);
  });

  it('reports advisory findings for coupling (import fan-out)', async () => {
    const server = createServer();
    const result = (await tool(server, 'engineering-review').handler({
      change: [
        '+import a from "lib-a";', '+import b from "lib-b";', '+import c from "lib-c";',
        '+import d from "lib-d";', '+import e from "lib-e";', '+import f from "lib-f";',
        '+import g from "lib-g";', '+import h from "lib-h";', '+import i from "lib-i";',
      ].join('\n'),
      kind: 'code',
    })) as ReviewOutcome;
    expect(result.findings.some((f) => f.conceptId === 'se.coupling' && f.gate === 'advisory')).toBe(true);
  });

  it('returns a clean review with no vetoes for a redundant design', async () => {
    const server = createServer();
    const result = (await tool(server, 'engineering-review').handler({
      change: 'The service runs in three replicas with automatic failover to a standby database.',
      kind: 'design',
    })) as ReviewOutcome;
    expect(result.findings.filter((f) => f.gate === 'veto')).toEqual([]);
  });
});
