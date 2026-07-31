import { describe, it, expect } from 'vitest';
import { CredentialPool, type PoolCredential } from '../credential-pool.js';

const keys: PoolCredential[] = [
  { id: 'k1', provider: 'openai', apiKey: 'sk-a', priority: 0 },
  { id: 'k2', provider: 'openai', apiKey: 'sk-b', priority: 1 },
  { id: 'k3', provider: 'anthropic', apiKey: 'sk-c', priority: 0 },
];

describe('CredentialPool', () => {
  it('selects credentials round-robin', () => {
    const pool = new CredentialPool(keys);
    expect(pool.select('openai')?.id).toBe('k1');
    expect(pool.select('openai')?.id).toBe('k2');
    expect(pool.select('openai')?.id).toBe('k1');
  });

  it('filters by provider', () => {
    const pool = new CredentialPool(keys);
    const selected = pool.select('anthropic');
    expect(selected?.id).toBe('k3');
    expect(pool.select('google')).toBeNull();
  });

  it('returns null when empty', () => {
    const pool = new CredentialPool();
    expect(pool.select()).toBeNull();
  });

  it('rotates away from exhausted keys and recovers after TTL', async () => {
    const pool = new CredentialPool(keys, { exhaustionTtlMs: 25, failureThreshold: 2 });
    pool.markFailure('k1', '429');
    expect(pool.select('openai')?.id).toBe('k2');
    await new Promise((resolve) => setTimeout(resolve, 35));
    expect(pool.select('openai')?.id).toBe('k1');
  });

  it('exhausts after threshold failures', () => {
    const pool = new CredentialPool(keys, { failureThreshold: 3 });
    pool.markFailure('k1');
    pool.markFailure('k1');
    expect(pool.isAvailable('k1')).toBe(true);
    pool.markFailure('k1');
    expect(pool.isAvailable('k1')).toBe(false);
  });

  it('tracks health metrics', () => {
    const pool = new CredentialPool([keys[0]]);
    pool.markSuccess('k1');
    pool.markFailure('k1', '429');
    const health = pool.healthOf('k1');
    expect(health?.totalSuccesses).toBe(1);
    expect(health?.totalFailures).toBe(1);
    expect(health?.state).toBe('exhausted');
    expect(health?.exhaustedUntil).not.toBeNull();
  });

  it('disables keys with permanent auth errors', () => {
    const pool = new CredentialPool([keys[0]]);
    pool.markFailure('k1', 'invalid_api_key');
    expect(pool.isAvailable('k1')).toBe(false);
    expect(pool.select()?.id ?? null).toBeNull();
  });

  it('marks success to restore availability', () => {
    const pool = new CredentialPool([keys[0]], { failureThreshold: 1 });
    pool.markFailure('k1');
    expect(pool.isAvailable('k1')).toBe(false);
    pool.markSuccess('k1');
    expect(pool.isAvailable('k1')).toBe(true);
    expect(pool.select()?.id).toBe('k1');
  });

  it('respects priority ordering mode', () => {
    const pool = new CredentialPool(keys, { rotation: 'priority' });
    expect(pool.select('openai')?.id).toBe('k1');
    expect(pool.select('openai')?.id).toBe('k1');
  });

  it('adds, removes, and lists credentials', () => {
    const pool = new CredentialPool();
    pool.add({ id: 'a', provider: 'openai', apiKey: 'x' });
    pool.add({ id: 'b', provider: 'openai', apiKey: 'y' });
    expect(pool.size()).toBe(2);
    expect(pool.remove('a')).toBe(true);
    expect(pool.size()).toBe(1);
    expect(pool.get('a')).toBeUndefined();
    expect(pool.list().map((c) => c.id)).toEqual(['b']);
  });

  it('updates existing credentials by id', () => {
    const pool = new CredentialPool([{ id: 'a', provider: 'openai', apiKey: 'x' }]);
    pool.add({ id: 'a', provider: 'openai', apiKey: 'y' });
    expect(pool.get('a')?.apiKey).toBe('y');
  });

  it('rejects invalid credentials', () => {
    const pool = new CredentialPool();
    expect(() => pool.add({ id: '', provider: 'openai', apiKey: 'x' })).toThrow();
    expect(() => pool.add({ id: 'a', provider: '', apiKey: 'x' })).toThrow();
    expect(() => pool.add({ id: 'a', provider: 'openai', apiKey: '' })).toThrow();
  });

  it('resets health state', () => {
    const pool = new CredentialPool([keys[0]], { failureThreshold: 1 });
    pool.markFailure('k1');
    expect(pool.isAvailable('k1')).toBe(false);
    pool.reset();
    expect(pool.isAvailable('k1')).toBe(true);
  });

  it('lists distinct providers', () => {
    const pool = new CredentialPool(keys);
    expect(pool.providers()).toEqual(['anthropic', 'openai']);
  });
});
