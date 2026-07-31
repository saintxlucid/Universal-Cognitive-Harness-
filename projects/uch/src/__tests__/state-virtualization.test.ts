import { describe, it, expect, beforeEach } from 'vitest';
import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { CognitiveKernel } from '../kernel/cognitive-kernel.js';
import { WorkspaceBrain } from '../workspace-brain/workspace-brain.js';
import { ExecutiveBrain } from '../executive-brain/executive-brain.js';
import { StateVirtualization } from '../state-virtualization/state-virtualization.js';

function createTestEnv() {
  const eventBus = new NeuralEventBus();
  const kernel = new CognitiveKernel({ agent_id: 'test', user_id: 'user', project_id: 'proj' });
  const workspace = new WorkspaceBrain({
    workspace_id: 'ws1', name: 'Test', root_path: '/test', eventBus,
  });
  const executive = new ExecutiveBrain({ eventBus });
  return { eventBus, kernel, workspace, executive };
}

describe('StateVirtualization', () => {
  let sv: StateVirtualization;

  beforeEach(() => {
    const env = createTestEnv();
    sv = new StateVirtualization(env);
  });

  it('starts with no agents', () => {
    expect(sv.getAttachedAgents()).toEqual([]);
  });

  it('attaches agents', () => {
    sv.attachAgent('agent-1', { type: 'cli', capabilities: ['read', 'write'] });
    expect(sv.getAttachedAgents()).toEqual(['agent-1']);
    const info = sv.getAgentInfo('agent-1');
    expect(info?.agent_type).toBe('cli');
    expect(info?.capabilities).toEqual(['read', 'write']);
  });

  it('detaches agents', () => {
    sv.attachAgent('agent-1');
    sv.detachAgent('agent-1');
    expect(sv.getAttachedAgents()).toEqual([]);
  });

  it('manages shared state', () => {
    sv.setSharedState('theme', 'dark');
    sv.setSharedState('count', 42);
    expect(sv.getSharedState('theme')).toBe('dark');
    expect(sv.getSharedState('count')).toBe(42);
    expect(sv.getSharedState('missing')).toBeUndefined();
  });

  it('captures cognitive snapshots', async () => {
    const env = createTestEnv();
    const sv2 = new StateVirtualization(env);
    sv2.attachAgent('a1');
    await env.kernel.remember({ content: { type: 'text', text: 'hello' }, concepts: [] });

    const snap = sv2.snapshot();
    expect(snap.episodes_count).toBe(1);
    expect(snap.attached_agents).toEqual(['a1']);
    expect(snap.health_status).toBe('healthy');
  });

  it('retrieves recent snapshots', () => {
    sv.snapshot();
    sv.snapshot();
    expect(sv.getSnapshots(1).length).toBe(1);
    expect(sv.getSnapshots(10).length).toBe(2);
  });

  it('generates state summary', async () => {
    const env = createTestEnv();
    const sv2 = new StateVirtualization(env);
    sv2.attachAgent('cli-1');
    const summary = sv2.getStateSummary();
    expect(summary).toContain('Cognitive State');
    expect(summary).toContain('cli-1');
  });
});
