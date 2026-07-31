// ── Grant Engine (CIC §2.1) ─────────────────────────────────────────────
// Implements the capability_grant model from the Cognitive Interchange
// Contract: a grant binds an actor to a scope, a set of operation families,
// and constraints (rate limit, budget, retention). Authorization is the
// runtime's enforcement point: no operation executes without a valid grant,
// and discovery never implies authority.
// ────────────────────────────────────────────────────────────────────────

import {
  type CapabilityScope,
  type GrantOperation,
  type CapabilityCost,
  type CapabilityRetention,
} from './capability-registry.js';

export const GRANT_SCHEMA_VERSION = 'cic.v0.1';

export type ActorType = 'agent' | 'user' | 'system' | 'service';

export interface GrantActor {
  type: ActorType;
  id: string;
}

export interface GrantConstraints {
  rateLimit?: { maxPerSecond: number };
  budget?: CapabilityCost;
  retention?: CapabilityRetention;
  purpose?: string;
}

export interface IssueGrantRequest {
  actor: GrantActor;
  scope: CapabilityScope;
  operations: GrantOperation[];
  constraints?: GrantConstraints;
  ttlMs?: number;
}

export interface CapabilityGrant {
  grant_id: string;
  schema_version: typeof GRANT_SCHEMA_VERSION;
  actor: GrantActor;
  scope: CapabilityScope;
  operations: GrantOperation[];
  constraints: GrantConstraints;
  issued_at: Date;
  expires_at: Date | null;
  revoked: boolean;
  usage: {
    tokens: number;
    operations: number;
    calls: number;
  };
}

export interface AuthorizationDecision {
  granted: boolean;
  reason?: string;
  grant?: CapabilityGrant;
}

/** Scope cascade order, most granular to most broad (CIC §2.2). */
const SCOPE_ORDER: Array<keyof CapabilityScope> = [
  'session',
  'task',
  'branch',
  'project',
  'workspace',
  'organization',
];

/** Index of the most granular level pinned by a scope, if any. */
function firstPinned(scope: CapabilityScope): number | undefined {
  for (const [index, level] of SCOPE_ORDER.entries()) {
    if (scope[level] !== undefined) return index;
  }
  return undefined;
}

function isScopeWithin(requested: CapabilityScope, granted: CapabilityScope): boolean {
  for (const level of SCOPE_ORDER) {
    const requestedValue = requested[level];
    const grantedValue = granted[level];
    if (requestedValue !== undefined && grantedValue !== undefined && grantedValue !== requestedValue) {
      return false;
    }
  }

  const requestPin = firstPinned(requested);
  const grantPin = firstPinned(granted);
  if (requestPin === undefined || grantPin === undefined) return true;
  return requestPin <= grantPin;
}

export class GrantEngine {
  private grants = new Map<string, CapabilityGrant>();
  private rateWindows = new Map<string, { windowStart: number; count: number }>();
  private now: () => Date;

  constructor(now?: () => Date) {
    this.now = now ?? (() => new Date());
  }

  issue(request: IssueGrantRequest): CapabilityGrant {
    if (request.operations.length === 0) {
      throw new Error('grant requires at least one operation');
    }
    const issuedAt = this.now();
    const expiresAt = request.ttlMs !== undefined
      ? new Date(issuedAt.getTime() + request.ttlMs)
      : null;

    const grant: CapabilityGrant = {
      grant_id: `grant-${crypto.randomUUID()}`,
      schema_version: GRANT_SCHEMA_VERSION,
      actor: { ...request.actor },
      scope: { ...request.scope },
      operations: [...request.operations],
      constraints: request.constraints ?? {},
      issued_at: issuedAt,
      expires_at: expiresAt,
      revoked: false,
      usage: { tokens: 0, operations: 0, calls: 0 },
    };
    this.grants.set(grant.grant_id, grant);
    return grant;
  }

  revoke(grantId: string): boolean {
    const grant = this.grants.get(grantId);
    if (!grant) return false;
    grant.revoked = true;
    this.rateWindows.delete(grantId);
    return true;
  }

  isExpired(grant: CapabilityGrant, now: Date): boolean {
    return grant.expires_at !== null && now > grant.expires_at;
  }

  /**
   * Authorizes an operation for an actor against the scope cascade.
   * Checks, in order: grant exists → not revoked → not expired → operation
   * allowed → scope containment → rate limit → budget.
   */
  authorize(params: {
    grantId: string;
    actor?: { type: ActorType; id: string };
    operation: GrantOperation;
    scope?: CapabilityScope;
    estimatedTokens?: number;
  }): AuthorizationDecision {
    const now = this.now();
    const grant = this.grants.get(params.grantId);

    if (!grant) {
      return { granted: false, reason: `no such grant: ${params.grantId}` };
    }
    if (grant.revoked) {
      return { granted: false, reason: 'grant revoked' };
    }
    if (this.isExpired(grant, now)) {
      return { granted: false, reason: 'grant expired' };
    }
    if (params.actor && (params.actor.type !== grant.actor.type || params.actor.id !== grant.actor.id)) {
      return { granted: false, reason: `actor ${params.actor.type}:${params.actor.id} does not hold this grant` };
    }
    if (!grant.operations.includes(params.operation)) {
      return { granted: false, reason: `operation "${params.operation}" not granted` };
    }

    const scope = params.scope ?? {};
    if (!isScopeWithin(scope, grant.scope)) {
      return { granted: false, reason: 'requested scope is outside the granted scope' };
    }

    const rate = this.checkRateLimit(grant);
    if (!rate.allowed) {
      return { granted: false, reason: rate.reason };
    }

    const budget = this.checkBudget(grant, params.estimatedTokens ?? 0);
    if (!budget.allowed) {
      return { granted: false, reason: budget.reason };
    }

    grant.usage.calls += 1;
    grant.usage.operations += 1;
    grant.usage.tokens += params.estimatedTokens ?? 0;

    return { granted: true, grant };
  }

  private checkRateLimit(grant: CapabilityGrant): { allowed: boolean; reason?: string } {
    const limit = grant.constraints.rateLimit;
    if (!limit) return { allowed: true };

    const now = this.now().getTime();
    const window = this.rateWindows.get(grant.grant_id) ?? { windowStart: now, count: 0 };
    const elapsed = now - window.windowStart;
    if (elapsed >= 1000) {
      window.windowStart = now;
      window.count = 0;
    }
    if (window.count >= limit.maxPerSecond) {
      this.rateWindows.set(grant.grant_id, window);
      return { allowed: false, reason: `rate limit exceeded (max ${limit.maxPerSecond}/s)` };
    }
    window.count += 1;
    this.rateWindows.set(grant.grant_id, window);
    return { allowed: true };
  }

  private checkBudget(grant: CapabilityGrant, estimatedTokens: number): { allowed: boolean; reason?: string } {
    const budget = grant.constraints.budget;
    if (!budget) return { allowed: true };

    const tokensWithEstimate = grant.usage.tokens + estimatedTokens;
    if (budget.maxTokensPerDay !== undefined && tokensWithEstimate > budget.maxTokensPerDay) {
      return { allowed: false, reason: `daily token budget exceeded (${tokensWithEstimate}/${budget.maxTokensPerDay})` };
    }
    if (budget.maxTokensPerSession !== undefined && tokensWithEstimate > budget.maxTokensPerSession) {
      return { allowed: false, reason: `session token budget exceeded (${tokensWithEstimate}/${budget.maxTokensPerSession})` };
    }
    if (budget.maxOperationsPerDay !== undefined && grant.usage.operations + 1 > budget.maxOperationsPerDay) {
      return { allowed: false, reason: `daily operation budget exceeded (max ${budget.maxOperationsPerDay})` };
    }
    return { allowed: true };
  }

  /**
   * Retention check (CIC constraints.retention): whether an object of a
   * given age may still be retained/accessed under this grant.
   */
  checkRetention(grantId: string, objectAgeDays: number): { allowed: boolean; reason?: string } {
    const grant = this.grants.get(grantId);
    if (!grant) return { allowed: false, reason: `no such grant: ${grantId}` };
    const retention = grant.constraints.retention;
    if (!retention) return { allowed: true };
    if (objectAgeDays > retention.maxAgeDays) {
      return {
        allowed: false,
        reason: `object age ${objectAgeDays}d exceeds retention limit ${retention.maxAgeDays}d`,
      };
    }
    return { allowed: true };
  }

  get(grantId: string): CapabilityGrant | undefined {
    return this.grants.get(grantId);
  }

  list(): CapabilityGrant[] {
    return [...this.grants.values()];
  }

  listActive(): CapabilityGrant[] {
    const now = this.now();
    return this.list().filter((g) => !g.revoked && !this.isExpired(g, now));
  }

  count(): number {
    return this.grants.size;
  }
}
