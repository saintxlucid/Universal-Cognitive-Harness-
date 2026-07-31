import OpenAI from 'openai';
import type { CompletionParams, EmbeddingParams, LLMDriver } from './driver.js';

export interface OpenAIDriverConfig {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  baseURL?: string;
  maxTokens?: number;
}

export class OpenAIDriver implements LLMDriver {
  readonly providerName = 'openai';
  readonly modelName: string;
  private openai: OpenAI;
  private embeddingModel: string;
  private maxTokens: number;

  constructor(config: OpenAIDriverConfig) {
    this.modelName = config.model;
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-3-small';
    this.maxTokens = config.maxTokens ?? 4096;
    const clientConfig: Record<string, unknown> = { apiKey: config.apiKey };
    if (config.baseURL) clientConfig.baseURL = config.baseURL;
    this.openai = new OpenAI(clientConfig as Record<string, string>);
  }

  get isAvailable(): boolean {
    return true;
  }

  async complete(params: CompletionParams): Promise<string> {
    const response = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? this.maxTokens,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async *completeStream(params: CompletionParams): AsyncGenerator<string> {
    const stream = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: params.messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? this.maxTokens,
      stream: true,
    });
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) yield text;
    }
  }

  async completeMultiModal(params: CompletionParams & { images?: string[] }): Promise<string> {
    const content: { type: string; text?: string; image_url?: { url: string } }[] = [];
    const textMsg = params.messages.find((m) => m.role === 'user');
    if (textMsg) content.push({ type: 'text', text: textMsg.content });
    for (const img of params.images ?? []) {
      content.push({ type: 'image_url', image_url: { url: img.startsWith('data:') ? img : `data:image/png;base64,${img}` } });
    }
    const response = await this.openai.chat.completions.create({
      model: this.modelName,
      messages: [{ role: 'user', content: content as unknown as string }],
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? this.maxTokens,
    });
    return response.choices[0]?.message?.content ?? '';
  }

  async embed(params: EmbeddingParams): Promise<number[][]> {
    const response = await this.openai.embeddings.create({
      model: params.model ?? this.embeddingModel,
      input: params.input,
    });
    return response.data.map((d) => d.embedding);
  }
}
