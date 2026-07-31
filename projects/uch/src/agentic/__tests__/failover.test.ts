import { describe, it, expect } from 'vitest';
import {
  classifyError,
  normalizeErrorMessage,
  extractErrorCode,
  FailoverChain,
  type FallbackModel,
} from '../query/failover.js';

describe('normalizeErrorMessage', () => {
  it('handles strings, Errors, and unknown values', () => {
    expect(normalizeErrorMessage('plain')).toBe('plain');
    expect(normalizeErrorMessage(new Error('boom'))).toBe('boom');
    expect(normalizeErrorMessage(null)).toBe('Unknown error');
    expect(normalizeErrorMessage({ weird: true })).toBe('[object Object]');
  });
});

describe('classifyError', () => {
  it('classifies by HTTP status', () => {
    expect(classifyError('nope', 401).category).toBe('auth');
    expect(classifyError('nope', 429).category).toBe('rate-limit');
    expect(classifyError('nope', 402).category).toBe('billing');
    expect(classifyError('nope', 504).category).toBe('timeout');
    expect(classifyError('nope', 413).category).toBe('context-overflow');
  });

  it('classifies by error code', () => {
    expect(classifyError({ code: 'insufficient_quota' }).category).toBe('billing');
    expect(classifyError({ code: 'rate_limit_exceeded' }).category).toBe('rate-limit');
    expect(classifyError({ code: 'context_length_exceeded' }).category).toBe('context-overflow');
    expect(classifyError({ code: 'invalid_api_key' }).category).toBe('auth');
  });

  it('classifies by message content', () => {
    expect(classifyError('This request exceeds the context length limit')).toBeTruthy();
    expect(classifyError('Request timed out after 60s').category).toBe('timeout');
    expect(classifyError('too many requests, please slow down').category).toBe('rate-limit');
    expect(classifyError('invalid API key provided').category).toBe('auth');
    expect(classifyError('You have exceeded your quota').category).toBe('billing');
  });

  it('reads status from error objects', () => {
    expect(classifyError({ status: 429, message: 'x' }).category).toBe('rate-limit');
  });

  it('defaults to unknown', () => {
    const result = classifyError('something else');
    expect(result.category).toBe('unknown');
    expect(result.shouldFailover).toBe(false);
  });

  it('sets retryable and failover flags', () => {
    const rate = classifyError('too many requests');
    expect(rate.retryable).toBe(true);
    expect(rate.shouldFailover).toBe(true);
    const auth = classifyError('nope', 401);
    expect(auth.retryable).toBe(false);
    expect(auth.shouldFailover).toBe(false);
  });
});

describe('extractErrorCode', () => {
  it('extracts code from error objects', () => {
    expect(extractErrorCode({ code: 'rate_limit_exceeded' })).toBe('rate_limit_exceeded');
  });
  it('extracts numeric status as string', () => {
    expect(extractErrorCode({ status: '429' })).toBe('429');
  });
  it('extracts from message', () => {
    expect(extractErrorCode('Error code: 429 - rate limited')).toBe('429');
  });
});

describe('FailoverChain', () => {
  const models: FallbackModel[] = [
    { provider: 'anthropic', model: 'claude-sonnet-4-5', priority: 1 },
    { provider: 'openai', model: 'gpt-4o', priority: 2 },
    { provider: 'openai', model: 'gpt-4o-mini', priority: 3 },
  ];

  it('returns the highest-priority model first', async () => {
    const chain = new FailoverChain(models);
    const first = await chain.next();
    expect(first?.model).toBe('claude-sonnet-4-5');
  });

  it('rotates after failure', async () => {
    const chain = new FailoverChain(models);
    const first = await chain.next();
    chain.markFailure(first!);
    const second = await chain.next();
    expect(second?.model).toBe('gpt-4o');
  });

  it('respects per-model attempt limits', async () => {
    const chain = new FailoverChain(models, { cooldownMs: 60000 });
    const first = await chain.next();
    chain.markFailure(first!);
    chain.markFailure(first!);
    chain.markFailure(first!);
    const next = await chain.next();
    expect(next?.model).not.toBe('claude-sonnet-4-5');
  });

  it('returns null when all models are exhausted', async () => {
    const chain = new FailoverChain(models, { cooldownMs: 60000, maxAttemptsPerModel: 1 });
    for (let i = 0; i < models.length; i++) {
      const model = await chain.next();
      expect(model).not.toBeNull();
      chain.markFailure(model!);
    }
    const result = await chain.next();
    expect(result).toBeNull();
  });

  it('recovers after cooldown elapses', async () => {
    const chain = new FailoverChain(models, { cooldownMs: 20 });
    const first = await chain.next();
    chain.markFailure(first!);
    const blocked = await chain.next();
    expect(blocked?.model).not.toBe('claude-sonnet-4-5');
    await new Promise((resolve) => setTimeout(resolve, 30));
    const recovered = await chain.next();
    expect(recovered?.model).toBe('claude-sonnet-4-5');
  });

  it('marks success to clear cooldown', async () => {
    const chain = new FailoverChain(models, { cooldownMs: 60000 });
    const first = await chain.next();
    chain.markFailure(first!);
    chain.markSuccess(first!);
    const again = await chain.next();
    expect(again?.model).toBe('claude-sonnet-4-5');
  });

  it('probes before use and skips unavailable models', async () => {
    const chain = new FailoverChain(models, { probeBeforeUse: true });
    chain.setProbe(async (model) => ({
      available: model.model !== 'gpt-4o',
      contextWindow: model.model === 'claude-sonnet-4-5' ? 200000 : 128000,
    }));
    const first = await chain.next();
    expect(first?.model).toBe('claude-sonnet-4-5');
    chain.markFailure(first!);
    const second = await chain.next();
    expect(second?.model).toBe('gpt-4o-mini');
  });

  it('computes exponential backoff', () => {
    const chain = new FailoverChain(models);
    expect(chain.backoffFor(0)).toBe(1000);
    expect(chain.backoffFor(2)).toBe(4000);
  });

  it('throws without models', () => {
    expect(() => new FailoverChain([])).toThrow('at least one model');
  });

  it('reports status with cooldowns and exhausted models', async () => {
    const chain = new FailoverChain(models, { cooldownMs: 60000, maxAttemptsPerModel: 1 });
    const first = await chain.next();
    chain.markFailure(first!);
    const status = chain.status();
    expect(status.inCooldown).toContain('anthropic:claude-sonnet-4-5');
    chain.markFailure(first!);
    chain.markFailure(first!);
    const exhausted = chain.status();
    expect(exhausted.exhausted).toContain('anthropic:claude-sonnet-4-5');
  });
});
