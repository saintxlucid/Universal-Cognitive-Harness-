import {
  PackageGate,
  PackageStore,
  defaultGrantedCapabilities,
  validatePackageManifest,
} from '../../control-plane/packages/index.js';
import { UCH_RUNTIME_VERSION } from '../../workspace-manifest/attach.js';
import type { MCPToolContext, ToolRegistrar } from './types.js';

/**
 * Cognitive Package tools — the governed install/update/revoke surface
 * (COGNITIVE-PACKAGES.md §4): every install passes the package gate
 * (signature, content hash, dependency closure, capability intersection,
 * level claims, vetoes) and is audited. Nothing executes on install; a
 * package becomes active only when a driver session attaches to it.
 */
export function registerPackageTools(ctx: MCPToolContext, register: ToolRegistrar): void {
  const gateFor = (args: Record<string, unknown>, store: PackageStore) =>
    new PackageGate({
      grantedCapabilities: defaultGrantedCapabilities(
        args.grantedCapabilities as string[] | undefined,
      ),
      substrateVersion: UCH_RUNTIME_VERSION,
      installedPackages: new Map(
        store
          .list()
          .filter((p) => !p.revoked)
          .map((p) => [p.manifest.name, p.manifest.version]),
      ),
    });

  const summarize = (decision: { admitted: boolean; reason?: string; violations: string[] }) => ({
    admitted: decision.admitted,
    ...(decision.reason !== undefined ? { reason: decision.reason } : {}),
    violations: decision.violations,
  });

  register(
    'package-install',
    'Governed install of a Cognitive Package: the manifest passes the package gate (schema, signature, content hash, dependency closure, capability intersection, level claims, vetoes) and the package is installed atomically, inactive until a driver session attaches. Audited. Pass the manifest object; optionally scope grantedCapabilities.',
    {
      type: 'object',
      properties: {
        manifest: {
          type: 'object',
          description: 'The cognitive package manifest (uch.package.v1)',
        },
        grantedCapabilities: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Optional capability override; defaults to the substrate surface (workspace capabilities + CIC op vocabulary)',
        },
      },
      required: ['manifest'],
    },
    async (args) => {
      const manifest = args.manifest as unknown;
      const validated = validatePackageManifest(manifest);
      if (!validated.ok) {
        return { admitted: false, violations: validated.errors, reason: 'malformed manifest' };
      }
      const store = await ctx.getPackageStore();
      const decision = await gateFor(args, store).evaluate(validated.manifest);
      if (!decision.admitted) return summarize(decision);
      const installed = store.install(validated.manifest);
      await ctx.persistPackageStore(store);
      return {
        ...summarize(decision),
        installed,
        package: {
          name: validated.manifest.name,
          version: validated.manifest.version,
          kind: validated.manifest.kind,
        },
      };
    },
  );

  register(
    'package-update',
    'Governed update of an installed Cognitive Package to a new version: same gate as install; a failed gate leaves the previous version byte-identical. Audited.',
    {
      type: 'object',
      properties: {
        manifest: {
          type: 'object',
          description: 'The new cognitive package manifest (uch.package.v1)',
        },
        grantedCapabilities: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional capability override; defaults to the substrate surface',
        },
      },
      required: ['manifest'],
    },
    async (args) => {
      const manifest = args.manifest as unknown;
      const validated = validatePackageManifest(manifest);
      if (!validated.ok) {
        return { admitted: false, violations: validated.errors, reason: 'malformed manifest' };
      }
      const store = await ctx.getPackageStore();
      const decision = await gateFor(args, store).evaluate(validated.manifest);
      if (!decision.admitted) return summarize(decision);
      const updated = store.update(validated.manifest);
      await ctx.persistPackageStore(store);
      return {
        ...summarize(decision),
        updated,
        package: {
          name: validated.manifest.name,
          version: validated.manifest.version,
          kind: validated.manifest.kind,
        },
      };
    },
  );

  register(
    'package-revoke',
    'Revoke an installed Cognitive Package: stops new execution and drains active sessions. Audited.',
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name to revoke' },
      },
      required: ['name'],
    },
    async (args) => {
      const store = await ctx.getPackageStore();
      const revoked = store.revoke(args.name as string);
      await ctx.persistPackageStore(store);
      return { revoked, name: args.name as string };
    },
  );

  register(
    'package-list',
    'List installed Cognitive Packages with activation state',
    {
      type: 'object',
      properties: {},
      required: [],
    },
    async () => {
      const store = await ctx.getPackageStore();
      return {
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
      };
    },
  );

  register(
    'package-audit',
    'Show the package audit ledger: every install, update, and revocation in order',
    {
      type: 'object',
      properties: {},
      required: [],
    },
    async () => {
      const store = await ctx.getPackageStore();
      return {
        count: store.audit().length,
        audit: store.audit().map((e) => ({ ...e, at: e.at.toISOString() })),
      };
    },
  );

  register(
    'package-attach',
    'Attach a driver session to an installed, non-revoked package (activation — the only state in which a package executes)',
    {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
      },
      required: ['name'],
    },
    async (args) => {
      const store = await ctx.getPackageStore();
      const attached = store.attach(args.name as string);
      await ctx.persistPackageStore(store);
      return { attached, name: args.name as string };
    },
  );
}
