import * as fs from 'node:fs';
import * as path from 'node:path';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import { dateReviver } from '../../cognitive-plane/persistence/persistence-engine.js';
import { validatePackageManifest, type CognitivePackageManifest } from './package-manifest.js';

export type PackageAction = 'install' | 'update' | 'remove' | 'revoke';

export interface PackageAuditEntry {
  action: PackageAction;
  name: string;
  version: string;
  at: Date;
}

export interface InstalledPackage {
  manifest: CognitivePackageManifest;
  installedAt: Date;
  active: boolean;
  revoked: boolean;
  activeSessions: number;
}

export class PackageStore {
  private packages = new Map<string, Map<string, InstalledPackage>>();
  private auditLedger: PackageAuditEntry[] = [];
  private eventBus?: NeuralEventBus;

  constructor(eventBus?: NeuralEventBus) {
    this.eventBus = eventBus;
  }

  install(manifest: CognitivePackageManifest): boolean {
    const validated = validatePackageManifest(manifest);
    if (!validated.ok) return false;
    const versions = this.versionsOf(validated.manifest.name);
    if (versions.has(validated.manifest.version)) return false;

    versions.set(validated.manifest.version, {
      manifest: validated.manifest,
      installedAt: new Date(),
      active: false,
      revoked: false,
      activeSessions: 0,
    });
    this.record('install', validated.manifest);
    return true;
  }

  update(manifest: CognitivePackageManifest): boolean {
    const validated = validatePackageManifest(manifest);
    if (!validated.ok) return false;
    const versions = this.versionsOf(validated.manifest.name);
    if (versions.size === 0) return false;

    const existing = versions.get(validated.manifest.version);
    if (existing) {
      existing.manifest = validated.manifest;
    } else {
      versions.set(validated.manifest.version, {
        manifest: validated.manifest,
        installedAt: new Date(),
        active: false,
        revoked: false,
        activeSessions: 0,
      });
    }
    this.record('update', validated.manifest);
    return true;
  }

  remove(name: string): boolean {
    const versions = this.packages.get(name);
    if (!versions) return false;
    if ([...versions.values()].some((p) => p.activeSessions > 0)) return false;

    this.packages.delete(name);
    const latest = this.latestOf(versions);
    if (latest) this.record('remove', latest.manifest);
    return true;
  }

  attach(name: string): boolean {
    const target = this.get(name);
    if (!target || target.revoked) return false;
    target.activeSessions += 1;
    target.active = true;
    return true;
  }

  detach(name: string): void {
    const target = this.get(name);
    if (!target) return;
    target.activeSessions = Math.max(0, target.activeSessions - 1);
    if (target.activeSessions === 0) {
      target.active = false;
    }
  }

  revoke(name: string): boolean {
    const target = this.get(name);
    if (!target) return false;
    target.revoked = true;
    this.record('revoke', target.manifest);
    return true;
  }

  /** The active version, else the most recently installed version. */
  get(name: string): InstalledPackage | undefined {
    const versions = this.packages.get(name);
    if (!versions || versions.size === 0) return undefined;
    const active = [...versions.values()].find((p) => p.activeSessions > 0);
    return active ?? this.latestOf(versions);
  }

  list(): InstalledPackage[] {
    const result: InstalledPackage[] = [];
    for (const versions of this.packages.values()) {
      result.push(...versions.values());
    }
    return result;
  }

  audit(): PackageAuditEntry[] {
    return [...this.auditLedger];
  }

  async persist(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const snapshot = {
      packages: this.list().map((p) => ({
        manifest: p.manifest,
        installedAt: p.installedAt.toISOString(),
        active: p.active,
        revoked: p.revoked,
        activeSessions: p.activeSessions,
      })),
      audit: this.auditLedger.map((e) => ({ ...e, at: e.at.toISOString() })),
    };
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  async load(filePath: string): Promise<number> {
    if (!fs.existsSync(filePath)) return 0;
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
      packages?: Array<{
        manifest: CognitivePackageManifest;
        installedAt: string;
        active: boolean;
        revoked: boolean;
        activeSessions: number;
      }>;
      audit?: Array<{ action: PackageAction; name: string; version: string; at: string }>;
    };

    this.packages.clear();
    for (const entry of parsed.packages ?? []) {
      const versions = this.versionsOf(entry.manifest.name);
      versions.set(entry.manifest.version, {
        manifest: entry.manifest,
        installedAt: new Date(dateReviver('', entry.installedAt) as string),
        active: entry.active,
        revoked: entry.revoked,
        activeSessions: entry.activeSessions,
      });
    }
    this.auditLedger = (parsed.audit ?? []).map((e) => ({
      action: e.action,
      name: e.name,
      version: e.version,
      at: new Date(dateReviver('', e.at) as string),
    }));
    return this.packages.size;
  }

  private versionsOf(name: string): Map<string, InstalledPackage> {
    let versions = this.packages.get(name);
    if (!versions) {
      versions = new Map();
      this.packages.set(name, versions);
    }
    return versions;
  }

  private latestOf(versions: Map<string, InstalledPackage>): InstalledPackage | undefined {
    return [...versions.values()].pop();
  }

  private record(action: PackageAction, manifest: CognitivePackageManifest): void {
    const entry: PackageAuditEntry = { action, name: manifest.name, version: manifest.version, at: new Date() };
    this.auditLedger.push(entry);
    if (this.eventBus) {
      void this.eventBus.publish({
        type: 'module:message',
        source: 'uch-package-store',
        payload: { module: 'cognitive-packages', action, name: manifest.name, version: manifest.version },
      });
    }
  }
}
