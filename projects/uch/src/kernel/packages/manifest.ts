import { createHash } from 'node:crypto';

export type PackageKind = 'skill' | 'policy' | 'knowledge' | 'brain';

export interface PackageEntry {
  path: string;
  content: string;
  hash: string;
}

export interface CognitivePackage {
  name: string;
  version: string;
  kind: PackageKind;
  entries: PackageEntry[];
  requires?: string[];
}

export const NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;
export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const KINDS: readonly PackageKind[] = ['skill', 'policy', 'knowledge', 'brain'];

export function sha256Hex(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function isAbsolutePath(entryPath: string): boolean {
  return (
    entryPath.startsWith('/') ||
    entryPath.startsWith('\\') ||
    /^[a-zA-Z]:/.test(entryPath)
  );
}

export function validatePackage(pkg: CognitivePackage): string[] {
  const reasons: string[] = [];
  if (!NAME_PATTERN.test(pkg.name)) reasons.push(`invalid name '${pkg.name}'`);
  if (!VERSION_PATTERN.test(pkg.version)) reasons.push(`invalid version '${pkg.version}'`);
  if (!KINDS.includes(pkg.kind)) reasons.push(`invalid kind '${String(pkg.kind)}'`);
  if (pkg.entries.length === 0) reasons.push('package must declare at least one entry');
  const seenPaths = new Set<string>();
  for (const entry of pkg.entries) {
    if (entry.path === '') {
      reasons.push('entry path must not be empty');
    } else if (isAbsolutePath(entry.path)) {
      reasons.push(`entry path '${entry.path}' must be relative`);
    }
    if (entry.path.split(/[\\/]/).includes('..')) {
      reasons.push(`entry path '${entry.path}' must not escape the package root`);
    }
    if (seenPaths.has(entry.path)) reasons.push(`duplicate entry path '${entry.path}'`);
    seenPaths.add(entry.path);
    if (entry.hash !== sha256Hex(entry.content)) reasons.push(`hash mismatch for entry '${entry.path}'`);
  }
  for (const required of pkg.requires ?? []) {
    if (!NAME_PATTERN.test(required)) reasons.push(`invalid requires entry '${required}'`);
  }
  return reasons;
}
