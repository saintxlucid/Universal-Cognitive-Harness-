import type { Message, MessageUsage } from '../types.js';

export interface CompactResult {
  messages: Message[];
  summary: string;
  boundaryMessage: Message | null;
  compactedMessages: number;
}

export interface AutoCompactOptions {
  thresholdRatio?: number;
  minMessages?: number;
  maxContextTokens?: number;
  estimateTokens?: (messages: Message[]) => number;
}

export const DEFAULT_AUTO_COMPACT_OPTIONS: Required<Omit<AutoCompactOptions, 'estimateTokens'>> = {
  thresholdRatio: 0.9,
  minMessages: 8,
  maxContextTokens: 200000,
};

export function estimateTokensApprox(messages: Message[]): number {
  let chars = 0;
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'text') chars += block.text.length;
      else if (block.type === 'tool_result') chars += block.content.length;
      else if (block.type === 'tool_use') chars += JSON.stringify(block.input).length;
    }
  }
  return Math.ceil(chars / 4);
}

export function estimateMessageTokens(message: Message): number {
  let chars = 0;
  for (const block of message.content) {
    if (block.type === 'text') chars += block.text.length;
    else if (block.type === 'tool_result') chars += block.content.length;
    else if (block.type === 'tool_use') chars += JSON.stringify(block.input).length;
  }
  return Math.ceil(chars / 4);
}

export function shouldAutoCompact(
  messages: Message[],
  maxContextTokens: number,
  options: AutoCompactOptions = {},
): boolean {
  const ratio = options.thresholdRatio ?? DEFAULT_AUTO_COMPACT_OPTIONS.thresholdRatio;
  const minMessages = options.minMessages ?? DEFAULT_AUTO_COMPACT_OPTIONS.minMessages;
  if (messages.length < minMessages) return false;
  const estimate = options.estimateTokens ? options.estimateTokens(messages) : estimateChars(messages);
  return estimate >= maxContextTokens * ratio;
}

function estimateChars(messages: Message[]): number {
  let chars = 0;
  for (const message of messages) {
    for (const block of message.content) {
      if (block.type === 'text') chars += block.text.length;
      else if (block.type === 'tool_result') chars += block.content.length;
      else if (block.type === 'tool_use') chars += JSON.stringify(block.input).length;
    }
  }
  return chars;
}

export interface CompactionCandidates {
  toCompact: Message[];
  toKeep: Message[];
}

export function selectCompactionCandidates(messages: Message[], maxContextTokens: number): CompactionCandidates {
  let tokens = 0;
  const toKeep: Message[] = [];
  const toCompact: Message[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i] as Message;
    const tokensForMessage = estimateMessageTokens(message);
    if (tokens + tokensForMessage <= maxContextTokens) {
      toKeep.unshift(message);
      tokens += tokensForMessage;
    } else {
      toCompact.unshift(message);
    }
  }
  return { toCompact, toKeep };
}

export async function summarizeMessages(
  messages: Message[],
  summarize: (text: string) => Promise<string>,
): Promise<string> {
  const text = messages
    .map((m) => {
      const body = m.content
        .map((b) => (b.type === 'text' ? b.text : b.type === 'tool_result' ? b.content : ''))
        .join('\n');
      return `${m.role}: ${body.slice(0, 2000)}`;
    })
    .join('\n\n');
  return summarize(`Summarize the key facts, decisions, and state from this conversation excerpt:\n\n${text}`);
}

export async function compactConversation(options: {
  messages: Message[];
  maxContextTokens: number;
  summarize: (text: string) => Promise<string>;
  compactOptions?: AutoCompactOptions;
}): Promise<CompactResult> {
  const { messages, maxContextTokens, summarize } = options;
  const candidates = selectCompactionCandidates(messages, maxContextTokens);
  if (candidates.toCompact.length === 0) {
    return {
      messages,
      summary: '',
      boundaryMessage: null,
      compactedMessages: 0,
    };
  }
  const summary = await summarizeMessages(candidates.toCompact, summarize);
  const boundaryMessage: Message = {
    id: `compact-${Date.now()}`,
    role: 'assistant',
    content: [{ type: 'text', text: `[Previous conversation summarized]\n${summary}` }],
    timestamp: new Date().toISOString(),
  };
  return {
    messages: [boundaryMessage, ...candidates.toKeep],
    summary,
    boundaryMessage,
    compactedMessages: candidates.toCompact.length,
  };
}

export function getTokenEstimateForUsage(usage: MessageUsage): number {
  return usage.inputTokens + usage.outputTokens + (usage.cacheReadInputTokens ?? 0);
}

export function mergeUsage(a: MessageUsage, b: MessageUsage): MessageUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadInputTokens: (a.cacheReadInputTokens ?? 0) + (b.cacheReadInputTokens ?? 0),
    cacheCreationInputTokens: (a.cacheCreationInputTokens ?? 0) + (b.cacheCreationInputTokens ?? 0),
  };
}
