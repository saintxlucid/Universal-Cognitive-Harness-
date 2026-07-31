import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { satisfiesSemver } from '../packages/semver.js';
import { validatePackageManifest, type CognitivePackageManifest } from '../packages/package-manifest.js';
import { PackageGate } from '../packages/package-gate.js';
import { PackageStore } from '../packages/package-store.js';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(Buffer.from(bytes)).digest('hex');

function basePackage(overrides?: Partial<CognitivePackageManifest>): CognitivePackageManifest {
  return {
    schema: 'uch.package.v1',
    name: 'uch-driver-opencode',
    version: '1.2.0',
    kind: 'driver',
    entry: 'src/index.js',
    level_claims: { hooks: 4, cot: 3, otel: 0 },
    requires: { substrate: '>=0.2.0', packages: ['uch-skills-core@^1.0.0'] },
    capabilities: ['observe:workspace', 'retrieve:cognitive-state'],
    permissions: ['read:session-digest'],
    retention: { reasoning_days: 30 },
    provenance: {
      author: 'uch-team',
      signature: 'ed25519:c2lnbmF0dXJlLXBsYWNlaG9sZGVy',
      source: 'https://example.test/tarball/abc123',
      published_at: '2026-08-01T00:00:00Z',
    },
    payload: ['src/index.js', 'hooks/hook.mjs'],
    ...overrides,
  };
}

function grantedCaps(): ReadonlySet<string> {
  return new Set(['observe:workspace', 'retrieve:cognitive-state', 'read:session-digest']);
}

function verifiedLevels(): Readonly<Record<string, number>> {
  return { hooks: 4, cot: 3, otel: 0 };
}

function gate(overrides?: ConstructorParameters<typeof PackageGate>[0]): PackageGate {
  return new PackageGate({
    grantedCapabilities: grantedCaps(),
    verifiedLevels: verifiedLevels(),
    installedPackages: new Map([['uch-skills-core', '1.1.0']]),
    substrateVersion: '0.3.0',
    ...overrides,
  });
}

describe('satisfiesSemver', () => {
  it('matches exact versions', () => {
    expect(satisfiesSemver('1.2.3', '1.2.3')).toBe(true);
    expect(satisfiesSemver('1.2.3', '1.2.4')).toBe(false);
  });
  it('matches caret ranges', () => {
    expect(satisfiesSemver('1.3.0', '^1.2.3')).toBe(true);
    expect(satisfiesSemver('1.1.9', '^1.2.3')).toBe(false);
    expect(satisfiesSemver('2.0.0', '^1.2.3')).toBe(false);
  });
  it('matches tilde ranges', () => {
    expect(satisfiesSemver('1.2.9', '~1.2.3')).toBe(true);
    expect(satisfiesSemver('1.3.0', '~1.2.3')).toBe(false);
  });
  it('matches greater-than-or-equal ranges', () => {
    expect(satisfiesSemver('2.0.0', '>=0.2.0')).toBe(true);
    expect(satisfiesSemver('0.1.0', '>=0.2.0')).toBe(false);
  });
  it('matches wildcard', () => {
    expect(satisfiesSemver('0.0.1', '*')).toBe(true);
  });
  it('rejects malformed inputs', () => {
    expect(satisfiesSemver('not-a-version', '^1.0.0')).toBe(false);
    expect(satisfiesSemver('1.2.3', 'not-a-range')).toBe(false);
  });
});

describe('validatePackageManifest', () => {
  it('accepts a well-formed manifest', () => {
    const result = validatePackageManifest(basePackage());
    expect(result.ok).toBe(true);
  });
  it('accepts a data-only manifest without provenance', () => {
    const result = validatePackageManifest(
      basePackage({ kind: 'policy', entry: null, capabilities: undefined, provenance: undefined }),
    );
    expect(result.ok).toBe(true);
  });
  it('rejects a wrong schema', () => {
    const result = validatePackageManifest(basePackage({ schema: 'uch.package.v2' as 'uch.package.v1' }));
    expect(result.ok).toBe(false);
  });
  it('rejects an unsafe name', () => {
    const result = validatePackageManifest(basePackage({ name: 'Uch Driver!' }));
    expect(result.ok).toBe(false);
  });
  it('rejects a malformed version', () => {
    const result = validatePackageManifest(basePackage({ version: 'latest' }));
    expect(result.ok).toBe(false);
  });
  it('rejects an unknown kind', () => {
    const result = validatePackageManifest(basePackage({ kind: 'binary' as 'driver' }));
    expect(result.ok).toBe(false);
  });
  it('rejects a missing payload list', () => {
    const result = validatePackageManifest(basePackage({ payload: undefined as unknown as string[] }));
    expect(result.ok).toBe(false);
  });
  it('rejects an entry on a data-only kind (no hidden execution)', () => {
    const result = validatePackageManifest(basePackage({ kind: 'policy', entry: 'x.js' }));
    expect(result.ok).toBe(false);
  });
  it('rejects a null entry on an executing kind', () => {
    const result = validatePackageManifest(basePackage({ kind: 'driver', entry: null }));
    expect(result.ok).toBe(false);
  });
  it('rejects out-of-range level claims', () => {
    const result = validatePackageManifest(basePackage({ level_claims: { hooks: 7 } }));
    expect(result.ok).toBe(false);
  });
  it('rejects non-object input', () => {
    expect(validatePackageManifest(null).ok).toBe(false);
    expect(validatePackageManifest('nope').ok).toBe(false);
    expect(validatePackageManifest([]).ok).toBe(false);
  });
});

describe('PackageGate', () => {
  it('admits a signed, capability-granted, level-consistent driver package', async () => {
    const decision = await gate().evaluate(basePackage());
    expect(decision.admitted).toBe(true);
    expect(decision.violations).toEqual([]);
  });
  it('denies an unsigned executing package (signature mandatory)', async () => {
    const pkg = basePackage({ provenance: { ...basePackage().provenance, signature: undefined } });
    const decision = await gate().evaluate(pkg);
    expect(decision.admitted).toBe(false);
    expect(decision.violations).toContain('signature-missing');
  });
  it('denies a capability outside the grant', async () => {
    const pkg = basePackage({ capabilities: ['observe:workspace', 'admin:everything'] });
    const decision = await gate().evaluate(pkg);
    expect(decision.admitted).toBe(false);
    expect(decision.violations).toContain('capability-not-granted:admin:everything');
  });
  it('denies a level claim above the host-verified level', async () => {
    const pkg = basePackage({ level_claims: { hooks: 4, cot: 4 } });
    const decision = await gate().evaluate(pkg);
    expect(decision.admitted).toBe(false);
    expect(decision.violations.some((v) => v.startsWith('level-claim-above-verified:cot'))).toBe(true);
  });
  it('denies an unresolved package dependency', async () => {
    const pkg = basePackage({ requires: { packages: ['uch-skills-core@^2.0.0'] } });
    const decision = await gate().evaluate(pkg);
    expect(decision.admitted).toBe(false);
    expect(decision.violations).toContain('dependency-unresolved:uch-skills-core@^2.0.0');
  });
  it('denies when the substrate floor is not met', async () => {
    const pkg = basePackage({ requires: { substrate: '>=0.5.0' } });
    const decision = await gate().evaluate(pkg);
    expect(decision.admitted).toBe(false);
    expect(decision.violations).toContain('substrate-unsatisfied:>=0.5.0');
  });
  it('blocks on a veto with the recorded reason', async () => {
    const decision = await gate({ veto: () => 'sovereignty: package exports traces off-workspace' }).evaluate(basePackage());
    expect(decision.admitted).toBe(false);
    expect(decision.reason).toContain('sovereignty');
  });
  it('denies a payload hash mismatch', async () => {
    const pkg = basePackage();
    const decision = await gate({ expectedPayloadHash: 'deadbeef' }).evaluate(pkg);
    expect(decision.admitted).toBe(false);
    expect(decision.violations).toContain('payload-hash-mismatch');
  });
  it('admits a data-only package with a content hash and no signature', async () => {
    const pkg = basePackage({
      kind: 'policy',
      entry: null,
      capabilities: undefined,
      provenance: { author: 'uch-team', source: 'https://example.test/tarball/abc123' },
    });
    const decision = await gate().evaluate(pkg);
    expect(decision.admitted).toBe(true);
  });
  it('denies a planted impostor package (T13 dependency confusion)', async () => {
    const pkg = basePackage({
      name: 'uch-driver-opencode',
      provenance: { ...basePackage().provenance, signature: undefined, source: 'https://evil.test/tarball/f00d' },
    });
    const decision = await gate({ expectedPayloadHash: '0000000000000000000000000000000000000000000000000000000000000000' }).evaluate(pkg);
    expect(decision.admitted).toBe(false);
    expect(decision.violations.some((v) => v.startsWith('signature-missing') || v.startsWith('payload-hash-mismatch'))).toBe(true);
  });
  it('publishes a governed denial event for vetoed packages', async () => {
    const bus = new NeuralEventBus();
    const denied = await gate({ veto: () => 'rejected-for-test', eventBus: bus }).evaluate(basePackage());
    expect(denied.admitted).toBe(false);
    const denials = bus.getHistory('governance:event_denied');
    expect(denials.length).toBe(1);
    expect(denials[0]?.payload.package).toBe('uch-driver-opencode');
  });
  it('publishes no denial event for admitted packages', async () => {
    const bus = new NeuralEventBus();
    const admitted = await gate({ eventBus: bus }).evaluate(basePackage());
    expect(admitted.admitted).toBe(true);
    expect(bus.getHistory('governance:event_denied').length).toBe(0);
  });
});

describe('PackageStore', () => {
  it('installs a package inactive until a driver session attaches', () => {
    const store = new PackageStore();
    expect(store.install(basePackage())).toBe(true);
    const installed = store.get('uch-driver-opencode');
    expect(installed?.active).toBe(false);
  });
  it('refuses a duplicate name+version install (atomic)', () => {
    const store = new PackageStore();
    expect(store.install(basePackage())).toBe(true);
    expect(store.install(basePackage())).toBe(false);
    expect(store.list().length).toBe(1);
  });
  it('allows the same name at a new version', () => {
    const store = new PackageStore();
    store.install(basePackage());
    expect(store.install(basePackage({ version: '1.3.0' }))).toBe(true);
    expect(store.list().length).toBe(2);
  });
  it('fails an update of an invalid manifest and leaves the prior version byte-identical', () => {
    const store = new PackageStore();
    store.install(basePackage());
    const before = store.get('uch-driver-opencode');
    expect(store.update({ ...basePackage({ version: '9.9.9' }), name: 'Uch Driver!' } as CognitivePackageManifest)).toBe(false);
    const after = store.get('uch-driver-opencode');
    expect(after?.manifest.version).toBe(before?.manifest.version);
    expect(after?.installedAt.getTime()).toBe(before?.installedAt.getTime());
  });
  it('updates an installed package to a new version', () => {
    const store = new PackageStore();
    store.install(basePackage());
    expect(store.update(basePackage({ version: '2.0.0' }))).toBe(true);
    expect(store.get('uch-driver-opencode')?.manifest.version).toBe('2.0.0');
  });
  it('refuses removal while sessions are active', () => {
    const store = new PackageStore();
    store.install(basePackage());
    expect(store.attach('uch-driver-opencode')).toBe(true);
    expect(store.remove('uch-driver-opencode')).toBe(false);
    store.detach('uch-driver-opencode');
    expect(store.remove('uch-driver-opencode')).toBe(true);
  });
  it('refuses to remove a package that is not installed', () => {
    const store = new PackageStore();
    expect(store.remove('ghost-package')).toBe(false);
  });
  it('revokes a package: stops new execution and drains sessions', () => {
    const store = new PackageStore();
    store.install(basePackage());
    expect(store.attach('uch-driver-opencode')).toBe(true);
    expect(store.attach('uch-driver-opencode')).toBe(true);
    expect(store.revoke('uch-driver-opencode')).toBe(true);
    expect(store.attach('uch-driver-opencode')).toBe(false);
    store.detach('uch-driver-opencode');
    expect(store.get('uch-driver-opencode')?.active).toBe(true);
    store.detach('uch-driver-opencode');
    expect(store.get('uch-driver-opencode')?.active).toBe(false);
  });
  it('refuses to revoke a package that is not installed', () => {
    const store = new PackageStore();
    expect(store.revoke('ghost-package')).toBe(false);
  });
  it('records a full audit history in order', () => {
    const store = new PackageStore();
    store.install(basePackage());
    store.update(basePackage({ version: '2.0.0' }));
    store.revoke('uch-driver-opencode');
    const audit = store.audit();
    expect(audit.map((e) => e.action)).toEqual(['install', 'update', 'revoke']);
    expect(audit[1]?.version).toBe('2.0.0');
  });
  it('emits module:message events for install, update, and revoke', () => {
    const bus = new NeuralEventBus();
    const store = new PackageStore(bus);
    store.install(basePackage());
    store.update(basePackage({ version: '2.0.0' }));
    store.revoke('uch-driver-opencode');
    const events = bus.getHistory('module:message');
    expect(events.length).toBe(3);
    expect(events.map((e) => e.payload.action)).toEqual(['install', 'update', 'revoke']);
    expect(events[0]?.payload.name).toBe('uch-driver-opencode');
  });
  it('persists and reloads state (Storable)', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uch-pkg-'));
    const file = path.join(dir, 'packages.json');
    const store = new PackageStore();
    store.install(basePackage());
    store.attach('uch-driver-opencode');
    await store.persist(file);
    const reloaded = new PackageStore();
    const count = await reloaded.load(file);
    expect(count).toBe(1);
    const restored = reloaded.get('uch-driver-opencode');
    expect(restored?.manifest.version).toBe('1.2.0');
    expect(restored?.active).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
