import { NeuralEventBus } from '../event-bus/neural-event-bus.js';
import { DriverRegistry, type Driver } from '../drivers/registry.js';
import {
  CapabilityRegistry,
  type CapabilityScope,
  type GrantOperation,
} from '../cognitive-runtime/capability-registry.js';
import { GrantEngine, type CapabilityGrant } from '../cognitive-runtime/grants.js';
import { EventGovernance } from '../control-plane/event-governance.js';
import {
  ProjectionEngine,
  type WorkspaceProjection,
  type WorkspaceState,
} from '../control-plane/projections.js';
import { discoverManifest, type DiscoveryResult } from './discovery.js';
import { negotiateVersion, type WorkspaceManifest } from './manifest.js';
import { negotiate } from './negotiation.js';

export const UCH_RUNTIME_VERSION = '0.3.0';

export const STANDARD_CAPABILITIES = [
  'memory',
  'knowledge',
  'skills',
  'planning',
  'retrieval',
  'architecture-analysis',
  'security-review',
  'performance-profiling',
  'refactoring',
  'testing',
  'documentation',
  'research',
  'simulation',
  'debugging',
  'deployment',
  'monitoring',
  'knowledge-search',
  'productivity',
  'signal-fusion',
  'code-governance',
];

/** Default operation families granted to an attached agent. */
export const DEFAULT_GRANT_OPERATIONS: GrantOperation[] = [
  'observe',
  'retrieve',
  'propose',
  'evaluate',
  'simulate',
];

export interface AttachOptions {
  /** Agent identity requesting attachment. */
  agent_id?: string;
  /** User identity on whose behalf the agent attaches. */
  user_id?: string;
  /** Directory to start manifest discovery from (defaults to cwd). */
  startDir?: string;
  /** Runtime version used for version negotiation. */
  runtimeVersion?: string;
  /** Pre-built capability registry (defaults to STANDARD_CAPABILITIES). */
  capabilityRegistry?: CapabilityRegistry;
  /** Pre-built driver registry; only requested drivers that are registered can start. */
  driverRegistry?: DriverRegistry;
  /** Grant engine used to issue the attachment grant (defaults to a fresh engine). */
  grantEngine?: GrantEngine;
  /** Operation families granted to the attaching agent (defaults to DEFAULT_GRANT_OPERATIONS). */
  grantOperations?: GrantOperation[];
  /** Time-to-live of the attachment grant, in ms (defaults to none). */
  grantTtlMs?: number;
  eventBus?: NeuralEventBus;
  /** Event governance gate; defaults to one bound to the attach event bus + grant engine. */
  governance?: EventGovernance;
  /** Additional scope pins for the issued grant (merged over the workspace scope). */
  grantScope?: CapabilityScope;
  /** Workspace state tree used to compute the authorized projection. */
  workspaceState?: WorkspaceState;
  /** Driver factory map: id → (eventBus, config) => Driver. */
  driverFactories?: Record<
    string,
    (eventBus: NeuralEventBus, config?: Record<string, unknown>) => Driver
  >;
}

export interface AttachmentResult {
  attached: boolean;
  reason?: string;
  discovery: DiscoveryResult | null;
  version?: {
    compatible: boolean;
    required: string;
    current: string;
    reason?: string;
  };
  capabilities: string[];
  drivers: string[];
  workspace_id: string;
  session_id: string;
  grant?: CapabilityGrant;
  /** Governance gate bound to this session; route driver observations through it. */
  governance?: EventGovernance;
  /** Authorized projection of the workspace state (when `workspaceState` was provided). */
  projection?: WorkspaceProjection;
}

export interface AttachmentSession {
  session_id: string;
  workspace_id: string;
  workspace_root: string;
  manifest: WorkspaceManifest;
  result: AttachmentResult;
  detach(): Promise<void>;
}

/**
 * The workspace attachment lifecycle (ADR-001 §Attachment lifecycle):
 *
 *   workspace opened
 *     -> manifest discovered
 *     -> runtime version negotiated
 *     -> capabilities and drivers negotiated
 *     -> authorized workspace-state projection materialized
 *     -> workspace:opened / agent:attached events emitted
 *     -> session detached; durable state remains with workspace policy
 *
 * A workspace with no manifest simply yields `attached: false` — the client
 * keeps operating normally. Attachment is discovery plus negotiated
 * activation, never hidden interception.
 */
export async function attach(options?: AttachOptions): Promise<AttachmentResult> {
  const opts: Required<Pick<AttachOptions, 'agent_id' | 'user_id' | 'runtimeVersion'>> &
    AttachOptions = {
    agent_id: options?.agent_id ?? 'uch-client',
    user_id: options?.user_id ?? 'default',
    runtimeVersion: options?.runtimeVersion ?? UCH_RUNTIME_VERSION,
    ...options,
  };

  const discovery = discoverManifest({ startDir: opts.startDir });
  if (!discovery) {
    return {
      attached: false,
      reason: 'no workspace manifest found (create one with: uch manifest init)',
      discovery: null,
      capabilities: [],
      drivers: [],
      workspace_id: '',
      session_id: '',
    };
  }

  const version = negotiateVersion(discovery.manifest, opts.runtimeVersion);
  if (!version.compatible) {
    return {
      attached: false,
      reason: version.reason,
      discovery,
      version,
      capabilities: [],
      drivers: [],
      workspace_id: '',
      session_id: '',
    };
  }

  const capabilityRegistry = opts.capabilityRegistry ?? createStandardCapabilityRegistry();
  const driverRegistry = opts.driverRegistry ?? new DriverRegistry();

  const negotiated = negotiate(discovery.manifest, {
    capabilities: capabilityRegistry.getAll().map((c) => c.name),
    drivers: driverRegistry.list().map((d) => d.id),
  });

  const startedDrivers: string[] = [];
  for (const entry of negotiated.drivers) {
    if (!entry.started) continue;
    const driver = driverRegistry.get(entry.id);
    if (!driver) {
      entry.error = `driver "${entry.id}" not registered`;
      entry.started = false;
      continue;
    }
    try {
      await driverRegistry.start(entry.id);
      startedDrivers.push(entry.id);
    } catch (err) {
      entry.error = err instanceof Error ? err.message : String(err);
      entry.started = false;
    }
  }

  const session_id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const workspace_id = discovery.manifest.workspace.id ?? discovery.manifest.workspace.name;

  const eventBus = opts.eventBus ?? new NeuralEventBus();
  const grantEngine = opts.grantEngine ?? new GrantEngine();
  const scope: CapabilityScope = {
    workspace: workspace_id,
    ...(opts.user_id !== undefined ? { organization: opts.user_id } : {}),
  };
  const grant = grantEngine.issue({
    actor: { type: 'agent', id: opts.agent_id },
    scope: {
      ...scope,
      ...opts.grantScope,
    },
    operations: opts.grantOperations ?? DEFAULT_GRANT_OPERATIONS,
    ttlMs: opts.grantTtlMs,
    constraints: {
      purpose: `Attachment of ${opts.agent_id} to workspace ${workspace_id}`,
    },
  });

  const projection =
    opts.workspaceState !== undefined
      ? new ProjectionEngine({ capabilityRegistry }).project(grant, {
          ...opts.workspaceState,
          workspace_id,
        })
      : undefined;

  const governance = opts.governance ?? new EventGovernance({ eventBus, grantEngine });
  const lifecycleInput = {
    type: '' as string,
    source: opts.agent_id,
    driver_id: 'workspace-manifest',
    source_authority: 'uch-attach',
    scope,
    grant_id: grant.grant_id,
    actor: { type: 'agent', id: opts.agent_id } as const,
    payload: {} as Record<string, unknown>,
  };

  const opened = {
    ...lifecycleInput,
    event_id: `att-opened-${session_id}`,
    type: 'workspace:opened' as const,
  };
  const attached = {
    ...lifecycleInput,
    event_id: `att-attached-${session_id}`,
    type: 'agent:attached' as const,
  };
  opened.payload = {
    workspace_id,
    name: discovery.manifest.workspace.name,
    root: discovery.workspaceRoot,
    session_id,
  };
  attached.payload = {
    agent_id: opts.agent_id,
    user_id: opts.user_id,
    workspace_id,
    session_id,
    capabilities: negotiated.grantedCapabilities,
    drivers: startedDrivers,
  };

  const lifecycleEvents = [opened, attached];
  if (opts.governance === undefined) {
    for (const event of lifecycleEvents) {
      await governance.admitAndPublish(event);
    }
  } else {
    for (const event of lifecycleEvents) {
      await eventBus.publish({ type: event.type, source: event.source, payload: event.payload });
    }
  }

  return {
    attached: true,
    discovery,
    version,
    capabilities: negotiated.grantedCapabilities,
    drivers: startedDrivers,
    workspace_id,
    session_id,
    grant,
    governance,
    projection,
  };
}

export async function detach(
  result: AttachmentResult,
  options?: {
    eventBus?: NeuralEventBus;
    driverRegistry?: DriverRegistry;
    grantEngine?: GrantEngine;
  },
): Promise<void> {
  if (!result.attached) return;

  if (options?.driverRegistry) {
    for (const id of result.drivers) {
      await options.driverRegistry.stop(id);
    }
  }

  if (options?.grantEngine && result.grant) {
    options.grantEngine.revoke(result.grant.grant_id);
  }

  const eventBus = options?.eventBus ?? new NeuralEventBus();
  await eventBus.publish({
    type: 'agent:detached',
    source: 'uch',
    payload: {
      session_id: result.session_id,
      workspace_id: result.workspace_id,
    },
  });
  await eventBus.publish({
    type: 'workspace:closed',
    source: 'uch',
    payload: {
      workspace_id: result.workspace_id,
      session_id: result.session_id,
    },
  });
}

export function createStandardCapabilityRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();

  const authorities: Record<string, GrantOperation[]> = {
    memory: ['observe', 'retrieve', 'propose', 'consolidate'],
    knowledge: ['observe', 'retrieve', 'propose', 'commit'],
    skills: ['retrieve', 'propose', 'evaluate'],
    planning: ['retrieve', 'propose', 'delegate'],
    retrieval: ['retrieve'],
    'architecture-analysis': ['retrieve', 'simulate'],
    'security-review': ['retrieve', 'evaluate'],
    'performance-profiling': ['retrieve', 'simulate'],
    refactoring: ['retrieve', 'propose', 'commit'],
    testing: ['retrieve', 'evaluate', 'simulate'],
    documentation: ['retrieve', 'propose', 'commit'],
    research: ['retrieve', 'propose'],
    simulation: ['simulate'],
    debugging: ['observe', 'retrieve', 'evaluate'],
    deployment: ['propose', 'commit'],
    monitoring: ['observe', 'retrieve'],
    'knowledge-search': ['retrieve'],
    productivity: ['observe', 'retrieve', 'propose', 'consolidate'],
    'signal-fusion': ['retrieve', 'evaluate', 'simulate'],
    'code-governance': ['observe', 'retrieve', 'evaluate'],
  };

  for (const name of STANDARD_CAPABILITIES) {
    registry.register({
      name,
      version: '1.0.0',
      description: `Workspace capability: ${name}`,
      requires: [],
      provides: [name],
      enabled: true,
      scope: { workspace: '*' },
      authority: authorities[name] ?? ['retrieve'],
      cost: {
        maxTokensPerDay: 100_000,
        maxTokensPerSession: 10_000,
        maxOperationsPerDay: 1_000,
      },
      retention: { maxAgeDays: 90 },
    });
  }
  return registry;
}
