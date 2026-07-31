// ── Workspace Manifest (schema + types) ─────────────────────────────────
// The versioned cognitive configuration of a workspace, discoverable by any
// attached client. Mirrors the spirit of package.json / Cargo.toml but for
// cognitive runtime configuration: identity, runtime requirements,
// capabilities, drivers, skills, and policies.
// ────────────────────────────────────────────────────────────────────────

export const MANIFEST_SCHEMA_VERSION = 'uch.manifest.v1';
export const MANIFEST_FILE_NAME = 'uch.manifest.json';
export const MANIFEST_DIR_NAME = '.uch';
export const MANIFEST_PATH = `${MANIFEST_DIR_NAME}/${MANIFEST_FILE_NAME}`;

export interface ManifestCapabilityEntry {
  name: string;
  version?: string;
  enabled: boolean;
}

export interface ManifestDriverEntry {
  id: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface ManifestEndpoint {
  type: 'local' | 'http' | 'ipc';
  url?: string;
}

export interface ManifestPolicyEntry {
  id: string;
  effect: 'allow' | 'deny';
  principals?: string[];
  actions?: string[];
  resources?: string[];
}

export interface WorkspaceManifest {
  schema_version: string;
  manifest_version: string;
  workspace: {
    id?: string;
    name: string;
    purpose?: string;
    domain?: string;
    mission?: string;
    personality?: {
      naming_convention?: string;
      test_style?: string;
      commit_style?: string;
      code_formality?: string;
      documentation_quality?: string;
      error_handling?: string;
    };
  };
  runtime: {
    min_uch_version: string;
    endpoint?: ManifestEndpoint;
  };
  capabilities?: ManifestCapabilityEntry[];
  drivers?: ManifestDriverEntry[];
  skills?: string[];
  policies?: ManifestPolicyEntry[];
  mcp_servers?: string[];
  metadata?: Record<string, unknown>;
}

export interface ManifestValidationResult {
  valid: boolean;
  issues: Array<{ severity: 'error' | 'warning'; message: string }>;
}

export interface VersionNegotiation {
  compatible: boolean;
  required: string;
  current: string;
  reason?: string;
}

const REQUIRED_STRING_FIELDS: Array<{ path: string[]; message: string }> = [
  { path: ['manifest_version'], message: 'manifest_version must be a non-empty string' },
  { path: ['workspace', 'name'], message: 'workspace.name must be a non-empty string' },
  { path: ['runtime', 'min_uch_version'], message: 'runtime.min_uch_version must be a non-empty string' },
];

function pathString(raw: unknown, path: string[]): unknown {
  let cur: unknown = raw;
  for (const key of path) {
    if (typeof cur !== 'object' || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function pushRequiredStringErrors(m: Partial<WorkspaceManifest>, issues: ManifestValidationResult['issues']): void {
  for (const { path, message } of REQUIRED_STRING_FIELDS) {
    const value = pathString(m, path);
    if (typeof value !== 'string' || value.trim() === '') {
      issues.push({ severity: 'error', message });
    }
  }
}

function validateEntryArray(
  raw: unknown,
  name: 'capabilities' | 'drivers',
  key: 'name' | 'id',
  issues: ManifestValidationResult['issues'],
): void {
  if (raw === undefined) return;
  if (!Array.isArray(raw)) {
    issues.push({ severity: 'error', message: `${name} must be an array` });
    return;
  }
  for (const [i, entry] of raw.entries()) {
    if (typeof entry !== 'object' || entry === null || typeof (entry as Record<string, unknown>)[key] !== 'string') {
      issues.push({ severity: 'error', message: `${name}[${i}] must have a string ${key}` });
    }
  }
}

export function validateManifest(raw: unknown): ManifestValidationResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { valid: false, issues: [{ severity: 'error', message: 'manifest must be a JSON object' }] };
  }

  const m = raw as Partial<WorkspaceManifest>;
  const issues: ManifestValidationResult['issues'] = [];

  if (m.schema_version !== MANIFEST_SCHEMA_VERSION) {
    issues.push({
      severity: 'error',
      message: `unsupported schema_version "${String(m.schema_version)}" (expected "${MANIFEST_SCHEMA_VERSION}")`,
    });
  }

  pushRequiredStringErrors(m, issues);
  validateEntryArray(m.capabilities, 'capabilities', 'name', issues);
  validateEntryArray(m.drivers, 'drivers', 'id', issues);

  if (m.skills !== undefined && !Array.isArray(m.skills)) {
    issues.push({ severity: 'error', message: 'skills must be an array of paths' });
  }

  if (m.policies !== undefined && !Array.isArray(m.policies)) {
    issues.push({ severity: 'error', message: 'policies must be an array' });
  }

  return { valid: issues.every((i) => i.severity !== 'error'), issues };
}

/** Compares two dotted numeric versions. Returns -1 | 0 | 1. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = a.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const pb = b.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const av = pa[i] ?? 0;
    const bv = pb[i] ?? 0;
    if (av < bv) return -1;
    if (av > bv) return 1;
  }
  return 0;
}

/** Negotiates runtime-version compatibility between a manifest and the running harness. */
export function negotiateVersion(manifest: WorkspaceManifest, currentVersion: string): VersionNegotiation {
  const required = manifest.runtime.min_uch_version;
  const cmp = compareVersions(currentVersion, required);
  if (cmp < 0) {
    return {
      compatible: false,
      required,
      current: currentVersion,
      reason: `manifest requires uch >= ${required}, running ${currentVersion}`,
    };
  }
  return { compatible: true, required, current: currentVersion };
}
