export type EvidenceClass =
  | 'alias_hit'
  | 'exact_title_match'
  | 'high_vector_match'
  | 'keyword_exact'
  | 'weak_semantic';

export type CreateSafety = 'exists' | 'probable' | 'unknown';

export interface EvidenceClassification {
  evidence: EvidenceClass;
  score: number;
  createSafety: CreateSafety;
  matchedTitle?: string;
  matchedAlias?: string;
  rationale: string;
}

export interface EvidenceInput {
  score: number;
  title?: string;
  alias?: string;
  queryTitleTokens?: string[];
  queryExactPhrase?: string;
  keywordExactScore?: number;
  vectorScore?: number;
  exactTitleMatch?: boolean;
  aliasHit?: boolean;
}

const VECTOR_MATCH_THRESHOLD = 0.85;
const KEYWORD_EXACT_THRESHOLD = 0.6;

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function classifyEvidence(input: EvidenceInput): EvidenceClassification {
  if (input.aliasHit || input.alias) {
    return {
      evidence: 'alias_hit',
      score: 1.0,
      createSafety: 'exists',
      matchedAlias: input.alias,
      rationale: `Alias hit: ${input.alias}`,
    };
  }

  if (input.exactTitleMatch) {
    return {
      evidence: 'exact_title_match',
      score: 1.0,
      createSafety: 'exists',
      matchedTitle: input.title,
      rationale: `Exact title match: ${input.title}`,
    };
  }

  const vectorScore = input.vectorScore ?? input.score;
  if (vectorScore >= VECTOR_MATCH_THRESHOLD) {
    return {
      evidence: 'high_vector_match',
      score: vectorScore,
      createSafety: 'probable',
      rationale: `High vector match (${vectorScore.toFixed(2)} >= 0.85)`,
    };
  }

  const keywordScore = input.keywordExactScore ?? input.score;
  if (keywordScore >= KEYWORD_EXACT_THRESHOLD) {
    return {
      evidence: 'keyword_exact',
      score: keywordScore,
      createSafety: 'probable',
      rationale: `Keyword exact match (${keywordScore.toFixed(2)} >= 0.6)`,
    };
  }

  const title = input.title;
  const queryTitleTokens = input.queryTitleTokens;
  const titleTokenMatch = title && queryTitleTokens
    ? queryTitleTokens.every((token) => tokenize(title).includes(token))
    : false;
  if (titleTokenMatch) {
    return {
      evidence: 'keyword_exact',
      score: 0.8,
      createSafety: 'probable',
      matchedTitle: title,
      rationale: 'All query title tokens present in result title',
    };
  }

  return {
    evidence: 'weak_semantic',
    score: vectorScore,
    createSafety: 'unknown',
    rationale: `Weak semantic match (${vectorScore.toFixed(2)})`,
  };
}

export function createSafetyForEvidence(evidence: EvidenceClass): CreateSafety {
  switch (evidence) {
    case 'alias_hit':
    case 'exact_title_match':
      return 'exists';
    case 'high_vector_match':
    case 'keyword_exact':
      return 'probable';
    case 'weak_semantic':
      return 'unknown';
  }
}

export function evidenceRank(evidence: EvidenceClass): number {
  switch (evidence) {
    case 'alias_hit':
      return 5;
    case 'exact_title_match':
      return 4;
    case 'high_vector_match':
      return 3;
    case 'keyword_exact':
      return 2;
    case 'weak_semantic':
      return 1;
  }
}

export interface DuplicateCheckResult {
  safety: CreateSafety;
  bestMatch: EvidenceClassification | null;
  shouldCreate: boolean;
  reason: string;
}

export function evaluateDuplicateCheck(
  classifications: EvidenceClassification[],
): DuplicateCheckResult {
  if (classifications.length === 0) {
    return {
      safety: 'unknown',
      bestMatch: null,
      shouldCreate: true,
      reason: 'No evidence of existing memory; safe to create',
    };
  }
  const sorted = [...classifications].sort((a, b) => evidenceRank(b.evidence) - evidenceRank(a.evidence));
  const best = sorted[0]!;
  const bestRank = evidenceRank(best.evidence);
  const shouldCreate = bestRank <= evidenceRank('weak_semantic');
  return {
    safety: best.createSafety,
    bestMatch: best,
    shouldCreate,
    reason: shouldCreate
      ? `Best evidence is ${best.evidence}; creating new memory`
      : `Existing memory found (${best.evidence}); skipping duplicate write`,
  };
}
