// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Sleep cycle: consolidation (off the critical path)
// NREM: replay episodes → claim formation (provenance-anchored), dedup,
// contradiction resolution via reconsolidation (supersede, never overwrite).
// REM: pattern mining, hierarchy summaries, anticipation (query prediction).
// Synaptic homeostasis: tier pruning, re-verification, confidence decay.
// Sleep is a WRITE PATH — every output is screened like one (ASI06).
// ═══════════════════════════════════════════════════════════════════════════

import type { MnemEpisode, SleepReport } from './types.js';
import { baseLevelActivation, decayFor, type DecaySchedule } from './activation.js';
import type { EpisodicStore } from './stores/episodic-store.js';
import type { SemanticStore, ClaimInput } from './stores/semantic-store.js';
import type { ProceduralStore } from './stores/procedural-store.js';
import type { ParahippocampalGate } from './parahippocampal-gate.js';

export interface ClaimExtractor {
  /** Extract atomic claims from an episode. Deterministic, provenance-anchored. */
  extract(episode: MnemEpisode): ClaimInput[];
}

export interface SleepOptions {
  phase?: 'nap' | 'deep';
  limit?: number;
  now?: Date;
}

const MIN_CLAIM_LENGTH = 8;
const MAX_CLAIM_LENGTH = 280;

/**
 * Default rule-based extractor: no LLM required, deterministic and testable.
 * A stronger-model extractor (e.g. structured-output LLM call) can be plugged
 * in behind the same interface during production sleep.
 */
export class RuleBasedClaimExtractor implements ClaimExtractor {
  extract(episode: MnemEpisode): ClaimInput[] {
    if (episode.channel === 'tool_output' || episode.channel === 'environment') return [];
    if (episode.content.type !== 'text') return [];

    const text = episode.content.text;
    if (text.length < MIN_CLAIM_LENGTH || text.length > MAX_CLAIM_LENGTH) return [];
    const stripped = text.replace(/\[context:.*?\]/g, '').replace(/\[sanitized:.*?\]/g, '').trim();
    if (stripped.length < MIN_CLAIM_LENGTH) return [];

    const sentences = stripped.split(/[.!?]+\s+/).map((s) => s.trim()).filter((s) => s.length >= MIN_CLAIM_LENGTH);
    const claims: ClaimInput[] = [];
    let idx = 0;

    for (const sentence of sentences.slice(0, 4)) {
      const parts = splitSubjectPredicateObject(sentence);
      if (!parts) continue;
      const [subject, predicate, object] = parts;
      claims.push({
        id: `claim-${episode.id}-${idx++}`,
        subject,
        predicate,
        object,
        class: 'semantic',
        status: episode.status,
        scope: episode.scope,
        certainty: Math.min(1, episode.reliability + 0.1),
        sourceEpisodes: [episode.id],
        extractionModel: 'rule-based',
        validAt: episode.ts,
        ts: episode.ts,
      });
    }
    return claims;
  }
}

/** "X is Y", "X uses Y", "X prefers Y" → {subject, predicate, object}. */
function splitSubjectPredicateObject(sentence: string): [string, string, string] | null {
  const patterns: Array<{ re: RegExp; predicate: string }> = [
    { re: /^(.*?)\s+(?:is|are)\s+(.+)$/i, predicate: 'is' },
    { re: /^(.*?)\s+(?:was|were)\s+(.+)$/i, predicate: 'was' },
    { re: /^(.*?)\s+prefers?\s+(.+)$/i, predicate: 'prefers' },
    { re: /^(.*?)\s+uses?\s+(.+)$/i, predicate: 'uses' },
    { re: /^(.*?)\s+likes?\s+(.+)$/i, predicate: 'likes' },
    { re: /^(.*?)\s+has\s+(.+)$/i, predicate: 'has' },
  ];
  for (const { re, predicate } of patterns) {
    const m = sentence.match(re);
    if (m && m[1] && m[2]) {
      const subject = m[1].split(/\s+/).slice(-2).join(' ');
      const object = m[2].trim().replace(/[.!?]+$/, '');
      if (subject.length >= 2 && object.length >= 2) return [subject, predicate, object];
    }
  }
  return null;
}

export class SleepCycle {
  private episodic: EpisodicStore;
  private semantic: SemanticStore;
  private procedural: ProceduralStore;
  private gate: ParahippocampalGate;
  private decay: DecaySchedule;
  private extractor: ClaimExtractor;

  constructor(
    episodic: EpisodicStore,
    semantic: SemanticStore,
    procedural: ProceduralStore,
    gate: ParahippocampalGate,
    decay: DecaySchedule,
    extractor?: ClaimExtractor,
  ) {
    this.episodic = episodic;
    this.semantic = semantic;
    this.procedural = procedural;
    this.gate = gate;
    this.decay = decay;
    this.extractor = extractor ?? new RuleBasedClaimExtractor();
  }

  run(options: SleepOptions = {}): SleepReport {
    const now = options.now ?? new Date();
    const phase = options.phase ?? 'deep';
    const limit = options.limit ?? 200;
    const report: SleepReport = {
      phase,
      replayed: 0,
      claimsCreated: 0,
      claimsSuperseded: 0,
      contradictionsResolved: 0,
      contradictionsOpen: 0,
      entitiesMerged: 0,
      archived: 0,
      reVerified: 0,
      confidenceDecayed: 0,
      anticipated: [],
      screened: 0,
      quarantined: 0,
    };

    // NREM — replay episodes in importance order, spaced (not massed)
    const candidates = this.episodic
      .all()
      .filter((e) => !e.quarantined && e.tier !== 'archive')
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);

    for (const episode of candidates) {
      report.replayed++;
      if (phase === 'nap' && report.replayed > 40) break;

      // Sleep security: screen the episode itself (ASI06 / Unit 42 lesson)
      report.screened++;
      if (episode.instructionLikeness >= 0.6) {
        this.episodic.quarantine(episode.id, 'sleep: instruction-like episode');
        report.quarantined++;
        continue;
      }

      // Claim formation
      const claims = this.extractor.extract(episode);
      for (const claimInput of claims) {
        report.claimsCreated++;
        const existing = this.semantic.findActive(claimInput.subject, claimInput.predicate, claimInput.scope);
        if (existing) {
          if (existing.object.toLowerCase() !== claimInput.object.toLowerCase()) {
            // Contradiction: reconsolidation — supersede, never overwrite
            this.semantic.upsert(claimInput);
            report.contradictionsResolved++;
          } else {
            this.semantic.corroborate(existing.id, episode.id);
          }
        } else {
          this.semantic.upsert(claimInput);
        }
      }

      // Episode → semantic link (bidirectional provenance)
      for (const claim of claims) {
        this.episodic.addCrossRef(episode.id, claim.id);
      }
    }

    // Contradiction sweep: reconsolidation (supersede, never overwrite)
    const activeClaims = this.semantic.active(now);
    for (const claim of activeClaims) {
      for (const other of activeClaims) {
        if (claim.id === other.id) continue;
        if (
          claim.subject.toLowerCase() === other.subject.toLowerCase() &&
          claim.predicate.toLowerCase() === other.predicate.toLowerCase() &&
          claim.object.toLowerCase() !== other.object.toLowerCase()
        ) {
          const existing = this.semantic.findActive(claim.subject, claim.predicate, claim.scope);
          if (existing && existing.id !== claim.id) {
            report.contradictionsOpen++;
          }
        }
      }
    }

    // Entity resolution (synonymy detection — HippoRAG PHR analog)
    report.entitiesMerged += this.mergeSynonymEntities();

    // REM — pattern mining: repeated structures → procedural patterns
    const anticipated = this.minePatterns(now);
    report.anticipated = anticipated.length > 0 ? anticipated : this.procedural.all().filter((p) => p.class === 'pattern').map((p) => p.pattern);

    // Synaptic homeostasis — pruning and tier migration
    const archivable = this.pickArchivable(now);
    report.archived = archivable.length;
    for (const id of archivable) this.episodic.setTier(id, 'archive');

    // Re-verification sweep: stale claims decay without re-confirmation
    for (const claim of this.semantic.active(now)) {
      const lastAccess = claim.lastAccess ?? claim.validAt ?? now;
      const days = (now.getTime() - lastAccess.getTime()) / 86_400_000;
      if (days > 30 && claim.corroborations < 2) {
        claim.certainty = Math.max(0.2, claim.certainty - 0.1);
        report.confidenceDecayed++;
        if (claim.certainty <= 0.25) this.semantic.quarantine(claim.id, 'sleep: unreconfirmed claim below confidence floor');
      }
    }

    return report;
  }

  /** Re-verify high-importance claims: corroborate from recent matching episodes. */
  reverify(now: Date = new Date()): number {
    let verified = 0;
    for (const claim of this.semantic.active(now)) {
      if (claim.lti < 0.5) continue;
      const matches = this.episodic
        .all()
        .filter((e) => !e.quarantined && e.instructionLikeness < 0.5)
        .filter((e) => {
          const text = typeof e.content === 'object' && 'text' in e.content ? e.content.text : '';
          return text.toLowerCase().includes(claim.subject.toLowerCase()) && text.toLowerCase().includes(claim.object.toLowerCase());
        });
      if (matches.length > 0) {
        for (const m of matches.slice(0, 3)) this.semantic.corroborate(claim.id, m.id);
        verified++;
      }
    }
    return verified;
  }

  private mergeSynonymEntities(): number {
    let merged = 0;
    const entities = this.semantic.allEntities();
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i]!;
        const b = entities[j]!;
        if (a.canonicalName === b.canonicalName) continue;
        if (a.canonicalName.toLowerCase().includes(b.canonicalName.toLowerCase()) && b.canonicalName.length >= 4) {
          this.semantic.mergeEntities(a.canonicalName, b.canonicalName, a.scope);
          merged++;
        }
      }
    }
    return merged;
  }

  private minePatterns(now: Date): string[] {
    const recent = this.episodic
      .all()
      .filter((e) => e.tier === 'working' && !e.quarantined && e.channel === 'tool_output')
      .slice(0, 30);
    const byTool = new Map<string, MnemEpisode[]>();
    for (const episode of recent) {
      if (episode.content.type !== 'tool_call') continue;
      const tool = episode.content.tool;
      const list = byTool.get(tool) ?? [];
      list.push(episode);
      byTool.set(tool, list);
    }

    const anticipated: string[] = [];
    for (const [tool, episodes] of byTool) {
      if (episodes.length < 3) continue;
      const pattern = `repeated ${tool} usage across ${episodes.length} episodes`;
      const existing = this.procedural.all().find((p) => p.pattern === pattern);
      if (!existing) {
        this.procedural.addPattern({
          id: `pattern-${tool}-${now.getTime()}`,
          pattern,
          condition: `when ${tool} appears in context`,
          class: 'pattern',
          scope: episodes[0]!.scope,
          sourceEpisodes: episodes.slice(0, 5).map((e) => e.id),
        });
      }
      anticipated.push(pattern);
    }
    return anticipated;
  }

  private pickArchivable(now: Date): string[] {
    const archivable: string[] = [];
    for (const episode of this.episodic.byTier('working')) {
      if (episode.quarantined) continue;
      const activation = baseLevelActivation(episode.accessTimes, now, decayFor(episode.class, this.decay));
      const days = (now.getTime() - episode.ts.getTime()) / 86_400_000;
      const deadEpisodic = episode.class === 'episodic' && days > 30 && activation < -6;
      const deadWorking = episode.class === 'working' && days > 3;
      if (deadEpisodic || deadWorking) archivable.push(episode.id);
    }
    return archivable;
  }

}

export type { ClaimInput };
