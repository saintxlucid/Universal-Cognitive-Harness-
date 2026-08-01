/**
 * IDEA-0076 — Knowledge Lineage Service (prototype).
 *
 * One interface answering the five lineage questions for any object:
 * origin (creator + creation event), changelog (who/what/why per
 * change), verification (verdicts + runs), and dependents (reverse
 * causal edges). Read-mostly, in-memory, deterministic. Extinct objects
 * retain a lineage stub ("where did I come from" survives death).
 *
 * SOP-08 Prototype discipline: NOT wired into any gate.
 */

export interface LineageOrigin {
  readonly creator: string;
  readonly eventId: string;
  readonly atTick: number;
}

export interface LineageChange {
  readonly who: string;
  readonly what: string;
  readonly why: string;
  readonly atTick: number;
}

export interface VerificationVerdict {
  readonly verdict: 'pass' | 'fail' | 'pending';
  readonly run: string;
  readonly atTick: number;
}

export interface LineageRecord {
  readonly objectId: string;
  readonly kind: string;
  readonly origin: LineageOrigin;
  changes: LineageChange[];
  verifications: VerificationVerdict[];
  /** Reverse causal edges: object ids that depend on this one. */
  dependents: readonly string[];
  /** Extinct stub: record survives with lineage, loadable: false. */
  extinct: boolean;
}

export interface LineageAnswer {
  readonly objectId: string;
  readonly origin: LineageOrigin;
  readonly changelog: readonly LineageChange[];
  readonly verification: readonly VerificationVerdict[];
  readonly dependents: readonly string[];
  readonly extinct: boolean;
}

export class LineageService {
  private records = new Map<string, LineageRecord>();

  recordOrigin(objectId: string, kind: string, creator: string, eventId: string, atTick: number): void {
    this.records.set(objectId, {
      objectId,
      kind,
      origin: { creator, eventId, atTick },
      changes: [],
      verifications: [],
      dependents: [],
      extinct: false,
    });
  }

  addChange(objectId: string, who: string, what: string, why: string, atTick: number): boolean {
    const record = this.records.get(objectId);
    if (!record || record.extinct) return false;
    record.changes = [...record.changes, { who, what, why, atTick }];
    return true;
  }

  addVerification(objectId: string, verdict: VerificationVerdict['verdict'], run: string, atTick: number): boolean {
    const record = this.records.get(objectId);
    if (!record) return false;
    record.verifications = [...record.verifications, { verdict, run, atTick }];
    return true;
  }

  /** Declares objectId depends on dependencyId (reverse edge added). */
  declareDependency(objectId: string, dependencyId: string): boolean {
    const dependent = this.records.get(objectId);
    const dependency = this.records.get(dependencyId);
    if (!dependent || !dependency || objectId === dependencyId) return false;
    dependency.dependents = [...dependency.dependents, objectId];
    return true;
  }

  /** Marks an object extinct: lineage survives, dependents retained. */
  markExtinct(objectId: string): boolean {
    const record = this.records.get(objectId);
    if (!record || record.extinct) return false;
    record.extinct = true;
    return true;
  }

  /** Answers all five lineage questions for an object. */
  lineage(objectId: string): LineageAnswer | undefined {
    const record = this.records.get(objectId);
    if (!record) return undefined;
    return {
      objectId: record.objectId,
      origin: record.origin,
      changelog: record.changes,
      verification: record.verifications,
      dependents: record.dependents,
      extinct: record.extinct,
    };
  }

  /** "Who verified this?" — canonical verdict list. */
  verifiedBy(objectId: string): readonly VerificationVerdict[] {
    return this.lineage(objectId)?.verification ?? [];
  }

  /** "What depends on me?" — reverse causal edges. */
  dependsOnMe(objectId: string): readonly string[] {
    return this.lineage(objectId)?.dependents ?? [];
  }
}
