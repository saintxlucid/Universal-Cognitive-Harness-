/**
 * Cognitive Frameworks Library — the codified reasoning, decision,
 * strategy, productivity, research, and quality frameworks of the
 * workspace, exposed as deterministic engines with an optional
 * LLM-assisted mode.
 *
 * Central thesis (from the corpus this library codifies):
 * "There is no one best model, only the right model for the moment."
 * The registry's `select` implements the decision-about-decisions layer.
 */

export { FrameworkRegistry, createFrameworkRegistry, createFrameworkCatalog, FRAMEWORK_CATALOG_VERSION } from './registry.js';
export type {
  FrameworkDefinition,
  FrameworkFamily,
  FrameworkLLMProvider,
  FrameworkSelectionInput,
  FrameworkSelectionResult,
  FrameworkStage,
  DecisionContext,
} from './types.js';

export {
  decisionMatrix,
  costBenefit,
  paretoAnalysis,
  decisionTree,
  swotAnalysis,
  premortem,
  prosCons,
  sixHats,
} from './decisions/decision-models.js';
export type {
  MatrixCriterion,
  MatrixOption,
  MatrixResult,
  CostBenefitInput,
  CostBenefitResult,
  ParetoItem,
  ParetoResult,
  TreeBranch,
  TreeOption,
  TreeResult,
  SwotInput,
  SwotResult,
  PremortemInput,
  PremortemResult,
  ProsConsInput,
  ProsConsResult,
  HatsResult,
} from './decisions/decision-models.js';
export { selectDecisionModel, classifyDecision } from './decisions/model-selector.js';
export type { ModelSelectionCriteria, ModelSelection } from './decisions/model-selector.js';

export {
  ideal,
  fiveWhys,
  designThinking,
  pdcaPlan,
  ooda,
  kepnerTregoe,
} from './problems/problem-solver.js';
export type {
  IdealInput,
  IdealResult,
  FiveWhysInput,
  FiveWhysResult,
  DesignThinkingInput,
  DesignThinkingResult,
  PDCACycle,
  OODAInput,
  OODAResult,
  KTInput,
  KTResult,
} from './problems/problem-solver.js';

export {
  rcaAnalyze,
  traceFiveWhys,
  fishbone,
  paretoPrioritize,
  CAUSE_CATEGORIES,
} from './rca/rca.js';
export type {
  CauseCategory,
  CauseHypothesis,
  EvidenceItem,
  RCAInput,
  RCAResult,
  WhysNode,
  FiveWhysTrace,
  FishboneInput,
  FishboneResult,
  CauseImpact,
} from './rca/rca.js';

export { strategyWheel, strategyVsPlan } from './strategy/strategy-wheel.js';
export type {
  StrategyQuadrant,
  StrategyAnswer,
  StrategyWheelInput,
  StrategyWheelResult,
  StrategicPillar,
  StrategyVsPlanInput,
  StrategyVsPlanResult,
} from './strategy/strategy-wheel.js';

export { planTasks, threeThreeThree } from './productivity/productivity-os.js';
export type {
  Task,
  TaskPlannerInput,
  TaskPlannerOutput,
  Urgency,
  Importance,
  ThreeThreeThreeInput,
  ThreeThreeThreeResult,
} from './productivity/productivity-os.js';

export { validateMethodology, detectGaps, GAP_TYPES } from './research/methodology.js';
export type {
  MethodologyPlan,
  MethodologyVerdict,
  StageCheck,
  MethodologyStage,
  GapType,
  LiteratureNote,
  GapDetectionInput,
  DetectedGap,
  GapAnalysisResult,
} from './research/methodology.js';

export { assessInformation, QUESTIONS as CRITICAL_QUESTIONS } from './critical/critical-evaluator.js';
export type {
  CriticalQuestionId,
  QuestionCheck,
  InformationAssessment,
  AssessmentInput,
} from './critical/critical-evaluator.js';

export { dikwTransform, checkRepresentationInvariance } from './knowledge/dikw.js';
export type {
  DataPoint,
  InformationEntity,
  KnowledgeRule,
  DikwInput,
  DikwResult,
  Representation,
  InvarianceResult,
} from './knowledge/dikw.js';

export { fuseSignals, factorRegimeNotes } from './signals/signal-fusion.js';
export type {
  FactorId,
  Factor,
  Candidate,
  FusionOptions,
  FusedCandidate,
  FusionResult,
} from './signals/signal-fusion.js';

export { auditCodePrinciples } from './code/code-principles.js';
export type {
  PrincipleId,
  PrincipleVerdict,
  TradeOffCheck,
  CodePrinciplesInput,
  CodePrinciplesResult,
} from './code/code-principles.js';

export {
  FrameworkDecisionJournal,
  syncTakesWithJournal,
  convictionFor,
} from './journal/decision-journal.js';
export type {
  FrameworkJournalEntry,
  FrameworkJournalInput,
  FrameworkJournalStats,
  JournalModelAccuracy,
} from './journal/decision-journal.js';

export { FrameworkComposer } from './composer/composer.js';
export type {
  SolveProfile,
  SolveStageResult,
  SolveResult,
} from './composer/composer.js';
