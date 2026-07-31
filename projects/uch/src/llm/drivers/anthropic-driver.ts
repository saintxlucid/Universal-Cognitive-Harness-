import { AnthropicProvider } from '../anthropic-provider.js';
import type { CompletionParams, LLMDriver } from './driver.js';

export interface AnthropicDriverConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
}

export class AnthropicDriver implements LLMDriver {
  readonly providerName = 'anthropic';
  readonly modelName: string;
  private provider: AnthropicProvider;
  private maxTokens: number;

  constructor(config: AnthropicDriverConfig) {
    this.modelName = config.model;
    this.maxTokens = config.maxTokens ?? 4096;
    this.provider = new AnthropicProvider(config.apiKey);
  }

  get isAvailable(): boolean {
    return this.provider.isAvailable;
  }

  private mapMessages(params: CompletionParams) {
    const system = params.messages.find((m) => m.role === 'system')?.content;
    const messages = params.messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
    return { system, messages };
  }

  async complete(params: CompletionParams): Promise<string> {
    const { system, messages } = this.mapMessages(params);
    return this.provider.complete(params.model ?? this.modelName, {
      messages,
      system,
      temperature: params.temperature,
      maxTokens: params.maxTokens ?? this.maxTokens,
    });
  }

  async *completeStream(params: CompletionParams): AsyncGenerator<string> {
    const { system, messages } = this.mapMessages(params);
    for await (const text of this.provider.completeStream(params.model ?? this.modelName, {
      messages,
      system,
      temperature: params.temperature,
      maxTokens: params.maxTokens ?? this.maxTokens,
      stream: true,
    })) {
      yield text;
    }
  }

  async completeMultiModal(params: CompletionParams & { images?: string[] }): Promise<string> {
    const { system } = this.mapMessages(params);
    const textMsg = params.messages.find((m) => m.role === 'user');
    const content: { type: string; text?: string; source?: { type: string; media_type: string; data: string } }[] = [];
    if (textMsg) content.push({ type: 'text', text: textMsg.content });
    for (const img of params.images ?? []) {
      const base64 = img.startsWith('data:') ? img.split(',')[1] ?? img : img;
      content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } });
    }
    return this.provider.complete(this.modelName, {
      messages: [{ role: 'user', content: content as unknown as string }],
      system,
      temperature: params.temperature,
      maxTokens: params.maxTokens ?? this.maxTokens,
    });
  }
}
