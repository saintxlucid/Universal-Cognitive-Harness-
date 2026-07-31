import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  PackageAlreadyInstalledError,
  PackageNotInstalledError,
  PackageRegistry,
  PackageValidationError,
  POLICY_QUARANTINE_DIR,
  sha256Hex,
  validatePackage,
  type CognitivePackage,
} from '../kernel/packages/index.js';

const FIXED = new Date('2026-08-01T12:00:00.000Z');

function tmpRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'uch-packages-'));
}

function makePackage(overrides: Partial<CognitivePackage> = {}): CognitivePackage {
  return {
    name: 'uch-skills-core',
    version: '1.2.0',
    kind: 'skill',
    entries: [{ path: 'skills/refactor.md', content: '# Refactor skill', hash: sha256Hex('# Refactor skill') }],
    ...overrides,
  };
}

function makeRegistry(root: string = tmpRoot()): PackageRegistry {
  return new PackageRegistry(root, () => FIXED);
}

describe('PackageRegistry install/verify/remove lifecycle', () => {
  it('installs, verifies, and removes a package', () => {
    const root = tmpRoot();
    const registry = makeRegistry(root);
    const result = registry.install(makePackage());
    expect(result.installed).toBe(true);
    expect(result.policyPendingReview).toEqual([]);

    const packageDir = path.join(root, '.uccp/packages/uch-skills-core@1.2.0');
    expect(fs.readFileSync(path.join(packageDir, 'skills/refactor.md'), 'utf-8')).toBe('# Refactor skill');

    const verified = registry.verify('uch-skills-core');
    expect(verified.ok).toBe(true);
    expect(verified.checked).toBe(1);
    expect(verified.mismatches).toEqual([]);

    expect(registry.remove('uch-skills-core')).toBe(true);
    expect(fs.existsSync(packageDir)).toBe(false);
    expect(registry.list()).toEqual([]);
    expect(() => registry.verify('uch-skills-core')).toThrow(PackageNotInstalledError);
  });

  it('remove returns false for an unknown package', () => {
    expect(makeRegistry().remove('no-such-package')).toBe(false);
  });
});

describe('PackageRegistry tamper detection', () => {
  it('verify fails when an installed file is modified', () => {
    const root = tmpRoot();
    const registry = makeRegistry(root);
    registry.install(
      makePackage({
        entries: [
          { path: 'skills/a.md', content: 'a', hash: sha256Hex('a') },
          { path: 'skills/b.md', content: 'b', hash: sha256Hex('b') },
        ],
      }),
    );
    const target = path.join(root, '.uccp/packages/uch-skills-core@1.2.0/skills/a.md');
    fs.writeFileSync(target, 'tampered', 'utf-8');

    const verified = registry.verify('uch-skills-core', '1.2.0');
    expect(verified.ok).toBe(false);
    expect(verified.checked).toBe(2);
    expect(verified.mismatches).toEqual(['skills/a.md']);
  });

  it('verify fails when an installed file is deleted', () => {
    const root = tmpRoot();
    const registry = makeRegistry(root);
    registry.install(makePackage());
    fs.rmSync(path.join(root, '.uccp/packages/uch-skills-core@1.2.0/skills/refactor.md'));

    const verified = registry.verify('uch-skills-core');
    expect(verified.ok).toBe(false);
    expect(verified.mismatches).toEqual(['skills/refactor.md']);
  });
});

describe('Policy entries are quarantined, never applied', () => {
  it('a policy-kind package lands fully in quarantine and is reported for review', () => {
    const root = tmpRoot();
    const registry = makeRegistry(root);
    const pkg = makePackage({
      kind: 'policy',
      entries: [
        { path: 'policies/limits.md', content: 'limit rules', hash: sha256Hex('limit rules') },
        { path: 'policies/audit.md', content: 'audit rules', hash: sha256Hex('audit rules') },
      ],
    });
    const result = registry.install(pkg);
    expect(result.policyPendingReview).toEqual(['policies/limits.md', 'policies/audit.md']);

    const packageDir = path.join(root, '.uccp/packages/uch-skills-core@1.2.0');
    expect(fs.existsSync(path.join(packageDir, 'policies/limits.md'))).toBe(false);
    expect(fs.readFileSync(path.join(packageDir, POLICY_QUARANTINE_DIR, 'policies/limits.md'), 'utf-8')).toBe('limit rules');
    expect(fs.readFileSync(path.join(packageDir, POLICY_QUARANTINE_DIR, 'policies/audit.md'), 'utf-8')).toBe('audit rules');
    expect(registry.verify('uch-skills-core').ok).toBe(true);
  });

  it('only top-level policies/ entries of a non-policy package are quarantined', () => {
    const root = tmpRoot();
    const registry = makeRegistry(root);
    const result = registry.install(
      makePackage({
        entries: [
          { path: 'skills/refactor.md', content: 'skill', hash: sha256Hex('skill') },
          { path: 'policies/limits.md', content: 'limit', hash: sha256Hex('limit') },
          { path: 'references/notes.md', content: 'notes', hash: sha256Hex('notes') },
        ],
      }),
    );
    expect(result.policyPendingReview).toEqual(['policies/limits.md']);

    const packageDir = path.join(root, '.uccp/packages/uch-skills-core@1.2.0');
    expect(fs.existsSync(path.join(packageDir, 'skills/refactor.md'))).toBe(true);
    expect(fs.existsSync(path.join(packageDir, 'references/notes.md'))).toBe(true);
    expect(fs.existsSync(path.join(packageDir, POLICY_QUARANTINE_DIR, 'policies/limits.md'))).toBe(true);
    expect(fs.existsSync(path.join(packageDir, 'policies/limits.md'))).toBe(false);
  });

  it('the registry writes nothing outside .uccp/packages (no policy store touched)', () => {
    const root = tmpRoot();
    const registry = makeRegistry(root);
    registry.install(makePackage({ kind: 'policy', entries: [{ path: 'policies/limits.md', content: 'x', hash: sha256Hex('x') }] }));
    expect(fs.readdirSync(path.join(root, '.uccp'))).toEqual(['packages']);
  });
});

describe('Manifest validation', () => {
  it('accepts a valid package for every kind', () => {
    const kinds = ['skill', 'policy', 'knowledge', 'brain'] as const;
    for (const kind of kinds) {
      expect(validatePackage(makePackage({ kind }))).toEqual([]);
    }
  });

  it('accepts boundary-valid names and versions', () => {
    const pkg = makePackage({ name: 'a'.repeat(63), version: '10.0.0' });
    expect(validatePackage(pkg)).toEqual([]);
    const registry = makeRegistry();
    expect(registry.install(pkg).installed).toBe(true);
  });

  it('rejects invalid names, versions, entries, and requires', () => {
    const cases: Array<[string, Partial<CognitivePackage>]> = [
      ['uppercase name', { name: 'Bad-Name' }],
      ['leading hyphen name', { name: '-bad' }],
      ['overlong name', { name: 'a'.repeat(64) }],
      ['underscore name', { name: 'bad_name' }],
      ['short version', { version: '1.2' }],
      ['four-part version', { version: '1.2.0.1' }],
      ['non-numeric version', { version: '1.x.0' }],
      ['no entries', { entries: [] }],
      ['bad hash', { entries: [{ path: 'x.md', content: 'x', hash: 'deadbeef' }] }],
      ['posix absolute path', { entries: [{ path: '/etc/x.md', content: 'x', hash: sha256Hex('x') }] }],
      ['windows absolute path', { entries: [{ path: 'C:\\evil\\x.md', content: 'x', hash: sha256Hex('x') }] }],
      ['unc absolute path', { entries: [{ path: '\\\\server\\share\\x.md', content: 'x', hash: sha256Hex('x') }] }],
      ['traversal path', { entries: [{ path: '../x.md', content: 'x', hash: sha256Hex('x') }] }],
      ['empty path', { entries: [{ path: '', content: 'x', hash: sha256Hex('x') }] }],
      ['duplicate entry paths', { entries: [{ path: 'a.md', content: 'x', hash: sha256Hex('x') }, { path: 'a.md', content: 'y', hash: sha256Hex('y') }] }],
      ['invalid requires name', { requires: ['Bad_Req'] }],
    ];
    for (const [, patch] of cases) {
      expect(validatePackage(makePackage(patch))).not.toEqual([]);
      expect(() => makeRegistry().install(makePackage(patch))).toThrow(PackageValidationError);
    }
  });
});

describe('PackageRegistry duplicate handling', () => {
  it('rejects re-install of the same name+version but allows other versions', () => {
    const registry = makeRegistry();
    registry.install(makePackage());
    expect(() => registry.install(makePackage())).toThrow(PackageAlreadyInstalledError);

    registry.install(makePackage({ version: '1.3.0' }));
    expect(registry.list().map((p) => p.version)).toEqual(['1.2.0', '1.3.0']);
  });
});

describe('PackageRegistry list', () => {
  it('lists installed packages sorted and reflects removals', () => {
    const registry = makeRegistry();
    registry.install(makePackage({ name: 'uch-skills-core' }));
    registry.install(makePackage({ name: 'uch-skills-core', version: '1.0.0' }));
    registry.install(makePackage({ name: 'uch-brain-base' }));

    const listed = registry.list();
    expect(listed.map((p) => `${p.name}@${p.version}`)).toEqual([
      'uch-brain-base@1.2.0',
      'uch-skills-core@1.0.0',
      'uch-skills-core@1.2.0',
    ]);
    expect(listed[0]!.installedAt.toISOString()).toBe(FIXED.toISOString());
    expect(listed[0]!.kind).toBe('skill');
    expect(listed[0]!.entryCount).toBe(1);

    expect(registry.remove('uch-skills-core')).toBe(true);
    expect(registry.list().map((p) => p.name)).toEqual(['uch-brain-base']);
  });
});

describe('PackageRegistry persistence across instances', () => {
  it('a new registry on the same root sees installed packages', () => {
    const root = tmpRoot();
    const first = makeRegistry(root);
    first.install(makePackage());
    first.install(makePackage({ name: 'uch-brain-base', entries: [{ path: 'brain/base.md', content: 'base', hash: sha256Hex('base') }] }));

    const second = new PackageRegistry(root, () => FIXED);
    expect(second.list().map((p) => `${p.name}@${p.version}`)).toEqual([
      'uch-brain-base@1.2.0',
      'uch-skills-core@1.2.0',
    ]);
    expect(second.verify('uch-skills-core').ok).toBe(true);
    expect(second.remove('uch-brain-base')).toBe(true);
    expect(first.list().map((p) => p.name)).toEqual(['uch-skills-core']);
  });
});

describe('PackageRegistry verify version selection', () => {
  it('verifies the requested version, or the highest installed when omitted', () => {
    const registry = makeRegistry();
    registry.install(makePackage({ version: '1.0.0' }));
    registry.install(makePackage({ version: '2.1.0' }));

    expect(registry.verify('uch-skills-core').version).toBe('2.1.0');
    expect(registry.verify('uch-skills-core', '1.0.0').version).toBe('1.0.0');
    expect(registry.verify('uch-skills-core', '1.0.0').ok).toBe(true);
    expect(() => registry.verify('uch-skills-core', '9.9.9')).toThrow(PackageNotInstalledError);
  });
});
