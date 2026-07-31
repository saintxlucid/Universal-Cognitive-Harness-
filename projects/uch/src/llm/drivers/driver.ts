// ── LLM Driver interface ──────────────────────────────────────────────
// The Cognitive OS never depends on one model vendor. Every provider is
// a driver — like a device driver for hardware. The kernel speaks to the
// driver interface; vendors churn behind it.

export interface CompletionParams {
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  multimodal?: boolean;
}

export interface EmbeddingParams {
  input: string | string[];
  model?: string;
}

export interface MultiModalContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string; detail?: 'auto' | 'low' | 'high' };
}

export interface LLMDriver {
  readonly providerName: string;
  readonly modelName: string;
  get isAvailable(): boolean;
  complete(params: CompletionParams): Promise<string>;
  completeStream(params: CompletionParams): AsyncGenerator<string>;
  completeMultiModal?(params: CompletionParams & { images?: string[] }): Promise<string>;
  embed?(params: EmbeddingParams): Promise<number[][]>;
}
