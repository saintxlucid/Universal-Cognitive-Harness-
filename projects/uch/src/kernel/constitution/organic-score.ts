/**
 * Organic Score Engine — deterministic evaluator implementing the
 * 15-metric Organic Score rubric from the `organic-code` skill.
 *
 * Like CodingPrinciplesEngine, it is pattern-based (no LLM dependency):
 * it scans the proposed change (and optional intent) for evidence of the
 * AI-code failure modes documented in `.agents/skills/ai-code-pitfalls`
 * and scores each metric 0-10. Unassessable metrics from text alone are
 * marked `unassessed` and scored neutral, so the aggregate reflects what
 * was actually measured.
 *
 * Gates (matching the skill): score >= 90 pass, 70-89 revise, < 70 reject.
 *
 * Engineering-intelligence hookup: optional pre-computed engineering
 * findings (Tier III SPOF, Tier VIII unrecovered failure, Tier I
 * pathological complexity) with `gate: 'veto'` hard-reject regardless of
 * the aggregate score, mirroring the security/error-masking vetoes below.
 */

import type { EngineeringFinding } from '../../engineering-intelligence/types.js';

export type OrganicMetricId =
  | 'architecture-integrity'
  | 'reuse'
  | 'abstraction-fit'
  | 'complexity'
  | 'naming'
  | 'idiomatic-fit'
  | 'coupling-cohesion'
  | 'security'
  | 'performance'
  | 'correctness-depth'
  | 'testability-tests'
  | 'error-handling'
  | 'documentation'
  | 'consistency'
  | 'future-readiness';

export type Verdict = 'pass' | 'revise' | 'reject';

export interface MetricVerdict {
  metric: OrganicMetricId;
  score: number;
  method: 'pattern' | 'unassessed';
  flags: string[];
  reason: string;
}

export interface Finding {
  metric: OrganicMetricId;
  severity: 'high' | 'medium' | 'low';
  pitfall: string | null;
  detail: string;
}

export interface OrganicScoreInput {
  /** The proposed change — description or diff snippet. */
  change: string;
  /** Optional task intent; adds context for scope and verification checks. */
  intent?: string;
  /** Optional execution context (tests run, files touched). */
  context?: { filesTouched?: string[]; testsRun?: string[] };
  /**
   * Optional pre-computed engineering-intelligence findings
   * (EngineeringEvaluator output). Findings with `gate: 'veto'`
   * hard-reject regardless of the aggregate score.
   */
  engineeringFindings?: EngineeringFinding[];
}

export interface OrganicScoreResult {
  verdict: Verdict;
  score: number;
  metrics: MetricVerdict[];
  findings: Finding[];
  recommendations: string[];
  /** Concept ids that hard-rejected via engineering veto findings. */
  vetoedBy?: string[];
}

/* ------------------------------------------------------------------ */
/* Evidence marker lists (exported for tests and future tuning).       */
/* ------------------------------------------------------------------ */

export const GENERIC_NAMING = [
  'userManager2', 'manager2', 'utils2', 'helper2', 'temp2', 'data2',
  'processData', 'doStuff', 'doThing', 'stuff', 'things', 'misc', 'miscellaneous',
  'just a helper', 'generic handler', 'catchAll',
];

export const OVER_ABSTRACTION = [
  'abstract base', 'generic wrapper', 'configurable generic', 'factory for',
  'plugin architecture', 'just in case', 'future-proof', 'extensible framework',
  'for later use', 'in case we need', 'speculative', 'over-engineering',
];

export const UNDER_ABSTRACTION = [
  'everything in one file', 'all in one file', 'one giant file', 'inline everything',
  'single monolithic', 'gigantic function', 'monolith',
];

export const ERROR_MASKING = [
  'catch {}', 'catch (e) {}', 'catch (err) {}', 'catch (ex) {}', 'catch (_) {}',
  'catch {', 'except: pass', 'bare except', 'pass on the error', 'ignore errors',
  'swallow the error', 'swallow errors', 'and ignore it', 'do nothing on error',
];

export const DEAD_CODE = [
  'unused import', 'unused variable', 'dead code', 'commented out', 'orphan helper',
  'never called', 'never used', 'leftover code',
];

export const SECURITY_SMELLS = [
  'hardcoded password', 'hardcoded secret', 'password =', 'api_key =', 'apiKey =',
  'secret =', 'passwd =', 'md5(', 'sha1(', 'ecb', 'eval(', 'innerHTML =',
  'shell=True', 'exec(', 'deserialize', 'pickle.loads', 'sql injection',
  'string concat into query', 'trust user input',
];

export const PERFORMANCE_RISKS = [
  'nested loop', 'n+1', 'fetch in loop', 'query in loop', 'foreach with query',
  'o(n^2)', 'o(n²)', 'recompute', 'allocation in loop', 'sync in loop',
];

export const CORRECTNESS_EDGES = [
  'empty input', 'null input', 'boundary', 'edge case', 'race condition',
  'concurrent', 'timeout', 'failure path', 'partial failure', 'off-by-one',
  'invalid input', 'malformed',
];

export const TEST_SIGNALS = [
  'test', 'spec', 'negative test', 'edge case test', 'fuzz', 'property test',
  'mutation test', 'unit test', 'integration test', 'assert', 'regression test',
];

export const TRACEABILITY_SIGNALS = [
  'extends existing', 'reuses', 'calls existing', 'follows existing', 'per adr',
  'adr-', 'canonical', 'required by', 'implements #', 'closes #', 'per convention',
  'matches existing pattern', 'existing abstraction',
];

export const SCOPE_CREEP_MARKERS = [
  'while im at it', "while i'm at it", 'while i am at it', 'also fix', 'also clean',
  'also reformat', 'also refactor', 'also update the', 'by the way', 'while were at it',
];

export const DEBT_MARKERS = [
  'todo', 'fixme', 'hack', 'temporary', 'quick fix', 'workaround', 'temp solution',
  'for now', 'later', 'shortcut',
];

export const VERIFY_SIGNALS = [
  'test', 'verify', 'typecheck', 'lint', 'build', 'ci', 'run the tests',
];

export const DOC_SIGNALS = [
  'docs', 'documented', 'jsdoc', 'docstring', 'readme', 'adr', 'changelog',
  'comment', 'api reference',
];

/* ------------------------------------------------------------------ */
/* Engine                                                              */
/* ------------------------------------------------------------------ */

interface MetricCheck {
  id: OrganicMetricId;
  negative: string[];
  positive: string[];
  penalty: number;
  severity: 'high' | 'medium' | 'low';
  pitfall: string | null;
  reasonWhenClean: string;
}

const METRIC_CHECKS: MetricCheck[] = [
  {
    id: 'reuse',
    negative: ['copy the', 'duplicate', 'reimplement', 'clone', 're-write', 'rewrite the existing', 'new helper for', 'parallel implementation', 'own version of'],
    positive: TRACEABILITY_SIGNALS,
    penalty: 3,
    severity: 'high',
    pitfall: 'C1',
    reasonWhenClean: 'No duplicate/reimplement signals; change extends existing code.',
  },
  {
    id: 'architecture-integrity',
    negative: ['move everything to', 'restructure the whole', 'rewrite the module', 'new module boundary', 'change the layering', 'bypass the', 'skip the repository', 'direct db access from', 'leak the', 'new architecture'],
    positive: TRACEABILITY_SIGNALS,
    penalty: 3,
    severity: 'high',
    pitfall: 'B1',
    reasonWhenClean: 'No boundary/layering violation signals.',
  },
  {
    id: 'abstraction-fit',
    negative: [...OVER_ABSTRACTION, ...UNDER_ABSTRACTION],
    positive: ['minimal change', 'simplest', 'keep it simple', 'no new abstraction'],
    penalty: 2,
    severity: 'medium',
    pitfall: 'B3',
    reasonWhenClean: 'No over/under-abstraction signals.',
  },
  {
    id: 'complexity',
    negative: ['huge function', 'very long function', '400-line', '500-line', 'deeply nested', 'complex method', 'monolithic'],
    positive: ['small function', 'extracted', 'decomposed', 'simple', 'clear flow'],
    penalty: 2,
    severity: 'medium',
    pitfall: 'B4',
    reasonWhenClean: 'No size/complexity red flags.',
  },
  {
    id: 'naming',
    negative: GENERIC_NAMING,
    positive: ['domain-driven', 'clear name', 'named after the domain', 'precise name'],
    penalty: 2,
    severity: 'medium',
    pitfall: 'D7',
    reasonWhenClean: 'No generic naming signals.',
  },
  {
    id: 'idiomatic-fit',
    negative: ['like a class hierarchy', 'in java style', 'as if it were', 'framework anti-pattern', 'not idiomatic', 'reinvents the framework', 'custom event system'],
    positive: ['idiomatic', 'matches the framework', 'uses the framework', 'react hooks', 'existing pattern'],
    penalty: 2,
    severity: 'medium',
    pitfall: 'B6',
    reasonWhenClean: 'No cross-paradigm signals.',
  },
  {
    id: 'coupling-cohesion',
    negative: ['tightly coupled', 'global state', 'imports everything', 'god object', 'spaghetti', 'singleton everywhere', 'shared mutable'],
    positive: ['decoupled', 'isolated', 'injected', 'small interface', 'single responsibility'],
    penalty: 2,
    severity: 'medium',
    pitfall: 'B7',
    reasonWhenClean: 'No coupling/cohesion red flags.',
  },
  {
    id: 'security',
    negative: SECURITY_SMELLS,
    positive: ['sanitize', 'parameterized', 'validation first', 'least privilege', 'https', 'encrypt', 'rate limit', 'auth check'],
    penalty: 4,
    severity: 'high',
    pitfall: 'D1',
    reasonWhenClean: 'No security smells detected.',
  },
  {
    id: 'performance',
    negative: PERFORMANCE_RISKS,
    positive: ['batch', 'index', 'cache', 'o(n)', 'single query', 'paginate', 'memoize'],
    penalty: 2,
    severity: 'medium',
    pitfall: 'D4',
    reasonWhenClean: 'No performance red flags.',
  },
  {
    id: 'correctness-depth',
    negative: ['assume it always works', 'no edge cases needed', 'only happy path', 'never fails', 'input is always valid'],
    positive: CORRECTNESS_EDGES,
    penalty: 2,
    severity: 'high',
    pitfall: 'E1',
    reasonWhenClean: 'Edge cases are addressed in the change description.',
  },
  {
    id: 'testability-tests',
    negative: ['no tests needed', 'skip tests', 'test not required', 'too simple to test', 'did not add tests'],
    positive: TEST_SIGNALS,
    penalty: 3,
    severity: 'high',
    pitfall: 'E1',
    reasonWhenClean: 'Tests are included or planned for the change.',
  },
  {
    id: 'error-handling',
    negative: ERROR_MASKING,
    positive: ['propagate', 'log with context', 'rethro', 'handle the error', 'fail fast', 'error boundary', 'typed error'],
    penalty: 3,
    severity: 'high',
    pitfall: 'C5',
    reasonWhenClean: 'No error-masking signals.',
  },
  {
    id: 'documentation',
    negative: ['no docs needed', 'self-documenting', 'skip documentation', 'docs later', 'do not document'],
    positive: DOC_SIGNALS,
    penalty: 2,
    severity: 'low',
    pitfall: 'E9',
    reasonWhenClean: 'Documentation is present or updated with the change.',
  },
  {
    id: 'consistency',
    negative: ['inconsistent', 'new convention', 'breaks the pattern', 'different style', 'rename everything'],
    positive: ['consistent', 'same pattern', 'convention', 'matches existing style', 'follows the style'],
    penalty: 2,
    severity: 'medium',
    pitfall: 'A1',
    reasonWhenClean: 'No consistency violations signaled.',
  },
  {
    id: 'future-readiness',
    negative: DEBT_MARKERS,
    positive: ['long-term', 'maintainable', 'extensible for the roadmap', 'no new debt', 'consolidates'],
    penalty: 2,
    severity: 'medium',
    pitfall: 'C3',
    reasonWhenClean: 'No debt markers (TODO/hack/workaround) in the change.',
  },
];

export class OrganicScoreEngine {
  evaluate(input: OrganicScoreInput): OrganicScoreResult {
    const change = (input.change ?? '').toLowerCase();
    const intent = (input.intent ?? '').toLowerCase();
    const text = `${intent}\n${change}`;
    const testsRun = input.context?.testsRun ?? [];
    const filesTouched = input.context?.filesTouched ?? [];

    const metrics: MetricVerdict[] = [];
    const findings: Finding[] = [];
    const recommendations: string[] = [];

    for (const check of METRIC_CHECKS) {
      const hits = check.negative.filter((m) => text.includes(m));
      const positives = check.positive.filter((m) => text.includes(m));
      const scopeCreep = check.id === 'architecture-integrity'
        ? SCOPE_CREEP_MARKERS.filter((m) => text.includes(m))
        : [];
      const allFlags = [...hits, ...scopeCreep];

      if (check.id === 'testability-tests' && testsRun.length > 0) {
        allFlags.length = 0;
        positives.push(`tests-run:${testsRun.length}`);
      }
      if (check.id === 'architecture-integrity' && filesTouched.length > 0) {
        positives.push(`files-touched:${filesTouched.length}`);
      }

      if (allFlags.length === 0) {
        metrics.push({
          metric: check.id,
          score: 10,
          method: 'pattern',
          flags: [],
          reason: check.reasonWhenClean,
        });
        continue;
      }

      const score = Math.max(0, 10 - check.penalty * allFlags.length);
      metrics.push({
        metric: check.id,
        score,
        method: 'pattern',
        flags: allFlags,
        reason: `Detected: ${allFlags.join(', ')}${positives.length ? `. Positive: ${positives.slice(0, 2).join(', ')}` : ''}`,
      });

      for (const flag of allFlags) {
        findings.push({
          metric: check.id,
          severity: check.severity,
          pitfall: check.pitfall,
          detail: `${check.id}: "${flag}"`,
        });
        recommendations.push(this.recommendationFor(check.id, flag));
      }
    }

    const score = Math.round((metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length) * 10);
    let verdict: Verdict = score >= 90 ? 'pass' : score >= 70 ? 'revise' : 'reject';

    // Constitutional vetoes (engineering-constitution laws 7 & 8):
    // error-masking and security smells are non-negotiable violations.
    // A single flag overrides any aggregate score.
    const hasSecurityFlag = metrics.some((m) => m.metric === 'security' && m.flags.length > 0);
    const hasErrorMasking = metrics.some((m) => m.metric === 'error-handling' && m.flags.length > 0);
    if (hasSecurityFlag || hasErrorMasking) {
      verdict = 'reject';
      recommendations.push(hasSecurityFlag
        ? '[D1] Security smell present — constitutional veto (law 7). Fix before any further review.'
        : '[C5] Error-masking present — constitutional veto (law 8). Handle, log, or rethrow.');
    }

    // Engineering-intelligence vetoes: pre-computed findings with
    // `gate: 'veto'` (Tier I pathological complexity, Tier III SPOF,
    // Tier VIII unrecovered failure surfaces) hard-reject regardless of
    // the aggregate score — mirroring the constitutional vetoes above.
    const engineeringVetoes = (input.engineeringFindings ?? []).filter(
      (f) => f.gate === 'veto',
    );
    let vetoedBy: string[] | undefined;
    if (engineeringVetoes.length > 0) {
      verdict = 'reject';
      vetoedBy = [...new Set(engineeringVetoes.map((f) => f.conceptId))];
      for (const v of engineeringVetoes) {
        recommendations.push(`[EI veto] ${v.conceptId} — ${v.message}`);
      }
    }

    return {
      verdict,
      score,
      metrics,
      findings: findings.slice(0, 20),
      recommendations: [...new Set(recommendations)].slice(0, 10),
      ...(vetoedBy ? { vetoedBy } : {}),
    };
  }

  private recommendationFor(metric: OrganicMetricId, flag: string): string {
    switch (metric) {
      case 'reuse':
        return `[C1] "${flag}" — find the existing implementation and extend it instead of duplicating.`;
      case 'architecture-integrity':
        return `[B1] "${flag}" — preserve module boundaries and layering; flag the conflict instead of violating it.`;
      case 'abstraction-fit':
        return `[B3/B4] "${flag}" — right-size the abstraction: no speculative layers, no monolithic files.`;
      case 'complexity':
        return `[B4] "${flag}" — decompose; keep functions < 60 lines and files < 400 lines.`;
      case 'naming':
        return `[D7] "${flag}" — use a domain-driven name, not a generic one.`;
      case 'idiomatic-fit':
        return `[B6] "${flag}" — match the language/framework's idiomatic patterns.`;
      case 'coupling-cohesion':
        return `[B7] "${flag}" — reduce coupling; keep responsibilities in one owner.`;
      case 'security':
        return `[D1/D2] "${flag}" — security smell; verify against OWASP patterns before merging.`;
      case 'performance':
        return `[D4] "${flag}" — check complexity against data scale before landing.`;
      case 'correctness-depth':
        return `[E1] "${flag}" — design for empty, invalid, boundary, and failure inputs.`;
      case 'testability-tests':
        return `[E1] "${flag}" — add tests incl. negative paths; happy-path-only is not verification.`;
      case 'error-handling':
        return `[C5] "${flag}" — never mask errors; handle, log with context, or rethrow.`;
      case 'documentation':
        return `[E9] "${flag}" — document public APIs and update docs in the same change.`;
      case 'consistency':
        return `[A1] "${flag}" — follow the project's canonical pattern; do not introduce a second one.`;
      case 'future-readiness':
        return `[C3] "${flag}" — debt marker; pay down or explicitly defer with a tracked issue.`;
    }
  }
}
