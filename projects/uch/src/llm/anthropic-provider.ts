export type AnthropicModel = string;

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

export interface AnthropicContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result';
  text?: string;
  source?: { type: 'base64'; media_type: string; data: string };
  tool_use?: { name: string; input: Record<string, unknown> };
  tool_result?: { tool_use_id: string; content: string };
}

export interface AnthropicCompletionParams {
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AnthropicStreamChunk {
  type: 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop' | 'error';
  delta?: { text?: string; type?: string };
  error?: { message: string };
}

export class AnthropicProvider {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
    this.baseURL = 'https://api.anthropic.com/v1';
  }

  get isAvailable(): boolean {
    return this.apiKey.length > 0;
  }

  async complete(model: AnthropicModel, params: AnthropicCompletionParams): Promise<string> {
    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        system: params.system,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.7,
        stream: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const data = await response.json() as { content: { text: string }[] };
    return data.content.map(c => c.text).join('');
  }

  async *completeStream(model: AnthropicModel, params: AnthropicCompletionParams): AsyncGenerator<string> {
    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        system: params.system,
        max_tokens: params.maxTokens ?? 4096,
        temperature: params.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${err}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const chunk = JSON.parse(trimmed.slice(6)) as AnthropicStreamChunk;
          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            yield chunk.delta.text;
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  async embed(_text: string): Promise<number[]> {
    throw new Error('Anthropic does not support embeddings. Use OpenAI or a local embedder.');
  }
}
