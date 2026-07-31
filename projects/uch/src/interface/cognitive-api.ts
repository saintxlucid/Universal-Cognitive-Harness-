import type { CognitiveExoskeleton } from '../exoskeleton/exoskeleton.js';
import type { ConsciousnessLayer } from '../aether/consciousness.js';
import type { FileProfile } from '../suit/litmus/code-scorer.js';

export interface CognitiveAPIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    durationMs: number;
    source: string;
  };
}

export class CognitiveAPI {
  private exoskeleton: CognitiveExoskeleton | null = null;

  attach(exoskeleton: CognitiveExoskeleton): void {
    this.exoskeleton = exoskeleton;
  }

  detach(): void {
    this.exoskeleton = null;
  }

  async observe(
    layer: string,
    content: string,
    source: string,
    tags?: string[],
  ): Promise<CognitiveAPIResponse> {
    const start = Date.now();
    if (!this.exoskeleton) {
      return { success: false, error: 'Not attached to exoskeleton', meta: { durationMs: 0, source: 'cognitive-api' } };
    }
    this.exoskeleton.aether.observeThought(layer as ConsciousnessLayer, content, source, tags);
    return {
      success: true,
      meta: { durationMs: Date.now() - start, source: 'cognitive-api' },
    };
  }

  async recall(query: string, limit = 10): Promise<CognitiveAPIResponse> {
    const start = Date.now();
    if (!this.exoskeleton) {
      return { success: false, error: 'Not attached to exoskeleton', meta: { durationMs: 0, source: 'cognitive-api' } };
    }
    const results = this.exoskeleton.hippocampus.recall(query, limit);
    return {
      success: true,
      data: results,
      meta: { durationMs: Date.now() - start, source: 'cognitive-api' },
    };
  }

  async evaluate(profile: Record<string, unknown>): Promise<CognitiveAPIResponse> {
    const start = Date.now();
    if (!this.exoskeleton) {
      return { success: false, error: 'Not attached to exoskeleton', meta: { durationMs: 0, source: 'cognitive-api' } };
    }
    const result = this.exoskeleton.codeScorer.score(profile as unknown as FileProfile);
    return {
      success: true,
      data: result,
      meta: { durationMs: Date.now() - start, source: 'cognitive-api' },
    };
  }

  async plan(goal: string): Promise<CognitiveAPIResponse> {
    const start = Date.now();
    if (!this.exoskeleton) {
      return { success: false, error: 'Not attached to exoskeleton', meta: { durationMs: 0, source: 'cognitive-api' } };
    }
    this.exoskeleton.aether.observeThought('strategic', goal, 'cognitive-api', ['plan']);
    return {
      success: true,
      data: { goal, acknowledged: true },
      meta: { durationMs: Date.now() - start, source: 'cognitive-api' },
    };
  }

  async reflect(): Promise<CognitiveAPIResponse> {
    const start = Date.now();
    if (!this.exoskeleton) {
      return { success: false, error: 'Not attached to exoskeleton', meta: { durationMs: 0, source: 'cognitive-api' } };
    }
    const state = this.exoskeleton.getState();
    return {
      success: true,
      data: {
        consciousness: state.consciousness,
        signals: this.exoskeleton.endocrineSystem.getSignals(),
        threats: this.exoskeleton.immuneSystem.getThreats().length,
        insights: this.exoskeleton.cortexKernel.getInsights(5),
      },
      meta: { durationMs: Date.now() - start, source: 'cognitive-api' },
    };
  }

  async status(): Promise<CognitiveAPIResponse> {
    const start = Date.now();
    if (!this.exoskeleton) {
      return { success: false, error: 'Not attached to exoskeleton', meta: { durationMs: 0, source: 'cognitive-api' } };
    }
    return {
      success: true,
      data: this.exoskeleton.getStats(),
      meta: { durationMs: Date.now() - start, source: 'cognitive-api' },
    };
  }
}
