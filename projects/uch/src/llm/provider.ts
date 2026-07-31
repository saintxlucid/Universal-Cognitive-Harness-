import { OpenAIDriver, AnthropicDriver, GoogleDriver } from './drivers/index.js';
import type { LLMDriver, CompletionParams, EmbeddingParams } from './drivers/index.js';

export type { CompletionParams, EmbeddingParams, MultiModalContent, LLMDriver } from './drivers/index.js';

export type LLMProviderType = 'openai' | 'anthropic' | 'google' | 'auto';

const DEFAULT_MODELS: Record<'openai' | 'anthropic' | 'google', string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5',
  google: 'gemini-2.0-flash',
};

export interface LLMConfig {
  provider?: LLMProviderType;
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
  maxTokens?: number;
}

export class LLMClient {
  private driver: LLMDriver | null = null;
  private config: Required<LLMConfig>;

  constructor(config?: Partial<LLMConfig>) {
    const requestedProvider = (config?.provider ?? process.env.UCH_LLM_PROVIDER ?? 'auto') as LLMProviderType;
    const apiKey = config?.apiKey
      ?? process.env.OPENAI_API_KEY
      ?? process.env.ANTHROPIC_API_KEY
      ?? process.env.GOOGLE_API_KEY
      ?? '';
    const explicitModel = config?.model ?? process.env.UCH_LLM_MODEL;
    const resolved = this.resolveProvider(requestedProvider, explicitModel ?? '');

    this.config = {
      provider: requestedProvider,
      apiKey,
      model: explicitModel ?? DEFAULT_MODELS[resolved],
      embeddingModel: config?.embeddingModel ?? 'text-embedding-3-small',
      baseURL: config?.baseURL ?? process.env.OPENAI_BASE_URL ?? '',
      maxTokens: config?.maxTokens ?? 4096,
    };

    this.driver = this.buildDriver(resolved);
  }

  private buildDriver(resolved: Exclude<LLMProviderType, 'auto'>): LLMDriver | null {
    if (!this.config.apiKey) return null;
    switch (resolved) {
      case 'openai':
        return new OpenAIDriver({
          apiKey: this.config.apiKey,
          model: this.config.model,
          embeddingModel: this.config.embeddingModel,
          baseURL: this.config.baseURL,
          maxTokens: this.config.maxTokens,
        });
      case 'anthropic':
        return new AnthropicDriver({
          apiKey: this.config.apiKey,
          model: this.config.model,
          maxTokens: this.config.maxTokens,
        });
      case 'google':
        return new GoogleDriver({
          apiKey: this.config.apiKey,
          model: this.config.model,
          embeddingModel: this.config.embeddingModel,
          maxTokens: this.config.maxTokens,
        });
    }
  }

  private resolveProvider(requested: LLMProviderType, model: string): Exclude<LLMProviderType, 'auto'> {
    if (requested !== 'auto') return requested as Exclude<LLMProviderType, 'auto'>;
    if (process.env.ANTHROPIC_API_KEY && model.startsWith('claude')) return 'anthropic';
    if (process.env.GOOGLE_API_KEY && model.startsWith('gemini')) return 'google';
    return 'openai';
  }

  get provider(): LLMProviderType {
    return this.resolveProvider(this.config.provider, this.config.model);
  }

  get isAvailable(): boolean {
    return this.driver?.isAvailable ?? false;
  }

  get modelName(): string {
    return this.config.model;
  }

  async complete(params: CompletionParams): Promise<string> {
    if (!this.driver) {
      throw new Error('No LLM provider configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY');
    }
    return this.driver.complete(params);
  }

  async *completeStream(params: CompletionParams): AsyncGenerator<string> {
    if (params.stream === false) {
      yield await this.complete(params);
      return;
    }
    if (!this.driver) {
      throw new Error('No LLM provider configured for streaming');
    }
    for await (const text of this.driver.completeStream(params)) {
      yield text;
    }
  }

  async completeMultiModal(params: CompletionParams & { images?: string[] }): Promise<string> {
    if (!this.driver) {
      throw new Error('No LLM provider configured for multi-modal');
    }
    if (!params.multimodal || !params.images?.length) {
      return this.complete(params);
    }
    if (this.driver.completeMultiModal) {
      return this.driver.completeMultiModal(params);
    }
    return this.complete(params);
  }

  async embed(params: EmbeddingParams): Promise<number[][]> {
    if (this.driver?.embed) {
      return this.driver.embed(params);
    }
    throw new Error('Embeddings require an OpenAI or Google provider');
  }

  async summarize(text: string, maxWords = 100): Promise<string> {
    return this.complete({
      messages: [
        { role: 'system', content: `Summarize the following in ${maxWords} words or less. Be concise and capture key points.` },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    });
  }

  async extractConcepts(text: string): Promise<string[]> {
    const response = await this.complete({
      messages: [
        { role: 'system', content: 'Extract key concepts from the following text. Return as a comma-separated list. Maximum 10 concepts.' },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
      maxTokens: 200,
    });
    return response.split(',').map((c) => c.trim()).filter(Boolean);
  }
}
