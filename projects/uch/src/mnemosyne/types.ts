// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — Core Data Model
// The cognitive memory brain of UCH. Reverse-engineered from the memory
// supremacy research corpus (research/ai-memory/memory-supremacy-research-2026.md).
// ═══════════════════════════════════════════════════════════════════════════

export type MemoryClass =
  | 'episodic' // what happened — fast decay
  | 'working' // current task state — session-bound
  | 'semantic' // facts about the world — standard decay
  | 'preference' // user/agent preferences — slow decay, re-confirmed
  | 'behavior' // behavioral patterns — slow decay
  | 'procedure'; // how to do things — near-infinite half-life

export type EpistemicStatus = 'observed' | 'inferred' | 'speculative';

export type MemoryChannel =
  | 'user'
  | 'tool_output'
  | 'environment'
  | 'artifact'
  | 'feedback'
  | 'consolidation'
  | 'agent';

export type MemoryTier = 'working' | 'core' | 'archival' | 'archive';

export interface Scope {
  user: string;
  agent: string;
  project: string;
  session: string;
  task?: string;
}

export type MemoryContent =
  | { type: 'text'; text: string }
  | { type: 'structured'; data: Record<string, unknown> }
  | { type: 'tool_call'; tool: string; input: unknown; output: unknown }
  | { type: 'artifact'; kind: string; reference: string }
  | { type: 'feedback'; signal: number; note?: string };

export interface MnemEpisode {
  id: string;
  class: MemoryClass;
  content: MemoryContent;
  status: EpistemicStatus;
  scope: Scope;
  channel: MemoryChannel;
  sourceId: string;
  reliability: number;
  importance: number; // encoding strength (ACh-modulated)
  instructionLikeness: number; // 0..1 — ASI06 poisoning signal
  sanitized: boolean;
  contextNote: string | null; // contextual retrieval annotation
  ts: Date; // event time
  ingestedAt: Date; // ingestion time (bi-temporal)
  embedding: number[];
  fingerprint: number[]; // sparse k-WTA indices (pattern separation)
  terms: string[]; // lexical index for BM25
  accessTimes: Date[]; // ACT-R base-level input
  lastAccess: Date | null;
  tier: MemoryTier;
  sti: number;
  lti: number;
  vlti: number;
  crossRefs: string[]; // derived object ids
  quarantined: boolean;
  quarantineReason: string | null;
}

export interface Claim {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  class: Exclude<MemoryClass, 'working' | 'episodic'>;
  status: EpistemicStatus;
  scope: Scope;
  certainty: number; // extraction confidence 0..1
  validAt: Date | null;
  invalidAt: Date | null;
  supersedes: string | null;
  supersededBy: string | null;
  sourceEpisodes: string[]; // provenance chain — ground truth contract
  extractionModel: string; // 'rule-based' | provider id
  corroborations: number; // supporting episodes count
  contradictions: Array<{ claimId: string; resolved: boolean }>;
  accessTimes: Date[];
  lastAccess: Date | null;
  sti: number;
  lti: number;
  vlti: number;
  quarantined: boolean;
  quarantineReason: string | null;
}

export interface Entity {
  id: string;
  canonicalName: string;
  aliases: string[];
  embedding: number[];
  fan: number; // number of connected claims — ACT-R fan penalty
  claimIds: string[];
  scope: Scope;
}

export interface PatternSkill {
  id: string;
  pattern: string;
  condition: string;
  class: 'pattern' | 'skill' | 'lesson';
  scope: Scope;
  utilities: Array<{ outcome: string; reward: number }>; // reinforcement-shaped
  accessTimes: Date[];
  lastAccess: Date | null;
  lti: number;
  sourceEpisodes: string[];
}

export interface Lesson extends PatternSkill {
  mistakeRef: string;
  rootCause: string;
  prevention: string;
}

export interface EvidencePacketItem {
  id: string;
  kind: 'claim' | 'episode' | 'pattern' | 'lesson' | 'summary';
  text: string;
  status: EpistemicStatus;
  confidence: number;
  evidenceCount: number;
  validAt: Date | null;
  invalidAt: Date | null;
  scope: Scope;
  tokens: number;
  flags: string[]; // e.g. 'instruction-like', 'conflict', 'low-trust'
}

export interface EvidencePacket {
  query: string;
  items: EvidencePacketItem[];
  tokens: number;
  budget: number;
  unknown: boolean; // abstention signal — LongMemEval abstraction
  unknownReason: string | null;
  totalCandidates: number;
}

export interface AuditEntry {
  ts: Date;
  op: string;
  scope: Scope;
  channel: MemoryChannel;
  targetId: string;
  decision: string;
  detail: string;
}

export interface RoiEntry {
  memoryId: string;
  memoryClass: MemoryClass;
  tokensSpent: number;
  outcome: number; // -1..1 reward
  ts: Date;
}

export interface SleepReport {
  phase: 'nap' | 'deep';
  replayed: number;
  claimsCreated: number;
  claimsSuperseded: number;
  contradictionsResolved: number;
  contradictionsOpen: number;
  entitiesMerged: number;
  archived: number;
  reVerified: number;
  confidenceDecayed: number;
  anticipated: string[];
  screened: number;
  quarantined: number;
}

export interface MnemosyneStats {
  episodes: number;
  episodesArchived: number;
  claims: number;
  claimsActive: number;
  entities: number;
  patterns: number;
  lessons: number;
  auditEntries: number;
  quarantined: number;
  tokenBudget: { admitted: number; spent: number };
  roiByClass: Record<MemoryClass, number>;
}

export interface Bank {
  id: string;
  kind: string;
  budget: number;
  blocks: Block[];
}

export interface Block {
  id: string;
  label: string;
  content: string;
  limit: number;
  version: number;
  updatedBy: 'sleep' | 'agent' | 'user';
}
