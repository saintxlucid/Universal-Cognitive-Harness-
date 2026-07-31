import { describe, it, expect, beforeEach } from 'vitest';
import { UniversalCognitiveHarness } from '../universal-harness.js';
import { BiologicalFunctions } from '../biological-functions.js';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';

describe('UniversalCognitiveHarness — edge cases', () => {
  it('initializes with minimal config', () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'minimal',
      workspace_name: 'Minimal',
      workspace_root: '/tmp',
    });
    expect(harness.kernel).toBeTruthy();
    expect(harness.eventBus).toBeTruthy();
    expect(harness.bio).toBeTruthy();
    expect(harness.executive).toBeTruthy();
    expect(harness.workspace).toBeTruthy();
    expect(harness.cognitiveOrganism).toBeTruthy();
    expect(harness.stateVirtualization).toBeTruthy();
    expect(harness.eventLedger).toBeTruthy();
  });

  it('initializes with alternate agent/user IDs', () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'ws-custom',
      workspace_name: 'Custom',
      workspace_root: '/custom/path',
      agent_id: 'my-agent',
      user_id: 'my-user',
    });
    expect(harness.config.agent_id).toBe('my-agent');
    expect(harness.config.user_id).toBe('my-user');
  });

  it('handles start/stop idempotently', async () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'idempotent',
      workspace_name: 'Idempotent',
      workspace_root: '/tmp/idem',
    });
    // Start twice — should not crash
    await harness.start();
    await harness.start();
    expect(harness.kernel.getStats().sleep_active).toBe(true);
    // Stop twice — should not crash
    await harness.stop();
    await harness.stop();
    expect(harness.kernel.getStats().sleep_active).toBe(false);
  });

  it('publishes workspace events on start/stop', async () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'events-test',
      workspace_name: 'Events',
      workspace_root: '/tmp/events',
    });
    await harness.start();
    expect(harness.eventBus.getHistory('workspace:opened').length).toBe(1);
    await harness.stop();
    expect(harness.eventBus.getHistory('workspace:closed').length).toBe(1);
  });

  it('returns meaningful status values', async () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'status-test',
      workspace_name: 'Status Test',
      workspace_root: '/tmp/status',
    });
    const status = harness.getStatus();
    expect(status.version).toBe('0.1.0');
    expect(status.workspace).toBe('Status Test');
    expect(status.episodes).toBeTypeOf('number');
    expect(status.concepts).toBeTypeOf('number');
    expect(status.relationships).toBeTypeOf('number');
    expect(status.subscriptions).toBeGreaterThan(0);
    expect(Array.isArray(status.attached_agents)).toBe(true);
    expect(typeof status.sleep_active).toBe('boolean');
  });

  it('wires file events to memory', async () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'file-event',
      workspace_name: 'File Event Test',
      workspace_root: '/tmp/file-event',
    });
    await harness.eventBus.publish({
      type: 'file:saved',
      source: 'editor',
      payload: { path: 'src/index.ts' },
    });
    expect(harness.kernel.getStats().episodes).toBe(1);
  });

  it('wires error events to health tracking', async () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'error-track',
      workspace_name: 'Error Track',
      workspace_root: '/tmp/error',
    });
    await harness.eventBus.publish({
      type: 'error:occurred',
      source: 'runtime',
      payload: { message: 'Out of memory' },
    });
    expect(harness.workspace.health.getIncidents().length).toBe(1);
  });

  it('wires agent attachment/detachment to state virtualization', async () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'agent-lifecycle',
      workspace_name: 'Agent Lifecycle',
      workspace_root: '/tmp/agent',
    });
    await harness.eventBus.publish({
      type: 'agent:attached',
      source: 'codex',
      payload: { agent_id: 'codex-cli' },
    });
    expect(harness.stateVirtualization.getAttachedAgents()).toContain('codex-cli');
    await harness.eventBus.publish({
      type: 'agent:detached',
      source: 'codex',
      payload: { agent_id: 'codex-cli' },
    });
    expect(harness.stateVirtualization.getAttachedAgents()).not.toContain('codex-cli');
  });

  it('wires git commits to timeline', async () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'git-event',
      workspace_name: 'Git Event',
      workspace_root: '/tmp/git',
    });
    await harness.eventBus.publish({
      type: 'git:commit',
      source: 'git',
      payload: { message: 'feat: add login\n\nDetailed description' },
    });
    const commits = harness.workspace.timeline.getByType('commit');
    expect(commits.length).toBe(1);
    expect(commits[0]!.title).toBe('Commit: feat: add login');
  });

  it('publishes protocol handoffs for module communication', async () => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'protocol-test',
      workspace_name: 'Protocol',
      workspace_root: '/tmp/protocol',
    });
    const seen: string[] = [];
    harness.eventBus.subscribeToProtocol('memory:ingest', (event) => {
      seen.push(String(event.payload.observation ?? ''));
    });
    await harness.eventBus.publish({
      type: 'file:saved',
      source: 'editor',
      payload: { path: 'src/app.ts' },
    });
    expect(seen.some((m) => m.includes('File saved: src/app.ts'))).toBe(true);
  });
});

describe('BiologicalFunctions — edge cases', () => {
  let bio: BiologicalFunctions;

  beforeEach(() => {
    const harness = new UniversalCognitiveHarness({
      workspace_id: 'bio-edge',
      workspace_name: 'Bio Edge',
      workspace_root: '/tmp/bio-edge',
    });
    bio = harness.bio;
  });

  it('observe handles empty text gracefully', async () => {
    const result = await bio.observe({ text: '', type: 'observation' });
    expect(result.observation_id).toBeTruthy();
    expect(Array.isArray(result.concepts)).toBe(true);
  });

  it('observe handles missing text gracefully', async () => {
    const result = await bio.observe({ type: 'observation' });
    expect(result.observation_id).toBeTruthy();
  });

  it('understand handles empty string', async () => {
    const result = await bio.understand('');
    expect(result.concepts.length).toBeGreaterThan(0);
    expect(result.relationships).toBeTypeOf('number');
  });

  it('remember stores content', async () => {
    const result = await bio.remember({ content: 'Important fact' });
    expect(result.memory_id).toBeTruthy();
  });

  it('retrieve returns results for known content', async () => {
    await bio.remember({ content: 'TypeScript is great' });
    const result = await bio.retrieve('TypeScript');
    expect(result.count).toBeGreaterThan(0);
    expect(result.results).toBeTruthy();
  });

  it('retrieve handles missing content', async () => {
    const result = await bio.retrieve('XYZZYXNotPresent');
    expect(result.count).toBeGreaterThanOrEqual(0);
  });

  it('predict returns confidence values', async () => {
    const result = await bio.predict('future state');
    expect(result.prediction).toBeTruthy();
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  });

  it('plan creates plans with steps', async () => {
    const result = await bio.plan('Implement login');
    expect(result.plan_id).toBeTruthy();
    expect(result.steps).toBeTypeOf('number');
  });

  it('reflect returns a report with all sections', async () => {
    const result = await bio.reflect();
    expect(result.report).toContain('Episodes stored');
    expect(result.report).toContain('Concepts known');
    expect(result.report).toContain('Relationships tracked');
    expect(result.report).toContain('Beliefs held');
    expect(result.report).toContain('Sleep cycles completed');
  });

  it('learn creates beliefs', async () => {
    await bio.learn('The sky is blue', 'Observed on clear days');
    const beliefs = bio['kernel'].getBeliefs();
    expect(beliefs.propositions.size).toBe(1);
  });

  it('critique returns scores', async () => {
    const result = await bio.critique('Current architecture');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.issues).toBeTypeOf('number');
  });

  it('simulate returns possible outcomes', async () => {
    const result = await bio.simulate('Migrate to new framework');
    expect(result.simulation_id).toBeTruthy();
    expect(result.possible_outcomes.length).toBe(3);
    expect(result.possible_outcomes[0]).toContain('Best case');
    expect(result.possible_outcomes[1]).toContain('Expected');
    expect(result.possible_outcomes[2]).toContain('Worst case');
  });

  it('execute returns success', async () => {
    const result = await bio.execute('npm test');
    expect(result.success).toBe(true);
    expect(result.result).toContain('npm test');
  });

  it('verify handles known claims', async () => {
    await bio.learn('The sky is blue', 'Observed fact');
    const result = await bio.verify('The sky is blue');
    expect(result.verified).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
  });

  it('verify handles unknown claims gracefully', async () => {
    const result = await bio.verify('Something completly unknown_' + Date.now());
    expect(result.verified).toBe(true);
  });

  it('evolve returns mutations', async () => {
    const result = await bio.evolve();
    expect(result.mutations).toContain('confidence_calibration');
  });

  it('compress reduces memory footprint', async () => {
    const result = await bio.compress();
    expect(result.bytes_saved).toBeGreaterThanOrEqual(0);
  });

  it('consolidate runs sleep cycles', async () => {
    const result = await bio.consolidate();
    expect(result.cycles_run).toBeGreaterThanOrEqual(0);
  });
});
