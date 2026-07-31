import { describe, it, expect } from 'vitest';
import { compressContext } from '../query/compaction-engine.js';

describe('probe10', () => {
  it('no-ops when under budget', async () => {
    const messages = [
      { id: 'a', role: 'user' as const, content: [{ type: 'text' as const, text: 'hi' }], timestamp: '' },
      { id: 'b', role: 'assistant' as const, content: [{ type: 'text' as const, text: 'hello' }], timestamp: '' },
    ];
    const result = await compressContext(messages, { maxContextTokens: 100000, summarize: async (t) => t });
    expect(result.compactedMessages).toBe(0);
  });
});
