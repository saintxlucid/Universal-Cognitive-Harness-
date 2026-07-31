import { describe, it, expect } from 'vitest';
import { shouldAutoCompact, selectCompactionCandidates, compactConversation, estimateTokensApprox, estimateMessageTokens, mergeUsage } from '../context/compaction.js';
import type { Message } from '../types.js';

function textMessage(role: Message['role'], text: string): Message {
  return { id: `m-${Math.random().toString(36).slice(2)}`, role, content: [{ type: 'text', text }], timestamp: '' };
}

describe('token estimation', () => {
  it('estimates tokens from characters', () => {
    expect(estimateMessageTokens(textMessage('user', 'x'.repeat(400)))).toBe(100);
    expect(estimateTokensApprox([textMessage('user', 'x'.repeat(400))])).toBe(100);
  });
});

describe('auto-compact trigger', () => {
  it('triggers above threshold ratio', () => {
    const messages = Array.from({ length: 9 }, () => textMessage('user', 'x'.repeat(40000)));
    expect(shouldAutoCompact(messages, 100000)).toBe(true);
    expect(shouldAutoCompact(messages, 1000000)).toBe(false);
  });

  it('requires a minimum message count', () => {
    const messages = [textMessage('user', 'x'.repeat(200000))];
    expect(shouldAutoCompact(messages, 100000)).toBe(false);
    expect(shouldAutoCompact(messages, 100000, { minMessages: 1 })).toBe(true);
  });

  it('uses custom estimator', () => {
    const messages = [textMessage('user', 'short')];
    expect(shouldAutoCompact(messages, 100, { minMessages: 1, estimateTokens: () => 1000 })).toBe(true);
  });
});

describe('compaction candidates', () => {
  it('keeps recent messages within budget', () => {
    const messages = [
      textMessage('user', 'old context '.repeat(1000)),
      textMessage('user', 'newer context '.repeat(1000)),
      textMessage('assistant', 'recent answer'),
    ];
    const { toCompact, toKeep } = selectCompactionCandidates(messages, 2000);
    expect(toCompact.length).toBeGreaterThan(0);
    expect(toKeep.length).toBeGreaterThan(0);
    expect(toKeep[toKeep.length - 1]?.content[0]).toEqual(messages[2]?.content[0]);
  });

  it('keeps everything when under budget', () => {
    const messages = [textMessage('user', 'small'), textMessage('assistant', 'tiny')];
    const { toCompact, toKeep } = selectCompactionCandidates(messages, 100000);
    expect(toCompact).toEqual([]);
    expect(toKeep).toHaveLength(2);
  });
});

describe('compactConversation', () => {
  it('produces a boundary message', async () => {
    const messages = [
      textMessage('user', 'a'.repeat(2000)),
      textMessage('assistant', 'b'.repeat(2000)),
      textMessage('user', 'c'.repeat(2000)),
    ];
    const result = await compactConversation({
      messages,
      maxContextTokens: 1000,
      summarize: async (text) => `SUMMARY: ${text.slice(0, 50)}`,
    });
    expect(result.compactedMessages).toBeGreaterThan(0);
    expect(result.boundaryMessage).not.toBeNull();
    expect(result.messages[0]?.content[0]?.type).toBe('text');
    expect(result.summary).toContain('SUMMARY:');
  });

  it('no-ops when under budget', async () => {
    const messages = [textMessage('user', 'hello')];
    const result = await compactConversation({
      messages,
      maxContextTokens: 100000,
      summarize: async (t) => t,
    });
    expect(result.compactedMessages).toBe(0);
    expect(result.boundaryMessage).toBeNull();
    expect(result.messages).toHaveLength(1);
  });
});

describe('usage merging', () => {
  it('sums usage fields', () => {
    const merged = mergeUsage(
      { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 5 },
      { inputTokens: 30, outputTokens: 40, cacheCreationInputTokens: 7 },
    );
    expect(merged.inputTokens).toBe(40);
    expect(merged.outputTokens).toBe(60);
    expect(merged.cacheReadInputTokens).toBe(5);
    expect(merged.cacheCreationInputTokens).toBe(7);
  });
});
