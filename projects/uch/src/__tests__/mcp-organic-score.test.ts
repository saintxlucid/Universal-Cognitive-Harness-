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

interface OrganicScoreOutcome {
  verdict: string;
  score: number;
  vetoedBy?: string[];
  recommendations: string[];
  engineeringReview?: { score: number; summary: string };
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

describe('MCP organic-score — engineering veto hookup', () => {
  it('registers the organic-score tool', () => {
    const server = createServer();
    expect(tool(server, 'organic-score')).toBeDefined();
  });

  it('hard-rejects on explicit engineeringFindings with gate=veto', async () => {
    const server = createServer();
    const result = (await tool(server, 'organic-score').handler({
      change: 'Adds a settings page with tests.',
      engineeringFindings: [{
        tier: 'tier-03-systems',
        severity: 'blocking',
        conceptId: 'sys.spof',
        message: 'Single point of failure: a critical component is described without redundancy.',
        evidence: ['singularity + critical asset'],
        suggestion: ['State the redundancy model.'],
        gate: 'veto',
      }],
    })) as OrganicScoreOutcome;
    expect(result.verdict).toBe('reject');
    expect(result.vetoedBy).toEqual(['sys.spof']);
  });

  it('runs the evaluator on engineeringTarget and vetoes on SPOF prose', async () => {
    const server = createServer();
    const result = (await tool(server, 'organic-score').handler({
      change: 'The message broker has no failover and no standby; if it dies the pipeline stops.',
      engineeringTarget: { kind: 'architecture', text: 'The message broker has no failover and no standby; if it dies the pipeline stops.' },
    })) as OrganicScoreOutcome;
    expect(result.verdict).toBe('reject');
    expect(result.vetoedBy).toEqual(['sys.spof']);
    expect(result.engineeringReview).toBeDefined();
    expect(result.recommendations.join(' ')).toContain('sys.spof');
  });

  it('vetoes an unmitigated network fetch via code target', async () => {
    const server = createServer();
    const result = (await tool(server, 'organic-score').handler({
      change: '+const r = await fetch("https://api.example.com/v1/users");\n+return await r.json();',
      engineeringTarget: {
        kind: 'code',
        diff: '+const r = await fetch("https://api.example.com/v1/users");\n+return await r.json();',
        paths: ['src/client.ts'],
      },
    })) as OrganicScoreOutcome;
    expect(result.verdict).toBe('reject');
    expect(result.vetoedBy).toContain('failure.network-loss');
  });

  it('leaves a clean target unvetoed and returns the review summary', async () => {
    const server = createServer();
    const result = (await tool(server, 'organic-score').handler({
      change: 'The service runs in three replicas with automatic failover to a standby database.',
      engineeringTarget: { kind: 'design', text: 'The service runs in three replicas with automatic failover to a standby database.' },
    })) as OrganicScoreOutcome;
    expect(result.vetoedBy).toBeUndefined();
    expect(result.engineeringReview).toBeDefined();
    expect(typeof result.engineeringReview?.score).toBe('number');
  });

  it('ignores malformed explicit findings', async () => {
    const server = createServer();
    const result = (await tool(server, 'organic-score').handler({
      change: 'Adds a settings page with tests.',
      engineeringFindings: [{ conceptId: 'no-gate', message: 'junk' }, 'not an object'],
    })) as OrganicScoreOutcome;
    expect(result.verdict).not.toBe('reject');
    expect(result.vetoedBy).toBeUndefined();
  });
});
