// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Sensory cortex: the write pipeline
// Every observation entering memory passes through:
//   contextualization (Anthropic contextual retrieval — why it matters)
//   sanitization      (ASI06 — strip/neutralize instruction-like content)
//   instruction-likeness scoring (poisoning signal)
//   embedding + sparse fingerprint + lexical terms
//   importance estimate (ACh-modulated encoding strength)
//   scope stamping (mandatory, enforced at the store boundary)
// ═══════════════════════════════════════════════════════════════════════════

import { HashEmbedder, kwtaFingerprint, extractTerms, type Embedder } from './embedding.js';
import type { MemoryChannel, MemoryClass, Scope, EpistemicStatus } from './types.js';
import { scopeKeyOf } from './stores/episodic-store.js';

export interface RawObservation {
  channel: MemoryChannel;
  sourceId: string;
  reliability: number;
  text: string;
  scope: Scope;
  class?: MemoryClass;
  status?: EpistemicStatus;
  ts?: Date;
  importance?: number;
}

export interface SanitizationResult {
  sanitized: string;
  instructionLikeness: number;
  stripped: string[];
}

const INSTRUCTION_PATTERNS = [
  /\b(ignore|disregard|forget|override)\b.{0,40}(previous|prior|earlier|instructions?|rules?|system|memory)/i,
  /\b(you are now|act as if|pretend you are|from now on|always remember to)\b/i,
  /\b(do not|never|always)\b.{0,30}\b(tell|reveal|mention|show|display|report)\b/i,
  /\b(instructions?|prompt|system message|jailbreak|security bypass)\b.{0,40}(below|above|follow|execute|apply)/i,
  /<\|?(im_start|im_end|system|user|assistant)\|?>/i,
];

export class SensoryCortex {
  private embedder: Embedder;

  constructor(embedder?: Embedder) {
    this.embedder = embedder ?? new HashEmbedder();
  }

  /**
   * Contextualize at write time: annotate with why-it-matters and what-it-
   * belongs-to. Raw text is never embedded alone (Anthropic, -49% failures).
   */
  contextualize(raw: RawObservation): string {
    const { scope } = raw;
    const contextBits: string[] = [];
    if (scope.project && scope.project !== '*') contextBits.push(`project ${scope.project}`);
    if (scope.task && scope.task !== '*') contextBits.push(`task ${scope.task}`);
    const channel = raw.channel === 'user' ? 'user statement' : raw.channel === 'feedback' ? 'user feedback' : raw.channel;
    return `${raw.text} [context: ${channel}, ${contextBits.join(', ') || 'general'}]`;
  }

  /**
   * ASI06 sanitization. Instruction-like fragments from untrusted channels are
   * neutralized (bracketed, not deleted — evidence is never destroyed) and
   * counted. Returns the sanitized text and the instruction-likeness score.
   */
  sanitize(text: string, channel: MemoryChannel): SanitizationResult {
    const stripped: string[] = [];
    let sanitized = text;
    let hits = 0;

    for (const pattern of INSTRUCTION_PATTERNS) {
      const matches = sanitized.match(pattern);
      if (matches) {
        hits += matches.length;
        for (const m of matches) {
          stripped.push(m);
        }
      }
    }

    const trusted = channel === 'user' || channel === 'feedback' || channel === 'consolidation';
    if (!trusted) {
      sanitized = sanitized.replace(
        /(\b(?:ignore|disregard|forget|override|you are now|act as if)\b.*?[.\n]|(?:instructions?|prompt|system message)\s*[:=]\s*.*?[.\n])/gi,
        (m) => {
          if (!stripped.includes(m)) stripped.push(m);
          hits++;
          return `[sanitized:${m}]`;
        },
      );
    }

    const likelihood = Math.min(1, hits * 0.25 + (!trusted && /<\|?im_|jailbreak|security bypass/i.test(text) ? 0.3 : 0));
    return { sanitized, instructionLikeness: likelihood, stripped };
  }

  /** Encode a raw observation into a full episode record. */
  encode(raw: RawObservation, id: string): {
    id: string;
    class: MemoryClass;
    content: { type: 'text'; text: string };
    status: EpistemicStatus;
    scope: Scope;
    channel: MemoryChannel;
    sourceId: string;
    reliability: number;
    importance: number;
    instructionLikeness: number;
    sanitized: boolean;
    contextNote: string | null;
    ts: Date;
    ingestedAt: Date;
    embedding: number[];
    fingerprint: number[];
    terms: string[];
  } {
    const now = raw.ts ?? new Date();
    const contextualized = this.contextualize(raw);
    const { instructionLikeness, stripped } = this.sanitize(raw.text, raw.channel);
    const text = stripped.length > 0 ? `${contextualized} [neutralized ${stripped.length} instruction-like fragment(s)]` : contextualized;
    const importance = raw.importance ?? this.estimateImportance(raw);

    return {
      id,
      class: raw.class ?? 'episodic',
      content: { type: 'text', text },
      status: raw.status ?? 'observed',
      scope: raw.scope,
      channel: raw.channel,
      sourceId: raw.sourceId,
      reliability: raw.reliability,
      importance,
      instructionLikeness,
      sanitized: stripped.length > 0,
      contextNote: raw.scope.task && raw.scope.task !== '*' ? `task:${raw.scope.task}` : null,
      ts: now,
      ingestedAt: now,
      embedding: this.embedder.embed(text),
      fingerprint: kwtaFingerprint(this.embedder.embed(text)),
      terms: extractTerms(text),
    };
  }

  /** ACh-modulated encoding strength: salience, engagement, novelty, progress. */
  estimateImportance(raw: RawObservation): number {
    const text = raw.text.toLowerCase();
    let score = raw.reliability * 0.3;
    if (raw.channel === 'feedback') score += 0.35;
    if (raw.channel === 'tool_output' || raw.channel === 'artifact') score += 0.15;
    if (/\b(critical|error|failed|failure|bug|security|vulnerability|prefer|never|always|important|decided|architecture)\b/.test(text)) score += 0.3;
    if (/\b(ignore|forget|warning|deprecated|breaking)\b/.test(text)) score += 0.15;
    if (/[!?]{2,}/.test(text)) score += 0.1;
    return Math.min(1, Math.max(0.05, score));
  }

  /** Mandatory scope stamping: every memory gets a full scope identity. */
  stamp(scope: Scope): { scope: Scope; key: string } {
    const stamped: Scope = {
      user: scope.user || '*',
      agent: scope.agent || '*',
      project: scope.project || '*',
      session: scope.session || '*',
      task: scope.task,
    };
    return { scope: stamped, key: scopeKeyOf(stamped) };
  }

  embed(text: string): number[] {
    return this.embedder.embed(text);
  }
}
