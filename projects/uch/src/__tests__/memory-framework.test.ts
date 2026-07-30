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
});
