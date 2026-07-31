import { describe, it, expect } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { FrameworkDecisionJournal, syncTakesWithJournal, convictionFor } from '../cognitive-plane/frameworks/journal/decision-journal.js';
import { FrameworkTraceRecorder } from '../cognitive-plane/frameworks/tracing/trace-recorder.js';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { computeCalibrationProfile } from '../cognitive-plane/calibration/calibration.js';
import { TakeFence } from '../cognitive-plane/calibration/takes.js';
import { MCPStdioServer } from '../mcp/stdio-server.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { BiologicalFunctions } from '../harness-api/biological-functions.js';

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

function tmpFile(): string {
  return path.join(os.tmpdir(), `uch-journal-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

describe('FrameworkDecisionJournal (blueprint §5.4)', () => {
  it('records open entries with problem-type classification', () => {
    const journal = new FrameworkDecisionJournal();
    journal.record({
      engine: 'pros-cons',
      family: 'decisions',
      problem: 'adopt a vendor',
      profile: { dataAvailability: 0.9 },
      verdict: 'adopt',
    });
    expect(journal.count()).toBe(1);
    const entry = journal.getEntries()[0]!;
    expect(entry.status).toBe('open');
    expect(entry.problemType).toBe('data-rich');
    expect(entry.verdict).toBe('adopt');
  });

  it('maps conviction from verdicts deterministically', () => {
    expect(convictionFor('adopt')).toBe(0.8);
    expect(convictionFor('reject')).toBe(0.8);
    expect(convictionFor('balanced')).toBe(0.6);
    expect(convictionFor('review')).toBe(0.6);
    expect(convictionFor(null)).toBe(0.6);
    expect(convictionFor('unusual-verdict')).toBe(0.7);
  });

  it('records completions and errors from traces, skipping selections', () => {
    const bus = new NeuralEventBus();
    const tracer = new FrameworkTraceRecorder(bus);
    const journal = new FrameworkDecisionJournal();
    tracer.recordSelection({
      problem: 'pick a stack',
      profile: { dataAvailability: 0.8 },
      result: {
        selected: { id: 'decision-matrix', name: 'x', family: 'decisions', purpose: 'p', bestFor: [], whenNotToUse: [], stages: [], selection: { contexts: [] }, source: 's' },
        family: 'decisions',
        runnerUp: null,
        rationale: 'r',
        alternatives: [],
      },
      durationMs: 1,
    });
    tracer.recordCompletion({
      engine: 'rca-focus', family: 'rca', problem: 'outage',
      profile: { rootCauseNeeded: true },
      result: { rootCause: 'timeout' }, verdict: 'found',
    });
    tracer.recordError({ engine: 'dikw', family: 'knowledge', problem: 'x', message: 'bad input' });
    for (const trace of tracer.getTraces()) journal.recordFromTrace(trace);
    expect(journal.count()).toBe(2);
    expect(journal.getEntries().every((e) => e.traceId !== undefined)).toBe(true);
  });

  it('subscribes to framework events on the bus with replay dedupe', async () => {
    const bus = new NeuralEventBus();
    const tracer = new FrameworkTraceRecorder(bus);
    const journal = new FrameworkDecisionJournal(bus);
    tracer.recordCompletion({
      engine: 'pros-cons', family: 'decisions', problem: 'hire?',
      profile: {}, result: { verdict: 'adopt' }, verdict: 'adopt',
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(journal.count()).toBe(1);
    bus.publish({
      type: 'framework:completed',
      source: 'framework:pros-cons',
      payload: { engine: 'pros-cons', family: 'decisions', problem: 'hire?', verdict: 'adopt' },
      metadata: { replay_of: 'replayed-trace-1' },
    });
    bus.publish({
      type: 'framework:completed',
      source: 'framework:pros-cons',
      payload: { engine: 'pros-cons', family: 'decisions', problem: 'hire?', verdict: 'adopt' },
      metadata: { replay_of: 'replayed-trace-1' },
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(journal.count()).toBe(2);
  });

  it('resolves entries and computes per-model accuracy', () => {
    const journal = new FrameworkDecisionJournal();
    const a1 = journal.record({ engine: 'pros-cons', family: 'decisions', problem: 'p1', verdict: 'adopt' });
    const a2 = journal.record({ engine: 'pros-cons', family: 'decisions', problem: 'p2', verdict: 'reject' });
    const b1 = journal.record({ engine: 'rca-focus', family: 'rca', problem: 'p3', verdict: 'found' });
    journal.resolve(a1.id, 'correct');
    journal.resolve(a2.id, 'incorrect');
    journal.resolve(b1.id, 'unresolvable');
    const stats = journal.getStats();
    expect(stats.total).toBe(3);
    expect(stats.open).toBe(0);
    expect(stats.resolved).toBe(3);
    const prosCons = stats.accuracyByModel.find((m) => m.engine === 'pros-cons')!;
    expect(prosCons.resolved).toBe(2);
    expect(prosCons.correct).toBe(1);
    expect(prosCons.accuracy).toBe(0.5);
    expect(stats.reversed.map((r) => r.engine)).toEqual(['pros-cons']);
    expect(stats.reversed[0]?.verdict).toBe('reject');
  });

  it('computes dominant framework per problem type and drift', () => {
    const journal = new FrameworkDecisionJournal();
    for (let i = 0; i < 3; i++) {
      journal.record({ engine: 'rca-focus', family: 'rca', problem: `o${i}`, profile: { rootCauseNeeded: true } });
    }
    journal.record({ engine: 'ideal', family: 'problems', problem: 'p1', profile: {} });
    const stats = journal.getStats();
    const dominant = stats.dominantPerProblemType.find((d) => d.problemType === 'root-cause')!;
    expect(dominant.engine).toBe('rca-focus');
    expect(dominant.count).toBe(3);
    expect(Array.isArray(stats.drift)).toBe(true);
    expect(stats.usageByModel[0]?.engine).toBe('rca-focus');
  });

  it('exports open entries as framework takes', () => {
    const journal = new FrameworkDecisionJournal();
    journal.record({ engine: 'pros-cons', family: 'decisions', problem: 'ship now?', verdict: 'adopt' });
    const takes = journal.toTakes();
    expect(takes).toHaveLength(1);
    expect(takes[0]?.domain).toBe('framework');
    expect(takes[0]?.conviction).toBe(0.8);
    expect(takes[0]?.status).toBe('open');
    expect(takes[0]?.claim).toContain("framework 'pros-cons' → adopt");
  });

  it('syncs journal entries into a takes fence idempotently', () => {
    const journal = new FrameworkDecisionJournal();
    const resolved = journal.record({ engine: 'pros-cons', family: 'decisions', problem: 'p1', verdict: 'adopt' });
    const open = journal.record({ engine: 'rca-focus', family: 'rca', problem: 'p2', verdict: 'found' });
    journal.resolve(resolved.id, 'correct', 'outcome matched');

    const fence = new TakeFence();
    let merged = syncTakesWithJournal(fence.all, journal);
    merged = syncTakesWithJournal(merged, journal);
    expect(merged).toHaveLength(2);
    const linked = merged.find((t) => t.sourceId === resolved.id)!;
    expect(linked.status).toBe('resolved');
    expect(linked.quality).toBe('correct');
    expect(linked.outcome).toBe(true);
    const stillOpen = merged.find((t) => t.sourceId === open.id)!;
    expect(stillOpen.status).toBe('open');
  });

  it('persists and loads the journal (Storable)', async () => {
    const file = tmpFile();
    try {
      const journal = new FrameworkDecisionJournal();
      const entry = journal.record({ engine: 'ideal', family: 'problems', problem: 'p', verdict: 'pass' });
      journal.resolve(entry.id, 'correct');
      await journal.persist(file);
      const loaded = new FrameworkDecisionJournal();
      expect(await loaded.load(file)).toBe(1);
      const restored = loaded.getEntries()[0]!;
      expect(restored.status).toBe('resolved');
      expect(restored.quality).toBe('correct');
      expect(restored.createdAt instanceof Date).toBe(true);
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it('merges journal takes into the calibration profile as a framework domain', () => {
    const journal = new FrameworkDecisionJournal();
    const resolved = journal.record({ engine: 'pros-cons', family: 'decisions', problem: 'p1', verdict: 'adopt' });
    journal.resolve(resolved.id, 'correct');
    const fence = new TakeFence();
    fence.add({ claim: 'unit test claim 1', conviction: 0.7, domain: 'testing' });
    fence.add({ claim: 'unit test claim 2', conviction: 0.8, domain: 'testing' });
    fence.add({ claim: 'unit test claim 3', conviction: 0.9, domain: 'testing' });
    fence.add({ claim: 'unit test claim 4', conviction: 0.6, domain: 'testing' });
    for (const t of fence.all) fence.resolve(t.id, { quality: 'correct' });
    const merged = syncTakesWithJournal(fence.all, journal);
    const profile = computeCalibrationProfile(merged);
    expect(profile.coldStart).toBe(false);
    const frameworkRow = profile.scorecards.find((s) => s.domain === 'framework')!;
    expect(frameworkRow.n).toBe(1);
    expect(frameworkRow.accuracy).toBe(1);
  });
});

describe('MCP framework-stats tool (blueprint §5.4)', () => {
  it('returns journal and trace stats after framework tool usage', async () => {
    const server = createServer();
    await tool(server, 'decide').handler({ model: 'pros-cons', pros: ['fast'], cons: ['risky'] });
    await tool(server, 'rca').handler({ problem: 'outage', evidenceFacts: ['timeout'] });
    const stats = (await tool(server, 'framework-stats').handler({})) as {
      journal: { total: number; usageByModel: { engine: string }[]; accuracyByModel: unknown[] };
      traces: { traceCount: number };
    };
    expect(stats.journal.total).toBe(2);
    expect(stats.journal.usageByModel.map((m) => m.engine)).toContain('pros-cons');
    expect(stats.traces.traceCount).toBeGreaterThanOrEqual(2);
  });

  it('omits trace stats when includeTraces is false', async () => {
    const server = createServer();
    const stats = (await tool(server, 'framework-stats').handler({ includeTraces: false })) as {
      journal: { total: number };
      traces?: unknown;
    };
    expect(stats.traces).toBeUndefined();
    expect(stats.journal.total).toBe(0);
  });
});
