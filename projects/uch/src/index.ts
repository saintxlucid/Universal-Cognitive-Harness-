// ═══════════════════════════════════════════════════════════════
// Artificial Cognitive Exoskeleton (ACE)
//
// ─── Architecture ──────────────────────────────────────────
//
//   LLM (Pilot)              → Interchangeable reasoning engine
//                              (Claude, GPT, Gemini, DeepSeek, Qwen)
//
//   Cognitive Exoskeleton    → Persistent augmentation platform
//     │                         Sensory, motor, reflex, immune,
//     │                         endocrine, memory, consciousness
//     │
//     ├── Exoskeleton Core   → Root orchestrator (CognitiveExoskeleton)
//     │   ├── Aether         → Persistent executive (24/7 consciousness)
//     │   ├── Consciousness  → Multi-layer awareness (reflex→meta)
//     │   ├── Nervous System → Layered signal routing (Law 1, 13)
//     │   │   ├── Peripheral → Raw perception (priority 0)
//     │   │   ├── Spinal     → Fast reflexes (priority 1)
//     │   │   ├── Brainstem  → Homeostasis (priority 2)
//     │   │   ├── Thalamus   → Signal prioritization (priority 3)
//     │   │   └── Cortex     → Executive reasoning (priority 4)
//     │   ├── Metabolism     → Energy budgeting & allocation (Law 2)
//     │   ├── Connectome     → Nervous system wiring / routing map
//     │   ├── Immune System  → Threat detection & policy enforcement
//     │   ├── Endocrine      → Global neuromodulation signals
//     │   ├── Sleep Cycle    → Offline maintenance & consolidation
//     │   ├── Cortex Kernel  → Higher-order integration
//     │   └── Hippocampus    → Episodic memory consolidation
//     │
//     ├── Suit (Exoskeleton) → Augmentation layer
//     │   ├── Litmus         → Organic Code Engine (16-dim scoring)
//     │   └── Instinct       → Engineering Reflex Engine (zero LLM)
//     │
//     ├── Control Plane      → Auth, policies, secrets, budgets,
//     │                         lifecycle, telemetry, plugins, config
//     │
//     ├── Cognitive Plane    → Trace engine, memory, signals,
//     │                         scheduler, search, analytics,
//     │                         constitution, genome, compiler,
//     │                         reflection, creativity, dreaming
//     │
//     ├── Drivers            → Filesystem, Git, IDE, Agent, MCP
//     │
//     └── Interface Layer    → MCP, HTTP, SSE, Cognitive API
//
// ─── Laws of Cognitive Physics ─────────────────────────────
// 1. Everything is an immutable signal.
// 2. No computation is free (Metabolism).
// 3. Every change is causally attributable.
// 4. No organ owns truth — only evidence.
// 7. Every action requires 3+ perspectives.
// 11. No organ requires global knowledge.
// 13. Signals terminate at lowest capable layer.
// ─── Principle ─────────────────────────────────────────────
// The LLM is the pilot. The Exoskeleton is the suit.
// The model can change. The suit—and its accumulated
// intelligence—remains.
// ═══════════════════════════════════════════════════════════════

// ── Control Plane ───────────────────────────────────────────
export { Lifecycle } from './control-plane/lifecycle.js';
export type { ServiceDefinition, ServiceStatus } from './control-plane/lifecycle.js';
export { PolicyEngine } from './control-plane/policies.js';
export type { PolicyRule, PolicyEffect } from './control-plane/policies.js';
export { Auth } from './control-plane/auth/auth.js';
export type { AuthConfig, AgentIdentity, AuthToken } from './control-plane/auth/auth.js';
export { SecretsStore } from './control-plane/secrets/secrets-store.js';
export type { SecretEntry } from './control-plane/secrets/secrets-store.js';
export { BudgetTracker } from './control-plane/budgets/budgets.js';
export type {
  BudgetConfig,
  BudgetState,
  BudgetCheckResult,
  UsageRecord,
} from './control-plane/budgets/budgets.js';
export { OTLPExporter } from './control-plane/telemetry/otlp-exporter.js';
export type { OTLPExporterConfig } from './control-plane/telemetry/otlp-exporter.js';
export { MCPTransport } from './cognitive-runtime/mcp-transport.js';
export { MCPSSETransport } from './control-plane/transport/mcp-sse.js';
export { SSEServer } from './control-plane/transport/sse-server.js';
export type { SSESession, SSEServerOptions } from './control-plane/transport/sse-server.js';
export { CapabilityRegistry } from './cognitive-runtime/capability-registry.js';
export type {
  Capability,
  CapabilityScope,
  CapabilityCost,
  CapabilityRetention,
  CapabilityDependencyCheck,
  GrantOperation,
} from './cognitive-runtime/capability-registry.js';
export { GrantEngine, GRANT_SCHEMA_VERSION } from './cognitive-runtime/grants.js';
export type {
  GrantActor,
  ActorType,
  GrantConstraints,
  IssueGrantRequest,
  CapabilityGrant,
  AuthorizationDecision,
} from './cognitive-runtime/grants.js';
export { ConfigLoader } from './control-plane/config/config-loader.js';
export type { UCCPConfig } from './control-plane/config/config-loader.js';
export { PluginLoader } from './control-plane/plugins/plugin-loader.js';
export type {
  PluginManifest,
  PluginAPI,
  PluginHook,
} from './control-plane/plugins/plugin-loader.js';
export { LRUCache } from './control-plane/cache/lru-cache.js';
export type { CacheEntry } from './control-plane/cache/lru-cache.js';
export { RateLimiter } from './control-plane/limits/rate-limiter.js';
export type { RateLimitConfig, RateLimitState } from './control-plane/limits/rate-limiter.js';
export { WebhookDispatcher } from './control-plane/notifications/webhook-dispatcher.js';
export type {
  WebhookConfig,
  WebhookDelivery,
} from './control-plane/notifications/webhook-dispatcher.js';
export { HealthMonitor } from './control-plane/monitor/health-monitor.js';
export type {
  HealthStatus,
  ComponentCategory,
  ComponentHealth,
  HealthCheckResult,
  HealthCheckFn,
} from './control-plane/monitor/health-monitor.js';
export { ExportEngine } from './control-plane/export/export-engine.js';
export type {
  ExportFormat,
  ExportScope,
  ExportOptions,
} from './control-plane/export/export-engine.js';

// ── Cognitive Plane ─────────────────────────────────────────
//   Protocol Layer — all modules communicate via capability protocols
//   (Capability types: see cognitive-runtime export below)

//   Trace Engine — OTel-aligned trace span model
export { TraceLedger } from './cognitive-plane/trace-engine/trace-ledger.js';
export type { TraceLedgerStats } from './cognitive-plane/trace-engine/trace-ledger.js';
export { TraceRecorder } from './cognitive-plane/trace-engine/trace-recorder.js';
export {
  createTrace,
  endTrace,
  addTraceEvent,
} from './cognitive-plane/trace-engine/cognitive-trace.js';
export type {
  CognitiveTrace,
  TraceEvent,
  TraceEventType,
  TraceAttribute,
  SpanKind,
  TraceStatus,
} from './cognitive-plane/trace-engine/cognitive-trace.js';

//   Persistence
export { TracePersistence } from './cognitive-plane/persistence/trace-persistence.js';
export { PersistenceProvider } from './cognitive-plane/persistence/persistence-provider.js';
export {
  dateReviver,
  writeSnapshot,
  readSnapshot,
  mapToRecord,
  recordToMap,
} from './cognitive-plane/persistence/persistence-engine.js';
export type { Storable } from './cognitive-plane/persistence/persistence-engine.js';
export type { PersistenceConfig } from './cognitive-plane/persistence/persistence-provider.js';

//   Cognitive Replay — flight recorder
export { CognitiveReplay } from './cognitive-plane/replay/cognitive-replay.js';
export type { ReplaySnapshot, ReplayOptions } from './cognitive-plane/replay/cognitive-replay.js';

//   Protocol Layer — capability-based module interaction
export { CognitiveProtocolRegistry, capabilityID } from './cognitive-plane/protocol/capability-protocol.js';
export { createProtocolAdapter, protocolHealthCheck } from './cognitive-plane/protocol/protocol-adapter.js';
export type {
  CapabilityProtocol,
  CapabilityHandler,
  CapabilityResult,
} from './cognitive-plane/protocol/capability-protocol.js';

//   Signals
export { SignalStore } from './cognitive-plane/signals/signal-store.js';
export type {
  CognitiveSignal,
  SignalType,
  ReplayTrigger,
} from './cognitive-plane/signals/signal-store.js';

//   Semantic Search
export { SearchEngine } from './cognitive-plane/search/search-engine.js';
export type {
  SearchOptions,
  SearchResult,
  SearchResponse,
} from './cognitive-plane/search/search-engine.js';

//   Task Scheduler
export { TaskScheduler } from './cognitive-plane/scheduler/task-scheduler.js';
export type {
  ScheduledTask,
  TaskSchedule,
  TaskStatus,
  TaskPriority,
  TaskHandler,
} from './cognitive-plane/scheduler/task-scheduler.js';

//   Decision Log
export { DecisionLog } from './cognitive-plane/decisions/decision-log.js';
export type {
  DecisionEntry,
  DecisionAlternative,
  DecisionLogStats,
} from './cognitive-plane/decisions/decision-log.js';

//   Workspace Analytics
export { WorkspaceAnalytics } from './cognitive-plane/analytics/workspace-analytics.js';
export type {
  AnalyticsReport,
  TraceAnalytics,
  DecisionAnalytics,
  SignalAnalytics,
  ActivityAnalytics,
  TimeseriesPoint,
} from './cognitive-plane/analytics/workspace-analytics.js';

//   Pattern Library
export { PatternLibrary } from './cognitive-plane/patterns/pattern-library.js';
export type {
  TracePattern,
  TraceMatcher,
  PatternMatch,
} from './cognitive-plane/patterns/pattern-library.js';

//   Cognitive Diff
export { CognitiveDiff } from './cognitive-plane/diff/cognitive-diff.js';
export type {
  DiffResult,
  DiffSummary,
  TraceDiff,
  DecisionDiff,
  SignalDiff,
  StateSnapshot,
} from './cognitive-plane/diff/cognitive-diff.js';

//   Suggestion Engine
export { SuggestionEngine } from './cognitive-plane/suggestions/suggestion-engine.js';
export type {
  Suggestion,
  SuggestionConfig,
} from './cognitive-plane/suggestions/suggestion-engine.js';

//   Cognitive Constitution — immutable laws that govern all behavior
export { CognitiveConstitution } from './cognitive-plane/constitution/constitution.js';
export type {
  CognitiveLaw,
  LawSeverity,
  ComplianceViolation,
} from './cognitive-plane/constitution/constitution.js';

//   Genome — three-layer identity model (Species → Workspace → Adaptive)
export { SpeciesGenome, WorkspaceGenome, AdaptiveGenome } from './cognitive-plane/genome/index.js';
export type {
  GenomeLaw,
  ImmutableCommitment,
  SpeciesGenomeConfig,
  GenomeEntry,
  GenomeSection,
  WorkspaceGenomeConfig,
  SkillProficiency,
  ConfidenceDistribution,
} from './cognitive-plane/genome/index.js';

//   Knowledge Compiler — events→facts→knowledge→wisdom compression
export { KnowledgeCompiler } from './cognitive-plane/compiler/knowledge-compiler.js';
export type {
  CompilationArtifact,
  CompilationStage,
  CompilationResult,
} from './cognitive-plane/compiler/knowledge-compiler.js';

//   Scientific Memory — evidence-backed memory with confidence, source, verification
export { ScientificMemory } from './cognitive-plane/memory/scientific-memory.js';
export type {
  ScientificMemoryEntry,
  MemoryCertainty,
} from './cognitive-plane/memory/scientific-memory.js';

//   Trust Engine — trust scoring for every source, memory, plugin, MCP, skill
export { TrustEngine } from './cognitive-plane/trust/trust-engine.js';
export type {
  TrustEntry,
  TrustLevel,
  TrustAssessment,
} from './cognitive-plane/trust/trust-engine.js';

//   Self Reflection Engine — nightly structured reflection/sleep cycle
export { SelfReflectionEngine } from './cognitive-plane/reflection/self-reflection-engine.js';
export type {
  ReflectionEntry,
  ReflectionSession,
  ReflectionPhase,
  ReflectionCategory,
} from './cognitive-plane/reflection/self-reflection-engine.js';

//   Creativity Engine — generate ideas, architectures, designs (separate from reasoning)
export { CreativityEngine } from './cognitive-plane/creativity/creativity-engine.js';
export type {
  Idea,
  IdeaDomain,
  IdeaNovelty,
  CreativeTechnique,
} from './cognitive-plane/creativity/creativity-engine.js';

//   Project Health Engine — multi-dimensional software health metrics
export { ProjectHealthEngine } from './cognitive-plane/health-metrics/project-health-engine.js';
export type {
  HealthMetric,
  HealthReport,
  HealthDimension,
} from './cognitive-plane/health-metrics/project-health-engine.js';

//   Taste Engine — learn preferences for code style, architecture, design quality
export { TasteEngine } from './cognitive-plane/taste/taste-engine.js';
export type {
  TastePreference,
  TasteFeedback,
  TasteAssessment,
  TasteDimension,
} from './cognitive-plane/taste/taste-engine.js';

//   Workspace Dreaming — background idle cognition
export { WorkspaceDreaming } from './cognitive-plane/dreaming/workspace-dreaming.js';
export type { DreamResult, DreamCategory } from './cognitive-plane/dreaming/workspace-dreaming.js';

//   Evolution System — self-benchmark, self-experiment, subsystem mutation
export {
  EvolutionEngine,
  BenchmarkEngine,
  ExperimentEngine,
  MutationEngine,
} from './cognitive-plane/evolution/index.js';
export type {
  EvolutionCycleReport,
  Adaptation,
} from './cognitive-plane/evolution/evolution-engine.js';
export type {
  BenchmarkMetric,
  BenchmarkRun,
  Benchmarkable,
} from './cognitive-plane/evolution/benchmark-engine.js';
export type {
  ExperimentDesign,
  ExperimentTrial,
  ExperimentResult,
} from './cognitive-plane/evolution/experiment-engine.js';
export type {
  Mutation,
  MutationProposal,
  MutationResult,
  MutationType,
  MutableSubsystem,
} from './cognitive-plane/evolution/mutation-engine.js';

//   Intelligence
export { Conscience } from './cognitive-brain/conscience.js';
export type { ReflectionReport, PredictionResult } from './cognitive-brain/conscience.js';
export { CognitiveOrganism, CognitiveOrganismConfig } from './cognitive-plane/organism/organism.js';
export type {
  AttentionSignal,
  EmotionalMemoryEntry,
  ImmuneIssue,
  PerceptionObservation,
  PerceptionModality,
  WorkingContext,
} from './cognitive-plane/organism/organism.js';
export { MemoryPipeline } from './cognitive-brain/memory-pipeline.js';
export type { PipelineReport } from './cognitive-brain/memory-pipeline.js';
export { ExecutiveBrain } from './executive-brain/executive-brain.js';
export type { ExecutiveBrainConfig } from './executive-brain/executive-brain.js';
export { Planner } from './executive-brain/planner.js';
export { DecisionEngine } from './executive-brain/decision-engine.js';
export { Critic } from './executive-brain/critic.js';
export type { Plan, PlanStep } from './executive-brain/planner.js';
export type { Decision, DecisionOption } from './executive-brain/decision-engine.js';
export type { Critique, CritiqueIssue } from './executive-brain/critic.js';

//   Memory
export { EpisodicStore } from './kernel/storage/episodic-store.js';
export { SemanticGraph } from './kernel/storage/semantic-graph.js';
export { SkillRegistry } from './cognitive-memory/skill-registry.js';
export type { SkillDefinition, SkillInvocation } from './cognitive-memory/skill-registry.js';

//   Workspace
export { WorkspaceBrain } from './workspace-brain/workspace-brain.js';
export type { WorkspaceBrainConfig } from './workspace-brain/workspace-brain.js';
export { WorkspaceKnowledgeGraph } from './workspace-graphs/knowledge-graph.js';
export { WorkspaceDecisionGraph, type DecisionRelation } from './workspace-graphs/decision-graph.js';
export { WorkspaceTaskGraph } from './workspace-graphs/task-graph.js';
export { WorkspaceEvolutionHistory, type CycleSummary } from './workspace-graphs/evolution-history.js';
export { WorkspaceDNA, type DnaMutation } from './workspace-graphs/workspace-dna.js';
export { CognitiveKernel } from './kernel/cognitive-kernel.js';
export type { CognitiveKernelConfig, CognitiveKernelStats } from './kernel/cognitive-kernel.js';

// ── Branded Types ───────────────────────────────────────────
export type {
  SignalID,
  ComponentID,
  Entropy,
  Novelty,
  Confidence,
  Timestamp,
  LawID,
  CapabilityID,
  SessionID,
  InformationMetrics,
} from './shared/branded-types.js';

// ── Context ─────────────────────────────────────────────────
export { WorkspaceContextGatherer } from './context/gatherer.js';
export type { WorkspaceContext, ProjectStructure, GitInfo, FileSystemState, EnvironmentInfo } from './context/gatherer.js';

// ── Drivers ─────────────────────────────────────────────────
export { FileSystemDriver } from './drivers/filesystem/filesystem-driver.js';
export type {
  FileSystemEvent,
  FileSystemDriverConfig,
} from './drivers/filesystem/filesystem-driver.js';
export { GitDriver } from './drivers/git/git-driver.js';
export type { GitCommitInfo, GitStatusEntry, GitDriverConfig } from './drivers/git/git-driver.js';

// ── Aether (Persistent Executive Core) ──────────────────────
export { AetherCore } from './aether/aether-core.js';
export { Consciousness } from './aether/consciousness.js';
export type {
  AetherConfig,
  AetherState,
  AetherPhase,
  AetherSubsystem,
} from './aether/aether-core.js';
export type { ConsciousnessLayer, Thought, ConsciousnessState } from './aether/consciousness.js';

// ── Nervous System (Layered Signal Routing) ────────────────
export { NervousSystem } from './nervous-system/nervous-system.js';
export type { NervousSystemConfig, LayerConfig } from './nervous-system/nervous-system.js';
export { createSignal } from './nervous-system/signal.js';
export type {
  Signal,
  SignalHandler,
  SignalFilter,
  NervousSystemLayer,
  SignalPriority,
  InterruptLevel,
  EntropyReductionResult,
} from './nervous-system/signal.js';

// ── Metabolism (Energy Budgeting & Allocation) ─────────────
export { Metabolism } from './metabolism/metabolism.js';
export type { MetabolismConfig, BudgetOverride } from './metabolism/metabolism.js';
export type { EconomicProposal } from './shared/branded-types.js';
export { zeroAllocation, subtractAllocation, canAfford } from './metabolism/metabolic-profile.js';
export type {
  MetabolicCost,
  EnergyUnit,
  EnergyAllocation,
  ComponentBudget,
} from './metabolism/metabolic-profile.js';

// ── Exoskeleton (Root Orchestrator) ─────────────────────────
export { CognitiveExoskeleton } from './exoskeleton/exoskeleton.js';
export type { ExoskeletonConfig, ExoskeletonState, ExoskeletonTransport } from './exoskeleton/exoskeleton.js';
export { ImmuneSystem } from './exoskeleton/immune.js';
export type { ThreatAssessment } from './exoskeleton/immune.js';
export { EndocrineSystem } from './exoskeleton/endocrine.js';
export type { GlobalSignals } from './exoskeleton/endocrine.js';

// ── Suit / Litmus (Organic Code Engine) ─────────────────────
export { CodeScorer } from './suit/litmus/code-scorer.js';
export type {
  ScoreDimension,
  ScoreResult,
  ScoredFile,
  ScorerConfig,
  FileProfile,
} from './suit/litmus/code-scorer.js';

// ── Suit / Instinct (Engineering Reflex Engine) ─────────────
export { ReflexEngine } from './suit/instinct/reflex-engine.js';
export type {
  Reflex,
  ReflexResult,
  ReflexContext,
  ReflexSeverity,
} from './suit/instinct/reflex-engine.js';

// ── CLI / Server ────────────────────────────────────────────
export { UCCPServer } from './cli/uccp.js';
export type { UCCPOptions } from './cli/uccp.js';

// ── LLM Provider ────────────────────────────────────────────
export { LLMClient } from './llm/provider.js';
export type { LLMConfig, LLMProviderType, CompletionParams, EmbeddingParams, MultiModalContent } from './llm/provider.js';
export { AnthropicProvider } from './llm/anthropic-provider.js';
export type { AnthropicModel, AnthropicMessage, AnthropicCompletionParams, AnthropicStreamChunk } from './llm/anthropic-provider.js';

// ── Cognitive Accelerators + Inference Fabric ───────────────
export { InferenceFabric, createDefaultFabric } from './accelerators/fabric.js';
export type { ProviderHealth, DispatchOptions } from './accelerators/fabric.js';
export { CognitiveScheduler, canonicalCacheKey, RISK_HUMAN_APPROVAL, FRUGALITY_MAX_COMPLEXITY } from './accelerators/scheduler.js';
export type { ExecutionStrategy, ExecutionStrategyKind, ScheduledResult } from './accelerators/scheduler.js';
export { normalizeProfile, DEFAULT_PROFILE } from './accelerators/profile.js';
export type { CognitiveProfile, Urgency } from './accelerators/profile.js';
export { ACCELERATORS } from './accelerators/implementations.js';
export type {
  Accelerator,
  AcceleratorKind,
  AcceleratorRequest,
  AcceleratorResult,
  InferenceProvider,
  ProviderGateway,
  GatewayCompletion,
  AcceleratorCompletionParams,
} from './accelerators/types.js';
export type {
  SemanticOutput,
  CompressionOutput,
  ReasoningOutput,
  ReasoningStep as AcceleratorReasoningStep,
  PredictionOutput,
  MemoryMergeOutput,
  Relationship,
  OntologyOutput,
  ClassificationOutput,
} from './accelerators/implementations.js';

// ── Embedding Pipeline ──────────────────────────────────────
export { Embedder } from './embeddings/embedder.js';
export type { EmbedderConfig, ScoredItem } from './embeddings/embedder.js';

// ── MCP STDIO Server ────────────────────────────────────────
export { MCPStdioServer } from './mcp/stdio-server.js';

// ── Session Management ──────────────────────────────────────
export { SessionManager } from './session/manager.js';
export type { SessionSnapshot, SessionEntry, SessionMemory, SessionManagerConfig } from './session/manager.js';

// ── Git Ingestion ───────────────────────────────────────────
export { GitIngester } from './git/ingester.js';
export type { IngesterConfig } from './git/ingester.js';

// ── Interface Layer ─────────────────────────────────────────
export { CognitiveAPI } from './interface/cognitive-api.js';
export type { CognitiveAPIResponse } from './interface/cognitive-api.js';
export { HTTPTransport } from './interface/http-transport.js';
export type { HTTPTransportConfig } from './interface/http-transport.js';

// ── Organs ──────────────────────────────────────────────────
export { Connectome } from './connectome/wiring.js';
export type { Connection } from './connectome/wiring.js';
export { ActionSelector } from './basal_ganglia/action-selector.js';
export type { Action, ActionSelectionResult } from './basal_ganglia/action-selector.js';
export { Hippocampus } from './hippocampus/consolidator.js';
export type { EpisodicMemory } from './hippocampus/consolidator.js';
export { Neocortex } from './neocortex/pattern-learner.js';
export type { Pattern, Skill } from './neocortex/pattern-learner.js';
export { CortexKernel, ConsciousnessGate } from './cortex_kernel/integrator.js';
export type { IntegrationInsight, ConsciousnessGateConfig } from './cortex_kernel/integrator.js';
export { SleepCycle } from './sleep_cycle/cycle.js';
export type { SleepPhase, SleepReport } from './sleep_cycle/cycle.js';

// ── Neural Event Bus (capture layer, feeds Trace Recorder) ──
export { NeuralEventBus } from './event-bus/neural-event-bus.js';
export type {
  NeuralEvent,
  EventType,
  EventHandler,
  EventFilter,
} from './event-bus/neural-event-bus.js';
export { AgentCoordinator } from './event-bus/agent-coordinator.js';
export type {
  AgentRegistration,
  AgentStatus,
  AgentCapability,
  HandoffRequest,
  DelegationRequest,
} from './event-bus/agent-coordinator.js';

// ── NeuralFS (Cognitive Filesystem) ────────────────────────
export { NeuralFS } from './neural-fs/index.js';
export { ConceptStore, ExperienceStore, SkillStore, WorldModel, ProjectStore } from './neural-fs/index.js';
export { VersionStore, contentID, stableSerialize, captureKernelState } from './neural-fs/index.js';
export type { FSEntry, FSEntryType, SnapshotTree, NFSObject, NFSCommit, NFSDiff, RestoreResult } from './neural-fs/index.js';

// ── Cognitive Protocol (CP) v1 — the versioned contract ────
export {
  CPServer,
  CP_PROTOCOL_ID,
  CP_VERSION,
  CP_MAJOR,
  CP_OPS,
  parseCPRequest,
  isCompatibleVersion,
  createDefaultCPServer,
  runConformance,
  assertConformance,
  createCPTools,
  handleCPHTTP,
  cpRouteInfo,
} from './protocol/index.js';
export type {
  CPOp,
  CPRequest,
  CPResponse,
  CPError,
  CPErrorCode,
  CPOpHandler,
  CPHandlerSpec,
  ConformanceReport,
  ConformanceResult,
  CPToolDef,
} from './protocol/index.js';

// ── Driver Registry (pluggable external world) ─────────────
export { DriverRegistry } from './drivers/registry.js';
export type { Driver, DriverEvent, DriverRegistration } from './drivers/registry.js';

// ── Workspace Manifest (discovery + attachment) ────────────
export {
  MANIFEST_SCHEMA_VERSION,
  MANIFEST_FILE_NAME,
  MANIFEST_DIR_NAME,
  MANIFEST_PATH,
  validateManifest,
  compareVersions,
  negotiateVersion,
  ManifestError,
  parseManifest,
  loadManifestFile,
  createManifest,
  writeManifest,
  discoverManifest,
  negotiate,
  attach,
  detach,
  createStandardCapabilityRegistry,
  UCH_RUNTIME_VERSION,
  STANDARD_CAPABILITIES,
} from './workspace-manifest/index.js';
export type {
  WorkspaceManifest,
  ManifestCapabilityEntry,
  ManifestDriverEntry,
  ManifestEndpoint,
  ManifestPolicyEntry,
  ManifestValidationResult,
  VersionNegotiation,
  LoadedManifest,
  CreateManifestOptions,
  DiscoveryResult,
  DiscoveryOptions,
  NegotiatedCapability,
  NegotiatedDriver,
  NegotiationResult,
  AttachOptions,
  AttachmentResult,
  AttachmentSession,
} from './workspace-manifest/index.js';

// ── Harness API (legacy) ────────────────────────────────────
export { UniversalCognitiveHarness } from './harness-api/universal-harness.js';
export type { UCHConfig, UCHStatus } from './harness-api/universal-harness.js';
export { BiologicalFunctions } from './harness-api/biological-functions.js';
export { StateVirtualization } from './state-virtualization/state-virtualization.js';

// ── Legacy Recorder (cognitive-recorder) ────────────────────
export { Recorder } from './cognitive-recorder/recorder.js';
export { EventLedger } from './cognitive-recorder/event-ledger.js';
export { createActivity, completeActivity } from './cognitive-recorder/cognitive-activity.js';
export type {
  CognitiveActivity,
  ActivityType,
  ActivityContext,
  ActivityEvidence,
  ActivityToolUse,
  ActivityDecision,
  ActivityOutcome,
  LedgerStats,
} from './cognitive-recorder/index.js';

// ── Reason Graph (Layer 4) ──────────────────────────────────
export { ReasonGraph } from './cortex_kernel/reason-graph.js';
export type { CausalLink, DependencyChain, ContradictionReport } from './cortex_kernel/reason-graph.js';

// ── Belief / Goal / Reasoning Trace Stores ──────────────────
export { BeliefStore } from './neural-fs/belief-store.js';
export type { Belief, BeliefStatus } from './neural-fs/belief-store.js';
export { GoalStore } from './neural-fs/goal-store.js';
export type { Goal, GoalStatus, GoalPriority } from './neural-fs/goal-store.js';
export { ReasoningTraceStore } from './neural-fs/reasoning-trace-store.js';
export type { ReasoningTrace, ReasoningStep, TraceStepType } from './neural-fs/reasoning-trace-store.js';

// ── WebSocket Transport ─────────────────────────────────────
export { WebSocketServer } from './control-plane/transport/websocket-transport.js';

// ── Kernel sub-exports ──────────────────────────────────────
export * from './kernel/index.js';

// ── Provenance-Weighted Retrieval ──────────────────────────
export type { ProvenanceWeightConfig } from './kernel/retrieval/fusion.js';

// ── Concept Genome DNA ────────────────────────────────────
export { ConceptGenome } from './kernel/concept-genome/index.js';
export type {
  GeneMarker,
  ConceptDNA,
  MutationEvent,
  FusionProposal,
  GenomeComparison,
  ConceptGenomeStats,
} from './kernel/concept-genome/index.js';
export { CognitiveMemorySystem } from './kernel/memory/cognitive-memory-system.js';
export type {
  MemorySystemConfig,
  MemoryObservationInput,
} from './kernel/memory/cognitive-memory-system.js';
export { EngineeringJudgmentEngine } from './kernel/constitution/engineering-judgment.js';
export type {
  EngineeringJudgmentInput,
  EngineeringJudgmentResult,
} from './kernel/constitution/engineering-judgment.js';

// ── Agentic Cognition Engine (ported from Claude Code architecture) ──
export * from './agentic/index.js';

// ---------------------------------------------------------------------------
// MNEMOSYNE - Cognitive Memory Brain (the memory supremacy system)
// ---------------------------------------------------------------------------
export * from './mnemosyne/index.js';

// Resolve export-* ambiguity: kernel's EpistemicStatus is canonical at the
// top level; mnemosyne's narrower union stays available under an alias.
export type { EpistemicStatus } from './kernel/types/provenance.js';
export type { EpistemicStatus as MnemosyneEpistemicStatus } from './mnemosyne/index.js';
