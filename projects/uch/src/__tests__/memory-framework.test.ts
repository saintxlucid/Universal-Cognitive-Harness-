import { describe, it, expect } from 'vitest';
import { CognitiveMemorySystem } from '../kernel/memory/cognitive-memory-system.js';

describe('CognitiveMemorySystem', () => {
  it('preserves contextualized observations for later recall', async () => {
    const memory = new CognitiveMemorySystem({
      agent_id: 'agent-1',
      user_id: 'user-1',
      project_id: 'project-1',
    });

    await memory.ingestObservation('Deployment failed during rollout', {
      importance: 0.9,
      tags: ['deployment', 'failure'],
      context: 'The release pipeline was under pressure and the rollback path was not rehearsed',
    });

    const recalled = await memory.recall('release pipeline rollback', { limit: 5 });

    expect(recalled.length).toBeGreaterThan(0);
    expect(recalled.some((item) => item.content.includes('release pipeline'))).toBe(true);
  });

  it('profiles memory with tag coverage and lessons', async () => {
    const memory = new CognitiveMemorySystem({
      agent_id: 'agent-2',
      user_id: 'user-2',
      project_id: 'project-2',
    });

    await memory.ingestObservation('Canary release tripped a timeout', {
      importance: 0.85,
      tags: ['release', 'stability'],
      context: 'The canary observed elevated latency during a peak traffic window',
    });
    await memory.learnFromOutcome('canary timeout during peak load', 'failure', -0.9);

    const profile = memory.getMemoryProfile();

    expect(profile.tagCoverage).toContain('release');
    expect(profile.lessons.length).toBeGreaterThan(0);
    expect(profile.recallReadiness).toBeGreaterThan(0.5);
  });

  it('produces a human-readable memory summary for operators', async () => {
    const memory = new CognitiveMemorySystem({
      agent_id: 'agent-3',
      user_id: 'user-3',
      project_id: 'project-3',
    });

    await memory.ingestObservation('Background worker latency regressed', {
      importance: 0.8,
      tags: ['reliability'],
      context: 'The worker queue backlog grew during the last rollout',
    });

    const summary = memory.summarizeMemory();

    expect(summary).toContain('reliability');
    expect(summary).toContain('working');
  });
});
