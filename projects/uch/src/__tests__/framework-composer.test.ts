import { describe, it, expect } from 'vitest';
import { FrameworkComposer } from '../cognitive-plane/frameworks/composer/composer.js';
import { FrameworkTraceRecorder } from '../cognitive-plane/frameworks/tracing/trace-recorder.js';
import { MCPStdioServer } from '../mcp/stdio-server.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';

function createServer(): MCPStdioServer {
  const bus = new NeuralEventBus();
  const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'test', project_id: 'test' });
  const workspace = new WorkspaceBrain({ workspace_id: 'test', name: 'test', root_path: '/test', eventBus: bus });
  const executive = new ExecutiveBrain({ eventBus: bus });
  const bio = new BiologicalFunctions(kernel, workspace, executive);
  return new MCPStdioServer({ kernel, bio, executive, workspace });
}

function tool(server: MCPStdioServer, name: string): { handler: (args: Record<string, unknown>) => Promise<unknown> } {
  const tools = (server as unknown as { tools: Map<string, { handler: (args: Record<string, unknown>) => Promise<unknown> }> }).tools;
  const entry = tools.get(name);
  if (!entry) throw new Error(`tool not registered: ${name}`);
  return entry;
}

describe('FrameworkComposer (blueprint §5.6)', () => {
  it('runs the full chain and produces a ready plan', () => {
    const composer = new FrameworkComposer();
    const result = composer.solve('choose a logging library for a new service', {
      dataAvailability: 0.8,
      timePressure: 0.2,
    });
    expect(result.model).not.toBeNull();
    expect(['decision-matrix', 'rational', 'cost-benefit']).toContain(result.model?.id);
    const stageNames = result.stages.map((s) => s.stage);
    expect(stageNames).toContain('understand');
    expect(stageNames).toContain('risk-gate');
    expect(stageNames).not.toContain('decide');
    expect(result.stages.find((s) => s.stage === 'risk-gate')?.verdict).toBe('pass');
    expect(result.plan.goal).toContain('logging library');
    expect(result.plan.steps.length).toBeGreaterThan(0);
    expect(result.plan.risks).toEqual([]);
    expect(result.verdict).toBe('ready');
  });

  it('adds the diagnose stage when a root cause is needed', () => {
    const composer = new FrameworkComposer();
    const result = composer.solve('production incidents keep recurring', {
      rootCauseNeeded: true,
      evidenceFacts: ['timeouts at 14:02', 'queue depth spikes'],
    });
    const diagnose = result.stages.find((s) => s.stage === 'diagnose')!;
    expect(diagnose.engine).toBe('rca-focus');
    expect(diagnose.output).toBeDefined();
    expect(['five-whys', 'rca-focus', 'fishbone']).toContain(result.model?.id);
  });

  it('runs the decide stage via decision matrix when alternatives are supplied', () => {
    const composer = new FrameworkComposer();
    const result = composer.solve('pick a database', {
      options: ['postgres', 'mysql', 'sqlite'],
      criteria: ['performance', 'operational ease'],
      weights: [0.7, 0.3],
      scores: [
        [9, 6],
        [7, 8],
        [4, 9],
      ],
    });
    const decide = result.stages.find((s) => s.stage === 'decide')!;
    expect(decide.engine).toBe('decision-matrix');
    expect(decide.verdict).toBe('postgres');
    const matrix = decide.output as { results: { option: string }[] };
    expect(matrix.results[0]?.option).toBe('postgres');
  });

  it('runs the decide stage via pros & cons when sides are given', () => {
    const composer = new FrameworkComposer();
    const result = composer.solve('should we hire an intern', {
      pros: ['cheap capacity', 'fresh perspective'],
      cons: [],
    });
    const decide = result.stages.find((s) => s.stage === 'decide')!;
    expect(decide.engine).toBe('pros-cons');
    expect(decide.verdict).toBe('adopt');
  });

  it('returns review when the pre-mortem gate finds high risks', () => {
    const composer = new FrameworkComposer();
    const result = composer.solve('migrate the monolith in two weeks', {
      riskCauses: ['regulatory miss', 'data loss during migration'],
      riskLikelihood: [0.9, 0.9],
      riskImpact: [0.9, 0.9],
    });
    expect(result.verdict).toBe('review');
    expect(result.plan.risks.length).toBeGreaterThan(0);
    expect(result.plan.risks[0]).toBe('regulatory miss');
    expect(result.stages.find((s) => s.stage === 'risk-gate')?.verdict).toBe('review');
  });

  it('emits one trace tree: a selection plus a completion per stage', () => {
    const tracer = new FrameworkTraceRecorder();
    const composer = new FrameworkComposer(tracer);
    composer.solve('debug flaky CI', { rootCauseNeeded: true });
    const stats = tracer.getStats();
    expect(stats.selectionCount).toBe(1);
    expect(stats.completionCount).toBe(3); // understand + diagnose + risk-gate
    expect(stats.usageByFramework.some((f) => f.engine === 'ideal')).toBe(true);
    expect(stats.usageByFramework.some((f) => f.engine === 'rca-focus')).toBe(true);
    expect(stats.usageByFramework.some((f) => f.engine === 'pre-mortem')).toBe(true);
  });

  it('rejects an empty problem', () => {
    const composer = new FrameworkComposer();
    expect(() => composer.solve('   ')).toThrow(/problem description/);
  });
});

describe('MCP framework-run tool (blueprint §5.6)', () => {
  it('solves a problem end-to-end and journals the stages', async () => {
    const server = createServer();
    const result = (await tool(server, 'framework-run').handler({
      problem: 'adopt an observability stack',
      dataAvailability: 0.8,
      pros: ['open source', 'community'],
      cons: ['self-hosting cost'],
    })) as {
      model: { id: string } | null;
      stages: { stage: string }[];
      verdict: string;
      plan: { steps: string[] };
    };
    expect(result.model).not.toBeNull();
    expect(result.stages.map((s) => s.stage)).toContain('decide');
    expect(result.plan.steps.length).toBeGreaterThan(0);
    expect(['ready', 'review']).toContain(result.verdict);

    const stats = (await tool(server, 'framework-stats').handler({})) as {
      journal: { total: number; usageByModel: { engine: string }[] };
      traces: { traceCount: number };
    };
    expect(stats.journal.total).toBeGreaterThanOrEqual(3);
    expect(stats.journal.usageByModel.map((m) => m.engine)).toContain('pros-cons');
    expect(stats.traces.traceCount).toBeGreaterThanOrEqual(4);
  });

  it('errors gracefully when the problem is missing', async () => {
    const server = createServer();
    const result = (await tool(server, 'framework-run').handler({})) as { error?: string };
    expect(result.error).toBeDefined();
  });
});
