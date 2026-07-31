import { describe, it, expect } from 'vitest';
import { compressContext, truncateToolResultBlocks, findTurnBoundaries, chunkMessagesByTokens, createSummaryBoundaryMessage } from '../query/compaction-engine.js';
import type { Message } from '../types.js';

function textMessage(role: Message['role'], text: string): Message {
  return { id: `m-${Math.random().toString(36).slice(2)}`, role, content: [{ type: 'text', text }], timestamp: '' };
}

function toolResultMessage(content: string): Message {
  return {
    id: `tr-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: [{ type: 'tool_result', toolUseId: 'tu-1', content }],
    timestamp: '',
  };
}

function buildConversation(turns: number, turnSize = 2000): Message[] {
  const messages: Message[] = [];
  for (let i = 0; i < turns; i++) {
    messages.push(textMessage('user', `task ${i} ${'x'.repeat(turnSize)}`));
    messages.push(textMessage('assistant', `answer ${i} ${'x'.repeat(turnSize)}`));
  }
  return messages;
}

describe('findTurnBoundaries', () => {
  it('protects first and last assistant turns', () => {
    const messages = buildConversation(6, 10);
    const { firstBoundary, lastBoundary } = findTurnBoundaries(messages);
    expect(firstBoundary).toBe(3);
    expect(lastBoundary).toBe(9);
  });
});

describe('truncateToolResultBlocks', () => {
  it('truncates oversized tool results with a marker', () => {
    const message = toolResultMessage('y'.repeat(100));
    const { messages, truncated } = truncateToolResultBlocks([message], 50);
    expect(truncated).toBe(1);
    const block = (messages[0] as Message).content[0];
    expect(block.type === 'tool_result' && block.content).toContain('[truncated: 100 chars]');
  });

  it('leaves small results untouched', () => {
    const message = toolResultMessage('small');
    const { messages, truncated } = truncateToolResultBlocks([message], 50);
    expect(truncated).toBe(0);
    expect(messages[0]).toBe(message);
  });
});

describe('chunkMessagesByTokens', () => {
  it('splits into budgeted chunks', () => {
    const messages = Array.from({ length: 10 }, () => textMessage('user', 'x'.repeat(400)));
    const chunks = chunkMessagesByTokens(messages, 300);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.flat().length).toBe(10);
  });
});

describe('compressContext', () => {
  it('no-ops when under budget', async () => {
    const messages = [textMessage('user', 'hi'), textMessage('assistant', 'hello')];
    const result = await compressContext(messages, {
      messages,
      maxContextTokens: 100000,
      summarize: async (t) => t,
    });
    expect(result.compactedMessages).toBe(0);
    expect(result.truncatedToolResults).toBe(0);
    expect(result.boundaryMessage).toBeNull();
    expect(result.messages).toHaveLength(2);
  });

  it('prunes oversized tool results first', async () => {
    const messages = [
      textMessage('user', 'start'),
      textMessage('assistant', 'plan'),
      toolResultMessage('z'.repeat(20000)),
      textMessage('user', 'next'),
      textMessage('assistant', 'done'),
    ];
    const result = await compressContext(messages, {
      maxContextTokens: 500,
      summarize: async (t) => `SUMMARY ${t.slice(0, 20)}`,
      maxToolResultChars: 1000,
    });
    expect(result.truncatedToolResults).toBe(1);
  });

  it('summarizes the middle and keeps boundaries', async () => {
    const messages = buildConversation(10, 4000);
    const result = await compressContext(messages, {
      maxContextTokens: 4000,
      summarize: async (text) => `SUMMARY: ${text.slice(0, 60)}`,
    });
    expect(result.summary).toContain('SUMMARY:');
    expect(result.compactedMessages).toBeGreaterThan(0);
    expect(result.messages[0]?.id).toBe(messages[0]?.id);
    expect(result.messages.at(-1)?.id).toBe(messages.at(-1)?.id);
  });

  it('retries failed summarization with backoff', async () => {
    const messages = buildConversation(10, 4000);
    let calls = 0;
    const result = await compressContext(messages, {
      maxContextTokens: 4000,
      summarize: async (text) => {
        calls++;
        if (calls === 1) throw new Error('transient');
        return `OK ${text.slice(0, 20)}`;
      },
    });
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(result.summary).toContain('OK');
  });

  it('creates summary boundary message with metadata', () => {
    const boundary = createSummaryBoundaryMessage('the summary');
    expect(boundary.metadata?.summary).toBe(true);
    expect(boundary.content[0]).toMatchObject({ type: 'text' });
  });
});
