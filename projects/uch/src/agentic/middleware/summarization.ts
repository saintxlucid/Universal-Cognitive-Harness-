import type { AgentMiddleware, MiddlewareContext } from './types.js';
import { compressContext, type CompressOptions } from '../query/compaction-engine.js';
import { estimateTokensApprox } from '../context/compaction.js';

export interface SummarizationMiddlewareOptions {
  maxContextTokens?: number;
  thresholdRatio?: number;
  maxToolResultChars?: number;
  summarize?: (text: string) => Promise<string>;
}

export class SummarizationMiddleware implements AgentMiddleware {
  readonly name = 'SummarizationMiddleware';

  private readonly maxContextTokens: number;
  private readonly thresholdRatio: number;
  private readonly maxToolResultChars: number;
  private readonly summarize: (text: string) => Promise<string>;
  private triggerCount = 0;

  constructor(options: SummarizationMiddlewareOptions = {}) {
    this.maxContextTokens = options.maxContextTokens ?? 200000;
    this.thresholdRatio = options.thresholdRatio ?? 0.8;
    this.maxToolResultChars = options.maxToolResultChars ?? 4000;
    this.summarize =
      options.summarize ??
      (async (_text) => {
        throw new Error('SummarizationMiddleware requires a summarize function; set one in options');
      });
  }

  get compressionTriggered(): number {
    return this.triggerCount;
  }

  needsCompression(messages: { content: { type: string; text?: string; content?: string }[] }[]): boolean {
    if (messages.length < 8) return false;
    const tokens = estimateTokensApprox(messages as never);
    return tokens >= this.maxContextTokens * this.thresholdRatio;
  }

  async beforeModelCall(context: MiddlewareContext): Promise<MiddlewareContext | null> {
    if (!this.needsCompression(context.messages)) return null;
    const result = await compressContext(context.messages, {
      maxContextTokens: this.maxContextTokens,
      summarize: this.summarize,
      maxToolResultChars: this.maxToolResultChars,
    } satisfies CompressOptions);
    this.triggerCount++;
    return { ...context, messages: result.messages };
  }
}
