import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  MANIFEST_SCHEMA_VERSION,
  validateManifest,
  compareVersions,
  negotiateVersion,
  type WorkspaceManifest,
} from '../manifest.js';
import { parseManifest, createManifest, writeManifest, ManifestError } from '../loader.js';
import { discoverManifest } from '../discovery.js';
import { negotiate } from '../negotiation.js';
import { attach, detach, UCH_RUNTIME_VERSION, createStandardCapabilityRegistry } from '../attach.js';
import { GrantEngine } from '../../cognitive-runtime/grants.js';
import { DriverRegistry, type Driver } from '../../drivers/registry.js';
import { NeuralEventBus } from '../../event-bus/neural-event-bus.js';

function makeTempDir(prefix = 'uch-manifest-'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function sampleManifest(overrides?: Partial<WorkspaceManifest>): WorkspaceManifest {
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    manifest_version: '0.1.0',
    workspace: { id: 'ws-test', name: 'test-workspace', purpose: 'testing' },
    runtime: { min_uch_version: '0.1.0' },
    capabilities: [
      { name: 'memory', enabled: true },
      { name: 'research', enabled: false },
      { name: 'unknown-cap', enabled: true },
    ],
    drivers: [{ id: 'filesystem', enabled: true }],
    ...overrides,
  };
}

describe('validateManifest', () => {
  it('accepts a valid manifest', () => {
    const result = validateManifest(sampleManifest());
    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects non-object input', () => {
    expect(validateManifest(null).valid).toBe(false);
    expect(validateManifest('nope').valid).toBe(false);
    expect(validateManifest([]).valid).toBe(false);
  });

  it('rejects unsupported schema versions', () => {
    const result = validateManifest(sampleManifest({ schema_version: 'uch.manifest.v999' }));
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.message).toContain('unsupported schema_version');
  });

  it('rejects missing workspace name', () => {
    const result = validateManifest(
      sampleManifest({ workspace: { id: 'x', name: '' } }),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes('workspace.name'))).toBe(true);
  });

  it('rejects missing runtime min version', () => {
    const result = validateManifest(
      sampleManifest({ runtime: { min_uch_version: '' } }),
    );
    expect(result.valid).toBe(false);
  });
});

describe('compareVersions', () => {
  it('compares dotted numeric versions', () => {
    expect(compareVersions('0.2.0', '0.1.0')).toBe(1);
    expect(compareVersions('0.1.0', '0.1.0')).toBe(0);
    expect(compareVersions('0.1.0', '0.2.0')).toBe(-1);
    expect(compareVersions('0.2', '0.2.0')).toBe(0);
    expect(compareVersions('1.0.0', '0.9.9')).toBe(1);
  });
});

describe('negotiateVersion', () => {
  it('accepts a compatible runtime version', () => {
    const result = negotiateVersion(sampleManifest(), '0.2.0');
    expect(result.compatible).toBe(true);
    expect(result.required).toBe('0.1.0');
  });

  it('rejects an outdated runtime', () => {
    const result = negotiateVersion(sampleManifest({ runtime: { min_uch_version: '0.5.0' } }), '0.2.0');
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain('requires uch >= 0.5.0');
  });
});

describe('parseManifest', () => {
  it('parses valid JSON content', () => {
    const { manifest, warnings } = parseManifest(JSON.stringify(sampleManifest()));
    expect(manifest.workspace.name).toBe('test-workspace');
    expect(warnings).toEqual([]);
  });

  it('throws ManifestError on malformed JSON', () => {
    expect(() => parseManifest('{ not json')).toThrow(ManifestError);
  });

  it('throws ManifestError on invalid manifest', () => {
    expect(() => parseManifest(JSON.stringify({ schema_version: 'bad' }))).toThrow(/schema_version/);
  });
});

describe('discoverManifest', () => {
  it('finds the manifest walking up from a nested directory', () => {
    const dir = makeTempDir();
    const nested = path.join(dir, 'a', 'b', 'c');
    fs.mkdirSync(nested, { recursive: true });
    const manifest = sampleManifest();
    const targetPath = writeManifest(dir, manifest);

    const found = discoverManifest({ startDir: nested });
    expect(found).not.toBeNull();
    expect(found!.workspaceRoot).toBe(dir);
    expect(found!.manifestPath).toBe(targetPath);
    expect(found!.manifest.workspace.name).toBe('test-workspace');
  });

  it('returns null when no manifest exists anywhere up the tree', () => {
    const dir = makeTempDir();
    expect(discoverManifest({ startDir: dir })).toBeNull();
  });

  it('does not cross the stopAt boundary', () => {
    const outer = makeTempDir();
    const inner = path.join(outer, 'inner');
    fs.mkdirSync(inner);
    writeManifest(outer, sampleManifest());
    expect(discoverManifest({ startDir: inner, stopAt: inner })).toBeNull();
  });
});

describe('createManifest + writeManifest', () => {
  it('writes a manifest that round-trips', () => {
    const dir = makeTempDir();
    const manifest = createManifest({ name: 'roundtrip', minUchVersion: '0.2.0' });
    const targetPath = writeManifest(dir, manifest);
    expect(fs.existsSync(targetPath)).toBe(true);
    const loaded = parseManifest(fs.readFileSync(targetPath, 'utf-8'));
    expect(loaded.manifest.workspace.name).toBe('roundtrip');
    expect(loaded.manifest.schema_version).toBe(MANIFEST_SCHEMA_VERSION);
  });
});

describe('negotiate', () => {
  it('grants only enabled capabilities the runtime can provide', () => {
    const result = negotiate(sampleManifest(), {
      capabilities: ['memory', 'research'],
      drivers: ['filesystem'],
    });
    const memory = result.capabilities.find((c) => c.name === 'memory')!;
    const research = result.capabilities.find((c) => c.name === 'research')!;
    const unknown = result.capabilities.find((c) => c.name === 'unknown-cap')!;
    expect(memory.granted).toBe(true);
    expect(research.granted).toBe(false);
    expect(unknown.granted).toBe(false);
    expect(result.grantedCapabilities).toEqual(['memory']);
  });

  it('reports drivers unavailable in the runtime', () => {
    const result = negotiate(sampleManifest(), { capabilities: [], drivers: [] });
    expect(result.drivers).toHaveLength(1);
    expect(result.drivers[0]!.started).toBe(false);
    expect(result.drivers[0]!.error).toContain('not available');
  });
});

describe('attach lifecycle', () => {
  it('attaches to a workspace with a manifest, starts drivers, publishes events, detaches', async () => {
    const dir = makeTempDir();
    writeManifest(dir, sampleManifest());

    const eventBus = new NeuralEventBus();
    const eventTypes: string[] = [];
    eventBus.subscribe(async (event) => {
      eventTypes.push(event.type);
    });

    const driverRegistry = new DriverRegistry();
    let filesystemStarted = false;
    let filesystemStopped = false;
    const filesystemDriver: Driver = {
      id: 'filesystem',
      name: 'filesystem',
      start: () => {
        filesystemStarted = true;
      },
      stop: () => {
        filesystemStopped = true;
      },
    };
    driverRegistry.register(filesystemDriver);

    const result = await attach({
      agent_id: 'test-agent',
      startDir: dir,
      eventBus,
      driverRegistry,
      capabilityRegistry: createStandardCapabilityRegistry(),
    });

    expect(result.attached).toBe(true);
    expect(result.discovery?.workspaceRoot).toBe(dir);
    expect(result.workspace_id).toBe('ws-test');
    expect(result.capabilities).toContain('memory');
    expect(result.drivers).toContain('filesystem');
    expect(filesystemStarted).toBe(true);
    expect(eventTypes).toContain('workspace:opened');
    expect(eventTypes).toContain('agent:attached');

    await detach(result, { eventBus, driverRegistry });
    expect(filesystemStopped).toBe(true);
    expect(eventTypes).toContain('agent:detached');
    expect(eventTypes).toContain('workspace:closed');
  });

  it('issues a scoped grant to the attaching agent and revokes it on detach', async () => {
    const dir = makeTempDir();
    writeManifest(dir, sampleManifest());
    const eventBus = new NeuralEventBus();
    const grantEngine = new GrantEngine();

    const result = await attach({
      agent_id: 'test-agent',
      startDir: dir,
      eventBus,
      grantEngine,
      capabilityRegistry: createStandardCapabilityRegistry(),
    });

    expect(result.attached).toBe(true);
    expect(result.grant).toBeDefined();
    expect(result.grant!.actor).toEqual({ type: 'agent', id: 'test-agent' });
    expect(result.grant!.scope).toEqual({ workspace: 'ws-test', organization: 'default' });
    expect(result.grant!.revoked).toBe(false);
    expect(grantEngine.get(result.grant!.grant_id)).toBeDefined();

    await detach(result, { eventBus, grantEngine });
    expect(grantEngine.get(result.grant!.grant_id)?.revoked).toBe(true);
    expect(grantEngine.listActive()).toHaveLength(0);
  });

  it('returns attached:false with a reason when no manifest exists', async () => {
    const dir = makeTempDir();
    const result = await attach({ startDir: dir });
    expect(result.attached).toBe(false);
    expect(result.reason).toContain('no workspace manifest');
    expect(result.session_id).toBe('');
  });

  it('rejects attachment when the runtime is older than required', async () => {
    const dir = makeTempDir();
    writeManifest(dir, sampleManifest({ runtime: { min_uch_version: '99.0.0' } }));
    const result = await attach({ startDir: dir, runtimeVersion: UCH_RUNTIME_VERSION });
    expect(result.attached).toBe(false);
    expect(result.version?.compatible).toBe(false);
    expect(result.reason).toContain('requires uch >= 99.0.0');
  });

  it('continues when a requested driver fails to start', async () => {
    const dir = makeTempDir();
    writeManifest(dir, sampleManifest());
    const eventBus = new NeuralEventBus();
    const driverRegistry = new DriverRegistry();
    driverRegistry.register({
      id: 'filesystem',
      name: 'filesystem',
      start: () => {
        throw new Error('boom');
      },
      stop: () => undefined,
    });

    const result = await attach({
      startDir: dir,
      eventBus,
      driverRegistry,
      capabilityRegistry: createStandardCapabilityRegistry(),
    });

    expect(result.attached).toBe(true);
    expect(result.drivers).not.toContain('filesystem');
  });
});
