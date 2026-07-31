/**
 * DIKW Transform Engine — Data → Information → Knowledge → Wisdom.
 *
 * Context is the catalyst at every stage:
 * - Data        — context-free observations (who/what/when/where)
 * - Information — organized, related data
 * - Knowledge   — models, mechanisms, experience (how)
 * - Wisdom      — judgment, priorities, purpose (why; what should be done)
 *
 * Accumulating more data does not produce wisdom; enriching with context
 * and interpretation does.
 */

export interface DataPoint {
  value: string;
  attribute: string;
}

export interface InformationEntity {
  subject: string;
  relationships: string[];
}

export interface KnowledgeRule {
  pattern: string;
  mechanism: string;
  applicability: string;
}

export interface DikwInput {
  dataPoints: DataPoint[];
  relationships?: InformationEntity[];
  knowledgeRules?: KnowledgeRule[];
  judgment?: { priorities: string[]; tradeoffs: string[]; ethicalConsiderations: string[] };
}

export interface DikwResult {
  data: { points: DataPoint[]; primaryQuestions: string[] };
  information: { entities: InformationEntity[]; added: string[] };
  knowledge: { rules: KnowledgeRule[]; primaryQuestion: string; added: string[] };
  wisdom: { judgment: { priorities: string[]; tradeoffs: string[]; ethicalConsiderations: string[] } | null; primaryQuestion: string; added: string[] };
  loop: string[];
}

export function dikwTransform(input: DikwInput): DikwResult {
  const entities: InformationEntity[] =
    input.relationships && input.relationships.length > 0
      ? input.relationships
      : input.dataPoints.length > 0
        ? [
            {
              subject: input.dataPoints[0]?.attribute ?? '',
              relationships: input.dataPoints.slice(1).map((d) => `${d.attribute}: ${d.value}`),
            },
          ]
        : [];

  const rules: KnowledgeRule[] =
    input.knowledgeRules && input.knowledgeRules.length > 0
      ? input.knowledgeRules
      : input.dataPoints.length >= 2
        ? [
            {
              pattern: input.dataPoints.map((d) => d.attribute).join(' + '),
              mechanism: 'relationship between observed attributes suggests a mechanism',
              applicability: 'model to be validated against more evidence',
            },
          ]
        : [];

  const judgment = input.judgment && input.judgment.priorities.length > 0 ? input.judgment : null;

  return {
    data: {
      points: input.dataPoints,
      primaryQuestions: ['Who?', 'What?', 'When?', 'Where?'],
    },
    information: {
      entities,
      added: entities.length > 0
        ? ['structure and relationships added — organized observations']
        : ['missing: add relationships between data points to reach information'],
    },
    knowledge: {
      rules,
      primaryQuestion: 'How?',
      added: rules.length > 0
        ? ['models/mechanisms added — how things work and connect']
        : ['missing: add a model or causal rule to reach knowledge'],
    },
    wisdom: {
      judgment,
      primaryQuestion: 'Why?',
      added: judgment
        ? ['judgment, priorities, and trade-offs added — what should be done']
        : ['missing: without judgment and purpose, understanding cannot guide decisions'],
    },
    loop: [
      'Reality → Observe → Data → (organize) → Information → (analyze & connect) → Knowledge → (judge & contextualize) → Wisdom → Decisions & Actions → New Reality',
      'Each layer contains the previous but adds a level of abstraction',
    ],
  };
}

/**
 * Representation invariance check (the "Truth" axiom): different
 * representations of the same claim are compared for consistency.
 * A claim survives when multiple independent representations agree.
 */
export interface Representation {
  label: string;
  content: string;
}

export interface InvarianceResult {
  claim: string;
  representations: Representation[];
  agreementPct: number;
  consistent: boolean;
  insight: string;
}

export function checkRepresentationInvariance(claim: string, representations: Representation[]): InvarianceResult {
  // The claim's essential keywords are the anchor: each representation is
  // scored on how much of the claim's substance it independently confirms.
  const keywords = (s: string): string[] => {
    const words = s.toLowerCase().split(/\W+/).filter((w) => w.length >= 4);
    const stop = new Set(['that', 'this', 'with', 'from', 'have', 'were', 'will', 'been', 'into', 'over', 'about', 'their', 'there', 'which', 'what', 'when', 'then', 'than']);
    return [...new Set(words.filter((w) => !stop.has(w)))];
  };
  const claimWords = keywords(claim);
  if (claimWords.length === 0 || representations.length === 0) {
    return {
      claim,
      representations,
      agreementPct: 0,
      consistent: false,
      insight: 'cannot evaluate — claim or representations are empty',
    };
  }
  const perRepresentation = representations.map((r) => {
    const rWords = keywords(r.content);
    if (rWords.length === 0) return 0;
    const hits = claimWords.filter((w) => rWords.includes(w)).length;
    return hits / claimWords.length;
  });
  const agreementPct = Math.round(
    (perRepresentation.reduce((a, b) => a + b, 0) / representations.length) * 100,
  );
  return {
    claim,
    representations,
    agreementPct,
    consistent: agreementPct >= 50,
    insight:
      agreementPct >= 80
        ? 'high convergence — the claim is robust across representations'
        : agreementPct >= 50
          ? 'partial convergence — representations agree on the core, verify the differences'
          : 'low convergence — representations conflict; treat the claim as unverified',
  };
}
