/**
 * Governance and quality-gate commands: `takes`, `calibration`,
 * `principles-check`, `organic-score`, `engineering-review`,
 * `engineering-benchmark`, `governance`.
 */

import { CalibrationStore } from '../cognitive-plane/calibration/store.js';
import { CodingPrinciplesEngine } from '../kernel/constitution/coding-principles.js';
import { OrganicScoreEngine } from '../kernel/constitution/organic-score.js';
import {
  autoTarget,
  coerceFindings,
  createEngineeringJudgment,
  engineeringFindingsFor,
  runEngineeringBenchmark,
} from '../engineering-intelligence/index.js';
import type { EngineeringFinding } from '../engineering-intelligence/index.js';
import {
  FrameworkDecisionJournal,
  syncTakesWithJournal,
} from '../cognitive-plane/frameworks/journal/decision-journal.js';
import { computeCalibrationProfile } from '../cognitive-plane/calibration/calibration.js';
import { CodeGovernanceGate } from '../kernel/constitution/code-governance-gate.js';
import type { CliContext } from './context.js';

export async function handleTakes(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const sub = args[1] ?? '';
  const store = new CalibrationStore();
  await store.load();
  if (sub === 'add') {
    const claim = args.slice(2, -1).join(' ');
    const convictionRaw = args[args.length - 1];
    const conviction = Number.parseFloat(convictionRaw ?? '');
    if (!claim || !Number.isFinite(conviction) || conviction < 0 || conviction > 1) {
      console.error('Usage: uch takes add "<claim>" <conviction 0-1>');
      return;
    }
    const take = await store.addTake({ claim, conviction });
    console.log(JSON.stringify(take, null, 2));
  } else if (sub === 'resolve') {
    const id = args[2];
    const quality = args[3] as 'correct' | 'incorrect' | 'partial' | 'unresolvable';
    if (!id || !['correct', 'incorrect', 'partial', 'unresolvable'].includes(quality)) {
      console.error('Usage: uch takes resolve <id> <correct|incorrect|partial|unresolvable>');
      return;
    }
    const take = await store.resolveTake(id, { quality, resolvedBy: 'uch-cli' });
    console.log(JSON.stringify(take, null, 2));
  } else if (sub === 'list') {
    const filter =
      args[2] === '--open'
        ? store.takes.open
        : args[2] === '--resolved'
          ? store.takes.resolved
          : store.takes.all;
    for (const t of filter) {
      console.log(
        `${t.status === 'resolved' ? '✓' : '·'} ${t.id.slice(0, 8)} ${t.conviction.toFixed(2)} ${t.domain.padEnd(12)} ${t.quality ?? 'open'.padEnd(11)} ${t.claim.slice(0, 90)}`,
      );
    }
    console.log(
      `\n${store.takes.count()} takes (${store.takes.open.length} open, ${store.takes.resolved.length} resolved)`,
    );
  } else {
    console.error(
      'Usage: uch takes add "<claim>" <cv> | resolve <id> <quality> | list [--open|--resolved]',
    );
  }
  process.exit(0);
}

export async function handleCalibration(_ctx: CliContext): Promise<void> {
  const store = new CalibrationStore();
  await store.load();
  // Frameworks section (blueprint §5.4): the decision journal's verdicts
  // are gradeable claims — merged into the takes fence as a 'framework'
  // domain so the profile shows which reasoning models hold up.
  const journal = new FrameworkDecisionJournal();
  await journal.load('.uccp/persist/framework-journal.json');
  const mergedTakes = syncTakesWithJournal(store.takes.all, journal);
  const profile = computeCalibrationProfile(mergedTakes);
  const out: Record<string, unknown> = {
    resolvedCount: profile.resolvedCount,
    openCount: profile.openCount,
    coldStart: profile.coldStart,
    brier: profile.brier,
    accuracy: profile.accuracy,
    unresolvableRate: profile.unresolvableRate,
    biasTags: profile.biasTags,
  };
  if (!profile.coldStart) {
    out.scorecards = profile.scorecards;
    out.convictionBuckets = profile.buckets;
    out.narrative = profile.narratives.join('\n');
  } else {
    out.narrative = profile.narratives[0] ?? '';
  }
  const journalStats = journal.getStats();
  if (journalStats.total > 0) {
    out.frameworks = {
      total: journalStats.total,
      open: journalStats.open,
      resolved: journalStats.resolved,
      usageByModel: journalStats.usageByModel,
      accuracyByModel: journalStats.accuracyByModel,
      dominantPerProblemType: journalStats.dominantPerProblemType,
      reversed: journalStats.reversed,
      drift: journalStats.drift,
    };
  }
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

export async function handlePrinciplesCheck(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const intent = args.slice(1).join(' ');
  if (!intent) {
    console.error('Usage: uch principles-check "<intent> [:: proposed change]"');
    return;
  }
  const [intentPart, changePart] = intent.split('::');
  const engine = new CodingPrinciplesEngine();
  const output = engine.evaluate({
    intent: (intentPart ?? '').trim(),
    proposedChange: (changePart ?? '').trim(),
  });
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

export async function handleOrganicScore(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const change = args.slice(1).join(' ');
  if (!change) {
    console.error(
      'Usage: uch organic-score "<change description> [:: intent] [:: files: a.ts,b.ts] [:: tests: npm test]" [--kind code|design|plan|architecture] [--findings <json array>]',
    );
    return;
  }
  const [changePart, intentPart, filesPart, testsPart] = change.split('::');
  const engine = new OrganicScoreEngine();

  const kindIdx = args.indexOf('--kind');
  const kind =
    kindIdx >= 0 ? (args[kindIdx + 1] as 'code' | 'design' | 'plan' | 'architecture') : undefined;
  const findingsIdx = args.indexOf('--findings');

  let engineeringFindings: EngineeringFinding[] | undefined;

  const targetText = (changePart ?? '').trim();
  if (kind) {
    engineeringFindings = engineeringFindingsFor(targetText, kind);
  } else if (findingsIdx >= 0) {
    try {
      engineeringFindings = coerceFindings(JSON.parse(args[findingsIdx + 1] ?? '[]'));
    } catch {
      console.error('--findings must be a valid JSON array of EngineeringFinding objects');
      process.exit(1);
    }
  }

  const output = engine.evaluate({
    change: targetText,
    intent: (intentPart ?? '').trim() || undefined,
    context: {
      filesTouched: (filesPart ?? '')
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean),
      testsRun: (testsPart ?? '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    },
    ...(engineeringFindings && engineeringFindings.length > 0 ? { engineeringFindings } : {}),
  });
  console.log(JSON.stringify(output, null, 2));
  process.exit(0);
}

export async function handleEngineeringReview(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const text = args.slice(1).join(' ').trim();
  if (!text) {
    console.error(
      'Usage: uch engineering-review "<diff or prose>" [--kind code|design|plan|architecture] [--paths a.ts,b.ts]',
    );
    process.exit(1);
  }
  const kindIdx = args.indexOf('--kind');
  const kind =
    kindIdx >= 0 ? (args[kindIdx + 1] as 'code' | 'design' | 'plan' | 'architecture') : undefined;
  const pathsIdx = args.indexOf('--paths');
  const paths =
    pathsIdx >= 0
      ? (args[pathsIdx + 1] ?? '')
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean)
      : [];
  const target = autoTarget(text, kind);
  if (target.kind === 'code' && paths.length > 0) target.paths = paths;
  const review = createEngineeringJudgment().evaluator.evaluate(target);
  console.log(JSON.stringify(review, null, 2));
  process.exit(0);
}

export async function handleEngineeringBenchmark(): Promise<void> {
  const report = runEngineeringBenchmark();
  console.log(
    JSON.stringify(
      {
        totalCases: report.totalCases,
        passedCases: report.passedCases,
        recall: report.recall,
        vetoRecall: report.vetoRecall,
        negativeControlPassRate: report.negativeControlPassRate,
        avgLatencyMs: report.avgLatencyMs,
        p95LatencyMs: report.p95LatencyMs,
        maxLatencyMs: report.maxLatencyMs,
        contract: {
          vetoRecallMet: report.vetoRecall >= 0.8,
          latencyMet: report.maxLatencyMs < 1000,
          negativeControlsClean: report.negativeControlPassRate === 1,
        },
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

export async function handleGovernance(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const change = args.slice(1).join(' ').trim();
  if (!change) {
    console.error('Usage: uch governance "<change description or diff snippet>" [--intent <why>]');
    process.exit(1);
  }
  const intentIdx = args.indexOf('--intent');
  const intent = intentIdx >= 0 ? args[intentIdx + 1] : undefined;
  const gate = new CodeGovernanceGate();
  const record = gate.review({ change, intent, target: 'cli' });
  console.log(
    JSON.stringify(
      { verdict: record.verdict, score: record.score, evidence: record.evidence },
      null,
      2,
    ),
  );
  process.exit(0);
}
