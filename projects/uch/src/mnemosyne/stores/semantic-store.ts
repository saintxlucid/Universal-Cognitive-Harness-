// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Neocortex: semantic store
// Claims with bi-temporal validity (event time / ingestion time), entity
// resolution, contradiction detection, and reconsolidation (supersede, never
// overwrite). Every claim carries a provenance chain to source episodes.
// ═══════════════════════════════════════════════════════════════════════════

import type { Claim, Entity, MemoryClass, Scope } from '../types.js';
import { projectKeyOf } from './episodic-store.js';
import { reviveDates, reviveDateList } from '../hydrate.js';

export interface ClaimInput {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  class: Exclude<MemoryClass, 'working' | 'episodic'>;
  status: Claim['status'];
  scope: Scope;
  certainty: number;
  sourceEpisodes: string[];
  extractionModel: string;
  validAt: Date | null;
  ts: Date;
}

export interface ContradictionResolution {
  resolved: 'superseded' | 'open' | 'none';
  supersededClaimId?: string;
  reason?: string;
}

export type UpsertOutcome = 'created' | 'superseded' | 'kept-existing' | 'corroborated';

export interface UpsertResult {
  claim: Claim;
  outcome: UpsertOutcome;
}

export class SemanticStore {
  private claims = new Map<string, Claim>();
  private entities = new Map<string, Entity>();
  private claimsByScope = new Map<string, string[]>();
  private claimsBySubject = new Map<string, string[]>();

  upsert(input: ClaimInput): UpsertResult {
    const existing = this.findActive(input.subject, input.predicate, input.scope);

    if (existing && this.isSameObject(existing, input)) {
      const source = input.sourceEpisodes[0];
      if (source) this.corroborate(existing.id, source);
      return { claim: existing, outcome: 'corroborated' };
    }

    if (existing) {
      const decision = this.resolveContradiction(existing, input);
      if (decision === 'keep') {
        // Never silently overwrite: equal-strength evidence → both coexist,
        // contradiction surfaced (retrieval shows the conflict).
        this.markContradiction(existing.id, input.id, false);
        return { claim: existing, outcome: 'kept-existing' };
      }
      existing.invalidAt = input.ts ?? new Date();
      existing.supersededBy = input.id;
      const claim = this.buildClaim(input, existing);
      this.claims.set(claim.id, claim);
      this.indexClaim(claim);
      this.linkEntity(claim);
      return { claim, outcome: 'superseded' };
    }

    const claim = this.buildClaim(input, undefined);
    this.claims.set(claim.id, claim);
    this.indexClaim(claim);
    this.linkEntity(claim);
    return { claim, outcome: 'created' };
  }

  private buildClaim(input: ClaimInput, superseded: Claim | undefined): Claim {
    return {
      ...input,
      invalidAt: null,
      supersedes: superseded?.id ?? null,
      supersededBy: null,
      corroborations: 1,
      contradictions: superseded ? [{ claimId: superseded.id, resolved: true }] : [],
      accessTimes: [],
      lastAccess: null,
      sti: 0,
      lti: 0.3 + input.certainty * 0.4,
      vlti: 0,
      quarantined: false,
      quarantineReason: null,
    };
  }

  private linkEntity(claim: Claim): void {
    this.ensureEntity(claim.subject, claim.scope);
    this.ensureEntity(claim.object, claim.scope);
    this.linkEntityToClaim(claim.subject, claim.id);
    this.linkEntityToClaim(claim.object, claim.id);
  }

  get(id: string): Claim | undefined {
    const claim = this.claims.get(id);
    if (claim) {
      claim.accessTimes.push(new Date());
      claim.lastAccess = new Date();
    }
    return claim;
  }

  peek(id: string): Claim | undefined {
    return this.claims.get(id);
  }

  all(): Claim[] {
    return [...this.claims.values()];
  }

  active(now: Date = new Date()): Claim[] {
    return this.all().filter((c) => !c.quarantined && (c.invalidAt === null || c.invalidAt.getTime() > now.getTime()));
  }

  byScope(scope: Scope): Claim[] {
    const ids = this.claimsByScope.get(projectKeyOf(scope)) ?? [];
    return ids.map((id) => this.claims.get(id)).filter((c): c is Claim => c !== undefined);
  }

  bySubject(subject: string): Claim[] {
    const key = subject.toLowerCase();
    const ids = this.claimsBySubject.get(key) ?? [];
    return ids.map((id) => this.claims.get(id)).filter((c): c is Claim => c !== undefined);
  }

  findActive(subject: string, predicate: string, scope: Scope): Claim | undefined {
    return this.bySubject(subject).find(
      (c) => c.predicate === predicate && c.invalidAt === null && !c.quarantined && projectKeyOf(c.scope) === projectKeyOf(scope),
    );
  }

  corroborate(claimId: string, sourceEpisodeId: string): void {
    const claim = this.claims.get(claimId);
    if (!claim) return;
    if (!claim.sourceEpisodes.includes(sourceEpisodeId)) {
      claim.sourceEpisodes.push(sourceEpisodeId);
      claim.corroborations = claim.sourceEpisodes.length;
    }
  }

  markContradiction(claimId: string, contradictorId: string, resolved: boolean): void {
    const claim = this.claims.get(claimId);
    if (!claim) return;
    if (!claim.contradictions.some((c) => c.claimId === contradictorId)) {
      claim.contradictions.push({ claimId: contradictorId, resolved });
    } else {
      claim.contradictions = claim.contradictions.map((c) => (c.claimId === contradictorId ? { ...c, resolved } : c));
    }
  }

  quarantine(id: string, reason: string): void {
    const claim = this.claims.get(id);
    if (claim) {
      claim.quarantined = true;
      claim.quarantineReason = reason;
      claim.invalidAt = new Date();
    }
  }
  allEntities(): Entity[] {
    return [...this.entities.values()];
  }

  entityByName(name: string): Entity | undefined {
    const key = name.toLowerCase();
    return this.entities.get(key);
  }

  private ensureEntity(name: string, scope: Scope): Entity {
    const key = name.toLowerCase();
    let entity = this.entities.get(key);
    if (!entity) {
      entity = { id: `ent-${key}`, canonicalName: name, aliases: [], embedding: [], fan: 0, claimIds: [], scope };
      this.entities.set(key, entity);
    }
    return entity;
  }

  mergeEntities(canonical: string, alias: string, scope: Scope): void {
    const canon = this.ensureEntity(canonical, scope);
    const aliasKey = alias.toLowerCase();
    const aliasEntity = this.entities.get(aliasKey);
    if (aliasEntity) {
      for (const claimId of aliasEntity.claimIds) {
        this.linkEntityToClaim(canonical, claimId);
      }
      if (!canon.aliases.includes(alias)) canon.aliases.push(alias);
      this.entities.delete(aliasKey);
    } else {
      if (!canon.aliases.includes(alias)) canon.aliases.push(alias);
    }
  }

  private linkEntityToClaim(entityName: string, claimId: string): void {
    const real = this.entityByName(entityName);
    if (!real) return;
    if (!real.claimIds.includes(claimId)) real.claimIds.push(claimId);
    real.fan = real.claimIds.length;
  }

  /**
   * Evidence strength for reconsolidation (recency × corroboration ×
   * certainty). Supersession requires a clear strength advantage — otherwise
   * the conflict stays open and both claims coexist (never silently
   * overwrite).
   */
  private contradictionStrength(claim: Claim, now: Date): number {
    const ref = claim.validAt ?? claim.lastAccess ?? now;
    const days = Math.max(0, (now.getTime() - ref.getTime()) / 86_400_000);
    const recency = 1 / (1 + days);
    return recency * 1.5 + Math.min(3, claim.corroborations) * 0.5 + claim.certainty * 0.7;
  }

  private resolveContradiction(existing: Claim, incoming: ClaimInput): 'supersede' | 'keep' {
    const now = incoming.ts ?? new Date();
    const existingStrength = this.contradictionStrength(existing, now);
    const incomingStrength = 1.5 + Math.min(3, incoming.sourceEpisodes.length) * 0.5 + incoming.certainty * 0.7;
    return incomingStrength > existingStrength * 1.15 ? 'supersede' : 'keep';
  }

  private isSameObject(a: Claim, b: ClaimInput): boolean {
    return a.object.toLowerCase() === b.object.toLowerCase();
  }

  private indexClaim(claim: Claim): void {
    const scopeKey = projectKeyOf(claim.scope);
    const list = this.claimsByScope.get(scopeKey) ?? [];
    list.push(claim.id);
    this.claimsByScope.set(scopeKey, list);

    const subjectKey = claim.subject.toLowerCase();
    const subjList = this.claimsBySubject.get(subjectKey) ?? [];
    subjList.push(claim.id);
    this.claimsBySubject.set(subjectKey, subjList);
  }

  count(): { claims: number; claimsActive: number; entities: number } {
    return {
      claims: this.claims.size,
      claimsActive: this.active().length,
      entities: this.entities.size,
    };
  }

  snapshot(): { claims: Claim[]; entities: Entity[] } {
    return {
      claims: [...this.claims.values()].map((c) => structuredClone(c)),
      entities: [...this.entities.values()].map((e) => structuredClone(e)),
    };
  }

  restore(data: { claims: Claim[]; entities: Entity[] }): void {
    this.claims.clear();
    this.entities.clear();
    this.claimsByScope.clear();
    this.claimsBySubject.clear();
    for (const raw of data.claims) {
      const claim: Claim = { ...raw };
      reviveDates(claim, ['validAt', 'invalidAt', 'lastAccess']);
      claim.accessTimes = reviveDateList(claim.accessTimes);
      this.claims.set(claim.id, claim);
      this.indexClaim(claim);
    }
    for (const entity of data.entities) {
      this.entities.set(entity.canonicalName.toLowerCase(), entity);
    }
  }
}
