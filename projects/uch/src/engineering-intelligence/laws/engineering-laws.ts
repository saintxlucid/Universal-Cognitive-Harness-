/**
 * Tier VI — Engineering Laws as first-class reasoning primitives.
 *
 * Not text, not prompts: typed objects with an applicability predicate
 * (is this law relevant?) and a trigger check (what does it say about
 * this situation?). The catalog follows the empirical engineering-laws
 * canon (laws-of-software-engineering.com) plus the classic laws from
 * software engineering literature.
 */

import type { EngineeringLaw, JudgmentContext, LawFinding } from '../types.js';

const has = (ctx: JudgmentContext, terms: string[]): boolean =>
  terms.some((t) => ctx.tokens.includes(t));

const evidenceFor = (ctx: JudgmentContext, terms: string[]): string[] => {
  const found: string[] = [];
  const lines = ctx.text.split('\n');
  for (const term of terms) {
    const line = lines.find((l) => l.toLowerCase().includes(term));
    if (line) found.push(`"${line.trim().slice(0, 120)}"`);
    if (found.length >= 3) break;
  }
  return found;
};

export const ENGINEERING_LAWS: EngineeringLaw[] = [
  {
    id: 'law.amdahl',
    name: "Amdahl's Law",
    statement:
      'Speedup is bounded by the serial fraction: parallelizing p% of work caps speedup at 1/(1−p) even with infinite cores.',
    domain: 'system',
    applicability: (ctx) =>
      ctx.codeFacts.parallelCalls > 0 || has(ctx, ['parallel', 'concurrent', 'worker', 'threads']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      if (ctx.codeFacts.parallelCalls > 0 || has(ctx, ['parallel', 'concurrent', 'worker', 'threads'])) {
        findings.push({
          lawId: 'law.amdahl',
          severity: 'info',
          message:
            'Parallelism introduced — verify the serial fraction and coordination overhead; expected speedup is 1/(1−p), not N.',
          evidence: ctx.codeFacts.parallelCalls > 0
            ? [`${ctx.codeFacts.parallelCalls} parallel call site(s)`]
            : evidenceFor(ctx, ['parallel', 'concurrent', 'worker', 'threads']),
          tradeoffs: ['Parallelism still wins when the serial fraction is small and coordination is cheap.'],
        });
      }
      return findings;
    },
    tradeoffs: ['None — the bound is mathematical.'],
    provenance: ['Amdahl, Validity of the Single Processor Approach (1967)'],
  },
  {
    id: 'law.little',
    name: "Little's Law",
    statement:
      'The average number of items in a stable queue equals arrival rate × average wait time (L = λW).',
    domain: 'system',
    applicability: (ctx) =>
      has(ctx, ['queue', 'backlog', 'batch', 'buffer', 'pending', 'latency', 'throughput']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      const mentions = evidenceFor(ctx, ['queue', 'backlog', 'pending', 'buffer']);
      if (mentions.length > 0) {
        findings.push({
          lawId: 'law.little',
          severity: 'info',
          message:
            'Queueing design present — state the arrival rate, queue depth, and wait time explicitly; any two determine the third.',
          evidence: mentions,
          tradeoffs: ['Bounded queues with backpressure are a deliberate violation of "keep everything buffered".'],
        });
      }
      return findings;
    },
    tradeoffs: ['Bounded queues and dropping work are deliberate exceptions with explicit limits.'],
    provenance: ['Little, A Proof for the Queuing Formula (1961); laws-of-software-engineering.com'],
  },
  {
    id: 'law.goodhart',
    name: "Goodhart's Law",
    statement:
      'When a measure becomes a target, it ceases to be a good measure — metric optimization distorts the underlying value.',
    domain: 'project',
    applicability: (ctx) =>
      has(ctx, ['metric', 'kpi', 'sla', 'target', 'coverage', 'score', 'dashboard']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      const mentions = evidenceFor(ctx, ['metric', 'kpi', 'sla', 'coverage', 'score']);
      if (mentions.length > 0) {
        findings.push({
          lawId: 'law.goodhart',
          severity: 'warning',
          message:
            'Metric-driven change — pair every target with the value it proxies, and watch for gaming paths that hit the number without the value.',
          evidence: mentions,
          tradeoffs: ['Metrics still work as guardrails when combined with sampling and qualitative review.'],
        });
      }
      return findings;
    },
    tradeoffs: ['Composite metrics with random auditing resist gaming.'],
    provenance: ['Strathern, "Improving ratings" (1997); Goodhart (1975); laws-of-software-engineering.com'],
  },
  {
    id: 'law.conway',
    name: "Conway's Law",
    statement:
      'Systems mirror the communication structure of the organization that builds them.',
    domain: 'team',
    applicability: (ctx) =>
      has(ctx, ['team', 'org', 'ownership', 'squad', 'group', 'platform team']) &&
      has(ctx, ['service', 'module', 'architecture', 'boundary', 'api']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      const mentions = evidenceFor(ctx, ['team', 'ownership', 'boundary', 'service']);
      if (mentions.length > 0) {
        findings.push({
          lawId: 'law.conway',
          severity: 'info',
          message:
            'Team/architecture coupling present — align service boundaries with team ownership, or budget explicit interface governance.',
          evidence: mentions,
          tradeoffs: ['Contract-first interfaces and API governance decouple architecture from org structure.'],
        });
      }
      return findings;
    },
    tradeoffs: ['Well-governed shared interfaces survive Conway mismatches.'],
    provenance: ['Conway, How Do Committees Invent? (1968)'],
  },
  {
    id: 'law.brooks',
    name: "Brooks' Law",
    statement:
      'Adding people to a late project makes it later — ramp-up, communication overhead, and re-partitioning costs dominate.',
    domain: 'schedule',
    applicability: (ctx) =>
      has(ctx, ['late', 'behind schedule', 'headcount', 'more people', 'hiring', 'add staff', 'deadline']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      const mentions = evidenceFor(ctx, ['late', 'deadline', 'headcount', 'people']);
      if (mentions.length > 0) {
        findings.push({
          lawId: 'law.brooks',
          severity: 'warning',
          message:
            'Schedule pressure with a staffing response — adding people now mostly adds communication cost; reduce scope or extend the date instead.',
          evidence: mentions,
          tradeoffs: ['Parallelizable, well-specified work can absorb new people without the usual penalty.'],
        });
      }
      return findings;
    },
    tradeoffs: ['Greenfield parallel workstreams with clean interfaces.'],
    provenance: ['Brooks, The Mythical Man-Month (1975)'],
  },
  {
    id: 'law.gall',
    name: "Gall's Law",
    statement:
      'A complex system that works is invariably found to have evolved from a simple system that worked; complex systems built from scratch do not work.',
    domain: 'system',
    applicability: (ctx) =>
      ctx.diffStats.newFiles >= 5 || has(ctx, ['rewrite', 'from scratch', 'greenfield', 'new platform', 'new architecture']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      if (ctx.diffStats.newFiles >= 5) {
        findings.push({
          lawId: 'law.gall',
          severity: 'warning',
          message:
            `${ctx.diffStats.newFiles} new files at once — large greenfield additions rarely work on the first design; grow from a working vertical slice.`,
          evidence: [`${ctx.diffStats.newFiles} new files`],
          tradeoffs: ['Prototypes and spikes are exempt — they are meant to be thrown away.'],
        });
      }
      return findings;
    },
    tradeoffs: ['Exploratory spikes are exempt by design.'],
    provenance: ['Gall, Systemantics (1975)'],
  },
  {
    id: 'law.lehman',
    name: "Lehman's Laws of Software Evolution",
    statement:
      'Systems must keep changing or become progressively less useful; change is continuous, complexity grows unless actively managed.',
    domain: 'project',
    applicability: (ctx) =>
      has(ctx, ['evolve', 'maintain', 'legacy', 'long term', 'roadmap', 'scale']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      const mentions = evidenceFor(ctx, ['maintain', 'legacy', 'long term', 'roadmap']);
      if (mentions.length > 0) {
        findings.push({
          lawId: 'law.lehman',
          severity: 'info',
          message:
            'Evolutionary pressure present — plan for continuous change; growing complexity must be paid down deliberately.',
          evidence: mentions,
          tradeoffs: ['None — evolution is unavoidable; the only choice is managed or unmanaged.'],
        });
      }
      return findings;
    },
    tradeoffs: ['None — this is a descriptive law.'],
    provenance: ['Lehman, Laws of Program Evolution (1980)'],
  },
  {
    id: 'law.pareto',
    name: 'Pareto Principle',
    statement:
      'Roughly 80% of effects come from 20% of causes — prioritize the vital few over the trivial many.',
    domain: 'project',
    applicability: (ctx) =>
      has(ctx, ['prioritize', '80/20', 'impact', 'vital few', 'top requests', 'most common', 'p95', 'p99']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      const mentions = evidenceFor(ctx, ['prioritize', 'impact', 'common', 'p95', 'p99']);
      if (mentions.length > 0) {
        findings.push({
          lawId: 'law.pareto',
          severity: 'info',
          message:
            'Prioritization context — identify the vital few (top 20%) before spending on the long tail.',
          evidence: mentions,
          tradeoffs: ['Long-tail work is still valid when the vital few are done or institutional.'],
        });
      }
      return findings;
    },
    tradeoffs: ['Compliance and correctness work is exempt from the 80/20 test.'],
    provenance: ['Pareto (1896); laws-of-software-engineering.com'],
  },
  {
    id: 'law.parkinson',
    name: "Parkinson's Law",
    statement:
      'Work expands to fill the time available — unbounded schedules and unprioritized backlogs inflate scope.',
    domain: 'schedule',
    applicability: (ctx) =>
      has(ctx, ['deadline', 'timebox', 'sprint', 'estimate', 'backlog', 'timeline']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      const mentions = evidenceFor(ctx, ['deadline', 'estimate', 'backlog', 'timeline']);
      if (mentions.length > 0) {
        findings.push({
          lawId: 'law.parkinson',
          severity: 'info',
          message:
            'Time-bound work — set explicit timeboxes and completion criteria, or the work absorbs the budget.',
          evidence: mentions,
          tradeoffs: ['Quality work on important systems can justify open-ended schedules.'],
        });
      }
      return findings;
    },
    tradeoffs: ['Hard quality bars justify open-ended refinement.'],
    provenance: ['Parkinson, Parkinson\u2019s Law (1955)'],
  },
  {
    id: 'law.hofstadter',
    name: "Hofstadter's Law",
    statement:
      'It always takes longer than you expect, even when you take into account Hofstadter\u2019s Law — estimates must carry uncertainty bands.',
    domain: 'schedule',
    applicability: (ctx) =>
      has(ctx, ['estimate', 'week', 'weeks', 'month', 'months', 'sprint', 'timeline', 'deliver']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      const mentions = evidenceFor(ctx, ['estimate', 'week', 'month', 'deliver']);
      if (mentions.length > 0) {
        findings.push({
          lawId: 'law.hofstadter',
          severity: 'info',
          message:
            'Estimate present — provide a range with confidence (e.g. P50/P90), not a single point.',
          evidence: mentions,
          tradeoffs: ['Point estimates are acceptable for reversible, low-risk work.'],
        });
      }
      return findings;
    },
    tradeoffs: ['Reversible, low-risk tasks tolerate point estimates.'],
    provenance: ['Hofstadter, Gödel, Escher, Bach (1979)'],
  },
  {
    id: 'law.murphy',
    name: "Murphy's Law (risk analysis)",
    statement:
      'What can go wrong will go wrong — plan for failure modes explicitly; the interesting question is what "wrong" looks like.',
    domain: 'system',
    applicability: (ctx) =>
      ctx.kind === 'code' ||
      has(ctx, ['fail', 'risk', 'outage', 'incident', 'rollback', 'recovery']),
    check: (ctx) => {
      const findings: LawFinding[] = [];
      if (ctx.codeFacts.rawIoCount > 0) {
        findings.push({
          lawId: 'law.murphy',
          severity: 'warning',
          message:
            'I/O present — enumerate the failure modes (network, disk, DB, clock) and name the behavior for each.',
          evidence: [`${ctx.codeFacts.rawIoCount} I/O call site(s)`],
          tradeoffs: ['Prototypes and spikes can assume ideal conditions.'],
        });
      }
      return findings;
    },
    tradeoffs: ['Explicitly throwaway code may assume ideal conditions.'],
    provenance: ['Murphy\u2019s Law (folk); risk-analysis canon'],
  },
  {
    id: 'law.occam',
    name: "Occam's Razor",
    statement:
      'Among competing explanations or designs, prefer the one with the fewest assumptions that still covers the requirements.',
    domain: 'code',
    applicability: (ctx) => (ctx.kind === 'design' || ctx.kind === 'architecture') || ctx.codeFacts.maxNestingDepth >= 4,
    check: (ctx) => {
      const findings: LawFinding[] = [];
      if (ctx.codeFacts.maxNestingDepth >= 4) {
        findings.push({
          lawId: 'law.occam',
          severity: 'warning',
          message:
            `Nesting depth ${ctx.codeFacts.maxNestingDepth} — complexity may exceed the problem; extract or simplify before adding more machinery.`,
          evidence: [`max nesting depth ${ctx.codeFacts.maxNestingDepth}`],
          tradeoffs: ['Domain-complex algorithms legitimately need deep structure — justify each level.'],
        });
      }
      return findings;
    },
    tradeoffs: ['The simplest design that covers all requirements — not the simplest possible design.'],
    provenance: ['Occam (14th c.); engineering heuristics canon'],
  },
];

export class LawRegistry {
  private laws = new Map<string, EngineeringLaw>();

  constructor(initial?: EngineeringLaw[]) {
    if (initial) for (const law of initial) this.register(law);
  }

  register(law: EngineeringLaw): void {
    if (this.laws.has(law.id)) {
      throw new Error(`Duplicate law id: ${law.id}`);
    }
    this.laws.set(law.id, law);
  }

  get(id: string): EngineeringLaw | null {
    return this.laws.get(id) ?? null;
  }

  list(domain?: EngineeringLaw['domain']): EngineeringLaw[] {
    const all = [...this.laws.values()];
    return domain ? all.filter((l) => l.domain === domain) : all;
  }

  get size(): number {
    return this.laws.size;
  }

  /** Run applicable laws against a context; returns triggered findings. */
  evaluate(ctx: JudgmentContext): LawFinding[] {
    const findings: LawFinding[] = [];
    for (const law of this.laws.values()) {
      if (!law.applicability(ctx)) continue;
      findings.push(...law.check(ctx));
    }
    return findings;
  }
}

export function createLawRegistry(): LawRegistry {
  return new LawRegistry(ENGINEERING_LAWS);
}
