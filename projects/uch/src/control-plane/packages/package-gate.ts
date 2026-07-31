import { createHash } from 'node:crypto';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';
import {
  EXECUTING_KINDS,
  validatePackageManifest,
  type CognitivePackageManifest,
} from './package-manifest.js';
import { satisfiesSemver } from './semver.js';

export interface PackageGateOptions {
  /** Effective capability set — the intersection of (requested) × (grant) × (workspace manifest). */
  grantedCapabilities: ReadonlySet<string>;
  /** Host-verified integration levels per rail; claims above these are denied. */
  verifiedLevels?: Readonly<Record<string, number>>;
  /** Installed package versions, name → version, for dependency resolution. */
  installedPackages?: ReadonlyMap<string, string>;
  /** Substrate runtime version for `requires.substrate` checks. */
  substrateVersion?: string;
  /** Expected payload content hash; compared against `payloadBytes` or the source tarball hash. */
  expectedPayloadHash?: string;
  /** Payload bytes of the package for content hashing. */
  payloadBytes?: Uint8Array;
  /** Signature verification; defaults to presence checking only. */
  verifySignature?: (payload: string, signature: string, name: string) => boolean | Promise<boolean>;
  /** Security / sovereignty / constitutional veto; returns a reason to block, or null. */
  veto?: (manifest: CognitivePackageManifest) => string | null;
  /** Bus for observable denials (`governance:event_denied`). */
  eventBus?: NeuralEventBus;
}

export interface PackageGateDecision {
  admitted: boolean;
  reason?: string;
  violations: string[];
}

function sourceHash(manifest: CognitivePackageManifest): string | null {
  const source = manifest.provenance?.source;
  if (!source) return null;
  const segment = source.split('/').filter(Boolean).pop();
  return segment && /^[0-9a-f]{4,}$/i.test(segment) ? segment : null;
}

export class PackageGate {
  private options: PackageGateOptions;

  constructor(options: PackageGateOptions) {
    this.options = options;
  }

  async evaluate(manifest: CognitivePackageManifest): Promise<PackageGateDecision> {
    const validated = validatePackageManifest(manifest);
    if (!validated.ok) {
      return this.decide(null, validated.errors, 'malformed manifest');
    }
    const pkg = validated.manifest;
    const violations: string[] = [];

    this.checkHash(pkg, violations);
    await this.checkSignature(pkg, violations);
    this.checkCapabilities(pkg, violations);
    this.checkLevelClaims(pkg, violations);
    this.checkDependencies(pkg, violations);
    this.checkVeto(pkg, violations);

    return this.decide(pkg, violations);
  }

  private checkHash(manifest: CognitivePackageManifest, violations: string[]): void {
    const expected = this.options.expectedPayloadHash ?? sourceHash(manifest);
    if (!expected) return;

    let actual: string | null;
    if (this.options.payloadBytes) {
      actual = createHash('sha256').update(Buffer.from(this.options.payloadBytes)).digest('hex');
    } else {
      actual = sourceHash(manifest);
    }
    if (actual === null || actual !== expected) {
      violations.push('payload-hash-mismatch');
    }
  }

  private async checkSignature(manifest: CognitivePackageManifest, violations: string[]): Promise<void> {
    if (!EXECUTING_KINDS.has(manifest.kind)) return;
    const signature = manifest.provenance?.signature;
    if (!signature) {
      violations.push('signature-missing');
      return;
    }
    if (!this.options.verifySignature) return;
    const payload = this.options.payloadBytes?.toString() ?? JSON.stringify(manifest);
    const valid = await this.options.verifySignature(payload, signature, manifest.name);
    if (!valid) {
      violations.push('signature-invalid');
    }
  }

  private checkCapabilities(manifest: CognitivePackageManifest, violations: string[]): void {
    for (const capability of manifest.capabilities ?? []) {
      if (!this.options.grantedCapabilities.has(capability)) {
        violations.push(`capability-not-granted:${capability}`);
      }
    }
  }

  private checkLevelClaims(manifest: CognitivePackageManifest, violations: string[]): void {
    const verified = this.options.verifiedLevels;
    if (!verified) return;
    for (const [rail, claim] of Object.entries(manifest.level_claims ?? {})) {
      const hostLevel = verified[rail] ?? 0;
      if (claim > hostLevel) {
        violations.push(`level-claim-above-verified:${rail}`);
      }
    }
  }

  private checkDependencies(manifest: CognitivePackageManifest, violations: string[]): void {
    for (const dependency of manifest.requires?.packages ?? []) {
      const separator = dependency.lastIndexOf('@');
      const name = separator > 0 ? dependency.slice(0, separator) : dependency;
      const range = separator > 0 ? dependency.slice(separator + 1) : '*';
      const installed = this.options.installedPackages?.get(name);
      if (!installed || !satisfiesSemver(installed, range)) {
        violations.push(`dependency-unresolved:${dependency}`);
      }
    }

    const substrate = manifest.requires?.substrate;
    if (substrate && this.options.substrateVersion) {
      if (!satisfiesSemver(this.options.substrateVersion, substrate)) {
        violations.push(`substrate-unsatisfied:${substrate}`);
      }
    }
  }

  private checkVeto(manifest: CognitivePackageManifest, violations: string[]): void {
    if (!this.options.veto) return;
    const reason = this.options.veto(manifest);
    if (reason !== null && reason !== undefined) {
      violations.push(`veto:${reason}`);
    }
  }

  private decide(
    manifest: CognitivePackageManifest | null,
    violations: string[],
    fallback?: string,
  ): PackageGateDecision {
    if (violations.length === 0) {
      return { admitted: true, violations };
    }
    const reason = fallback ?? `package gate denied: ${violations.join('; ')}`;
    if (this.options.eventBus) {
      void this.options.eventBus.publish({
        type: 'governance:event_denied',
        source: 'uch-package-gate',
        payload: {
          package: manifest?.name,
          version: manifest?.version,
          kind: manifest?.kind,
          gate: 'cognitive-package',
          violations,
          reason,
        },
      });
    }
    return { admitted: false, reason, violations };
  }
}
