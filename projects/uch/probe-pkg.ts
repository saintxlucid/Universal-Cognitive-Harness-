import { PackageStore } from './src/control-plane/packages/package-store.js';
import { validatePackageManifest } from './src/control-plane/packages/package-manifest.js';

const base = {
  schema: 'uch.package.v1' as const,
  name: 'uch-driver-opencode',
  version: '1.2.0',
  kind: 'driver' as const,
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
};

const v = validatePackageManifest(base);
console.log('validate:', v.ok ? 'ok' : JSON.stringify(v));
const store = new PackageStore();
console.log('install1:', store.install(base));
console.log('get1:', store.get('uch-driver-opencode')?.manifest.version);
console.log('update:', store.update({ ...base, version: '2.0.0' }));
console.log('get2:', store.get('uch-driver-opencode')?.manifest.version);
console.log('audit:', JSON.stringify(store.audit()));
