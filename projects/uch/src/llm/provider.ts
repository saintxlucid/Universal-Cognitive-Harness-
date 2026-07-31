import OpenAI from 'openai';

export type LLMProvider = 'openai' | 'anthropic';

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  embeddingModel?: string;
  baseURL?: string;
  maxTokens?: number;
}

export interface CompletionParams {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

export interface EmbeddingParams {
  input: string | string[];
  model?: string;
}

export class LLMClient {
  private openai: OpenAI | null = null;
  private config: Required<LLMConfig>;

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      provider: config?.provider ?? this.detectProvider(),
      apiKey: config?.apiKey ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? '',
      model: config?.model ?? 'gpt-4o',
      embeddingModel: config?.embeddingModel ?? 'text-embedding-3-small',
      baseURL: config?.baseURL ?? process.env.OPENAI_BASE_URL ?? '',
      maxTokens: config?.maxTokens ?? 4096,
    };

    if (this.config.apiKey && this.config.provider === 'openai') {
      const clientConfig: Record<string, unknown> = { apiKey: this.config.apiKey };
      if (this.config.baseURL) clientConfig.baseURL = this.config.baseURL;
      this.openai = new OpenAI(clientConfig as Record<string, string>);
    }
  }

  private detectProvider(): LLMProvider {
    if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
    return 'openai';
  }

  get isAvailable(): boolean {
    return this.openai !== null && this.config.apiKey !== '';
  }

  get provider(): LLMProvider {
    return this.config.provider;
  }

  get modelName(): string {
    return this.config.model;
  }

  async complete(params: CompletionParams): Promise<string> {
    if (!this.openai) throw new Error('No LLM provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens ?? this.config.maxTokens,
    });

    return response.choices[0]?.message?.content ?? '';
  }

  async embed(params: EmbeddingParams): Promise<number[][]> {
    if (!this.openai) throw new Error('No LLM provider configured for embeddings');

    const response = await this.openai.embeddings.create({
      model: this.config.embeddingModel,
      input: params.input,
    });

    return response.data.map((d) => d.embedding);
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
