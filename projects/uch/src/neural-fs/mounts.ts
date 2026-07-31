import {
  readSnapshot,
  writeSnapshot,
  type Storable,
} from '../cognitive-plane/persistence/persistence-engine.js';

export interface Mount {
  point: string;
  scope: string;
  grantId: string;
  capabilities: string[];
  attachedAt: Date;
}

export interface MountSpec {
  point: string;
  scope: string;
  grantId: string;
  capabilities: string[];
  attachedAt?: Date;
}

export type Clock = () => Date;

// Trailing slashes normalize so `/memory` and `/memory/` are the same point.
function normalizePoint(point: string): string {
  return point === '/' ? '/' : point.replace(/\/+$/, '');
}

function isWithin(point: string, path: string): boolean {
  if (point === '/') return path.startsWith('/');
  return path === point || path.startsWith(`${point}/`);
}

// Static subset of the CIC instruction vocabulary (ADR-006 §3) mapped to FS
// verb families. The runtime catalog (src/protocol/catalog.ts) does not export
// its op list, so the subset is documented here; catalog correspondence:
// retrieve=RECALL, remember=STORE, observe=OBSERVE, evaluate/critique=VERIFY,
// plan=PLAN, reflect=REFLECT, consolidate=CONSOLIDATE (COMPARE has no op yet).
export const CP_VERBS: Record<string, string[]> = {
  RECALL: ['/memory:read', '/knowledge:read', '/episodes:read', '/history:read'],
  STORE: ['/memory:write', '/knowledge:write', '/evidence:write'],
  OBSERVE: ['/events:read', '/workspaces:read', '/projects:read'],
  VERIFY: ['/beliefs:read', '/evidence:read'],
  PLAN: ['/goals:read', '/goals:write'],
  COMPARE: ['/beliefs:read', '/evidence:read'],
  REFLECT: ['/thoughts:read', '/thoughts:write', '/history:read'],
  CONSOLIDATE: ['/memory:write', '/skills:write', '/history:read'],
};

export class MountTable implements Storable {
  private readonly mounts = new Map<string, Mount>();
  private readonly now: Clock;

  constructor(options?: { now?: Clock }) {
    this.now = options?.now ?? (() => new Date());
  }

  mount(spec: MountSpec): Mount {
    const point = normalizePoint(spec.point);
    if (this.mounts.has(point)) {
      throw new Error(`mount point already in use: ${point}`);
    }
    const mount: Mount = {
      point,
      scope: spec.scope,
      grantId: spec.grantId,
      capabilities: [...spec.capabilities],
      attachedAt: spec.attachedAt ?? this.now(),
    };
    this.mounts.set(point, mount);
    return mount;
  }

  unmount(point: string): boolean {
    return this.mounts.delete(normalizePoint(point));
  }

  resolve(path: string): { mount: Mount; remainder: string } | undefined {
    let best: { mount: Mount; remainder: string } | undefined;
    for (const mount of this.mounts.values()) {
      if (!isWithin(mount.point, path)) continue;
      if (best !== undefined && mount.point.length <= best.mount.point.length) continue;
      best = { mount, remainder: path === mount.point ? '/' : path.slice(mount.point.length) };
    }
    return best;
  }

  canAccess(path: string, capability: string, grantedCapabilities: readonly string[]): boolean {
    const resolved = this.resolve(path);
    if (resolved === undefined) return false;
    return (
      resolved.mount.capabilities.includes(capability) && grantedCapabilities.includes(capability)
    );
  }

  list(): Mount[] {
    return [...this.mounts.values()].map((m) => ({ ...m, capabilities: [...m.capabilities] }));
  }

  async persist(filePath: string): Promise<void> {
    writeSnapshot(filePath, { mounts: this.list() });
  }

  async load(filePath: string): Promise<number> {
    const data = readSnapshot<{ mounts?: Mount[] }>(filePath);
    if (!data?.mounts) return 0;
    this.mounts.clear();
    for (const mount of data.mounts) this.mounts.set(mount.point, mount);
    return this.mounts.size;
  }
}
