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

describe('CP tools on MCP server', () => {
  it('registers cp.list and cp.invoke', () => {
    const server = createServer();
    const tools = (server as unknown as { tools: Map<string, ToolEntry> }).tools;
    expect(tools.has('cp.list')).toBe(true);
    expect(tools.has('cp.invoke')).toBe(true);
  });

  it('cp.list reports the protocol version and ops', async () => {
    const server = createServer();
    const result = (await tool(server, 'cp.list').handler({})) as {
      protocol: string;
      version: string;
      ops: Array<{ op: string }>;
    };
    expect(result.protocol).toBe('uch-cp');
    expect(result.version).toMatch(/^1\./);
    expect(result.ops.some((o) => o.op === 'retrieve')).toBe(true);
    expect(result.ops.some((o) => o.op === 'consolidate')).toBe(true);
  });

  it('cp.invoke observes and retrieves through the kernel', async () => {
    const server = createServer();
    const observed = (await tool(server, 'cp.invoke').handler({
      op: 'observe',
      payload: { text: 'mcp cp invocation works' },
    })) as { success: boolean; op: string };
    expect(observed.success).toBe(true);
    expect(observed.op).toBe('observe');

    const retrieved = (await tool(server, 'cp.invoke').handler({
      op: 'retrieve',
      payload: { query: 'mcp cp invocation', limit: 5 },
    })) as { success: boolean; data: { count: number } };
    expect(retrieved.success).toBe(true);
    expect(retrieved.data.count).toBeGreaterThan(0);
  });

  it('cp.invoke returns a typed error for unknown ops', async () => {
    const server = createServer();
    const result = (await tool(server, 'cp.invoke').handler({ op: 'not-an-op' })) as {
      success: boolean;
      error: { code: string };
    };
    expect(result.success).toBe(false);
    expect(result.error.code).toBe('UNSUPPORTED_OP');
  });
});
