import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeSnapshot } from '../../cognitive-plane/persistence/persistence-engine.js';
import { sha256Hex, validatePackage, type CognitivePackage, type PackageKind } from './manifest.js';

export const POLICY_QUARANTINE_DIR = 'policy-quarantine';

const PACKAGES_DIR = '.uccp/packages';
const MANIFEST_FILE = 'manifest.json';
const INSTALL_FILE = 'install.json';

export interface InstallResult {
  installed: true;
  policyPendingReview: string[];
}

export interface InstalledPackage {
  name: string;
  version: string;
  kind: PackageKind;
  installedAt: Date;
  entryCount: number;
  policyPending: string[];
}

export interface VerifyResult {
  name: string;
  version: string;
  ok: boolean;
  checked: number;
  mismatches: string[];
}

export class PackageValidationError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`package validation failed: ${reasons.join('; ')}`);
    this.name = 'PackageValidationError';
    this.reasons = reasons;
  }
}

export class PackageAlreadyInstalledError extends Error {
  constructor(name: string, version: string) {
    super(`package ${name}@${version} is already installed`);
    this.name = 'PackageAlreadyInstalledError';
  }
}

export class PackageNotInstalledError extends Error {
  constructor(name: string, version?: string) {
    super(`package ${name}${version === undefined ? '' : `@${version}`} is not installed`);
    this.name = 'PackageNotInstalledError';
  }
}

interface InstallRecord {
  name: string;
  version: string;
  kind: PackageKind;
  installedAt: string;
  policyPending: string[];
}

export function isPolicyEntry(pkg: CognitivePackage, entryPath: string): boolean {
  return pkg.kind === 'policy' || entryPath.split(/[\\/]/)[0] === 'policies';
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10));
  const pb = b.split('.').map((n) => parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export class PackageRegistry {
  private readonly rootDir: string;
  private readonly clock: () => Date;

  constructor(rootDir: string, clock: () => Date = () => new Date()) {
    this.rootDir = rootDir;
    this.clock = clock;
  }

  install(pkg: CognitivePackage): InstallResult {
    const reasons = validatePackage(pkg);
    if (reasons.length > 0) throw new PackageValidationError(reasons);
    const packageDir = this.packageDir(pkg.name, pkg.version);
    if (fs.existsSync(packageDir)) throw new PackageAlreadyInstalledError(pkg.name, pkg.version);
    const policyPending: string[] = [];
    fs.mkdirSync(packageDir, { recursive: true });
    for (const entry of pkg.entries) {
      const quarantined = isPolicyEntry(pkg, entry.path);
      const baseDir = quarantined ? path.join(packageDir, POLICY_QUARANTINE_DIR) : packageDir;
      const target = path.join(baseDir, entry.path);
      if (!isWithin(baseDir, target)) {
        throw new PackageValidationError([`entry path '${entry.path}' escapes the package root`]);
      }
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, entry.content, 'utf-8');
      if (quarantined) policyPending.push(entry.path);
    }
    writeSnapshot(path.join(packageDir, MANIFEST_FILE), pkg);
    const record: InstallRecord = {
      name: pkg.name,
      version: pkg.version,
      kind: pkg.kind,
      installedAt: this.clock().toISOString(),
      policyPending,
    };
    writeSnapshot(path.join(packageDir, INSTALL_FILE), record);
    return { installed: true, policyPendingReview: [...policyPending] };
  }

  verify(name: string, version?: string): VerifyResult {
    const resolved = version ?? this.resolveInstalledVersion(name);
    const packageDir = this.packageDir(name, resolved);
    const manifest = readPackageFile<CognitivePackage>(path.join(packageDir, MANIFEST_FILE));
    if (manifest === null) throw new PackageNotInstalledError(name, resolved);
    const record = readPackageFile<InstallRecord>(path.join(packageDir, INSTALL_FILE));
    const policyPending = new Set(record?.policyPending ?? []);
    const mismatches: string[] = [];
    let checked = 0;
    for (const entry of manifest.entries) {
      checked += 1;
      const baseDir = policyPending.has(entry.path) ? path.join(packageDir, POLICY_QUARANTINE_DIR) : packageDir;
      const file = path.join(baseDir, entry.path);
      if (!fs.existsSync(file)) {
        mismatches.push(entry.path);
        continue;
      }
      if (sha256Hex(fs.readFileSync(file, 'utf-8')) !== entry.hash) mismatches.push(entry.path);
    }
    return { name, version: resolved, ok: mismatches.length === 0, checked, mismatches };
  }

  remove(name: string): boolean {
    const base = this.packagesBase();
    if (!fs.existsSync(base)) return false;
    let removed = false;
    for (const dirName of fs.readdirSync(base)) {
      const match = /^(.+)@(\d+\.\d+\.\d+)$/.exec(dirName);
      if (match === null || match[1] !== name) continue;
      fs.rmSync(path.join(base, dirName), { recursive: true, force: true });
      removed = true;
    }
    return removed;
  }

  list(): InstalledPackage[] {
    const base = this.packagesBase();
    if (!fs.existsSync(base)) return [];
    const installed: InstalledPackage[] = [];
    for (const dirName of fs.readdirSync(base)) {
      const match = /^(.+)@(\d+\.\d+\.\d+)$/.exec(dirName);
      if (match === null) continue;
      const packageDir = path.join(base, dirName);
      const manifest = readPackageFile<CognitivePackage>(path.join(packageDir, MANIFEST_FILE));
      if (manifest === null) continue;
      const record = readPackageFile<InstallRecord>(path.join(packageDir, INSTALL_FILE));
      installed.push({
        name: manifest.name,
        version: manifest.version,
        kind: manifest.kind,
        installedAt: record === null ? new Date(0) : new Date(record.installedAt),
        entryCount: manifest.entries.length,
        policyPending: [...(record?.policyPending ?? [])],
      });
    }
    installed.sort(
      (a, b) => a.name.localeCompare(b.name) || compareVersions(a.version, b.version),
    );
    return installed;
  }

  private resolveInstalledVersion(name: string): string {
    const versions = this.installedVersions(name);
    if (versions.length === 0) throw new PackageNotInstalledError(name);
    return versions.reduce((best, v) => (compareVersions(v, best) > 0 ? v : best));
  }

  private installedVersions(name: string): string[] {
    const base = this.packagesBase();
    if (!fs.existsSync(base)) return [];
    const versions: string[] = [];
    for (const dirName of fs.readdirSync(base)) {
      const match = /^(.+)@(\d+\.\d+\.\d+)$/.exec(dirName);
      if (match !== null && match[1] === name) versions.push(match[2]!);
    }
    versions.sort(compareVersions);
    return versions;
  }

  private packagesBase(): string {
    return path.join(this.rootDir, PACKAGES_DIR);
  }

  private packageDir(name: string, version: string): string {
    return path.join(this.rootDir, PACKAGES_DIR, `${name}@${version}`);
  }
}

function isWithin(parent: string, target: string): boolean {
  const rel = path.relative(parent, target);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function readPackageFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}
