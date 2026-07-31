import type { Message } from '../types.js';
import { estimateMessageTokens, estimateTokensApprox } from '../context/compaction.js';

export interface CompressOptions {
  maxContextTokens: number;
  summarize: (text: string) => Promise<string>;
  protectFirstTurns?: number;
  protectLastTurns?: number;
  safetyMargin?: number;
  maxToolResultChars?: number;
  chunkSizeTokens?: number;
  maxSummaryRetries?: number;
  estimateTokens?: (messages: Message[]) => number;
}

export interface CompressResult {
  messages: Message[];
  summary: string;
  compactedMessages: number;
  truncatedToolResults: number;
  boundaryMessage: Message | null;
  protectedFirst: number;
  protectedLast: number;
}

export const DEFAULT_COMPRESS_OPTIONS = {
  protectFirstTurns: 2,
  protectLastTurns: 2,
  safetyMargin: 0.2,
  maxToolResultChars: 4000,
  chunkSizeTokens: 8000,
  maxSummaryRetries: 2,
};

export function findTurnBoundaries(messages: Message[]): { firstBoundary: number; lastBoundary: number } {
  let assistantCount = 0;
  let firstBoundary = -1;
  for (let i = 0; i < messages.length; i++) {
    if ((messages[i] as Message).role === 'assistant') {
      assistantCount++;
      if (assistantCount >= 2) {
        firstBoundary = i;
        break;
      }
    }
  }
  let lastAssistantCount = 0;
  let lastBoundary = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    if ((messages[i] as Message).role === 'assistant') {
      lastAssistantCount++;
      if (lastAssistantCount >= 2) {
        lastBoundary = i;
        break;
      }
    }
  }
  if (firstBoundary === -1) firstBoundary = messages.length;
  return { firstBoundary, lastBoundary };
}

export function truncateToolResultBlocks(messages: Message[], maxChars: number): { messages: Message[]; truncated: number } {
  let truncated = 0;
  const updated = messages.map((message) => {
    if (!message.content.some((block) => block.type === 'tool_result')) return message;
    let changed = false;
    const content = message.content.map((block) => {
      if (block.type !== 'tool_result') return block;
      if (block.content.length > maxChars) {
        changed = true;
        truncated++;
        return {
          ...block,
          content: `${block.content.slice(0, maxChars)}\n[truncated: ${block.content.length} chars]`,
        };
      }
      return block;
    });
    if (!changed) return message;
    return { ...message, content, metadata: { ...(message.metadata ?? {}), truncatedToolResult: true } };
  });
  return { messages: updated, truncated };
}

export function chunkMessagesByTokens(messages: Message[], chunkSizeTokens: number): Message[][] {
  const chunks: Message[][] = [];
  let current: Message[] = [];
  let currentTokens = 0;
  for (const message of messages) {
    const tokens = estimateMessageTokens(message);
    if (current.length > 0 && currentTokens + tokens > chunkSizeTokens) {
      chunks.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(message);
    currentTokens += tokens;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function serializeMessagesForSummary(messages: Message[]): string {
  return messages
    .map((message) => {
      const body = message.content
        .map((block) => {
          if (block.type === 'text') return block.text;
          if (block.type === 'tool_use') return `[tool_use: ${block.name} ${JSON.stringify(block.input)}]`;
          if (block.type === 'tool_result') return `[tool_result] ${block.content.slice(0, 800)}`;
          return '';
        })
        .join('\n');
      return `${message.role}: ${body.slice(0, 3000)}`;
    })
    .join('\n\n');
}

export async function summarizeChunkWithRetry(
  messages: Message[],
  summarize: (text: string) => Promise<string>,
  maxRetries = DEFAULT_COMPRESS_OPTIONS.maxSummaryRetries,
): Promise<string> {
  const text = serializeMessagesForSummary(messages);
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await summarize(text);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await sleep(100 * (attempt + 1));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createSummaryBoundaryMessage(summary: string): Message {
  return {
    id: `summary-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role: 'assistant',
    content: [{ type: 'text', text: `[Previous conversation summarized]\n${summary}` }],
    timestamp: new Date().toISOString(),
    metadata: { summary: true },
  };
}

export async function compressContext(messages: Message[], options: CompressOptions): Promise<CompressResult> {
  const estimate = options.estimateTokens ?? estimateTokensApprox;
  const budget = options.maxContextTokens * (1 - (options.safetyMargin ?? DEFAULT_COMPRESS_OPTIONS.safetyMargin));
  const maxToolResultChars = options.maxToolResultChars ?? DEFAULT_COMPRESS_OPTIONS.maxToolResultChars;

  const initial = estimate(messages);
  if (initial <= budget) {
    return {
      messages,
      summary: '',
      compactedMessages: 0,
      truncatedToolResults: 0,
      boundaryMessage: null,
      protectedFirst: 0,
      protectedLast: 0,
    };
  }

  const { messages: pruned, truncated } = truncateToolResultBlocks(messages, maxToolResultChars);
  const { firstBoundary, lastBoundary } = findTurnBoundaries(pruned);
  const protectedFirst = firstBoundary > 0 ? firstBoundary : 0;
  const protectedLast = lastBoundary < pruned.length ? pruned.length - lastBoundary : 0;

  let trimmed = pruned;
  let summary = '';
  let compacted = 0;
  const middle = pruned.slice(firstBoundary, lastBoundary);
  if (estimate(pruned) > budget && middle.length > 0) {
    const chunks = chunkMessagesByTokens(middle, options.chunkSizeTokens ?? DEFAULT_COMPRESS_OPTIONS.chunkSizeTokens);
    const summaries: string[] = [];
    for (const chunk of chunks) {
      summaries.push(await summarizeChunkWithRetry(chunk, options.summarize, options.maxSummaryRetries));
      compacted += chunk.length;
    }
    summary = summaries.join('\n\n');
    const boundary = createSummaryBoundaryMessage(summary);
    trimmed = pruned.slice(0, firstBoundary).concat([boundary], pruned.slice(lastBoundary));
  }

  return {
    messages: trimmed,
    summary,
    compactedMessages: compacted,
    truncatedToolResults: truncated,
    boundaryMessage: summary ? trimmed.find((m) => m.metadata?.summary === true) ?? null : null,
    protectedFirst,
    protectedLast,
  };
}
