import { describe, it, expect, vi, afterEach } from 'vitest';
import { AvailabilityRegistry, withTimeout, DEFAULT_AVAILABILITY_TTL_MS } from '../tools/availability.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('AvailabilityRegistry', () => {
  it('probes on first call and caches the result', async () => {
    const probe = vi.fn(() => true);
    const registry = new AvailabilityRegistry();
    registry.register('web_fetch', probe);
    expect(await registry.isAvailable('web_fetch')).toBe(true);
    expect(await registry.isAvailable('web_fetch')).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('caches false results too', async () => {
    const probe = vi.fn(() => false);
    const registry = new AvailabilityRegistry();
    registry.register('x', probe);
    expect(await registry.isAvailable('x')).toBe(false);
    expect(await registry.isAvailable('x')).toBe(false);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('returns false for unregistered tools', async () => {
    const registry = new AvailabilityRegistry();
    expect(await registry.isAvailable('nope')).toBe(false);
  });

  it('expires the cache after TTL', async () => {
    vi.useFakeTimers();
    let available = true;
    const probe = vi.fn(() => available);
    const registry = new AvailabilityRegistry();
    registry.register('x', probe, { ttlMs: 100 });
    expect(await registry.isAvailable('x')).toBe(true);
    available = false;
    await vi.advanceTimersByTimeAsync(150);
    expect(await registry.isAvailable('x')).toBe(false);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('default TTL is 30 seconds', () => {
    expect(DEFAULT_AVAILABILITY_TTL_MS).toBe(30_000);
  });

  it('invalidates a single entry', async () => {
    let available = true;
    const registry = new AvailabilityRegistry();
    registry.register('a', () => available);
    registry.register('b', () => true);
    expect(await registry.isAvailable('a')).toBe(true);
    available = false;
    expect(await registry.isAvailable('a')).toBe(true);
    registry.invalidate('a');
    expect(await registry.isAvailable('a')).toBe(false);
    expect(await registry.isAvailable('b')).toBe(true);
  });

  it('invalidates all entries via generation bump', async () => {
    let available = true;
    const registry = new AvailabilityRegistry();
    registry.register('a', () => available);
    registry.register('b', () => available);
    expect(await registry.isAvailable('a')).toBe(true);
    expect(await registry.isAvailable('b')).toBe(true);
    available = false;
    expect(await registry.isAvailable('a')).toBe(true);
    registry.invalidateAll();
    expect(await registry.isAvailable('a')).toBe(false);
    expect(await registry.isAvailable('b')).toBe(false);
  });

  it('treats probe failures as unavailable', async () => {
    const probe = vi.fn(() => {
      throw new Error('probe failed');
    });
    const registry = new AvailabilityRegistry();
    registry.register('x', probe);
    expect(await registry.isAvailable('x')).toBe(false);
  });

  it('coalesces concurrent probes into one call', async () => {
    let resolveProbe: (value: boolean) => void = () => {};
    const probe = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveProbe = resolve;
        }),
    );
    const registry = new AvailabilityRegistry();
    registry.register('x', probe);
    const first = registry.isAvailable('x');
    const second = registry.isAvailable('x');
    resolveProbe(true);
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('times out slow probes', async () => {
    const registry = new AvailabilityRegistry();
    registry.register('x', () => new Promise(() => {}), { probeTimeoutMs: 20 });
    expect(await registry.isAvailable('x')).toBe(false);
  });

  it('unregisters and clears', async () => {
    const registry = new AvailabilityRegistry();
    registry.register('a', () => true);
    registry.register('b', () => true);
    expect(registry.names()).toEqual(['a', 'b']);
    expect(registry.unregister('a')).toBe(true);
    expect(registry.has('a')).toBe(false);
    registry.clear();
    expect(registry.names()).toEqual([]);
  });

  it('re-register replaces the probe and resets cache', async () => {
    let available = false;
    const registry = new AvailabilityRegistry();
    registry.register('x', () => available);
    expect(await registry.isAvailable('x')).toBe(false);
    available = true;
    registry.register('x', () => available);
    expect(await registry.isAvailable('x')).toBe(true);
  });
});

describe('withTimeout', () => {
  it('resolves before timeout', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 100)).resolves.toBe('ok');
  });

  it('rejects when the promise hangs', async () => {
    await expect(withTimeout(new Promise(() => {}), 10)).rejects.toThrow('timed out');
  });
});
