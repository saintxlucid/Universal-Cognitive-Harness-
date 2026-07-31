export type ErrorCategory =
  | 'auth'
  | 'billing'
  | 'rate-limit'
  | 'context-overflow'
  | 'timeout'
  | 'unknown';

export interface ClassifiedError {
  category: ErrorCategory;
  message: string;
  status: number | null;
  code: string | null;
  retryable: boolean;
  shouldFailover: boolean;
}

const STATUS_TO_CATEGORY: Record<number, ErrorCategory> = {
  400: 'unknown',
  401: 'auth',
  402: 'billing',
  403: 'auth',
  404: 'unknown',
  408: 'timeout',
  409: 'unknown',
  413: 'context-overflow',
  422: 'unknown',
  429: 'rate-limit',
  500: 'unknown',
  502: 'unknown',
  503: 'unknown',
  504: 'timeout',
};

const CODE_TO_CATEGORY: Record<string, ErrorCategory> = {
  invalid_api_key: 'auth',
  authentication_error: 'auth',
  permission_denied: 'auth',
  insufficient_quota: 'billing',
  billing_not_active: 'billing',
  access_terminated: 'billing',
  rate_limit_exceeded: 'rate-limit',
  requests_rate_limit: 'rate-limit',
  tokens_rate_limit: 'rate-limit',
  engines_rate_limit: 'rate-limit',
  context_length_exceeded: 'context-overflow',
  context_window_exceeded: 'context-overflow',
  max_tokens_exceeded: 'context-overflow',
  timeout: 'timeout',
  request_timeout: 'timeout',
};

const RETRYABLE_CATEGORIES = new Set<ErrorCategory>(['rate-limit', 'timeout', 'unknown']);
const FAILOVER_CATEGORIES = new Set<ErrorCategory>(['rate-limit', 'context-overflow', 'timeout']);

export function normalizeErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (!error) return 'Unknown error';
  if (error instanceof Error) return error.message;
  return String(error);
}

export function extractErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error !== null) {
    const candidate = (error as Record<string, unknown>)['code'];
    if (typeof candidate === 'string') return candidate;
    const status = (error as Record<string, unknown>)['status'];
    if (typeof status === 'string') return status;
  }
  const message = normalizeErrorMessage(error);
  const codeMatch = /code[:\s]+['"]?([a-z0-9_-]+)['"]?/i.exec(message);
  if (codeMatch) return codeMatch[1] ?? null;
  return null;
}

export function classifyError(error: unknown, status?: number): ClassifiedError {
  const message = normalizeErrorMessage(error);
  const code = extractErrorCode(error);
  const numericStatus = status ?? (typeof error === 'object' && error !== null && typeof (error as Record<string, unknown>)['status'] === 'number' ? ((error as Record<string, unknown>)['status'] as number) : null);

  let category: ErrorCategory = 'unknown';
  if (numericStatus !== null && STATUS_TO_CATEGORY[numericStatus]) {
    category = STATUS_TO_CATEGORY[numericStatus] as ErrorCategory;
  } else if (code && CODE_TO_CATEGORY[code]) {
    category = CODE_TO_CATEGORY[code] as ErrorCategory;
  } else {
    const lower = message.toLowerCase();
    if (lower.includes('rate limit') || lower.includes('too many requests')) category = 'rate-limit';
    else if (lower.includes('context length') || lower.includes('context window') || lower.includes('max context')) category = 'context-overflow';
    else if (lower.includes('timeout') || lower.includes('timed out')) category = 'timeout';
    else if (lower.includes('api key') || lower.includes('authentication') || lower.includes('unauthorized')) category = 'auth';
    else if (lower.includes('quota') || lower.includes('billing')) category = 'billing';
  }

  return {
    category,
    message,
    status: numericStatus,
    code,
    retryable: RETRYABLE_CATEGORIES.has(category),
    shouldFailover: FAILOVER_CATEGORIES.has(category),
  };
}

export interface FallbackModel {
  provider: string;
  model: string;
  priority: number;
  contextWindow?: number;
  minContextWindow?: number;
}

export interface FailoverChainOptions {
  backoffMs?: number;
  backoffMultiplier?: number;
  maxAttemptsPerModel?: number;
  cooldownMs?: number;
  probeBeforeUse?: boolean;
}

export interface ProbeResult {
  available: boolean;
  contextWindow?: number;
}

export interface FailoverChainStatus {
  currentIndex: number;
  inCooldown: string[];
  attempts: Map<string, number>;
  exhausted: string[];
}

export class FailoverChain {
  private readonly models: FallbackModel[];
  private readonly options: Required<FailoverChainOptions>;
  private index = 0;
  private cooldowns = new Map<string, number>();
  private attempts = new Map<string, number>();
  private probe: ((model: FallbackModel) => Promise<ProbeResult>) | null = null;

  constructor(models: FallbackModel[], options: FailoverChainOptions = {}) {
    if (models.length === 0) {
      throw new Error('FailoverChain requires at least one model');
    }
    this.models = [...models].sort((a, b) => a.priority - b.priority);
    this.options = {
      backoffMs: options.backoffMs ?? 1000,
      backoffMultiplier: options.backoffMultiplier ?? 2,
      maxAttemptsPerModel: options.maxAttemptsPerModel ?? 2,
      cooldownMs: options.cooldownMs ?? 30000,
      probeBeforeUse: options.probeBeforeUse ?? false,
    };
  }

  private key(model: FallbackModel): string {
    return `${model.provider}:${model.model}`;
  }

  private now(): number {
    return Date.now();
  }

  setProbe(probe: (model: FallbackModel) => Promise<ProbeResult>): void {
    this.probe = probe;
  }

  async next(classified: ClassifiedError | null = null): Promise<FallbackModel | null> {
    const now = this.now();
    for (let offset = 0; offset < this.models.length; offset++) {
      const candidate = this.models[offset] as FallbackModel;
      const key = this.key(candidate);
      const cooldownUntil = this.cooldowns.get(key);
      if (cooldownUntil !== undefined && cooldownUntil > now) {
        continue;
      }
      const used = this.attempts.get(key) ?? 0;
      if (used >= this.options.maxAttemptsPerModel) {
        continue;
      }
      if (this.options.probeBeforeUse && this.probe) {
        const result = await this.probe(candidate);
        if (!result.available) {
          this.cooldowns.set(key, now + this.options.cooldownMs);
          continue;
        }
        if (classified?.category === 'context-overflow') {
          const candidateWindow = result.contextWindow ?? candidate.contextWindow;
          const required = candidate.minContextWindow ?? 0;
          if (candidateWindow !== undefined && candidateWindow < required) {
            continue;
          }
        }
      }
      this.index = offset;
      this.attempts.set(key, used + 1);
      return candidate;
    }
    return null;
  }

  markSuccess(model: FallbackModel): void {
    const key = this.key(model);
    this.cooldowns.delete(key);
    this.attempts.delete(key);
  }

  markFailure(model: FallbackModel, classified?: ClassifiedError): void {
    const key = this.key(model);
    this.cooldowns.set(key, this.now() + this.options.cooldownMs);
    if (classified?.category === 'auth' || classified?.category === 'billing') {
      this.attempts.set(key, this.options.maxAttemptsPerModel);
    }
  }

  backoffFor(attemptIndex: number): number {
    return this.options.backoffMs * Math.pow(this.options.backoffMultiplier, attemptIndex);
  }

  reset(): void {
    this.index = 0;
    this.cooldowns.clear();
    this.attempts.clear();
  }

  status(): FailoverChainStatus {
    const now = this.now();
    const inCooldown: string[] = [];
    const exhausted: string[] = [];
    for (const [key, until] of this.cooldowns) {
      if (until > now) inCooldown.push(key);
    }
    for (const [key, used] of this.attempts) {
      if (used >= this.options.maxAttemptsPerModel) exhausted.push(key);
    }
    return { currentIndex: this.index, inCooldown, attempts: new Map(this.attempts), exhausted };
  }
}
