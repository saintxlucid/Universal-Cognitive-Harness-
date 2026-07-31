/**
 * Coding Principles Engine — evaluates an intended change against
 * UCH's four coding principles:
 *
 *   1. think-before-coding      — no silent assumptions, surface tradeoffs
 *   2. simplicity-first         — no speculative abstractions/bloat
 *   3. surgical-changes         — no drive-by edits or scope creep
 *   4. goal-driven-execution    — success criteria + verification loop
 *
 * Deterministic pattern-based evaluator (no LLM dependency). Returns a
 * per-principle pass/flags verdict plus a recommendation list.
 */

export type PrincipleName = 'think-before-coding' | 'simplicity-first' | 'surgical-changes' | 'goal-driven-execution';

export interface PrincipleVerdict {
  principle: PrincipleName;
  pass: boolean;
  flags: string[];
  reason: string;
}

export interface CodingPrinciplesInput {
  intent: string;
  proposedChange: string;
  /** Optional execution plan; steps containing verify/test/check markers count as a verification loop. */
  context?: { plan?: string[] };
}

export interface CodingPrinciplesResult {
  verdict: 'pass' | 'review';
  score: number;
  principles: PrincipleVerdict[];
  recommendations: string[];
}

const ASSUMPTION_MARKERS = [
  'i assume', 'assume', 'presumably', 'obviously', 'just fix', 'just make it',
  'simple fix', 'obviously it', 'should be trivial', 'no need to',
];

const BLOAT_MARKERS = [
  'just in case', 'flexibility', 'configurable generic', 'abstract base',
  'future-proof', 'generic wrapper', 'for later', 'extensible framework',
  'over-engineer', 'in case we need', 'plugin architecture',
];

const SCOPE_CREEP_MARKERS = [
  'while im at it', "while i'm at it", 'while i am at it', 'also fix', 'also clean',
  'also reformat', 'also refactor', 'also update the', 'while we are at it',
  'while were at it', 'by the way', 'additionally, fix',
];

const VERIFICATION_MARKERS = [
  'test', 'verify', 'verification', 'check', 'reproduce', 'assert',
  'validate inputs first', 'make them pass', 'run the tests', 'lint',
];

const SIMPLICITY_ANTI_PATTERNS = [
  'abstract base', 'generic wrapper', 'configurable', 'plugin', 'framework',
  'just in case', 'flexibility', 'factory for', 'base class',
];

/** True if the proposed change itself contains scope creep markers. */
function hasScopeCreep(change: string): boolean {
  const lower = change.toLowerCase();
  return SCOPE_CREEP_MARKERS.some((m) => lower.includes(m))
    || /reformat|clean up|refactor|restructure/.test(lower);
}

export class CodingPrinciplesEngine {
  evaluate(input: CodingPrinciplesInput): CodingPrinciplesResult {
    const intent = input.intent ?? '';
    const change = input.proposedChange ?? '';
    const intentLower = intent.toLowerCase();
    const changeLower = change.toLowerCase();

    const principles: PrincipleVerdict[] = [];

    // 1. Think before coding — silent assumptions.
    const assumptionFlags: string[] = [];
    if (ASSUMPTION_MARKERS.some((m) => intentLower.includes(m))) {
      assumptionFlags.push('silent-assumption');
    }
    if (/i (just )?need it (fast|asap|now)/.test(intentLower)) {
      assumptionFlags.push('urgency-over-clarity');
    }
    principles.push({
      principle: 'think-before-coding',
      pass: assumptionFlags.length === 0,
      flags: assumptionFlags,
      reason: assumptionFlags.length === 0
        ? 'No silent assumptions detected.'
        : 'The intent states an assumption instead of asking; surface it explicitly before coding.',
    });

    // 2. Simplicity first — bloat markers.
    const simplicityFlags: string[] = [];
    if (BLOAT_MARKERS.some((m) => intentLower.includes(m))) {
      simplicityFlags.push('speculative-abstraction');
    }
    if (SIMPLICITY_ANTI_PATTERNS.some((m) => changeLower.includes(m))) {
      simplicityFlags.push('overengineering');
    }
    principles.push({
      principle: 'simplicity-first',
      pass: simplicityFlags.length === 0,
      flags: simplicityFlags,
      reason: simplicityFlags.length === 0
        ? 'No speculative abstraction detected.'
        : 'The change introduces flexibility/abstraction that was not requested; write the minimum code that solves the problem.',
    });

    // 3. Surgical changes — scope creep.
    const surgicalFlags: string[] = [];
    if (SCOPE_CREEP_MARKERS.some((m) => intentLower.includes(m))) {
      surgicalFlags.push('scope-creep');
    }
    if (hasScopeCreep(change)) {
      surgicalFlags.push('unrelated-edits');
    }
    principles.push({
      principle: 'surgical-changes',
      pass: surgicalFlags.length === 0,
      flags: surgicalFlags,
      reason: surgicalFlags.length === 0
        ? 'Change scope is limited to the request.'
        : 'The change touches work outside the request; keep edits surgical.',
    });

    // 4. Goal-driven execution — success criteria + verification loop.
    const goalFlags: string[] = [];
    const plan = input.context?.plan ?? [];
    const hasPlanVerification = plan.some((step) => /verify|test|check|reproduce|assert/.test(step.toLowerCase()));
    if (!VERIFICATION_MARKERS.some((m) => (intentLower + ' ' + changeLower).includes(m)) && !hasPlanVerification) {
      goalFlags.push('vague-success-criteria');
    }
    if (!/verify|test|check/.test(changeLower) && !/verify|test|check/.test(intentLower) && !hasPlanVerification) {
      goalFlags.push('missing-verification-loop');
    }
    principles.push({
      principle: 'goal-driven-execution',
      pass: goalFlags.length === 0,
      flags: goalFlags,
      reason: goalFlags.length === 0
        ? 'Success criteria and a verification loop are present.'
        : 'Define success criteria and a way to verify them before executing.',
    });

    const failed = principles.filter((p) => !p.pass);
    const score = Number((1 - failed.length / principles.length).toFixed(2));
    const verdict = failed.length === 0 ? 'pass' : 'review';

    const recommendations: string[] = [];
    for (const p of failed) {
      recommendations.push(this.recommendationFor(p));
    }

    return { verdict, score, principles, recommendations };
  }

  private recommendationFor(p: PrincipleVerdict): string {
    switch (p.principle) {
      case 'think-before-coding':
        return 'State assumptions explicitly and ask about ambiguity before coding.';
      case 'simplicity-first':
        return 'Remove speculative abstractions; write the minimum code that solves the problem.';
      case 'surgical-changes':
        return 'Restrict edits to what the request requires; mention unrelated issues, do not fix them.';
      case 'goal-driven-execution':
        return 'Define success criteria, then write a verification loop (test/check) around them.';
    }
  }
}
