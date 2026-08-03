/**
 * CIR commands: `cir` (compile / optimize / execute / benchmark) — the
 * RFC-0004 compiler front-end exposed over the CLI.
 */

import {
  CIR_VERSION,
  compileIntent,
  executePipeline,
  runCIRBenchmark,
  runPasses,
} from '../cognitive-compiler/index.js';
import { strFlagAt, type CliContext } from './context.js';

export async function handleCir(ctx: CliContext): Promise<void> {
  const { args } = ctx;
  const sub = args[1] ?? '';
  if (sub === 'benchmark') {
    const report = await runCIRBenchmark();
    console.log(
      JSON.stringify(
        {
          corpus: report.corpusVersion,
          totalCases: report.totalCases,
          passedCases: report.passedCases,
          contracts: report.contracts,
          passCoverage: report.passCoverage.map((c) => ({
            pass: c.pass,
            changing: c.changing,
            nonChanging: c.nonChanging,
            covered: c.covered,
          })),
          latencyMs: {
            avg: report.avgLatencyMs,
            p95: report.p95LatencyMs,
            max: report.maxLatencyMs,
          },
          failures: report.cases
            .filter((c) => !c.passed)
            .map((c) => ({ id: c.id, failures: c.failures })),
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  if (sub === 'compile' || sub === 'optimize' || sub === 'execute') {
    const goal = args
      .slice(2)
      .filter((a) => !a.startsWith('--'))
      .join(' ');
    if (!goal) {
      console.error(
        'Usage: uch cir <compile|optimize|execute> "<goal>" [--context "..."] [--scope ws:x] [--by <driver>]',
      );
      process.exit(1);
    }
    const scope = strFlagAt(args, '--scope') ?? 'ws:default';
    const compiledBy = strFlagAt(args, '--by') ?? 'uch-cli';
    const context = strFlagAt(args, '--context');
    const { stream, report } = compileIntent(goal, context, { scope, compiledBy, tick: 1 });
    if (sub === 'compile') {
      console.log(JSON.stringify({ cir: CIR_VERSION, stream, report }, null, 2));
      process.exit(0);
    }
    const optimizer = runPasses(stream);
    if (sub === 'optimize') {
      console.log(
        JSON.stringify(
          {
            cir: CIR_VERSION,
            reports: optimizer.reports,
            energy: { before: optimizer.energyBefore, after: optimizer.energyAfter },
            tokens: { before: optimizer.tokenBefore, after: optimizer.tokenAfter },
          },
          null,
          2,
        ),
      );
      process.exit(0);
    }
    // Deterministic subset: the delegated evaluate is replayed from the
    // recorded payload (ADR-002) instead of a live model call.
    const result = await executePipeline(
      stream,
      {},
      {
        replayPayloads: new Map([
          ['v1', { payload: { verdict: 'approved' }, confidence: 0.9, latencyMs: 0 }],
        ]),
      },
    );
    console.log(
      JSON.stringify(
        {
          cir: CIR_VERSION,
          accepted: result.verdict.accepted,
          ...(result.verdict.accepted
            ? { record: result.verdict.record }
            : { rejection: result.verdict.rejection }),
          passReports: result.optimizer?.reports,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }
  console.error('Usage: uch cir <compile|optimize|execute|benchmark>');
  process.exit(1);
}
