import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MANIFEST_PATH,
  MANIFEST_SCHEMA_VERSION,
  type WorkspaceManifest,
  validateManifest,
} from './manifest.js';

export class ManifestError extends Error {
  readonly issues: Array<{ severity: 'error' | 'warning'; message: string }>;

  constructor(issues: Array<{ severity: 'error' | 'warning'; message: string }>) {
    super(issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
    this.name = 'ManifestError';
    this.issues = issues;
  }
}

export interface LoadedManifest {
  manifest: WorkspaceManifest;
  warnings: string[];
}

export function parseManifest(content: string): LoadedManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(content) as unknown;
  } catch (err) {
    throw new ManifestError([
      { severity: 'error', message: `invalid JSON: ${err instanceof Error ? err.message : String(err)}` },
    ]);
  }

  const result = validateManifest(raw);
  if (!result.valid) {
    throw new ManifestError(result.issues);
  }

  const warnings = result.issues
    .filter((i) => i.severity === 'warning')
    .map((i) => i.message);

  return { manifest: raw as WorkspaceManifest, warnings };
}

/** Loads a manifest from a file path. Throws ManifestError on invalid input. */
export function loadManifestFile(manifestPath: string): LoadedManifest {
  let content: string;
  try {
    content = fs.readFileSync(manifestPath, 'utf-8');
  } catch (err) {
    throw new ManifestError([
      { severity: 'error', message: `cannot read manifest at ${manifestPath}: ${err instanceof Error ? err.message : String(err)}` },
    ]);
  }
  return parseManifest(content);
}

export interface CreateManifestOptions {
  name: string;
  id?: string;
  purpose?: string;
  domain?: string;
  mission?: string;
  minUchVersion?: string;
  capabilities?: Array<{ name: string; enabled: boolean }>;
  drivers?: Array<{ id: string; enabled: boolean; config?: Record<string, unknown> }>;
  skills?: string[];
  policies?: WorkspaceManifest['policies'];
  metadata?: Record<string, unknown>;
}

/** Creates a default manifest for a workspace. */
export function createManifest(options: CreateManifestOptions): WorkspaceManifest {
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    manifest_version: '0.1.0',
    workspace: {
      id: options.id,
      name: options.name,
      purpose: options.purpose,
      domain: options.domain,
      mission: options.mission,
    },
    runtime: {
      min_uch_version: options.minUchVersion ?? '0.1.0',
    },
    capabilities: options.capabilities,
    drivers: options.drivers,
    skills: options.skills,
    policies: options.policies,
    metadata: options.metadata,
  };
}

/** Writes a manifest to `<root>/.uch/uch.manifest.json`, creating `.uch/` if needed. */
export function writeManifest(workspaceRoot: string, manifest: WorkspaceManifest): string {
  const targetDir = path.join(workspaceRoot, '.uch');
  fs.mkdirSync(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, MANIFEST_PATH.split('/').pop()!);
  fs.writeFileSync(targetPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  return targetPath;
}
