/**
 * Cognitive package commands: `package` (install / update / revoke / list /
 * audit) with the package gate in the loop.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CliContext } from './context.js';

export async function handlePackage(ctx: CliContext): Promise<void> {
  const { args, workspaceRoot, eventBus } = ctx;
  const sub = args[1] ?? '';
  const { PackageGate, PackageStore, defaultGrantedCapabilities, validatePackageManifest } =
    await import('../control-plane/packages/index.js');
  const { UCH_RUNTIME_VERSION } = await import('../workspace-manifest/attach.js');
  const storePath = path.join(workspaceRoot, '.uccp', 'persist', 'packages.json');
  const store = new PackageStore(eventBus);
  await store.load(storePath);

  const grantedCapabilities = defaultGrantedCapabilities();
  const installedPackages = new Map(
    store
      .list()
      .filter((p) => !p.revoked)
      .map((p) => [p.manifest.name, p.manifest.version]),
  );
  const gate = new PackageGate({
    grantedCapabilities,
    installedPackages,
    substrateVersion: UCH_RUNTIME_VERSION,
    eventBus,
  });

  if (sub === 'list') {
    console.log(
      JSON.stringify(
        {
          count: store.list().length,
          packages: store.list().map((p) => ({
            name: p.manifest.name,
            version: p.manifest.version,
            kind: p.manifest.kind,
            active: p.active,
            revoked: p.revoked,
            activeSessions: p.activeSessions,
            installedAt: p.installedAt.toISOString(),
          })),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (sub === 'audit') {
    console.log(
      JSON.stringify(
        {
          count: store.audit().length,
          audit: store.audit().map((e) => ({ ...e, at: e.at.toISOString() })),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (sub === 'install' || sub === 'update') {
    const dir = args[2];
    if (!dir) {
      console.error(`Usage: uch package ${sub} <dir>`);
      process.exit(1);
    }
    const manifestPath = path.join(dir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      console.error(`No manifest.json found at ${manifestPath}`);
      process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const validated = validatePackageManifest(raw);
    if (!validated.ok) {
      console.error(`Malformed package manifest: ${validated.errors.join('; ')}`);
      process.exit(1);
    }
    const decision = await gate.evaluate(validated.manifest);
    if (!decision.admitted) {
      console.error(`Package gate denied: ${decision.reason ?? 'violations'}`);
      console.error(JSON.stringify({ violations: decision.violations }, null, 2));
      process.exit(1);
    }
    const applied =
      sub === 'install' ? store.install(validated.manifest) : store.update(validated.manifest);
    if (!applied) {
      console.error(`Package ${sub} failed (duplicate version or unknown package)`);
      process.exit(1);
    }
    await store.persist(storePath);
    console.log(
      JSON.stringify(
        {
          action: sub,
          name: validated.manifest.name,
          version: validated.manifest.version,
          kind: validated.manifest.kind,
          gate: decision,
          audit: store.audit().slice(-1)[0]
            ? { ...store.audit().slice(-1)[0], at: store.audit().slice(-1)[0]!.at.toISOString() }
            : null,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  if (sub === 'revoke') {
    const name = args[2];
    if (!name) {
      console.error('Usage: uch package revoke <name>');
      process.exit(1);
    }
    const revoked = store.revoke(name);
    if (!revoked) {
      console.error(`Package ${name} is not installed`);
      process.exit(1);
    }
    await store.persist(storePath);
    const entry = store.audit().slice(-1)[0];
    console.log(
      JSON.stringify(
        {
          action: 'revoke',
          name,
          revoked: true,
          audit: entry ? { ...entry, at: entry.at.toISOString() } : null,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  console.error('Usage: uch package <install|update|revoke|list|audit>');
  process.exit(1);
}
