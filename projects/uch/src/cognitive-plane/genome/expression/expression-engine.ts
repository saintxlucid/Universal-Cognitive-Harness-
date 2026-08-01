/**
 * Cognitive Expression System — prototype (IDEA-0090).
 *
 * Genes are not configuration. The genome is the stable information
 * store; an EXPRESSION step synthesizes runtime behavior units
 * (proteins) from genes conditioned on the environment; the same
 * genome expresses differently in production (conservative) vs
 * development (experimental); expression changes are ledgered
 * epigenetic marks, never genome edits.
 *
 * This is a PROTOTYPE (SOP-08 Prototype stage): a new module, not
 * wired into any gate. Its value is DERIVATION — the corpus's
 * mechanisms (RFC-0005 veto threshold θ, decision-law exploration
 * bias, sleep cadence) all have parameters that fall out of a gene's
 * protein instead of being hard-coded per environment.
 *
 * Model:  Genome (immutable) → express(environment) → Proteins →
 * Behavior.  An undeclared environment expresses every gene's
 * conservative `default` protein and REPORTS the ambiguity (the
 * intake's fallback rule); marks are recorded on switch or fallback
 * only — re-expressing the same environment is idempotent.
 *
 * G1 evidence: research/foundations/18-cognitive-expression.md
 * (central dogma — Crick 1970; operon regulation — Jacob & Monod
 * 1961; epigenetics — Waddington 1957, Waterland & Jirtle 2003,
 * Evans & Wheeler 2001; derivation — Miller 1966 capabilities).
 */

export type ExpressionEnvironment = string;

export interface ProteinParams {
  readonly [key: string]: number | string | boolean;
}

/** A runtime behavior unit synthesized from a gene by an environment. */
export interface Protein {
  readonly id: string;
  readonly gene: string;
  readonly name: string;
  /** What the protein does at runtime — the behavior, not a config value. */
  readonly behavior: string;
  /** Typed parameters consumable by existing mechanisms. */
  readonly params: ProteinParams;
}

/** `(gene, environment) → protein`. `environment: 'default'` is the
 * conservative fallback rule every gene must carry. */
export interface GeneExpressionRule {
  readonly gene: string;
  readonly environment: ExpressionEnvironment;
  readonly protein: Omit<Protein, 'gene'>;
}

/** Append-only ledger entry: an expression event (switch or fallback). */
export interface EpigeneticMark {
  readonly gene: string;
  readonly environment: ExpressionEnvironment;
  readonly proteinId: string;
  readonly atTick: number;
  readonly reason: 'switch' | 'fallback';
}

export interface ExpressionResult {
  readonly environment: ExpressionEnvironment;
  readonly proteins: Protein[];
  /** Marks recorded by this expression call (empty when idempotent). */
  readonly marks: EpigeneticMark[];
  /** Genes that fell back to `default` because the environment is
   * undeclared — the ambiguity is reported, never hidden. */
  readonly fallbacks: string[];
}

export const DEFAULT_ENVIRONMENT = 'default';
export const BUILTIN_ENVIRONMENTS = ['production', 'development'] as const;

/* ------------------------------------------------------------------ */
/* Default gene catalog — the corpus anchors as genes                 */
/* ------------------------------------------------------------------ */

/**
 * `verification-strictness` — the intake's "Security Gene → Strict
 * Verification Protein". Production expresses the normative RFC-0005
 * veto threshold θ = 0.5; development relaxes it to 0.7 so
 * experiments may proceed; `default` is the strict protein.
 */
const VERIFICATION_RULES: GeneExpressionRule[] = [
  {
    gene: 'verification-strictness',
    environment: 'production',
    protein: {
      id: 'strict-verification',
      name: 'Strict Verification',
      behavior: 'Verify every significant change; veto at the normative RFC-0005 threshold.',
      params: { vetoThreshold: 0.5, verifyBeforeCommit: true, evidenceSources: 3 },
    },
  },
  {
    gene: 'verification-strictness',
    environment: 'development',
    protein: {
      id: 'lenient-verification',
      name: 'Lenient Verification',
      behavior: 'Verify only risk-bearing changes; experiments proceed below a relaxed veto.',
      params: { vetoThreshold: 0.7, verifyBeforeCommit: false, evidenceSources: 2 },
    },
  },
  {
    gene: 'verification-strictness',
    environment: 'default',
    protein: {
      id: 'strict-verification',
      name: 'Strict Verification',
      behavior: 'Verify every significant change; veto at the normative RFC-0005 threshold.',
      params: { vetoThreshold: 0.5, verifyBeforeCommit: true, evidenceSources: 3 },
    },
  },
];

/**
 * `risk-profile` — the decision law's exploration term as a gene.
 * Production biases toward exploitation (λi/λe small); development
 * biases toward information gain (exploration), the intake's
 * "Production → Conservative / Development → Experimental".
 */
const RISK_RULES: GeneExpressionRule[] = [
  {
    gene: 'risk-profile',
    environment: 'production',
    protein: {
      id: 'conservative-risk',
      name: 'Conservative Risk',
      behavior: 'Prioritize exploitation; keep instability exposure low.',
      params: { maxInstability: 0.3, explorationBias: 0.1 },
    },
  },
  {
    gene: 'risk-profile',
    environment: 'development',
    protein: {
      id: 'experimental-risk',
      name: 'Experimental Risk',
      behavior: 'Prioritize information gain; tolerate higher instability exposure.',
      params: { maxInstability: 0.6, explorationBias: 0.6 },
    },
  },
  {
    gene: 'risk-profile',
    environment: 'default',
    protein: {
      id: 'conservative-risk',
      name: 'Conservative Risk',
      behavior: 'Prioritize exploitation; keep instability exposure low.',
      params: { maxInstability: 0.3, explorationBias: 0.1 },
    },
  },
];

/** `sleep-cadence` — the sleep cycle's consolidation rhythm as a gene. */
const SLEEP_RULES: GeneExpressionRule[] = [
  {
    gene: 'sleep-cadence',
    environment: 'production',
    protein: {
      id: 'daily-consolidation',
      name: 'Daily Consolidation',
      behavior: 'Consolidate memory on the long cadence; minimize interruption.',
      params: { sleepEveryTicks: 1000, distill: true },
    },
  },
  {
    gene: 'sleep-cadence',
    environment: 'development',
    protein: {
      id: 'frequent-consolidation',
      name: 'Frequent Consolidation',
      behavior: 'Consolidate often so experiments learn quickly from their residue.',
      params: { sleepEveryTicks: 200, distill: true },
    },
  },
  {
    gene: 'sleep-cadence',
    environment: 'default',
    protein: {
      id: 'daily-consolidation',
      name: 'Daily Consolidation',
      behavior: 'Consolidate memory on the long cadence; minimize interruption.',
      params: { sleepEveryTicks: 1000, distill: true },
    },
  },
];

export const DEFAULT_GENE_EXPRESSION_RULES: readonly GeneExpressionRule[] = [
  ...VERIFICATION_RULES,
  ...RISK_RULES,
  ...SLEEP_RULES,
];

/* ------------------------------------------------------------------ */
/* The expression engine                                               */
/* ------------------------------------------------------------------ */

export class ExpressionEngine {
  private readonly rules: ReadonlyMap<string, GeneExpressionRule>;
  private readonly markLedger: EpigeneticMark[] = [];

  constructor(rules: readonly GeneExpressionRule[] = DEFAULT_GENE_EXPRESSION_RULES) {
    const byKey = new Map<string, GeneExpressionRule>();
    for (const rule of rules) byKey.set(`${rule.gene}::${rule.environment}`, rule);
    this.rules = byKey;
  }

  /** The declared environments for which at least one gene has a rule
   * (excluding the universal `default` fallback). */
  declaredEnvironments(): ExpressionEnvironment[] {
    const envs = new Set<ExpressionEnvironment>();
    for (const rule of this.rules.values()) {
      if (rule.environment !== DEFAULT_ENVIRONMENT) envs.add(rule.environment);
    }
    return [...envs];
  }

  /** The genes the catalog knows (each must carry a `default` rule). */
  genes(): string[] {
    return [...new Set([...this.rules.values()].map((r) => r.gene))];
  }

  /** Pure lookup: the protein a gene expresses in an environment,
   * falling back to the conservative `default` rule. No ledger side
   * effects — use `express` for the ledgered synthesis. */
  proteinFor(gene: string, environment: ExpressionEnvironment): Protein | undefined {
    const rule =
      this.rules.get(`${gene}::${environment}`) ??
      this.rules.get(`${gene}::${DEFAULT_ENVIRONMENT}`);
    if (!rule) return undefined;
    return { ...rule.protein, gene };
  }

  /** Ledgered synthesis: express every gene for an environment.
   * Records a mark when a gene's protein differs from its last
   * recorded mark (a switch) or when it fell back to `default`
   * (the declared rule for the environment was absent). Idempotent
   * for repeated same-environment expression. */
  express(environment: ExpressionEnvironment, tick: number): ExpressionResult {
    const proteins: Protein[] = [];
    const marks: EpigeneticMark[] = [];
    const fallbacks: string[] = [];
    for (const gene of this.genes().sort()) {
      const declared = this.rules.get(`${gene}::${environment}`);
      const protein = this.proteinFor(gene, environment);
      if (!protein) continue;
      proteins.push(protein);
      const reason: EpigeneticMark['reason'] = declared ? 'switch' : 'fallback';
      if (!declared) fallbacks.push(gene);
      const last = this.lastMark(gene);
      const changed = last === undefined || last.proteinId !== protein.id;
      if (changed) {
        const mark: EpigeneticMark = {
          gene,
          environment,
          proteinId: protein.id,
          atTick: tick,
          reason,
        };
        this.markLedger.push(mark);
        marks.push(mark);
      }
    }
    return { environment, proteins, marks, fallbacks };
  }

  /** The append-only mark ledger, oldest first. */
  marks(): readonly EpigeneticMark[] {
    return [...this.markLedger];
  }

  private lastMark(gene: string): EpigeneticMark | undefined {
    for (let i = this.markLedger.length - 1; i >= 0; i--) {
      const mark = this.markLedger[i];
      if (mark && mark.gene === gene) return mark;
    }
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Derived report — params consumable by existing mechanisms          */
/* ------------------------------------------------------------------ */

export interface ExpressionReportEntry {
  readonly gene: string;
  readonly environment: ExpressionEnvironment;
  readonly proteinId: string;
  readonly behavior: string;
  /** Params the consuming organ would read. */
  readonly params: ProteinParams;
}

export interface ExpressionReport {
  readonly environment: ExpressionEnvironment;
  readonly entries: ExpressionReportEntry[];
  /** e.g. the RFC-0005 veto threshold the verification gene expresses. */
  readonly effectiveVetoThreshold: number | undefined;
  /** e.g. the decision-law exploration bias (λi/λe proxy). */
  readonly explorationBias: number | undefined;
  readonly fallbacks: string[];
}

/**
 * Derive what the corpus would consume from an environment's
 * expression. The report is pure derivation — nothing is wired.
 */
export function deriveExpressionReport(
  engine: ExpressionEngine,
  environment: ExpressionEnvironment,
  tick: number,
): ExpressionReport {
  const result = engine.express(environment, tick);
  const entries: ExpressionReportEntry[] = result.proteins.map((p) => ({
    gene: p.gene,
    environment: result.environment,
    proteinId: p.id,
    behavior: p.behavior,
    params: p.params,
  }));
  const verification = entries.find((e) => e.gene === 'verification-strictness');
  const risk = entries.find((e) => e.gene === 'risk-profile');
  return {
    environment: result.environment,
    entries,
    effectiveVetoThreshold:
      typeof verification?.params.vetoThreshold === 'number'
        ? verification.params.vetoThreshold
        : undefined,
    explorationBias:
      typeof risk?.params.explorationBias === 'number' ? risk.params.explorationBias : undefined,
    fallbacks: result.fallbacks,
  };
}
