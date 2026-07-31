/**
 * EngineeringEvaluator — the unified engineering gate.
 *
 * Runs deterministic, zero-LLM gates against an evaluation target and
 * returns a structured review: findings per tier with severity,
 * evidence, suggestions, and a gate classification. Veto-capable
 * findings (pathological complexity, unmitigated failure surfaces)
 * hard-reject through the organic-score pipeline regardless of the
 * aggregate score.
 *
 * Layer 3 (LLM-assisted: product thinking, economics estimates, taste)
 * is not part of this module; it is an optional extension that records
 * explicit findings only (ADR-002 observable/private boundary).
 */

import { analyzeTarget } from './analyzer.js';
import { DomainRegistry } from './domains/index.js';
import { LawRegistry } from './laws/engineering-laws.js';
import type {
  EngineeringFinding,
  EngineeringReview,
  EvaluationTarget,
  JudgmentContext,
  LawFinding,
  Severity,
} from './types.js';

export interface EvaluatorConfig {
  /** Cap on findings returned (cheapest tiers win on truncation). */
  maxFindings?: number;
}

/* ------------------------------------------------------------------ */
/* Marker vocabularies (exported for tests and benchmark tuning).      */
/* ------------------------------------------------------------------ */

/** Singularity words: "a single X", "the only X", "sole X". */
export const SPOF_SINGULARITY = ['single', 'sole', 'only', 'standalone'];

/** Critical assets whose loss takes down the system. */
export const SPOF_ASSETS = [
  'database', 'db', 'server', 'broker', 'queue', 'gateway', 'cache', 'redis',
  'postgres', 'mysql', 'instance', 'datacenter', 'region', 'authorizer',
  'service', 'api',
];

/** Redundancy architecture: suppresses the singularity shape when present. */
export const SPOF_RECOVERY = [
  'replica', 'replicas', 'failover', 'standby', 'redundancy', 'redundant',
  'mirror', 'secondary', 'multi', 'cluster', 'backup',
];

/** Recovery words that become violations when negated ("no failover"). */
export const SPOF_NEGATED_RECOVERY = [
  'failover', 'redundancy', 'standby', 'replica', 'backup', 'mirror', 'secondary',
];

/** Failure-handling tokens that mark an I/O surface as mitigated. */
export const IO_MITIGATION = new Set([
  'timeout', 'retry', 'retries', 'retryable', 'backoff', 'jitter', 'fallback',
  'circuit', 'breaker', 'degraded', 'graceful', 'catch', 'resilient', 'standby',
  'replica', 'failover', 'deadline', 'abort', 'cache',
]);

const SEVERITY_ORDER: Record<Severity, number> = {
  blocking: 0,
  warning: 1,
  info: 2,
};

const SEVERITY_PENALTY: Record<Severity, number> = {
  blocking: 25,
  warning: 10,
  info: 2,
};

export class EngineeringEvaluator {
  private readonly maxFindings: number;

  constructor(
    private readonly domains: DomainRegistry,
    private readonly laws: LawRegistry,
    config: EvaluatorConfig = {},
  ) {
    this.maxFindings = config.maxFindings ?? 100;
  }

  evaluate(target: EvaluationTarget): EngineeringReview {
    const ctx = analyzeTarget(target);
    const findings: EngineeringFinding[] = [
      ...this.complexityGate(ctx),
      ...this.structureSmellsGate(ctx),
      ...this.couplingGate(ctx),
      ...this.spofGate(ctx),
      ...this.failureSurfacesGate(ctx),
      ...this.economicsGate(ctx),
      ...this.lawGate(ctx),
    ];

    findings.sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.tier.localeCompare(b.tier),
    );

    const capped = findings.slice(0, this.maxFindings);
    const score = this.score(capped);
    const tiers = new Set(capped.map((f) => f.tier)).size;
    const blocking = capped.filter((f) => f.severity === 'blocking').length;

    return {
      targetId: targetIdOf(target),
      findings: capped,
      score,
      summary: `${capped.length} finding(s) across ${tiers} tier(s); ${blocking} blocking. Score ${score}/100.`,
    };
  }

  /** Deterministic hash-based target id. */
  static targetId(target: EvaluationTarget): string {
    return targetIdOf(target);
  }

  private score(findings: EngineeringFinding[]): number {
    let s = 100;
    for (const f of findings) s -= SEVERITY_PENALTY[f.severity];
    return Math.max(0, Math.min(100, s));
  }

  /* ------------------------------------------------------------ */
  /* Tier I — complexity gate                                      */
  /* ------------------------------------------------------------ */

  private complexityGate(ctx: JudgmentContext): EngineeringFinding[] {
    const out: EngineeringFinding[] = [];
    const { nestedLoopPairs, arrayScansInLoop, maxNestingDepth, loopCount, stringConcatInLoop } =
      ctx.codeFacts;

    if (nestedLoopPairs >= 3 && arrayScansInLoop >= 2) {
      out.push(
        finding(
          'tier-01-cs',
          'blocking',
          'cs.complexity.time',
          `Nested loops (${nestedLoopPairs} pair(s)) with in-loop array scans (${arrayScansInLoop}) — cubic-range behavior; restructure before accepting.`,
          [`nested loop pairs: ${nestedLoopPairs}`, `in-loop array scans: ${arrayScansInLoop}`],
          ['Hoist scans out of loops; index once with a Map/Set; state the final complexity.'],
          'veto',
        ),
      );
    } else if (nestedLoopPairs >= 1 && loopCount >= 4) {
      out.push(
        finding(
          'tier-01-cs',
          'warning',
          'cs.complexity.time',
          `${loopCount} loops with ${nestedLoopPairs} nested pair(s) — potential quadratic behavior on large input; state the bounds.`,
          [`loops: ${loopCount}`, `nested pairs: ${nestedLoopPairs}`],
          ['Estimate worst-case input size; convert inner scans to hash lookups.'],
          'advisory',
        ),
      );
    }

    if (arrayScansInLoop >= 1) {
      out.push(
        finding(
          'tier-01-cs',
          'warning',
          'cs.complexity.time',
          `${arrayScansInLoop} in-loop array scan(s) (includes/indexOf/find/filter) — O(n) per iteration; use a Set/Map for membership.`,
          [`in-loop array scans: ${arrayScansInLoop}`],
          ['Replace in-loop membership scans with a hash set built once.'],
          'advisory',
        ),
      );
    }

    if (maxNestingDepth >= 4) {
      out.push(
        finding(
          'tier-01-cs',
          'warning',
          'cs.complexity.time',
          `Nesting depth ${maxNestingDepth} — cognitive complexity; extract guards or helper functions.`,
          [`max nesting depth: ${maxNestingDepth}`],
          ['Early-exit guards; extract nested blocks into named helpers.'],
          'advisory',
        ),
      );
    }

    if (stringConcatInLoop >= 1) {
      out.push(
        finding(
          'tier-01-cs',
          'info',
          'cs.data-structures.rope',
          `${stringConcatInLoop} string concatenation(s) inside loops — quadratic on large text; use a builder or array join.`,
          [`in-loop concat: ${stringConcatInLoop}`],
          ['Collect parts in an array and join; use rope-style structures for very large text.'],
          'advisory',
        ),
      );
    }

    return out;
  }

  /* ------------------------------------------------------------ */
  /* Tier I — data-structure smell gate                            */
  /* ------------------------------------------------------------ */

  private structureSmellsGate(ctx: JudgmentContext): EngineeringFinding[] {
    const out: EngineeringFinding[] = [];
    const { shiftUnshiftCount, loopCount } = ctx.codeFacts;

    if (shiftUnshiftCount >= 1 && loopCount >= 1) {
      out.push(
        finding(
          'tier-01-cs',
          'warning',
          'cs.data-structures.deque',
          `${shiftUnshiftCount} array shift/unshift in a looping context — O(n) per operation; use a deque or ring buffer.`,
          [`shift/unshift: ${shiftUnshiftCount}`, `loops: ${loopCount}`],
          ['Use a deque (or ring buffer) for FIFO workloads in hot paths.'],
          'advisory',
        ),
      );
    } else if (shiftUnshiftCount >= 2) {
      out.push(
        finding(
          'tier-01-cs',
          'info',
          'cs.data-structures.deque',
          `${shiftUnshiftCount} array shift/unshift calls — O(n) each; consider a deque or ring buffer.`,
          [`shift/unshift: ${shiftUnshiftCount}`],
          ['Use a deque (or ring buffer) for FIFO workloads.'],
          'advisory',
        ),
      );
    }

    return out;
  }

  /* ------------------------------------------------------------ */
  /* Tier II — coupling gate                                       */
  /* ------------------------------------------------------------ */

  private couplingGate(ctx: JudgmentContext): EngineeringFinding[] {
    const out: EngineeringFinding[] = [];
    const { filesTouched } = ctx.diffStats;
    const { externalImports, importCount } = ctx.codeFacts;

    if (filesTouched >= 8) {
      out.push(
        finding(
          'tier-02-se',
          'warning',
          'se.change-amplification',
          `${filesTouched} files touched by one change — change amplification; one logical edit is rippling too wide.`,
          [`files touched: ${filesTouched}`],
          ['Shrink the change surface: shared helpers, stable boundaries, less duplication.'],
          'advisory',
        ),
      );
    } else if (filesTouched >= 5) {
      out.push(
        finding(
          'tier-02-se',
          'info',
          'se.change-amplification',
          `${filesTouched} files touched — check whether one logical change really needs this many edit sites.`,
          [`files touched: ${filesTouched}`],
          ['Ask "how many files does a typical change touch?" and shrink the answer.'],
          'advisory',
        ),
      );
    }

    if (externalImports >= 8) {
      out.push(
        finding(
          'tier-02-se',
          'warning',
          'se.coupling',
          `${externalImports} external import site(s) — high fan-out to the outside world; keep dependencies stable and narrow.`,
          [`external imports: ${externalImports}`, `imports total: ${importCount}`],
          ['Prefer stable abstractions at boundaries; document the exit path per major dependency.'],
          'advisory',
        ),
      );
    } else if (externalImports >= 5) {
      out.push(
        finding(
          'tier-02-se',
          'info',
          'se.coupling',
          `${externalImports} external import site(s) — moderate coupling; verify each dependency is narrow and stable.`,
          [`external imports: ${externalImports}`],
          ['Depend on stable, narrow interfaces; isolate volatile dependencies.'],
          'advisory',
        ),
      );
    }

    return out;
  }

  /* ------------------------------------------------------------ */
  /* Tier III — SPOF gate (constitution-anchored veto)             */
  /* ------------------------------------------------------------ */

  private spofGate(ctx: JudgmentContext): EngineeringFinding[] {
    if (ctx.kind === 'code') return [];
    const t = new Set(ctx.tokens);

    const hasSingularity = SPOF_SINGULARITY.some((w) => t.has(w));
    const hasAsset = SPOF_ASSETS.some((w) => t.has(w));
    const hasNegatedRecovery =
      t.has('no') && SPOF_NEGATED_RECOVERY.some((w) => t.has(w));
    const hasRecovery = SPOF_RECOVERY.some((w) => t.has(w));

    // Two shapes: "a single <critical asset> …" or "no <recovery architecture>".
    const spof = (hasSingularity && hasAsset) || hasNegatedRecovery;
    if (!spof) return [];
    // Positive redundancy elsewhere suppresses the singularity shape.
    if (hasRecovery && !hasNegatedRecovery) return [];

    return [
      finding(
        'tier-03-systems',
        'blocking',
        'sys.spof',
        'Single point of failure: a critical component is described without redundancy or an exit path.',
        [
          hasSingularity && hasAsset ? 'singularity + critical asset' : 'negated recovery architecture',
        ],
        ['State the redundancy model (replicas, failover, standby) or the degraded mode if the component dies.'],
        'veto',
      ),
    ];
  }

  /* ------------------------------------------------------------ */
  /* Tier III — failure-surface gate                               */
  /* ------------------------------------------------------------ */

  private failureSurfacesGate(ctx: JudgmentContext): EngineeringFinding[] {
    const out: EngineeringFinding[] = [];
    const f = ctx.codeFacts;
    const mitigated = ctx.tokens.some((t) => IO_MITIGATION.has(t));

    if (f.networkAccess) {
      out.push(
        finding(
          'tier-03-systems',
          'warning',
          'sys.failure-propagation',
          'Network I/O present — name the failure mode for: connection loss, timeout, and dependency outage.',
          [`I/O sites: ${f.rawIoCount}`],
          ['Define timeout + error behavior per call; fallbacks for degraded modes.'],
          'advisory',
        ),
      );
      if (f.retryCount > 0) {
        out.push(
          finding(
            'tier-03-systems',
            'warning',
            'sys.retry-amplification',
            `${f.retryCount} retry mention(s) with network I/O — cap depth, add jittered backoff, bound fan-out.`,
            [`retry mentions: ${f.retryCount}`],
            ['Exponential backoff with jitter; per-layer retry caps; circuit breakers.'],
            'advisory',
          ),
        );
      }
      if (!mitigated) {
        out.push(
          finding(
            'tier-08-failure',
            'blocking',
            'failure.network-loss',
            'Network I/O with no recovery path in the change — connection loss is an unrecovered failure mode.',
            [`I/O sites: ${f.rawIoCount}`],
            ['Add timeout + retry/backoff or fallback; name what happens when the network disappears.'],
            'veto',
          ),
        );
      }
    }

    if (f.databaseAccess) {
      out.push(
        finding(
          'tier-03-systems',
          'warning',
          'sys.failure-propagation',
          'Database I/O present — define behavior when the DB stalls (timeout, pool exhaustion, read replica fallback).',
          [`I/O sites: ${f.rawIoCount}`],
          ['Bound the pool, set statement timeouts, and define a degraded mode.'],
          'advisory',
        ),
      );
      if (!mitigated) {
        out.push(
          finding(
            'tier-08-failure',
            'blocking',
            'failure.db-stall',
            'Database I/O with no recovery path in the change — a stalled DB is an unrecovered failure mode.',
            [`I/O sites: ${f.rawIoCount}`],
            ['Set statement timeouts, bound the pool, and define behavior when the DB stalls.'],
            'veto',
          ),
        );
      }
    }

    if (f.fileSystemAccess) {
      out.push(
        finding(
          'tier-03-systems',
          'info',
          'sys.graceful-degradation',
          'Filesystem I/O present — plan the disk-full and permission-denied paths explicitly.',
          [`I/O sites: ${f.rawIoCount}`],
          ['Surface write failures; avoid buffering unbounded data before a flush.'],
          'advisory',
        ),
      );
    }

    if (f.clockAccess) {
      out.push(
        finding(
          'tier-03-systems',
          'info',
          'sys.failure-propagation',
          'Clock/time usage present — verify monotonic sources for durations and treat wall-clock as untrustworthy.',
          ['Date.now / new Date / timers detected'],
          ['Use monotonic clocks for intervals; never use wall-clock for ordering.'],
          'advisory',
        ),
      );
    }

    if (f.parallelCalls >= 1 && f.retryCount === 0) {
      out.push(
        finding(
          'tier-03-systems',
          'info',
          'sys.fault-isolation',
          `${f.parallelCalls} parallel call site(s) — handle partial failure: one slow branch must not stall the aggregate.`,
          [`parallel calls: ${f.parallelCalls}`],
          ['Per-branch timeouts; Promise.allSettled with partial-failure handling.'],
          'advisory',
        ),
      );
    }

    return out;
  }

  /* ------------------------------------------------------------ */
  /* Tier V — economics gate                                       */
  /* ------------------------------------------------------------ */

  private economicsGate(ctx: JudgmentContext): EngineeringFinding[] {
    const out: EngineeringFinding[] = [];
    const d = ctx.diffStats;
    const f = ctx.codeFacts;

    if (d.newFiles >= 5) {
      out.push(
        finding(
          'tier-05-economics',
          'info',
          'econ.build-vs-buy',
          `${d.newFiles} new files — greenfield-sized addition; run an explicit build-vs-buy and lifetime-cost check.`,
          [`new files: ${d.newFiles}`],
          ['Estimate build + maintenance + ops cost vs. existing libraries/services.'],
          'advisory',
        ),
      );
    }

    if (f.externalImports >= 10) {
      out.push(
        finding(
          'tier-05-economics',
          'info',
          'econ.vendor-lock-in',
          `${f.externalImports} external imports — evaluate dependency exit cost and lock-in before deepening.`,
          [`external imports: ${f.externalImports}`],
          ['Prefer standard interfaces; document the exit path per major dependency.'],
          'advisory',
        ),
      );
    }

    if (d.linesAdded >= 400) {
      out.push(
        finding(
          'tier-05-economics',
          'info',
          'econ.maintenance-cost',
          `${d.linesAdded} lines added — every line carries lifetime reading/maintenance cost; split or simplify if feasible.`,
          [`lines added: ${d.linesAdded}`],
          ['Review for duplication and extractable modules; prefer small, reviewable changes.'],
          'advisory',
        ),
      );
    }

    return out;
  }

  /* ------------------------------------------------------------ */
  /* Tier VI — law gate                                            */
  /* ------------------------------------------------------------ */

  private lawGate(ctx: JudgmentContext): EngineeringFinding[] {
    return this.laws.evaluate(ctx).map((law: LawFinding) =>
      finding(
        'tier-06-laws',
        law.severity,
        law.lawId,
        law.message,
        law.evidence,
        law.tradeoffs,
        'advisory',
      ),
    );
  }
}

function finding(
  tier: EngineeringFinding['tier'],
  severity: Severity,
  conceptId: string,
  message: string,
  evidence: string[],
  suggestion: string[],
  gate: 'veto' | 'advisory',
): EngineeringFinding {
  return { tier, severity, conceptId, message, evidence, suggestion, gate };
}

function targetIdOf(target: EvaluationTarget): string {
  const text = target.kind === 'code' ? target.diff : target.text;
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  }
  return `${target.kind}-${h.toString(16).padStart(8, '0')}`;
}
