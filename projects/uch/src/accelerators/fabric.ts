import OpenAI from 'openai';
import { LLMClient } from '../llm/provider.js';
import type {
  Accelerator,
  AcceleratorKind,
  AcceleratorResult,
  InferenceProvider,
  ProviderGateway,
} from './types.js';

export interface ProviderHealth {
  providerId: string;
  label: string;
  consecutiveFailures: number;
  totalCalls: number;
  totalFailures: number;
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
  cooldownUntil: number | null;
  healthy: boolean;
}

export interface DispatchOptions {
  priority?: number;
  latencyTargetMs?: number;
  maxTokens?: number;
  skipInference?: boolean;
  retries?: number;
}

const COOLDOWN_MS = 15_000;
const MAX_CONSECUTIVE_FAILURES = 2;

function extractConfidence(output: Record<string, unknown>): number {
  const c = output.confidence;
  if (typeof c === 'number' && c >= 0 && c <= 1) return c;
  return 0.5;
}

export class InferenceFabric {
  private providers: InferenceProvider[] = [];
  private health: Map<string, ProviderHealth> = new Map();
  private cursor = 0;

  constructor(autoRegister = true) {
    if (autoRegister) this.autoRegister();
  }

  registerProvider(provider: InferenceProvider): void {
    if (this.providers.some((p) => p.id === provider.id)) return;
    this.providers.push(provider);
    this.health.set(provider.id, {
      providerId: provider.id,
      label: provider.label,
      consecutiveFailures: 0,
      totalCalls: 0,
      totalFailures: 0,
      lastLatencyMs: null,
      avgLatencyMs: null,
      cooldownUntil: null,
      healthy: true,
    });
  }

  isAvailable(): boolean {
    return this.providers.some((p) => p.isAvailable() && this.isHealthy(p.id));
  }

  isDegraded(): boolean {
    const total = this.providers.length;
    if (total === 0) return true;
    return this.providers.filter((p) => p.isAvailable() && this.isHealthy(p.id)).length < total;
  }

  healthStatus(): ProviderHealth[] {
    return [...this.health.values()].map((h) => ({ ...h }));
  }

  async dispatch<I extends Record<string, unknown>, O extends object>(
    accelerator: Accelerator<I, O>,
    input: I,
    options?: DispatchOptions,
  ): Promise<AcceleratorResult<O>> {
    const kind = accelerator.kind;
    const priority = options?.priority ?? 1;
    const latencyTargetMs = options?.latencyTargetMs;
    const retries = options?.retries ?? 2;
    const started = Date.now();

    if (options?.skipInference || !this.isAvailable()) {
      return this.fallbackResult(accelerator, input, kind, started);
    }

    const ordered = await this.orderedHealthyProviders(priority, latencyTargetMs);
    if (ordered.length === 0) {
      return this.fallbackResult(accelerator, input, kind, started);
    }

    const attempts = Math.min(retries, ordered.length);
    for (let i = 0; i < attempts; i++) {
      const provider = ordered[i]!;
      const gateway = this.gatewayFor(provider);
      try {
        const output = await accelerator.execute(input, gateway, {
          maxTokens: options?.maxTokens,
        });
        const latencyMs = Date.now() - started;
        this.recordSuccess(provider.id, latencyMs);
        return {
          kind,
          output,
          confidence: extractConfidence(output as unknown as Record<string, unknown>),
          provider: provider.id,
          latencyMs,
          fallbackUsed: false,
          fired: true,
        };
      } catch {
        this.recordFailure(provider.id);
      }
    }

    return this.fallbackResult(accelerator, input, kind, started);
  }

  private async fallbackResult<I, O>(
    accelerator: Accelerator<I, O>,
    input: I,
    kind: AcceleratorKind,
    started: number,
  ): Promise<AcceleratorResult<O>> {
    const output = await accelerator.fallback(input);
    return {
      kind,
      output,
      confidence: extractConfidence(output as unknown as Record<string, unknown>),
      provider: 'deterministic',
      latencyMs: Date.now() - started,
      fallbackUsed: true,
      fired: false,
    };
  }

  private gatewayFor(provider: InferenceProvider): ProviderGateway {
    return {
      isAvailable: () => provider.isAvailable(),
      complete: async (params) => {
        const t0 = Date.now();
        const text = await provider.complete(params);
        return { text, providerId: provider.id, latencyMs: Date.now() - t0 };
      },
    };
  }

  private isHealthy(providerId: string): boolean {
    const h = this.health.get(providerId);
    if (!h) return true;
    if (h.cooldownUntil !== null && h.cooldownUntil > Date.now()) return false;
    return h.consecutiveFailures < MAX_CONSECUTIVE_FAILURES;
  }

  private async orderedHealthyProviders(priority: number, latencyTargetMs?: number): Promise<InferenceProvider[]> {
    await this.probeUnmeasured();
    const available = this.providers.filter((p) => p.isAvailable() && this.isHealthy(p.id));
    available.sort((a, b) => {
      const ha = this.health.get(a.id);
      const hb = this.health.get(b.id);
      const fa = ha?.totalFailures ?? 0;
      const fb = hb?.totalFailures ?? 0;
      if (fa !== fb) return fa - fb;
      const la = ha?.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
      const lb = hb?.avgLatencyMs ?? Number.MAX_SAFE_INTEGER;
      return la - lb;
    });
    if (latencyTargetMs !== undefined && available.length > 1) {
      const within = available.filter((p) => {
        const h = this.health.get(p.id);
        return h?.avgLatencyMs === null || h!.avgLatencyMs! <= latencyTargetMs;
      });
      if (within.length > 0) return within;
    }
    if (priority >= 3) {
      this.cursor = (this.cursor + 1) % available.length;
      const rotated = [...available.slice(this.cursor), ...available.slice(0, this.cursor)];
      return rotated;
    }
    return available;
  }

  private async probeUnmeasured(): Promise<void> {
    const unmeasured = this.providers.filter((p) => this.health.get(p.id)?.avgLatencyMs === null);
    await Promise.all(unmeasured.map(async (provider) => {
      const t0 = Date.now();
      try {
        await provider.complete({ system: 'ping', user: 'ping', temperature: 0, maxTokens: 16 });
        const h = this.health.get(provider.id);
        if (!h) return;
        h.lastLatencyMs = Date.now() - t0;
        h.avgLatencyMs = h.avgLatencyMs === null ? h.lastLatencyMs : h.avgLatencyMs * 0.8 + h.lastLatencyMs * 0.2;
      } catch {
        this.recordFailure(provider.id);
      }
    }));
  }

  private recordSuccess(providerId: string, latencyMs: number): void {
    const h = this.health.get(providerId);
    if (!h) return;
    h.totalCalls += 1;
    h.consecutiveFailures = 0;
    h.cooldownUntil = null;
    h.lastLatencyMs = latencyMs;
    h.avgLatencyMs = h.avgLatencyMs === null ? latencyMs : h.avgLatencyMs * 0.8 + latencyMs * 0.2;
  }

  private recordFailure(providerId: string): void {
    const h = this.health.get(providerId);
    if (!h) return;
    h.totalCalls += 1;
    h.totalFailures += 1;
    h.consecutiveFailures += 1;
    if (h.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      h.cooldownUntil = Date.now() + COOLDOWN_MS;
    }
  }

  private autoRegister(): void {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const client = new LLMClient({ provider: 'openai', apiKey: openaiKey });
      this.registerProvider(this.llmAdapter('openai', 'OpenAI', client));
    }
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      const client = new LLMClient({ provider: 'anthropic', apiKey: anthropicKey });
      this.registerProvider(this.llmAdapter('anthropic', 'Anthropic', client));
    }
    const cerebrasKeys = [
      process.env.CEREBRAS_API_KEY,
      process.env.CEREBRAS_API_KEY_1,
      process.env.CEREBRAS_API_KEY_2,
      process.env.CEREBRAS_API_KEY_3,
    ];
    cerebrasKeys.forEach((key, i) => {
      if (!key) return;
      const id = i === 0 ? 'cerebras' : `cerebras-${i}`;
      const openai = new OpenAI({ apiKey: key, baseURL: 'https://api.cerebras.ai/v1' });
      this.registerProvider(this.openaiCompatibleAdapter(id, `Cerebras ${id}`, openai));
    });
  }

  private llmAdapter(id: string, label: string, client: LLMClient): InferenceProvider {
    return {
      id,
      label,
      isAvailable: () => client.isAvailable,
      complete: async ({ system, user, temperature, maxTokens }) => {
        const messages = [
          ...(system ? [{ role: 'system' as const, content: system }] : []),
          { role: 'user' as const, content: user },
        ];
        return client.complete({ messages, temperature, maxTokens });
      },
    };
  }

  private openaiCompatibleAdapter(id: string, label: string, client: OpenAI): InferenceProvider {
    return {
      id,
      label,
      isAvailable: () => true,
      complete: async ({ system, user, temperature, maxTokens }) => {
        const response = await client.chat.completions.create({
          model: process.env.CEREBRAS_MODEL ?? 'llama-3.3-70b',
          messages: [
            ...(system ? [{ role: 'system' as const, content: system }] : []),
            { role: 'user' as const, content: user },
          ],
          temperature: temperature ?? 0.2,
          max_tokens: maxTokens ?? 1024,
        });
        return response.choices[0]?.message?.content ?? '';
      },
    };
  }
}

export function createDefaultFabric(): InferenceFabric {
  return new InferenceFabric(true);
}
