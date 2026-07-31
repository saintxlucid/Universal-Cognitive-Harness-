// ── Projection Engine ───────────────────────────────────────────────────
// ADR-001 Phase-I criterion #4: two independently implemented clients
// receiving different authorized projections of the same workspace state.
//
// A projection is what one grant holder may actually see: the workspace
// state filtered through the grant's scope (CIC §2.2 cascade) and the
// capabilities filtered through the grant's operation families. Discovery
// never implies authority — a capability whose operations are all outside
// the grant is absent from the projection.
//
// Same workspace state, two grants -> two projections. No state is ever
// projected unfiltered.
// ────────────────────────────────────────────────────────────────────────

import type {
  CapabilityCost,
  CapabilityRetention,
  CapabilityScope,
  GrantOperation,
} from '../cognitive-runtime/capability-registry.js';
import { CapabilityRegistry } from '../cognitive-runtime/capability-registry.js';
import type { CapabilityGrant, GrantActor } from '../cognitive-runtime/grants.js';

export const SCOPE_LEVELS = ['session', 'task', 'branch', 'project', 'workspace'] as const;
export type ScopeLevel = (typeof SCOPE_LEVELS)[number];

/** Workspace state as a containment tree: workspace -> projects -> branches -> tasks -> sessions. */
export interface WorkspaceState {
  workspace_id: string;
  projects: string[];
  /** projectId -> branch ids */
  branches: Record<string, string[]>;
  /** branchId -> task ids */
  tasks: Record<string, string[]>;
  /** taskId -> session ids */
  sessions: Record<string, string[]>;
  /** Capability names the workspace runtime provides. */
  capabilities: string[];
}

export interface CapabilityProjection {
  name: string;
  /** Operation families this client may actually invoke. */
  operations: GrantOperation[];
  cost?: CapabilityCost;
  retention?: CapabilityRetention;
}

export interface ScopeProjection {
  projects: string[];
  branches: string[];
  tasks: string[];
  sessions: string[];
}

export interface WorkspaceProjection {
  actor: GrantActor;
  grant_id: string;
  workspace_id: string;
  /** The scope actually granted (never wider than the grant). */
  scope: CapabilityScope;
  /** Operation families granted. */
  operations: GrantOperation[];
  /** Capabilities with at least one authorized operation family. */
  capabilities: CapabilityProjection[];
  /** Workspace objects this client may see, contained in the granted scope. */
  visible: ScopeProjection;
  projected_at: Date;
}

function emptyScopeProjection(): ScopeProjection {
  return { projects: [], branches: [], tasks: [], sessions: [] };
}

interface ResolvedChain {
  project?: string;
  branch?: string;
  task?: string;
  session?: string;
}

function taskContainingSession(state: WorkspaceState, session: string): string | undefined {
  for (const [task, sessions] of Object.entries(state.sessions)) {
    if (sessions.includes(session)) return task;
  }
  return undefined;
}

function branchContainingTask(state: WorkspaceState, task: string): string | undefined {
  for (const [branch, tasks] of Object.entries(state.tasks)) {
    if (tasks.includes(task)) return branch;
  }
  return undefined;
}

function projectContainingBranch(state: WorkspaceState, branch: string): string | undefined {
  for (const [project, branches] of Object.entries(state.branches)) {
    if (branches.includes(branch)) return project;
  }
  return undefined;
}

/**
 * Resolves the containment chain of a grant's scope bottom-up from the most
 * granular pin: every level above the pin collapses to the containing
 * ancestor of what is visible. Returns `null` when a pinned object is
 * unknown to the state — nothing is projected then.
 */
function resolveChain(state: WorkspaceState, scope: CapabilityScope): ResolvedChain | null {
  let project = scope.project;
  let branch = scope.branch;
  let task = scope.task;
  const session = scope.session;

  if (session !== undefined && task === undefined) {
    task = taskContainingSession(state, session);
    if (task === undefined) return null;
  }
  if (task !== undefined && branch === undefined) {
    branch = branchContainingTask(state, task);
    if (branch === undefined) return null;
  }
  if (branch !== undefined && project === undefined) {
    project = projectContainingBranch(state, branch);
    if (project === undefined) return null;
  }
  return { project, branch, task, session };
}

/**
 * Filters the workspace containment tree down to the objects a grant may
 * see. Objects below the grant's pin level are fully visible; objects at
 * the pin level are filtered to the granted values; levels above the pin
 * are projected only as the containing ancestors of what is visible.
 */
export function projectScope(grantScope: CapabilityScope, state: WorkspaceState): ScopeProjection {
  const visible = emptyScopeProjection();

  if (grantScope.workspace !== undefined && grantScope.workspace !== state.workspace_id) {
    return visible;
  }

  const chain = resolveChain(state, grantScope);
  if (chain === null) return visible;

  const projectFilter = chain.project;
  const branchFilter = chain.branch;
  const taskFilter = chain.task;
  const sessionFilter = chain.session;

  const projects = projectFilter !== undefined
    ? [projectFilter]
    : state.projects;

  for (const project of projects) {
    if (!state.projects.includes(project)) continue;
    visible.projects.push(project);

    const branches = branchFilter !== undefined
      ? [branchFilter]
      : state.branches[project] ?? [];
    for (const branch of branches) {
      if (!visible.branches.includes(branch)) visible.branches.push(branch);

      const tasks = taskFilter !== undefined
        ? [taskFilter]
        : state.tasks[branch] ?? [];
      for (const task of tasks) {
        if (!visible.tasks.includes(task)) visible.tasks.push(task);

        const sessions = sessionFilter !== undefined
          ? [sessionFilter]
          : state.sessions[task] ?? [];
        for (const session of sessions) {
          if (!visible.sessions.includes(session)) visible.sessions.push(session);
        }
      }
    }
  }

  return visible;
}

export interface ProjectionEngineOptions {
  /** Registry used to resolve capability authority/cost/retention. */
  capabilityRegistry?: CapabilityRegistry;
}

export class ProjectionEngine {
  private registry?: CapabilityRegistry;

  constructor(options?: ProjectionEngineOptions) {
    this.registry = options?.capabilityRegistry;
  }

  /**
   * Computes the authorized projection for one grant over one workspace
   * state. The projection is the intersection of what the workspace holds
   * and what the grant permits — never the workspace state itself.
   */
  project(grant: CapabilityGrant, state: WorkspaceState): WorkspaceProjection {
    const capabilities: CapabilityProjection[] = [];
    for (const name of state.capabilities) {
      const authority = this.registry?.getAuthority(name) ?? [];
      const operations = authority.filter((op) => grant.operations.includes(op));
      if (operations.length === 0) continue;
      capabilities.push({
        name,
        operations,
        ...(this.registry?.getCost(name) !== undefined ? { cost: this.registry!.getCost(name) } : {}),
        ...(this.registry?.getRetention(name) !== undefined ? { retention: this.registry!.getRetention(name) } : {}),
      });
    }

    return {
      actor: { ...grant.actor },
      grant_id: grant.grant_id,
      workspace_id: state.workspace_id,
      scope: { ...grant.scope },
      operations: [...grant.operations],
      capabilities,
      visible: projectScope(grant.scope, state),
      projected_at: new Date(),
    };
  }

  /** Projects one state for every grant. Each grant holder sees its own view. */
  projectAll(grants: CapabilityGrant[], state: WorkspaceState): WorkspaceProjection[] {
    return grants.map((grant) => this.project(grant, state));
  }
}
