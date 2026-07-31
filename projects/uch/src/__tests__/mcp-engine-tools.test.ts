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

describe('MCP engine tools', () => {
  it('registers principles-check, gap-analysis, mem-search and mem-get', () => {
    const server = createServer();
    const tools = (server as unknown as { tools: Map<string, ToolEntry> }).tools;
    for (const name of ['principles-check', 'gap-analysis', 'mem-search', 'mem-get']) {
      expect(tools.has(name), `missing tool ${name}`).toBe(true);
    }
  });

  it('principles-check returns a verdict with per-principle flags', async () => {
    const server = createServer();
    const result = (await tool(server, 'principles-check').handler({
      intent: 'Fix the login bug',
      proposedChange: 'Patch login and reformat unrelated dashboard files while at it',
    })) as {
      verdict: string;
      score: number;
      principles: Array<{ principle: string; pass: boolean; flags: string[] }>;
    };
    expect(result.verdict).toBe('review');
    expect(result.score).toBeLessThan(1);
    expect(result.principles.length).toBe(4);
    const surgical = result.principles.find((p) => p.principle === 'surgical-changes');
    expect(surgical?.pass).toBe(false);
  });

  it('gap-analysis reports coverage and missing terms for a query', async () => {
    const server = createServer();
    const result = (await tool(server, 'gap-analysis').handler({
      query: 'deployment pipeline rollback status',
    })) as { query: string; gaps: string[]; confidence: number; citations: string[] };
    expect(result.query).toBe('deployment pipeline rollback status');
    expect(Array.isArray(result.gaps)).toBe(true);
    expect(Array.isArray(result.citations)).toBe(true);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('mem-search returns a ranked index and mem-get fetches details', async () => {
    const server = createServer();
    const search = (await tool(server, 'mem-search').handler({
      query: 'anything at all',
      limit: 5,
    })) as { totalMatches: number; entries: unknown[]; tokenCostHint: string };
    expect(search.totalMatches).toBe(0);
    expect(search.entries).toEqual([]);
    expect(search.tokenCostHint).toContain('tokens');

    const details = (await tool(server, 'mem-get').handler({ ids: ['missing-id'] })) as unknown[];
    expect(details).toEqual([]);
  });
});
