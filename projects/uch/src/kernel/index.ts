export { CognitiveKernel } from './cognitive-kernel.js';
export type { CognitiveKernelConfig, CognitiveKernelStats } from './cognitive-kernel.js';
export { EpisodicStore } from './storage/episodic-store.js';
export { SemanticGraph } from './storage/semantic-graph.js';
export { PersistentStore } from './storage/persistent-store.js';
export type { PersistentStoreConfig, StoreSnapshot } from './storage/persistent-store.js';
export { Journal, initJournal } from './storage/journal.js';
export type { JournalEntry, JournalOperation } from './storage/journal.js';
export { VectorStore } from './storage/vector-store.js';
export type { VectorRecord, SearchResult } from './storage/vector-store.js';
export { GraphStore } from './storage/graph-store.js';
export type { GraphNode, GraphEdge } from './storage/graph-store.js';
export { ActivationField } from './activation/activation-field.js';
export type {
  ActivationFieldConfig,
  FieldEntity,
  FieldEntityInput,
  FieldMetrics,
  FieldStats,
  SpikeResult,
} from './activation/activation-field.js';
export { Connectome } from './activation/connectome.js';
export type { ConnectomeConfig, Connection, ConnectomeNeighbor } from './activation/connectome.js';
export { WorldModelEngine } from './world-model/world-model.js';
export type {
  ClaimClass,
  Generalization,
  ModelVersionStatus,
  PredictionStatus,
  PredictionType,
  StateVariable,
  WorldModelDeclaration,
  WorldModelEngineConfig,
  WorldModelObservation,
  WorldModelPrediction,
  WorldModelStats,
  WorldModelVersion,
} from './world-model/world-model.js';
export {
  NoActiveVersionError,
  UnscopedModelError,
  UndeclaredPredictionTypeError,
  UnknownObservationTopicError,
} from './world-model/world-model.js';
export { RetrievalFusion } from './retrieval/fusion.js';
export type { FusionQuery, ScoredResult, ProvenanceWeightConfig } from './retrieval/fusion.js';
export { GapAnalysisEngine } from './retrieval/gap-analysis.js';
export type { GapAnalysisOutput, GapAnalysisResultItem, GapAnalysisOptions } from './retrieval/gap-analysis.js';
export { SynthesisEngine, parseInlineCitations, normalizeStructuredCitations, resolveCitations } from './retrieval/synthesis.js';
export type {
  SynthesisOutput,
  SynthesisClaim,
  SynthesisSource,
  SynthesisOptions,
  ParsedCitation,
} from './retrieval/synthesis.js';
export {
  DEFAULT_RECENCY_DECAY,
  DEFAULT_FALLBACK,
  parseRecencyDecayEnv,
  resolveRecencyDecayMap,
  lookupDecayConfig,
  recencyBoost,
  recencyBoostForId,
} from './retrieval/recency-decay.js';
export type { RecencyDecayConfig, RecencyDecayMap } from './retrieval/recency-decay.js';
export { ConceptGenome } from './concept-genome/index.js';
export type {
  GeneMarker,
  ConceptDNA,
  MutationEvent,
  FusionProposal,
  GenomeComparison,
  ConceptGenomeStats,
} from './concept-genome/index.js';
export { SleepCycle } from './consolidation/sleep-cycle.js';
export type { SleepReport } from './consolidation/sleep-cycle.js';
export { Neuromodulation } from './cortex/neuromodulation.js';
export type { NeuromodulationState, ContextState } from './cortex/neuromodulation.js';
export { MemoryOrgan } from './memory/memory-organ.js';
export type { MemoryOrganConfig } from './memory/memory-organ.js';
export { MemoryEvolution } from './memory/memory-evolution.js';
export type { EvolutionConfig, EvolutionReport } from './memory/memory-evolution.js';
export {
  revise,
  integrateEvidence,
  createBeliefSet,
  classifyEpistemicStatus,
  assessTruth,
} from './constitution/epistemology.js';
export type { Proposition, Evidence, BeliefSet } from './constitution/epistemology.js';
export { EngineeringJudgmentEngine } from './constitution/engineering-judgment.js';
export type {
  EngineeringJudgmentInput,
  EngineeringJudgmentResult,
} from './constitution/engineering-judgment.js';
export {
  createProvenance,
  createConfidence,
  createConcept,
  createEpisode,
  createEdge,
} from './types/index.js';
export type {
  Provenance,
  Confidence,
  EntrenchmentLevel,
  EpistemicStatus,
  TemporalWindow,
  Concept,
  ConceptType,
  Episode,
  EpisodeContent,
  Edge,
} from './types/index.js';
