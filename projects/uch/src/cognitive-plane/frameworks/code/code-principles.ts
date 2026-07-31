/**
 * Clean Code Principles Engine — audits a design or change description
 * against the five principles (SOC, DRY, KISS, DYC, YAGNI) and their
 * hidden trade-offs. Complements the constitution's Clean Code Covenant
 * by making the trade-off layer explicit:
 *   DRY vs KISS, YAGNI vs SOC, documentation vs self-documenting code.
 *
 * Pattern-based and deterministic (mirrors CodingPrinciplesEngine and
 * OrganicScoreEngine conventions).
 */

export type PrincipleId = 'soc' | 'dry' | 'kiss' | 'dyc' | 'yagni';

export interface PrincipleVerdict {
  principle: PrincipleId;
  name: string;
  score: number; // 0-10
  flags: string[];
  reason: string;
}

export interface TradeOffCheck {
  tradeOff: string;
  guidance: string;
  triggered: boolean;
}

export interface CodePrinciplesInput {
  /** Description or diff snippet of the design/change. */
  change: string;
  /** Optional intent — used for YAGNI and DYC context. */
  intent?: string;
}

export interface CodePrinciplesResult {
  verdict: 'clean' | 'revise';
  principles: PrincipleVerdict[];
  tradeOffs: TradeOffCheck[];
  recommendations: string[];
  score: number;
}

const SOC_VIOLATIONS = [
  'god object', 'god class', 'everything in one', 'does everything',
  'monolithic service', 'one big function', 'handles auth and billing',
  'mixes ui and logic', 'single file with', 'utils class with',
  'multipurpose', 'all-in-one',
];

const DRY_VIOLATIONS = [
  'duplicated', 'duplicate', 'copy the same', 'copy-paste', 'copied the',
  'repeated in', 'reimplements', 'rewrites the same', 'inline copy',
  'same logic in', 'repeats the',
];

const DRY_POSITIVE = [
  'reuse', 'shared helper', 'extracted', 'single source', 'canonical',
  'centralized', 'refactored into', 'common utility', 'one authoritative',
];

const KISS_VIOLATIONS = [
  'microservices', 'distributed cache', 'message queue', 'event sourcing',
  'plugin framework', 'plugin architecture', 'config engine', 'factory for',
  'abstract base', 'dependency injection framework', 'over-engineer',
  'over-engineered', 'just in case', 'future-proof', 'extensible framework',
];

const KISS_POSITIVE = [
  'simple', 'simplest', 'single application', 'straightforward',
  'minimal', 'plain function', 'fewer moving parts', 'keep it simple',
];

const DYC_MISSING = [
  'no comments', 'no documentation', 'undocumented', 'no doc', 'unexplained',
  'magic number', 'obscure', 'unreadable', 'cryptic',
];

const DYC_POSITIVE = [
  'documented', 'comment explains why', 'docstring', 'rationale',
  'explains the why', 'intent documented', 'named clearly', 'jsdoc',
];

const YAGNI_VIOLATIONS = [
  'future features', 'hypothetical', 'speculative', 'in case we need',
  'for later', 'might need', 'potentially useful', 'future-proof',
  'build 12 extension', 'plugin system', 'will probably need',
  'plugin framework', 'plugin architecture', 'config engine', 'just in case',
  'extensible framework', 'factory for', 'abstract base',
  'dependency injection framework',
];

const YAGNI_POSITIVE = [
  'only what is required', 'current requirement', 'needed now',
  'minimal scope', 'surgical', 'no speculative',
];

export function auditCodePrinciples(input: CodePrinciplesInput): CodePrinciplesResult {
  const text = `${input.intent ?? ''} ${input.change}`.toLowerCase();
  const principles: PrincipleVerdict[] = [];

  const socScore = scorePattern(SOC_VIOLATIONS, [], text, 8);
  principles.push({ principle: 'soc', name: 'Separation of Concerns', score: socScore, flags: socScore < 7 ? ['architectural: one primary responsibility per module'] : [], reason: 'SOC is foundational — everything else depends on it' });

  const dryScore = scorePattern(DRY_VIOLATIONS, DRY_POSITIVE, text, 8, 3);
  principles.push({ principle: 'dry', name: "Don't Repeat Yourself", score: dryScore, flags: dryScore < 7 ? ['every piece of knowledge needs one authoritative representation'] : [], reason: 'DRY optimizes change management' });

  const kissScore = scorePattern(KISS_VIOLATIONS, KISS_POSITIVE, text, 8, 2);
  principles.push({ principle: 'kiss', name: 'Keep It Simple', score: kissScore, flags: kissScore < 7 ? ['complexity must be earned, not assumed'] : [], reason: 'complexity carries permanent cost' });

  const dycScore = scorePattern(DYC_MISSING, DYC_POSITIVE, text, 8, 2);
  principles.push({ principle: 'dyc', name: 'Document Your Code', score: dycScore, flags: dycScore < 7 ? ['document intent (why), not behavior (what)'] : [], reason: 'future developers include future you' });

  const yagniScore = scorePattern(YAGNI_VIOLATIONS, YAGNI_POSITIVE, text, 8, 2);
  principles.push({ principle: 'yagni', name: "You Aren't Gonna Need It", score: yagniScore, flags: yagniScore < 7 ? ['premature flexibility becomes unnecessary complexity'] : [], reason: 'implement what is required now; evolve when requirements appear' });

  const tradeOffs: TradeOffCheck[] = [
    {
      tradeOff: 'DRY vs KISS',
      guidance: 'Over-aggressive DRY creates abstractions harder to understand than the duplication they replace — small duplication is sometimes preferable to a poor abstraction.',
      triggered: dryScore < 7,
    },
    {
      tradeOff: 'YAGNI vs SOC',
      guidance: 'Design for extension (categories of change), but do not implement imaginary functionality.',
      triggered: yagniScore < 7 && socScore >= 7,
    },
    {
      tradeOff: 'Documentation vs self-documenting code',
      guidance: 'Excellent names reduce the need for comments; comments explain intent, assumptions, and constraints — not obvious behavior.',
      triggered: dycScore < 7,
    },
  ];

  const score = Math.round(principles.reduce((acc, p) => acc + p.score, 0) / principles.length);
  const hardViolation = principles.some((p) => p.score < 5);
  const recommendations: string[] = [];
  if (socScore < 7) recommendations.push('SOC: split modules so each has one primary responsibility');
  if (dryScore < 7) recommendations.push('DRY: centralize duplicated knowledge into one authoritative representation');
  if (kissScore < 7) recommendations.push('KISS: drop speculative machinery; choose the simplest solution that fully solves the problem');
  if (dycScore < 7) recommendations.push('DYC: document why, not what');
  if (yagniScore < 7) recommendations.push('YAGNI: remove speculative features; implement only current requirements');
  for (const t of tradeOffs) {
    if (t.triggered) recommendations.push(`Trade-off: ${t.tradeOff} — ${t.guidance}`);
  }

  return {
    verdict: score >= 7 && !hardViolation ? 'clean' : 'revise',
    principles,
    tradeOffs,
    recommendations,
    score,
  };
}

function scorePattern(
  violations: string[],
  positives: string[],
  text: string,
  base = 8,
  positiveBoost = 3,
): number {
  const vHits = violations.filter((v) => text.includes(v)).length;
  const pHits = positives.filter((p) => text.includes(p)).length;
  let score = base - vHits * 3;
  if (pHits > 0) score += Math.min(2, pHits);
  return Math.max(0, Math.min(10, score + (pHits > 0 ? positiveBoost : 0)));
}
