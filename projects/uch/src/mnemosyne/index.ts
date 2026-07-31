// ═══════════════════════════════════════════════════════════════════════════
// MNEMOSYNE — the cognitive memory brain of UCH
// Research: research/ai-memory/memory-supremacy-research-2026.md
// Design:   research/ai-memory/memory-supremacy-design.md
// ═══════════════════════════════════════════════════════════════════════════

export { Mnemosyne } from './mnemosyne.js';
export type { MnemosyneConfig, IngestResult, MnemosyneSnapshot } from './mnemosyne.js';

export { SensoryCortex } from './sensory-cortex.js';
export type { RawObservation, SanitizationResult } from './sensory-cortex.js';

export { ParahippocampalGate } from './parahippocampal-gate.js';
export type { GateInput, GateDecision, WatchdogEvent } from './parahippocampal-gate.js';

export { RetrievalCortex, reciprocalRankFusion, mmrDiversity, isLesson } from './retrieval-cortex.js';
export type { RetrievalQuery, RetrievalResult } from './retrieval-cortex.js';

export { SleepCycle, RuleBasedClaimExtractor } from './sleep-cycle.js';
export type { ClaimExtractor, SleepOptions } from './sleep-cycle.js';

export { ContextCompiler, estimateTokens, DEFAULT_COMPILER_CONFIG } from './context-compiler.js';
export type { CompiledContext, CompilerConfig, BankKind } from './context-compiler.js';

export { EpisodicStore, scopeKeyOf, projectKeyOf } from './stores/episodic-store.js';
export type { EpisodeInput } from './stores/episodic-store.js';

export { SemanticStore } from './stores/semantic-store.js';
export type { ClaimInput, ContradictionResolution } from './stores/semantic-store.js';

export { ProceduralStore } from './stores/procedural-store.js';
export type { PatternInput } from './stores/procedural-store.js';

export { ImportanceEconomy, RoiLedger, DEFAULT_ECONOMY } from './economy.js';
export type { EconomyConfig } from './economy.js';

export {
  baseLevelActivation,
  decayFor,
  associativeStrength,
  spreadingActivation,
  totalActivation,
  retrievalProbability,
  retrievalLatencyMs,
  recordAccess,
  DEFAULT_DECAY,
} from './activation.js';
export type { DecaySchedule, SpreadingContext } from './activation.js';

export {
  HashEmbedder,
  cosineSimilarity,
  kwtaFingerprint,
  fingerprintOverlap,
  extractTerms,
  Bm25Index,
} from './embedding.js';
export type { Embedder, Bm25IndexEntry } from './embedding.js';

export type {
  MnemEpisode,
  Claim,
  Entity,
  PatternSkill,
  Lesson,
  EvidencePacket,
  EvidencePacketItem,
  AuditEntry,
  RoiEntry,
  SleepReport,
  MnemosyneStats,
  Scope,
  MemoryClass,
  MemoryTier,
  MemoryChannel,
  EpistemicStatus,
  MemoryContent,
  Bank,
  Block,
} from './types.js';
