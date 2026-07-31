import { describe, it, expect } from 'vitest';
import { PluginLoader } from '../control-plane/plugins/plugin-loader.js';

describe('PluginLoader', () => {
  it('starts empty', () => {
    const loader = new PluginLoader('/tmp/nonexistent-plugins');
    expect(loader.count()).toBe(0);
  });

  it('handles non-existent plugin directory', async () => {
    const loader = new PluginLoader('/tmp/nonexistent-plugins');
    const loaded = await loader.loadAll();
    expect(loaded).toHaveLength(0);
  });

  it('returns null for missing plugin', async () => {
    const loader = new PluginLoader('/tmp');
    const plugin = await loader.loadPlugin('/tmp/nonexistent-plugin');
    expect(plugin).toBeNull();
  });

  it('supports hook registration and execution', async () => {
    const loader = new PluginLoader('/tmp');
    loader.registerHook('pre:tool_call', { name: 'log-call', handler: (...args: unknown[]) => `called ${args[0]}` });
    loader.registerHook('pre:tool_call', { name: 'validate', handler: (...args: unknown[]) => `validated ${args[0]}` });

    const results = await loader.executeHook('pre:tool_call', 'eslint');
    expect(results).toHaveLength(2);
    expect(results[0]).toBe('called eslint');
    expect(results[1]).toBe('validated eslint');
  });

  it('handles hooks with no handlers', async () => {
    const loader = new PluginLoader('/tmp');
    const results = await loader.executeHook('nonexistent:hook', 'arg');
    expect(results).toEqual([]);
  });
});
