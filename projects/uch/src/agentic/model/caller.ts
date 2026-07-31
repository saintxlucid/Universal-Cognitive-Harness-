import type { Message, ModelCallResult, MessageUsage } from '../types.js';
import { renderMessagesAsText } from '../context/prompt-builder.js';
import { parseToolCallsFromText } from './tool-parser.js';
import { LLMClient } from '../../llm/provider.js';

export interface ModelCaller {
  call(messages: Message[], options: ModelCallOptions): Promise<ModelCallResult>;
  readonly modelName: string;
  readonly available: boolean;
}

export interface ModelCallOptions {
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

const EMPTY_USAGE: MessageUsage = { inputTokens: 0, outputTokens: 0 };

export class LLMClientAdapter implements ModelCaller {
  readonly modelName: string;
  private readonly llm: LLMClient;
  private readonly baseSystemPrompt?: string;

  constructor(llm: LLMClient, options?: { model?: string; systemPrompt?: string }) {
    this.llm = llm;
    this.modelName = options?.model ?? llm.modelName;
    this.baseSystemPrompt = options?.systemPrompt;
  }

  get available(): boolean {
    return this.llm.isAvailable;
  }

  async call(messages: Message[], options: ModelCallOptions): Promise<ModelCallResult> {
    const systemPrompt = options.systemPrompt ?? this.baseSystemPrompt;
    const transcript = renderMessagesAsText(messages);
    const promptMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [];
    if (systemPrompt) {
      promptMessages.push({ role: 'system', content: systemPrompt });
    }
    promptMessages.push({ role: 'user', content: transcript });

    const stream = this.llm.completeStream({
      messages: promptMessages,
      maxTokens: options.maxTokens ?? 8192,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });

    let text = '';
    for await (const chunk of stream) {
      if (options.signal?.aborted) break;
      text += chunk;
    }

    if (options.signal?.aborted) {
      throw new DOMException('Model call aborted', 'AbortError');
    }

    const toolCalls = parseToolCallsFromText(text);
    const cleanText = stripToolCallsFromText(text);
    return {
      text: cleanText,
      toolCalls,
      usage: EMPTY_USAGE,
      stopReason: toolCalls.length > 0 ? 'tool_use' : 'end_turn',
    };
  }
}

export function stripToolCallsFromText(text: string): string {
  return text
    .replace(/<tool_call[\s\S]*?<\/tool_call>/g, '')
    .replace(/<tool_call[\s\S]*?\/>/g, '')
    .trim();
}
