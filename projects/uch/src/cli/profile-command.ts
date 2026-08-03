/**
 * `uch profile` — the Cognitive Profiler CLI (IDEA-0128 P2, WS-5).
 *
 * Profiles a session (or whole ledger) from the ADR-002 trace journal:
 * per-stage attribution, the ten IDEA-0128 metrics, hotspots, bottlenecks,
 * and cross-session aggregation when multiple sessions are present.
 *
 * Default input: `.uccp/persist/trace-ledger.json` (newline-delimited
 * CognitiveTrace JSON, the W-01 write path). Override with a path argument.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { CognitiveProfiler, type ProfilerReport } from '../cognitive-plane/profiler/profiler.js';
import type { CognitiveTrace } from '../cognitive-plane/trace-engine/cognitive-trace.js';

export const PROFILE_DEFAULT_SOURCE = path.join('.uccp', 'persist', 'trace-ledger.json');

export function loadTraces(filePath: string): CognitiveTrace[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`trace ledger not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const traces: CognitiveTrace[] = [];
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      const trace = JSON.parse(line) as CognitiveTrace;
      trace.timestamp = new Date(trace.timestamp);
      if (trace.end_timestamp) trace.end_timestamp = new Date(trace.end_timestamp);
      traces.push(trace);
    } catch {
      // Skip corrupt lines: the journal is append-only and may end mid-write.
    }
  }
  return traces;
}

export function groupBySession(traces: CognitiveTrace[]): Map<string, CognitiveTrace[]> {
  const groups = new Map<string, CognitiveTrace[]>();
  for (const trace of traces) {
    const sessionAttr = trace.attributes.find((a) => a.key === 'session.id');
    const sessionId = sessionAttr ? String(sessionAttr.value) : 'default';
    const bucket = groups.get(sessionId) ?? [];
    bucket.push(trace);
    groups.set(sessionId, bucket);
  }
  return groups;
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '0.0%';
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function formatReport(report: ProfilerReport, verbose: boolean): string {
  const lines: string[] = [];
  lines.push(`Session: ${report.sessionId}`);
  lines.push(
    `  spans: ${report.spanCount}  errors: ${report.errorCount}  duration: ${report.totalDurationMs} ms`,
  );
  lines.push(
    `  reasoning cost: ${report.metrics.reasoningCostMs} ms  energy: ${report.metrics.reasoningEnergy}`,
  );
  lines.push(
    `  verification: ${report.metrics.verificationTimeMs} ms  research latency: ${report.metrics.researchLatencyMs.toFixed(1)} ms`,
  );
  lines.push(
    `  planning: ${report.metrics.planningCostMs} ms  simulation: ${report.metrics.simulationCostMs} ms`,
  );
  lines.push(
    `  context growth: ${report.metrics.contextGrowthTokens} tokens  reuse: ${report.metrics.knowledgeReuse}`,
  );
  lines.push(
    `  memory hits: ${report.metrics.memoryHits}  decision entropy: ${report.metrics.decisionEntropyBits.toFixed(2)} bits`,
  );
  lines.push(`  token efficiency: ${report.metrics.tokenEfficiency.toFixed(3)}`);
  if (report.bottleneck) {
    lines.push(
      `  bottleneck: ${report.bottleneck.stage} ${report.bottleneck.spanName} (${report.bottleneck.durationMs} ms, ${pct(report.bottleneck.durationMs, report.totalDurationMs)})`,
    );
  }
  if (verbose) {
    lines.push('  hotspots:');
    for (const h of report.hotspots) {
      lines.push(
        `    ${h.stage}: ${h.durationMs} ms (${pct(h.durationMs, report.totalDurationMs)})`,
      );
    }
    const uncovered = Object.entries(report.coverage)
      .filter(([, covered]) => !covered)
      .map(([metric]) => metric);
    if (uncovered.length > 0) {
      lines.push(`  coverage gaps (substrate absent): ${uncovered.join(', ')}`);
    }
  }
  return lines.join('\n');
}

export function formatProfile(traces: CognitiveTrace[], verbose: boolean): string {
  if (traces.length === 0) {
    return 'No traces found — the ledger is empty (or the profile substrate is absent).';
  }
  const profiler = new CognitiveProfiler();
  const groups = groupBySession(traces);
  const reports: ProfilerReport[] = [];
  const lines: string[] = [];
  for (const [sessionId, sessionTraces] of groups) {
    const report = profiler.profileSession(sessionTraces);
    reports.push(report);
    lines.push(formatReport(report, verbose));
    if (sessionId !== 'default') {
      lines[lines.length - 1] += `  [session.id=${sessionId}]`;
    }
  }
  if (groups.size > 1) {
    const agg = profiler.aggregate(reports);
    lines.push('');
    lines.push(
      `Aggregate: ${agg.sessionCount} sessions / ${agg.totalSpans} spans / ${agg.totalDurationMs} ms`,
    );
    lines.push(
      `  mean token efficiency: ${agg.meanTokenEfficiency.toFixed(3)}  mean research latency: ${agg.meanResearchLatencyMs.toFixed(1)} ms`,
    );
    lines.push('  sessions by cost:');
    for (const s of agg.sessionsByCost) {
      lines.push(`    ${s.sessionId}: ${s.durationMs} ms`);
    }
  }
  return lines.join('\n');
}
