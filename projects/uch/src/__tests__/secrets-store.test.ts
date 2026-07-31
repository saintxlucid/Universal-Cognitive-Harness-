import { describe, it, expect } from 'vitest';
import { SecretsStore } from '../control-plane/secrets/secrets-store.js';

describe('SecretsStore', () => {
  it('stores and retrieves secrets', () => {
    const store = new SecretsStore('a'.repeat(64));
    store.set('api-key', 'sk-12345');
    expect(store.get('api-key')).toBe('sk-12345');
  });

  it('returns null for missing keys', () => {
    const store = new SecretsStore('a'.repeat(64));
    expect(store.get('nonexistent')).toBeNull();
  });

  it('checks key existence', () => {
    const store = new SecretsStore('a'.repeat(64));
    store.set('exists', 'value');
    expect(store.has('exists')).toBe(true);
    expect(store.has('missing')).toBe(false);
  });

  it('deletes secrets', () => {
    const store = new SecretsStore('a'.repeat(64));
    store.set('temp', 'value');
    expect(store.delete('temp')).toBe(true);
    expect(store.has('temp')).toBe(false);
  });

  it('lists keys', () => {
    const store = new SecretsStore('a'.repeat(64));
    store.set('key1', 'v1');
    store.set('key2', 'v2');
    expect(store.listKeys()).toEqual(expect.arrayContaining(['key1', 'key2']));
  });

  it('returns metadata', () => {
    const store = new SecretsStore('a'.repeat(64));
    store.set('key', 'value', { env: 'prod' });
    expect(store.getMetadata('key')).toEqual({ env: 'prod' });
  });

  it('counts secrets', () => {
    const store = new SecretsStore('a'.repeat(64));
    expect(store.count()).toBe(0);
    store.set('a', '1');
    store.set('b', '2');
    expect(store.count()).toBe(2);
  });

  it('clears all secrets', () => {
    const store = new SecretsStore('a'.repeat(64));
    store.set('a', '1');
    store.set('b', '2');
    store.clear();
    expect(store.count()).toBe(0);
  });

  it('persists and loads from file', async () => {
    const store = new SecretsStore('a'.repeat(64));
    store.set('key1', 'secret-value');

    await store.persist('/tmp/test-secrets.json');
    const store2 = new SecretsStore();
    const count = await store2.load('/tmp/test-secrets.json');

    expect(count).toBe(1);
    expect(store2.get('key1')).toBe('secret-value');
  });
});
