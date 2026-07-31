import * as fs from 'node:fs';
import * as path from 'node:path';
import { MANIFEST_PATH, type WorkspaceManifest } from './manifest.js';
import { loadManifestFile, type LoadedManifest } from './loader.js';

export interface DiscoveryResult {
  workspaceRoot: string;
  manifestPath: string;
  manifest: WorkspaceManifest;
  warnings: string[];
}

export interface DiscoveryOptions {
  /** Directory to start searching from (defaults to cwd). */
  startDir?: string;
  /** Stop walking up at this directory (inclusive). */
  stopAt?: string;
}

/**
 * Walks upward from a start directory looking for `.uch/uch.manifest.json`.
 * Returns null when no manifest is found — the workspace simply has no
 * cognitive configuration, and clients operate normally without one.
 */
export function discoverManifest(options?: DiscoveryOptions): DiscoveryResult | null {
  const startDir = path.resolve(options?.startDir ?? process.cwd());
  const stopAt = options?.stopAt ? path.resolve(options.stopAt) : path.parse(startDir).root;

  let current = startDir;
  while (true) {
    const manifestPath = path.join(current, MANIFEST_PATH);
    if (fs.existsSync(manifestPath) && fs.statSync(manifestPath).isFile()) {
      let loaded: LoadedManifest;
      try {
        loaded = loadManifestFile(manifestPath);
      } catch {
        throw new Error(`found manifest at ${manifestPath} but it is invalid`);
      }
      return {
        workspaceRoot: current,
        manifestPath,
        manifest: loaded.manifest,
        warnings: loaded.warnings,
      };
    }

    if (current === stopAt) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}
