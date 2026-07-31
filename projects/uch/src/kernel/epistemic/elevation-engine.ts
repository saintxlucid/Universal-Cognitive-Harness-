/**
 * Epistemic Elevation Engine — DIKW tier promotion (blueprint §2).
 *
 * Sub-organ of the Memory System (Association Cortex): promotes memory
 * objects through Data → Information → Knowledge → Wisdom tiers as
 * context accumulates, and blocks premature promotion.
 *
 * Promotion gates (constitutional in Phase E, Law 17):
 * - Information tier: requires a populated InquiryContract.
 * - Knowledge tier: requires InquiryContract + a passing pass through
 *   the Epistemic Immune System gate (accept or resolved-corroborated).
 * - Wisdom tier: requires Knowledge eligibility + N≥2 independent
 *   corroborating sources (source triangulation) + survival of
 *   contradiction testing (representation invariance).
 *
 * Benchmarkable: false-promotion rate, tier-demotion frequency,
 * promotion precision (Wisdom objects that survive contradiction testing).
 */

import { isInquiryEligible, type InquiryContract } from './inquiry-contract.js';
import {
  EpistemicImmuneSystem,
  type GateResult,
  type InboundSignal,
} from './epistemic-immune.js';
import {
  checkRepresentationInvariance,
  dikwTransform,
  type DikwInput,
} from '../../cognitive-plane/frameworks/knowledge/dikw.js';

export type MemoryTier = 'data' | 'information' | 'knowledge' | 'wisdom';

export interface MemoryObject {
  id: string;
  tier: MemoryTier;
  content: unknown;
  /** Drives promotion eligibility (0-1). */
  context_score: number;
  /** From the Epistemic Immune System. */
  corroboration_count: number;
  /** Required for information tier and above. */
  inquiry: InquiryContract | null;
  /** Gate results on the most recent evaluation. */
  lastGate?: GateResult | null;
  promotedAt: Record<string, string>;
}

export interface ElevationConfig {
  /** Context score required for data → information (default 0.2). */
  informationContextThreshold?: number;
  /** Context score required for information → knowledge (default 0.5). */
  knowledgeContextThreshold?: number;
  /** Context score required for knowledge → wisdom (default 0.75). */
  wisdomContextThreshold?: number;
  /** Independent sources required for wisdom (default 2, per blueprint Q9). */
  wisdomCorroborationThreshold?: number;
}

export interface PromotionAttempt {
  objectId: string;
  from: MemoryTier;
  to: MemoryTier;
  allowed: boolean;
  reasons: string[];
}

export class EpistemicElevationEngine {
  private config: Required<ElevationConfig>;
  private immune: EpistemicImmuneSystem;
  private objects: Map<string, MemoryObject> = new Map();
  private promotions: PromotionAttempt[] = [];
  private demotions: Array<{ id: string; from: MemoryTier; to: MemoryTier; at: string }> = [];
  private contradictionFails = 0;

  constructor(immune: EpistemicImmuneSystem, config: ElevationConfig = {}) {
    this.immune = immune;
    this.config = {
      informationContextThreshold: config.informationContextThreshold ?? 0.2,
      knowledgeContextThreshold: config.knowledgeContextThreshold ?? 0.5,
      wisdomContextThreshold: config.wisdomContextThreshold ?? 0.75,
      wisdomCorroborationThreshold: config.wisdomCorroborationThreshold ?? 2,
    };
  }

  /** Register a new memory object at the Data tier. */
  ingest(content: unknown, contextScore = 0, inquiry: InquiryContract | null = null): MemoryObject {
    const object: MemoryObject = {
      id: crypto.randomUUID(),
      tier: 'data',
      content,
      context_score: contextScore,
      corroboration_count: 0,
      inquiry,
      lastGate: null,
      promotedAt: { data: new Date().toISOString() },
    };
    this.objects.set(object.id, object);
    return object;
  }

  getObject(id: string): MemoryObject | undefined {
    return this.objects.get(id);
  }

  getObjects(): MemoryObject[] {
    return [...this.objects.values()];
  }

  /** Attempt to promote an object one tier; records the attempt for benchmarks. */
  attemptPromotion(id: string, signal?: InboundSignal): PromotionAttempt {
    const object = this.objects.get(id);
    if (!object) {
      return { objectId: id, from: 'data', to: 'data', allowed: false, reasons: ['unknown object'] };
    }

    const from = object.tier;
    const to: MemoryTier | null =
      from === 'data' ? 'information' : from === 'information' ? 'knowledge' : from === 'knowledge' ? 'wisdom' : null;

    if (!to) {
      const attempt = { objectId: id, from, to: from, allowed: false, reasons: ['already at top tier'] };
      this.promotions.push(attempt);
      return attempt;
    }

    const reasons: string[] = [];
    let allowed = true;

    // Gate 1: context accumulation.
    const threshold =
      to === 'information'
        ? this.config.informationContextThreshold
        : to === 'knowledge'
          ? this.config.knowledgeContextThreshold
          : this.config.wisdomContextThreshold;
    if (object.context_score < threshold) {
      allowed = false;
      reasons.push(`context_score ${object.context_score} < ${threshold}`);
    }

    // Gate 2: InquiryContract (required from information tier up).
    if (!isInquiryEligible(object.inquiry)) {
      allowed = false;
      reasons.push('missing populated InquiryContract');
    }

    // Gate 3: Epistemic Immune System pass (required from knowledge tier up).
    if (to === 'knowledge' || to === 'wisdom') {
      let gate = object.lastGate;
      if (signal && (!gate || gate.target !== signal.target)) {
        gate = this.immune.gateSignal(signal);
        object.lastGate = gate;
      }
      const passed =
        gate?.verdict === 'accept' ||
        (gate?.verdict === 'quarantine' && this.immune.getQuarantineById(gate.signalId)?.resolution === 'corroborated');
      if (!passed) {
        allowed = false;
        reasons.push('did not pass Epistemic Immune System gate');
      }
    }

    // Gate 4: corroboration (wisdom tier requires N independent sources).
    if (to === 'wisdom') {
      const corroborations = object.corroboration_count;
      if (corroborations < this.config.wisdomCorroborationThreshold) {
        allowed = false;
        reasons.push(
          `corroboration ${corroborations} < ${this.config.wisdomCorroborationThreshold} (source triangulation required)`,
        );
      }
    }

    // Gate 5: wisdom requires surviving contradiction testing.
    if (to === 'wisdom' && allowed) {
      const survived = this.contradictionTest(object);
      if (!survived) {
        allowed = false;
        this.contradictionFails++;
        reasons.push('contradiction testing failed — representations do not converge');
      }
    }

    if (allowed) {
      object.tier = to;
      object.promotedAt[to] = new Date().toISOString();
    }

    const attempt: PromotionAttempt = { objectId: id, from, to, allowed, reasons };
    this.promotions.push(attempt);
    return attempt;
  }

  /** Add corroborating sources (counts toward wisdom triangulation). */
  addCorroboration(id: string, count = 1): void {
    const object = this.objects.get(id);
    if (!object) return;
    object.corroboration_count += count;
  }

  /**
   * Demote an object whose evidence weakened (e.g. its gate result was
   * later contradicted). Tier-demotion frequency is a benchmark metric.
   */
  demote(id: string, to: MemoryTier): boolean {
    const object = this.objects.get(id);
    if (!object) return false;
    const rank: MemoryTier[] = ['data', 'information', 'knowledge', 'wisdom'];
    const fromRank = rank.indexOf(object.tier);
    const toRank = rank.indexOf(to);
    if (toRank >= fromRank) return false;
    this.demotions.push({ id, from: object.tier, to, at: new Date().toISOString() });
    object.tier = to;
    return true;
  }

  /**
   * Contradiction test (representation invariance): render the object's
   * content as multiple independent representations and require the
   * claim to survive. Wisdom that cannot survive testing is not wisdom.
   */
  private contradictionTest(object: MemoryObject): boolean {
    const content = typeof object.content === 'string' ? object.content : JSON.stringify(object.content);
    const representations = [
      { label: 'canonical', content },
      {
        label: 'recalled',
        content: object.inquiry ? `${object.inquiry.data_collection_method}: ${content}` : content,
      },
    ];
    const result = checkRepresentationInvariance(content, representations);
    return result.consistent;
  }

  /** Benchmark: fraction of Wisdom-tier objects that survive contradiction testing. */
  getPromotionPrecision(): number {
    const wisdomAttempts = this.promotions.filter((p) => p.to === 'wisdom' && p.allowed);
    if (wisdomAttempts.length === 0) return 0;
    const survived = wisdomAttempts.length - this.contradictionFails;
    return survived / wisdomAttempts.length;
  }

  /** Benchmark: fraction of attempted promotions that were (later) demoted. */
  getFalsePromotionRate(): number {
    if (this.promotions.length === 0) return 0;
    return this.demotions.length / this.promotions.length;
  }

  getDemotionCount(): number {
    return this.demotions.length;
  }

  /** Run the DIKW transform (framework engine) over an object's content. */
  analyzeDikw(objectId: string, input: DikwInput) {
    const object = this.objects.get(objectId);
    if (!object) return null;
    return dikwTransform(input);
  }

  getStatus(): Record<string, unknown> {
    const tiers: Record<MemoryTier, number> = { data: 0, information: 0, knowledge: 0, wisdom: 0 };
    for (const o of this.objects.values()) tiers[o.tier]++;
    return {
      objects: this.objects.size,
      tiers,
      attempts: this.promotions.length,
      demotions: this.demotions.length,
      falsePromotionRate: this.getFalsePromotionRate(),
      promotionPrecision: this.getPromotionPrecision(),
    };
  }
}
