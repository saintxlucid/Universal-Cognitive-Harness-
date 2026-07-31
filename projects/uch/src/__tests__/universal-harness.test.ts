import { describe, it, expect, beforeEach } from 'vitest';
import { UniversalCognitiveHarness } from '../harness-api/universal-harness.js';

describe('UniversalCognitiveHarness', () => {
  let harness: UniversalCognitiveHarness;

  beforeEach(() => {
    harness = new UniversalCognitiveHarness({
      workspace_id: 'ws1',
      workspace_name: 'My Project',
      workspace_root: '/path/to/project',
      agent_id: 'uch-test',
    });
  });

  it('initializes all subsystems', () => {
    expect(harness.kernel).toBeTruthy();
    expect(harness.workspace).toBeTruthy();
    expect(harness.executive).toBeTruthy();
    expect(harness.bio).toBeTruthy();
    expect(harness.stateVirtualization).toBeTruthy();
    expect(harness.eventBus).toBeTruthy();
  });

  it('starts and stops the sleep cycle', async () => {
    await harness.start();
    expect(harness.kernel.getStats().sleep_active).toBe(true);
    await harness.stop();
    expect(harness.kernel.getStats().sleep_active).toBe(false);
  });

  it('publishes workspace events on start/stop', async () => {
    await harness.start();
    expect(harness.eventBus.getHistory('workspace:opened').length).toBe(1);
    await harness.stop();
    expect(harness.eventBus.getHistory('workspace:closed').length).toBe(1);
  });

  it('returns status', async () => {
    await harness.start();
    const status = harness.getStatus();
    expect(status.workspace).toBe('My Project');
    expect(status.version).toBe('0.1.0');
    expect(status.health).toBe('healthy');
    expect(status.subscriptions).toBeGreaterThan(0);
    expect(status.sleep_active).toBe(true);
    await harness.stop();
  });

  it('processes file events through event bus', async () => {
    await harness.eventBus.publish({
      type: 'file:saved',
      source: 'editor',
      payload: { path: 'src/app.ts' },
    });
    expect(harness.kernel.getStats().episodes).toBe(1);
  });

  it('publishes protocol handoffs for coordinated module communication', async () => {
    const seen: string[] = [];
    harness.eventBus.subscribeToProtocol('memory:ingest', (event) => {
      seen.push(String(event.payload.observation ?? ''));
    });

    await harness.eventBus.publish({
      type: 'file:saved',
      source: 'editor',
      payload: { path: 'src/app.ts' },
    });

    expect(seen.some((message) => message.includes('File saved: src/app.ts'))).toBe(true);
  });

  it('processes error events through health tracking', async () => {
    await harness.eventBus.publish({
      type: 'error:occurred',
      source: 'runtime',
      payload: { message: 'TypeError: undefined is not a function' },
    });
    const incidents = harness.workspace.health.getIncidents();
    expect(incidents.length).toBe(1);
    expect(incidents[0]).toContain('TypeError');
  });

  it('processes agent attachment through state virtualization', async () => {
    await harness.eventBus.publish({
      type: 'agent:attached',
      source: 'codex',
      payload: { agent_id: 'codex-cli', type: 'cli' },
    });
    expect(harness.stateVirtualization.getAttachedAgents()).toContain('codex-cli');
  });

  it('processes agent detachment through state virtualization', async () => {
    await harness.eventBus.publish({
      type: 'agent:attached',
      source: 'test-agent',
      payload: { agent_id: 'test-agent' },
    });
    await harness.eventBus.publish({
      type: 'agent:detached',
      source: 'test-agent',
      payload: { agent_id: 'test-agent' },
    });
    expect(harness.stateVirtualization.getAttachedAgents()).not.toContain('test-agent');
  });

  it('processes git commits through timeline', async () => {
    await harness.eventBus.publish({
      type: 'git:commit',
      source: 'git',
      payload: { message: 'feat: add login', hash: 'abc123' },
    });
    expect(harness.workspace.timeline.getEventCount()).toBe(1);
    expect(harness.workspace.timeline.getByType('commit')[0]!.title).toBe(
      'Commit: feat: add login',
    );
  });
});

describe('BiologicalFunctions', () => {
  let harness: UniversalCognitiveHarness;

  beforeEach(() => {
    harness = new UniversalCognitiveHarness({
      workspace_id: 'bio-test',
      workspace_name: 'Bio Test',
      workspace_root: '/test',
    });
  });

  it('observes and stores episodes', async () => {
    const result = await harness.bio.observe({
      text: 'User opened settings panel',
      type: 'observation',
    });
    expect(result.observation_id).toBeTruthy();
    expect(harness.kernel.getStats().episodes).toBeGreaterThan(0);
  });

  it('understands text and creates concepts', async () => {
    const result = await harness.bio.understand('The authentication module uses JWT tokens');
    expect(result.concepts.length).toBeGreaterThan(0);
  });

  it('remembers memories', async () => {
    const result = await harness.bio.remember({
      content: 'Important fact: the API key is in .env',
      importance: 0.9,
    });
    expect(result.memory_id).toBeTruthy();
    expect(harness.kernel.getStats().episodes).toBe(1);
  });

  it('retrieves context', async () => {
    await harness.kernel.remember({
      content: { type: 'text', text: 'TypeScript is typed' },
      concepts: [],
    });
    const result = await harness.bio.retrieve('TypeScript');
    expect(result.count).toBeGreaterThan(0);
  });

  it('makes predictions based on neuromodulation', async () => {
    const result = await harness.bio.predict('learning new patterns');
    expect(result.prediction).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('plans goals', async () => {
    const result = await harness.bio.plan('Implement search feature');
    expect(result.plan_id).toBeTruthy();
    expect(result.steps).toBe(0);
  });

  it('reflects on current state', async () => {
    const result = await harness.bio.reflect();
    expect(result.report).toContain('Episodes stored');
    expect(result.report).toContain('Concepts known');
  });

  it('learns from evidence', async () => {
    await harness.bio.learn(
      'TypeScript is safer than JavaScript',
      'Type checking prevents runtime errors',
    );
    const beliefs = harness.kernel.getBeliefs();
    expect(beliefs.propositions.size).toBe(1);
  });

  it('critiques targets', async () => {
    const result = await harness.bio.critique('Current codebase structure');
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('simulates scenarios', async () => {
    const result = await harness.bio.simulate('What if we switch to Bun?');
    expect(result.simulation_id).toBeTruthy();
    expect(result.possible_outcomes.length).toBeGreaterThan(0);
  });

  it('executes actions', async () => {
    const result = await harness.bio.execute('npm run build');
    expect(result.success).toBe(true);
  });

  it('verifies claims', async () => {
    const result = await harness.bio.verify('The application builds successfully');
    expect(result.verified).toBe(true);
  });

  it('consolidates memory through sleep cycle', async () => {
    const result = await harness.bio.consolidate();
    expect(result.cycles_run).toBeGreaterThan(0);
  });

  it('sleeps and consolidates', async () => {
    const result = await harness.bio.sleep(1000);
    expect(result.slept_ms).toBeGreaterThanOrEqual(0);
  });

  it('evolves by reporting mutations', async () => {
    const result = await harness.bio.evolve();
    expect(result.mutations).toContain('confidence_calibration');
  });
});
