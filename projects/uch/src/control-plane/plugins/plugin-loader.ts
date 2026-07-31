import * as fs from 'node:fs';
import * as path from 'node:path';

export interface PluginManifest {
  name: string;
  version: string;
  description: string;
  entryPoint: string;
  requires: string[];
  provides: string[];
}

export interface PluginAPI {
  manifest: PluginManifest;
  initialize: () => Promise<void>;
  shutdown: () => Promise<void>;
  [key: string]: unknown;
}

export interface PluginHook {
  name: string;
  handler: (...args: unknown[]) => unknown | Promise<unknown>;
}

export class PluginLoader {
  private plugins: Map<string, PluginAPI> = new Map();
  private hooks: Map<string, PluginHook[]> = new Map();
  private pluginDir: string;

  constructor(pluginDir?: string) {
    this.pluginDir = pluginDir ?? 'plugins';
  }

  async loadPlugin(dirPath: string): Promise<PluginAPI | null> {
    const manifestPath = path.join(dirPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) return null;

    const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    if (this.plugins.has(manifest.name)) {
      return null;
    }

    const entryPath = path.resolve(dirPath, manifest.entryPoint);
    if (!fs.existsSync(entryPath)) return null;

    try {
      const mod = await import(entryPath);
      const plugin: PluginAPI = {
        manifest,
        initialize: mod.initialize ?? (async () => {}),
        shutdown: mod.shutdown ?? (async () => {}),
      };

      this.plugins.set(manifest.name, plugin);

      if (mod.hooks) {
        for (const hook of mod.hooks as PluginHook[]) {
          this.registerHook(hook.name, hook);
        }
      }

      return plugin;
    } catch {
      return null;
    }
  }

  async loadAll(): Promise<PluginAPI[]> {
    const loaded: PluginAPI[] = [];
    if (!fs.existsSync(this.pluginDir)) return loaded;

    const entries = fs.readdirSync(this.pluginDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const plugin = await this.loadPlugin(path.join(this.pluginDir, entry.name));
        if (plugin) loaded.push(plugin);
      }
    }

    return loaded;
  }

  async initializeAll(): Promise<void> {
    for (const [, plugin] of this.plugins) {
      await plugin.initialize();
    }
  }

  async shutdownAll(): Promise<void> {
    for (const [, plugin] of this.plugins) {
      await plugin.shutdown();
    }
  }

  getPlugin(name: string): PluginAPI | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): PluginAPI[] {
    return [...this.plugins.values()];
  }

  registerHook(name: string, hook: PluginHook): void {
    const hooks = this.hooks.get(name) ?? [];
    hooks.push(hook);
    this.hooks.set(name, hooks);
  }

  async executeHook(name: string, ...args: unknown[]): Promise<unknown[]> {
    const hooks = this.hooks.get(name) ?? [];
    const results: unknown[] = [];
    for (const hook of hooks) {
      try {
        const result = await Promise.resolve(hook.handler(...args));
        results.push(result);
      } catch {
        results.push(null);
      }
    }
    return results;
  }

  count(): number {
    return this.plugins.size;
  }
}
