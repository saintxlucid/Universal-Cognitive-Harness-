export type PackageKind = 'driver' | 'skill' | 'policy' | 'instrument';

export const PACKAGE_KINDS: readonly PackageKind[] = ['driver', 'skill', 'policy', 'instrument'];

export const EXECUTING_KINDS: ReadonlySet<PackageKind> = new Set(['driver', 'instrument']);

export const PACKAGE_SCHEMA = 'uch.package.v1';

export interface PackageProvenance {
  author?: string;
  signature?: string;
  source?: string;
  published_at?: string;
}

export interface PackageRequires {
  substrate?: string;
  packages?: string[];
}

export interface CognitivePackageManifest {
  schema: typeof PACKAGE_SCHEMA;
  name: string;
  version: string;
  kind: PackageKind;
  entry: string | null;
  level_claims?: Record<string, number>;
  requires?: PackageRequires;
  capabilities?: string[];
  permissions?: string[];
  retention?: Record<string, number>;
  provenance?: PackageProvenance;
  payload: string[];
}

export type ManifestResult =
  | { ok: true; manifest: CognitivePackageManifest }
  | { ok: false; errors: string[] };

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;
const VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return isRecord(value) && Object.values(value).every((v) => typeof v === 'number');
}

export function validatePackageManifest(input: unknown): ManifestResult {
  const errors: string[] = [];

  if (!isRecord(input)) {
    return { ok: false, errors: ['manifest must be an object'] };
  }

  if (input['schema'] !== PACKAGE_SCHEMA) {
    errors.push(`schema must be "${PACKAGE_SCHEMA}"`);
  }
  if (!isString(input['name']) || !NAME_RE.test(input['name'])) {
    errors.push('name must match [a-z0-9][a-z0-9-]*');
  }
  if (!isString(input['version']) || !VERSION_RE.test(input['version'])) {
    errors.push('version must be semver (MAJOR.MINOR.PATCH)');
  }
  if (!isString(input['kind']) || !(PACKAGE_KINDS as readonly string[]).includes(input['kind'])) {
    errors.push('kind must be one of driver | skill | policy | instrument');
  }
  if (!isStringArray(input['payload']) || input['payload'].length === 0) {
    errors.push('payload must be a non-empty array of file paths');
  }

  const kind = input['kind'] as PackageKind;
  if (isRecord(input) && PACKAGE_KINDS.includes(kind)) {
    const entry = input['entry'];
    if (EXECUTING_KINDS.has(kind)) {
      if (!isString(entry) || entry.length === 0) {
        errors.push('entry is required for executing package kinds (driver, instrument)');
      }
    } else if (entry !== null) {
      errors.push('entry must be null for data-only package kinds (skill, policy)');
    }
  }

  if (input['capabilities'] !== undefined && !isStringArray(input['capabilities'])) {
    errors.push('capabilities must be an array of strings');
  }
  if (input['permissions'] !== undefined && !isStringArray(input['permissions'])) {
    errors.push('permissions must be an array of strings');
  }

  const levelClaims = input['level_claims'];
  if (levelClaims !== undefined) {
    if (!isNumberRecord(levelClaims)) {
      errors.push('level_claims must be a record of numbers');
    } else {
      for (const [rail, level] of Object.entries(levelClaims)) {
        if (!Number.isInteger(level) || level < 0 || level > 4) {
          errors.push(`level_claims.${rail} must be an integer between 0 and 4`);
        }
      }
    }
  }

  const requires = input['requires'];
  if (requires !== undefined) {
    if (!isRecord(requires)) {
      errors.push('requires must be an object');
    } else {
      if (requires['substrate'] !== undefined && !isString(requires['substrate'])) {
        errors.push('requires.substrate must be a semver range string');
      }
      if (requires['packages'] !== undefined && !isStringArray(requires['packages'])) {
        errors.push('requires.packages must be an array of "name@range" strings');
      }
    }
  }

  if (input['retention'] !== undefined && !isNumberRecord(input['retention'])) {
    errors.push('retention must be a record of numbers');
  }

  const provenance = input['provenance'];
  if (provenance !== undefined) {
    if (!isRecord(provenance)) {
      errors.push('provenance must be an object');
    } else {
      const keys = ['author', 'signature', 'source', 'published_at'] as const;
      for (const key of keys) {
        if (provenance[key] !== undefined && !isString(provenance[key])) {
          errors.push(`provenance.${key} must be a string`);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    manifest: {
      schema: PACKAGE_SCHEMA,
      name: input['name'] as string,
      version: input['version'] as string,
      kind: input['kind'] as PackageKind,
      entry: input['entry'] === undefined ? null : (input['entry'] as string | null),
      level_claims: levelClaims as Record<string, number> | undefined,
      requires: requires as PackageRequires | undefined,
      capabilities: input['capabilities'] as string[] | undefined,
      permissions: input['permissions'] as string[] | undefined,
      retention: input['retention'] as Record<string, number> | undefined,
      provenance: provenance as PackageProvenance | undefined,
      payload: input['payload'] as string[],
    },
  };
}
