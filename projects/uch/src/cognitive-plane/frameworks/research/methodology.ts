/**
 * Research Methodology Engine — validates a methodology plan against the
 * five-stage structure (design → collection → analysis → sampling → ethics)
 * with quality controls and a "before you finish" checklist.
 *
 * Also implements Research Gap Analysis with the eight gap types:
 * knowledge, evidence, methodological, population, context, time,
 * contradiction, theory.
 */

/* ── Methodology validation ──────────────────────────────────────── */

export type MethodologyStage =
  | 'design'
  | 'collection'
  | 'analysis'
  | 'sampling'
  | 'ethics';

export interface MethodologyPlan {
  researchQuestion: string;
  design?: { approach?: 'qualitative' | 'quantitative' | 'mixed'; justification?: string };
  collection?: { methods?: string[]; detail?: string };
  analysis?: { methods?: string[]; description?: string };
  sampling?: { population?: string; method?: string; size?: string; justification?: string };
  ethics?: { informedConsent?: boolean; confidentiality?: boolean; voluntary?: boolean; dataProtection?: boolean };
}

export interface StageCheck {
  stage: MethodologyStage;
  label: string;
  fundamentalQuestion: string;
  ok: boolean;
  detail: string;
}

export interface MethodologyVerdict {
  researchQuestion: string;
  stages: StageCheck[];
  mistakes: string[];
  checklist: { item: string; ok: boolean }[];
  ready: boolean;
}

export function validateMethodology(plan: MethodologyPlan): MethodologyVerdict {
  const stages: StageCheck[] = [
    {
      stage: 'design',
      label: 'Research Design',
      fundamentalQuestion: 'How will I investigate the problem?',
      ok: Boolean(plan.design?.approach && (plan.design?.justification?.length ?? 0) > 20),
      detail: plan.design?.approach
        ? `${plan.design.approach} design — justification: ${plan.design.justification?.slice(0, 120) ?? 'missing'}`
        : 'missing: choose qualitative/quantitative/mixed and justify it against objectives',
    },
    {
      stage: 'collection',
      label: 'Data Collection',
      fundamentalQuestion: 'Where will the evidence come from?',
      ok: Boolean(plan.collection?.methods && plan.collection.methods.length > 0 && plan.collection?.detail),
      detail: plan.collection?.methods?.join(', ') ?? 'missing: specify surveys, interviews, focus groups, observations, or secondary data',
    },
    {
      stage: 'analysis',
      label: 'Data Analysis',
      fundamentalQuestion: 'How will I interpret the evidence?',
      ok: Boolean(plan.analysis?.methods && plan.analysis.methods.length > 0 && plan.analysis.description),
      detail: plan.analysis?.methods?.join(', ') ?? 'missing: describe how raw data becomes findings (coding, regression, statistics)',
    },
    {
      stage: 'sampling',
      label: 'Sample and Population',
      fundamentalQuestion: 'Whose evidence is being represented?',
      ok: Boolean(plan.sampling?.population && plan.sampling?.size && plan.sampling?.justification),
      detail: plan.sampling?.population
        ? `${plan.sampling.population} via ${plan.sampling.method ?? '? '} (n=${plan.sampling.size ?? '?'}) — ${plan.sampling.justification?.slice(0, 100) ?? 'justification missing'}`
        : 'missing: define target population, sampling method, and sample size justification',
    },
    {
      stage: 'ethics',
      label: 'Ethical Considerations',
      fundamentalQuestion: 'Can this research be trusted ethically?',
      ok: Boolean(plan.ethics?.informedConsent && plan.ethics?.confidentiality && plan.ethics?.voluntary && plan.ethics?.dataProtection),
      detail: plan.ethics
        ? ['informed consent', 'confidentiality', 'voluntary participation', 'data protection']
            .filter((k) => !plan.ethics?.[k as keyof typeof plan.ethics])
            .join(', ') || 'all four protections addressed'
        : 'missing: informed consent, confidentiality, voluntary participation, data protection',
    },
  ];

  const mistakes: string[] = [];
  if (!plan.design?.approach) mistakes.push('No clear research design');
  if (plan.collection?.methods?.length && plan.collection.methods.length > 4) mistakes.push('Overly complicated methods');
  if (!plan.analysis?.description) mistakes.push('Missing explanation of analysis');
  if (!plan.sampling?.population) mistakes.push('Unclear sampling');
  if (!plan.ethics?.informedConsent) mistakes.push('Ignoring ethics');

  const checklist: MethodologyVerdict['checklist'] = [
    { item: 'Research design is clearly defined', ok: stages[0]?.ok ?? false },
    { item: 'Data collection methods are specific', ok: stages[1]?.ok ?? false },
    { item: 'Analysis procedures are explained', ok: stages[2]?.ok ?? false },
    { item: 'Sample is justified', ok: stages[3]?.ok ?? false },
    { item: 'Ethical considerations are addressed', ok: stages[4]?.ok ?? false },
  ];

  return {
    researchQuestion: plan.researchQuestion,
    stages,
    mistakes,
    checklist,
    ready: checklist.every((c) => c.ok),
  };
}

/* ── Research gap analysis ───────────────────────────────────────── */

export type GapType =
  | 'knowledge'
  | 'evidence'
  | 'methodological'
  | 'population'
  | 'context'
  | 'time'
  | 'contradiction'
  | 'theory';

export const GAP_TYPES: { type: GapType; label: string; description: string; signal: string }[] = [
  { type: 'knowledge', label: 'Knowledge Gap', description: 'Nobody knows — no studies exist.', signal: 'no studies found for this topic' },
  { type: 'evidence', label: 'Evidence Gap', description: 'Claims exist; evidence does not.', signal: 'claims without supporting evidence' },
  { type: 'methodological', label: 'Methodological Gap', description: 'Wrong, poor, or outdated methods.', signal: 'weak or outdated methods used' },
  { type: 'population', label: 'Population Gap', description: 'Wrong people studied.', signal: 'different population unstudied' },
  { type: 'context', label: 'Context Gap', description: 'Wrong location, culture, industry, environment.', signal: 'different context unstudied' },
  { type: 'time', label: 'Time Gap', description: 'Old evidence, new reality.', signal: 'evidence predates current reality' },
  { type: 'contradiction', label: 'Contradiction Gap', description: 'Studies disagree.', signal: 'conflicting findings across studies' },
  { type: 'theory', label: 'Theory Gap', description: 'Existing theories cannot explain observations.', signal: 'observations unexplained by theory' },
];

export interface LiteratureNote {
  title: string;
  finding: string;
  /** Year of publication — used for time-gap and old-vs-new detection. */
  year?: number;
  limitation?: string;
  futureRecommendation?: string;
  population?: string;
  context?: string;
}

export interface GapDetectionInput {
  topic: string;
  notes: LiteratureNote[];
}

export interface DetectedGap {
  type: GapType;
  label: string;
  confidence: number;
  evidence: string;
}

export interface GapAnalysisResult {
  topic: string;
  detected: DetectedGap[];
  ranked: DetectedGap[];
  researchQuestion: string | null;
  advice: string;
}

export function detectGaps(input: GapDetectionInput): GapAnalysisResult {
  const detected: DetectedGap[] = [];
  const n = input.notes;

  if (n.length === 0) {
    detected.push({
      type: 'knowledge',
      label: 'Knowledge Gap',
      confidence: 0.9,
      evidence: 'no literature found for this topic',
    });
  } else {
    const contradictions = n.filter((x) => x.finding && /no effect|contradict|disagree|inconsistent|no significant|failed/.test(x.finding));
    if (contradictions.length > 0) {
      detected.push({
        type: 'contradiction',
        label: 'Contradiction Gap',
        confidence: 0.75,
        evidence: `${contradictions.length} study/studies disagree: ${contradictions.map((c) => c.title).join('; ')}`,
      });
    }

    const limitations = n.filter((x) => x.limitation);
    if (limitations.length > 0) {
      detected.push({
        type: 'methodological',
        label: 'Methodological Gap',
        confidence: 0.6,
        evidence: `limitations reported: ${limitations.map((l) => l.limitation).slice(0, 3).join('; ')}`,
      });
    }

    const withFutures = n.filter((x) => x.futureRecommendation);
    if (withFutures.length > 0) {
      detected.push({
        type: 'knowledge',
        label: 'Knowledge Gap',
        confidence: 0.55,
        evidence: `authors request future research: ${withFutures.map((f) => f.futureRecommendation).slice(0, 3).join('; ')}`,
      });
    }

    const years = n.map((x) => x.year).filter((y): y is number => typeof y === 'number');
    const maxYear = Math.max(...years, 0);
    const now = new Date().getFullYear();
    if (years.length > 0 && now - maxYear > 5) {
      detected.push({
        type: 'time',
        label: 'Time Gap',
        confidence: 0.6,
        evidence: `newest source is ${now - maxYear} years old — reality may have changed`,
      });
    }

    const populations = new Set(n.map((x) => x.population ?? 'unspecified'));
    const contexts = new Set(n.map((x) => x.context ?? 'unspecified'));
    if (populations.size === 1 && populations.has('unspecified')) {
      detected.push({
        type: 'population',
        label: 'Population Gap',
        confidence: 0.5,
        evidence: 'no population explicitly studied — consider understudied populations',
      });
    }
    if (contexts.size === 1 && contexts.has('unspecified')) {
      detected.push({
        type: 'context',
        label: 'Context Gap',
        confidence: 0.45,
        evidence: 'no context explicitly studied — different settings may change results',
      });
    }

    const claims = n.filter((x) => x.finding);
    const withEvidence = n.length - (n.filter((x) => !x.finding).length);
    if (claims.length > 0 && withEvidence < n.length) {
      detected.push({
        type: 'evidence',
        label: 'Evidence Gap',
        confidence: 0.5,
        evidence: 'some entries are claims without supporting evidence',
      });
    }
  }

  const ranked = [...detected].sort((a, b) => b.confidence - a.confidence);
  const top = ranked[0];

  return {
    topic: input.topic,
    detected,
    ranked,
    researchQuestion: top
      ? `Given the ${top.label.toLowerCase()}, a strong research question is: "${input.topic} under [new population/context/method]?"`
      : null,
    advice:
      top?.type === 'knowledge'
        ? 'This is a genuine frontier — formulate a specific, narrow research question.'
        : 'Prioritize the highest-confidence gap; be specific about what is missing.',
  };
}
