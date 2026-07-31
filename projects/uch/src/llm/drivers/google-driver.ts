import type { CompletionParams, EmbeddingParams, LLMDriver } from './driver.js';

// ── Google Gemini driver ──────────────────────────────────────────────
// Hand-rolled fetch implementation (no SDK dependency), following the
// AnthropicProvider pattern. The 'google' provider was declared in the
// type system but unimplemented — this completes the model driver layer.

export interface GoogleDriverConfig {
  apiKey: string;
  model: string;
  embeddingModel?: string;
  maxTokens?: number;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
}

interface GeminiEmbeddingsResponse {
  embeddings?: Array<{ values?: number[] }>;
}

export class GoogleDriver implements LLMDriver {
  readonly providerName = 'google';
  readonly modelName: string;
  private apiKey: string;
  private embeddingModel: string;
  private maxTokens: number;
  private baseURL = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config: GoogleDriverConfig) {
    this.apiKey = config.apiKey;
    this.modelName = config.model;
    this.embeddingModel = config.embeddingModel ?? 'text-embedding-004';
    this.maxTokens = config.maxTokens ?? 4096;
  }

  get isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': this.apiKey,
    };
  }

  private requestBody(params: CompletionParams, stream: boolean): Record<string, unknown> {
    const system = params.messages.find((m) => m.role === 'system')?.content;
    const contents = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
    return {
      contents,
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens ?? this.maxTokens,
      },
      ...(stream ? {} : {}),
    };
  }

  private extractText(data: GeminiResponse): string {
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p) => p.text ?? '').join('');
  }

  async complete(params: CompletionParams): Promise<string> {
    const model = params.model ?? this.modelName;
    const response = await fetch(`${this.baseURL}/models/${model}:generateContent`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.requestBody(params, false)),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google API error ${response.status}: ${err}`);
    }
    const data = await response.json() as GeminiResponse;
    return this.extractText(data);
  }

  async *completeStream(params: CompletionParams): AsyncGenerator<string> {
    const model = params.model ?? this.modelName;
    const response = await fetch(`${this.baseURL}/models/${model}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(this.requestBody(params, true)),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google API error ${response.status}: ${err}`);
    }
    if (!response.body) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:') || trimmed === 'data: [DONE]') continue;
        try {
          const data = JSON.parse(trimmed.slice(5).trim()) as GeminiResponse;
          const text = this.extractText(data);
          if (text) yield text;
        } catch {
          // Skip malformed SSE payloads — the stream is best-effort.
        }
      }
    }
  }

  async embed(params: EmbeddingParams): Promise<number[][]> {
    const model = params.model ?? this.embeddingModel;
    const inputs = Array.isArray(params.input) ? params.input : [params.input];
    const response = await fetch(`${this.baseURL}/models/${model}:batchEmbedContents`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        requests: inputs.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
        })),
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Google API error ${response.status}: ${err}`);
    }
    const data = await response.json() as GeminiEmbeddingsResponse;
    const embeddings = (data.embeddings ?? []).map((e) => e.values ?? []);
    if (embeddings.length !== inputs.length) {
      throw new Error(`Google API returned ${embeddings.length} embeddings for ${inputs.length} inputs`);
    }
    return embeddings;
  }
}
