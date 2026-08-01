export { SpeciesGenome } from './species-genome.js';
export type { GenomeLaw, ImmutableCommitment, SpeciesGenomeConfig } from './species-genome.js';
export { AdaptiveGenome } from './adaptive-genome.js';
export type { SkillProficiency, ConfidenceDistribution } from './adaptive-genome.js';
export { WorkspaceGenome } from './workspace-genome.js';
export type { GenomeEntry, GenomeSection, WorkspaceGenomeConfig } from './workspace-genome.js';
export {
  ExpressionEngine,
  deriveExpressionReport,
  DEFAULT_GENE_EXPRESSION_RULES,
  DEFAULT_ENVIRONMENT,
  BUILTIN_ENVIRONMENTS,
} from './expression/expression-engine.js';
export type {
  ExpressionEnvironment,
  Protein,
  ProteinParams,
  GeneExpressionRule,
  EpigeneticMark,
  ExpressionResult,
  ExpressionReport,
  ExpressionReportEntry,
} from './expression/expression-engine.js';
