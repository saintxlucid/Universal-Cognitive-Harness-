// ── Event Governance ────────────────────────────────────────────────────
// ADR-001 Phase-I criterion #3: at least one driver event path that is
// provenance-linked, idempotent, policy-checked, and observable.
//
// A driver observation enters the runtime only through EventGovernance:
//   1. idempotency   — the source event_id is deduplicated; replays are dropped
//   2. policy check  — PolicyEngine allow/deny on (source, type, resource)
//   3. grant check   — GrantEngine authorizes the observation at its scope
//                      (operation families, rate limit, budget all enforced)
//   4. staleness     — observations older than maxEventAgeMs are rejected
//   5. observability — every decision is written to an audit ledger and
//                      denials are emitted on the event bus
// Admitted events carry a ProvenanceLink (causal chain) in bus metadata.
// ────────────────────────────────────────────────────────────────────────

import { NeuralEventBus, type EventType } from '../event-bus/neural-event-bus.js';
import type { CapabilityScope, GrantOperation } from '../cognitive-runtime/capability-registry.js';
import { GrantEngine } from '../cognitive-runtime/grants.js';
import { PolicyEngine } from './policies.js';

export interface ProvenanceLink {
  /** Id of this event. */
  event_id: string;
  /** Id of the causal predecessor, if any (provenance chain). */
  parent_id?: string;
  /** Driver that produced the observation. */
  driver_id: string;
  /** Authority the observation claims (e.g. 'git', 'filesystem'). */
  source_authority: string;
  /** When the driver observed the fact. */
  emitted_at: Date;
}

export interface GovernedEvent {
  event_id: string;
  type: string;
  timestamp: Date;
  source: string;
  payload: Record<string, unknown>;
  scope: CapabilityScope;
  provenance: ProvenanceLink;
}

export interface GovernEventInput {
  /** Stable source-side id; the idempotency key. Defaults to a fresh id. */
  event_id?: string;
  /** Causal predecessor for the provenance chain. */
  parent_id?: string;
  type: string;
  /** When the driver observed the fact (defaults to now). */
  timestamp?: Date;
  source: string;
  /** Authority the observation claims (defaults to the driver_id). */
  source_authority?: string;
  driver_id: string;
  payload?: Record<string, unknown>;
  /** Scope the observation is asserted within. */
  scope?: CapabilityScope;
  /** Grant to authorize the observation against. */
  grant_id?: string;
  /** Actor claiming the grant (checked against grant.actor). */
  actor?: { type: 'agent' | 'user' | 'system' | 'service'; id: string };
  /** Grant operation family to authorize (defaults to 'observe'). */
  operation?: GrantOperation;
  /** Policy resource (defaults to scope.workspace ?? scope.project ?? '*'). */
  resource?: string;
}

export interface GovernanceDecision {
  admitted: boolean;
  reason?: string;
  /** True when the event was dropped as a replay. */
  duplicate?: boolean;
  /** True when the event was rejected as stale. */
  stale?: boolean;
  governed?: GovernedEvent;
}

export interface GovernanceRecord {
  decision: 'admitted' | 'denied' | 'duplicate';
  event_id: string;
  type: string;
  source: string;
  reason?: string;
  at: Date;
}

export interface EventGovernanceOptions {
  policyEngine?: PolicyEngine;
  grantEngine?: GrantEngine;
  eventBus?: NeuralEventBus;
  /** Reject observations older than this (stale-event handling). */
  maxEventAgeMs?: number;
  /** Audit ledger capacity (defaults to 1000). */
  maxLedger?: number;
}

export class EventGovernance {
  private policyEngine?: PolicyEngine;
  private grantEngine?: GrantEngine;
  private eventBus?: NeuralEventBus;
  private maxEventAgeMs?: number;
  private maxLedger: number;

  private seen = new Map<string, true>();
  private auditLedger: GovernanceRecord[] = [];
  private admittedEvents: GovernedEvent[] = [];
  private admissions = 0;
  private deniedTotal = 0;
  private duplicates = 0;

  constructor(options?: EventGovernanceOptions) {
    this.policyEngine = options?.policyEngine;
    this.grantEngine = options?.grantEngine;
    this.eventBus = options?.eventBus;
    this.maxEventAgeMs = options?.maxEventAgeMs;
    this.maxLedger = options?.maxLedger ?? 1000;
  }

  /**
   * Runs the full governance gate: dedupe → policy → grant → staleness.
   * Does not publish; use `admitAndPublish` for the full driver path.
   */
  admit(input: GovernEventInput): GovernanceDecision {
    const now = new Date();
    const event_id = input.event_id ?? `evt-${crypto.randomUUID()}`;

    if (this.seen.has(event_id)) {
      this.duplicates += 1;
      this.record({ decision: 'duplicate', event_id, type: input.type, source: input.source, at: now });
      return { admitted: false, duplicate: true, reason: 'duplicate event (already processed)' };
    }

    const timestamp = input.timestamp ?? now;
    if (this.maxEventAgeMs !== undefined && now.getTime() - timestamp.getTime() > this.maxEventAgeMs) {
      this.deniedTotal += 1;
      const reason = `stale event (age exceeds ${this.maxEventAgeMs}ms)`;
      this.record({ decision: 'denied', event_id, type: input.type, source: input.source, reason, at: now });
      this.publishDenial(event_id, input.type, input.source, reason);
      return { admitted: false, stale: true, reason };
    }

    if (this.policyEngine) {
      const scope = input.scope ?? {};
      const resource = input.resource ?? scope.workspace ?? scope.project ?? '*';
      const policy = this.policyEngine.evaluate({
        principal: input.source,
        action: input.type,
        resource,
        context: {
          driver_id: input.driver_id,
          event_id,
          scope,
        },
      });
      if (!policy.allowed) {
        this.deniedTotal += 1;
        const reason = `denied by policy rule ${policy.matchedRule?.id ?? '(default deny)'}`;
        this.record({ decision: 'denied', event_id, type: input.type, source: input.source, reason, at: now });
        this.publishDenial(event_id, input.type, input.source, reason);
        return { admitted: false, reason };
      }
    }

    if (this.grantEngine && input.grant_id) {
      const decision = this.grantEngine.authorize({
        grantId: input.grant_id,
        actor: input.actor,
        operation: input.operation ?? 'observe',
        scope: input.scope ?? {},
      });
      if (!decision.granted) {
        this.deniedTotal += 1;
        const reason = `denied by grant: ${decision.reason ?? 'unauthorized'}`;
        this.record({ decision: 'denied', event_id, type: input.type, source: input.source, reason, at: now });
        this.publishDenial(event_id, input.type, input.source, reason);
        return { admitted: false, reason };
      }
    }

    const governed: GovernedEvent = {
      event_id,
      type: input.type,
      timestamp,
      source: input.source,
      payload: input.payload ?? {},
      scope: input.scope ?? {},
      provenance: {
        event_id,
        parent_id: input.parent_id,
        driver_id: input.driver_id,
        source_authority: input.source_authority ?? input.driver_id,
        emitted_at: timestamp,
      },
    };

    this.seen.set(event_id, true);
    this.evictSeen();
    this.admissions += 1;
    this.admittedEvents.push(governed);
    this.record({ decision: 'admitted', event_id, type: input.type, source: input.source, at: now });
    return { admitted: true, governed };
  }

  /**
   * Full governed driver path: gate the observation and, when admitted,
   * publish it on the event bus with its provenance chain attached.
   */
  async admitAndPublish(input: GovernEventInput): Promise<GovernanceDecision> {
    const decision = this.admit(input);
    if (decision.admitted && this.eventBus && decision.governed) {
      await this.eventBus.publish({
        type: decision.governed.type as EventType,
        source: decision.governed.source,
        payload: decision.governed.payload,
        metadata: {
          session_id: decision.governed.scope.session,
          agent_id: decision.governed.scope.task,
          workspace_id: decision.governed.scope.workspace,
          module: decision.governed.provenance.driver_id,
          protocol: 'governed-driver-event',
          targets: [decision.governed.provenance.source_authority],
          provenance: decision.governed.provenance,
          governed: true,
          scope: decision.governed.scope,
        },
      });
    }
    return decision;
  }

  /** Audit ledger of every decision, oldest first. */
  ledger(): GovernanceRecord[] {
    return [...this.auditLedger];
  }

  /** Admitted events with their provenance links, oldest first. */
  events(): GovernedEvent[] {
    return [...this.admittedEvents];
  }

  /** Denial records only. */
  denials(): GovernanceRecord[] {
    return this.auditLedger.filter((r) => r.decision === 'denied');
  }

  get admissionCount(): number {
    return this.admissions;
  }

  get denialCount(): number {
    return this.deniedTotal;
  }

  get duplicateCount(): number {
    return this.duplicates;
  }

  private record(entry: GovernanceRecord): void {
    this.auditLedger.push(entry);
    if (this.auditLedger.length > this.maxLedger) {
      this.auditLedger.shift();
    }
  }

  private evictSeen(): void {
    if (this.seen.size <= this.maxLedger) return;
    const oldest = this.seen.keys().next().value;
    if (oldest !== undefined) this.seen.delete(oldest);
  }

  private publishDenial(event_id: string, type: string, source: string, reason: string): void {
    if (!this.eventBus) return;
    void this.eventBus.publish({
      type: 'governance:event_denied',
      source: 'uch-governance',
      payload: { event_id, type, source, reason },
    });
  }
}
