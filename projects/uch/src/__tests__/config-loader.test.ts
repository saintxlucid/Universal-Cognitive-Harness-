import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../control-plane/config/config-loader.js';

describe('ConfigLoader', () => {
  it('creates empty config', () => {
    const loader = new ConfigLoader();
    expect(loader.get()).toEqual({});
  });

  it('merges configs', () => {
    const loader = new ConfigLoader({ server: { name: 'test' } });
    loader.merge({ server: { port: 3200 } });
    expect(loader.get().server?.name).toBe('test');
    expect(loader.get().server?.port).toBe(3200);
  });

  it('resolves config', () => {
    const loader = new ConfigLoader({ server: { name: 'uccp' } });
    expect(loader.resolve().server?.name).toBe('uccp');
  });

  it('handles partial configs', () => {
    const loader = new ConfigLoader({ drivers: { filesystem: { rootPath: '/workspace' } } });
    expect(loader.get().drivers?.filesystem?.rootPath).toBe('/workspace');
    expect(loader.get().drivers?.git).toBeUndefined();
  });

  it('loads from file', () => {
    const loader = ConfigLoader.fromFile('nonexistent.json');
    expect(loader.get()).toEqual({});
  });
});
