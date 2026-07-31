import { TraceLedger } from '../../cognitive-plane/trace-engine/trace-ledger.js';
import { DecisionLog, type DecisionEntry } from '../../cognitive-plane/decisions/decision-log.js';
import { SignalStore, type CognitiveSignal } from '../../cognitive-plane/signals/signal-store.js';
import type { CognitiveTrace } from '../../cognitive-plane/trace-engine/cognitive-trace.js';
import * as fs from 'node:fs';

export type ExportFormat = 'json' | 'jsonl' | 'csv' | 'markdown';
export type ExportScope = 'traces' | 'decisions' | 'signals' | 'all';

export interface ExportOptions {
  format: ExportFormat;
  scope: ExportScope;
  traceFilter?: (t: CognitiveTrace) => boolean;
  decisionFilter?: (d: DecisionEntry) => boolean;
  signalFilter?: (s: CognitiveSignal) => boolean;
  limit?: number;
  pretty?: boolean;
}

export class ExportEngine {
  private ledger: TraceLedger;
  private decisionLog: DecisionLog;
  private signalStore: SignalStore;

  constructor(ledger: TraceLedger, decisionLog: DecisionLog, signalStore: SignalStore) {
    this.ledger = ledger;
    this.decisionLog = decisionLog;
    this.signalStore = signalStore;
  }

  export(opts: ExportOptions): string {
    switch (opts.format) {
      case 'json': return this.exportJSON(opts);
      case 'jsonl': return this.exportJSONL(opts);
      case 'csv': return this.exportCSV(opts);
      case 'markdown': return this.exportMarkdown(opts);
    }
  }

  exportToFile(opts: ExportOptions & { filePath: string }): void {
    const content = this.export(opts);
    fs.writeFileSync(opts.filePath, content, 'utf-8');
  }

  private computeDurationMs(t: { timestamp: Date; end_timestamp: Date | null }): number | null {
    if (!t.end_timestamp) return null;
    return t.end_timestamp.getTime() - t.timestamp.getTime();
  }

  private exportJSON(opts: ExportOptions): string {
    const data: Record<string, unknown> = { exportedAt: new Date().toISOString() };

    if (opts.scope === 'traces' || opts.scope === 'all') {
      data.traces = this.filterTraces(opts).map((t) => this.serializeTrace(t));
    }
    if (opts.scope === 'decisions' || opts.scope === 'all') {
      data.decisions = this.filterDecisions(opts).map((d) => this.serializeDecision(d));
    }
    if (opts.scope === 'signals' || opts.scope === 'all') {
      data.signals = this.filterSignals(opts).map((s) => this.serializeSignal(s));
    }

    return JSON.stringify(data, null, opts.pretty ? 2 : undefined);
  }

  private exportJSONL(opts: ExportOptions): string {
    const lines: string[] = [];

    if (opts.scope === 'traces' || opts.scope === 'all') {
      for (const t of this.filterTraces(opts)) {
        lines.push(JSON.stringify({ type: 'trace', data: this.serializeTrace(t) }));
      }
    }
    if (opts.scope === 'decisions' || opts.scope === 'all') {
      for (const d of this.filterDecisions(opts)) {
        lines.push(JSON.stringify({ type: 'decision', data: this.serializeDecision(d) }));
      }
    }
    if (opts.scope === 'signals' || opts.scope === 'all') {
      for (const s of this.filterSignals(opts)) {
        lines.push(JSON.stringify({ type: 'signal', data: this.serializeSignal(s) }));
      }
    }

    return lines.join('\n');
  }

  private exportCSV(opts: ExportOptions): string {
    const rows: string[] = [];

    if (opts.scope === 'traces' || opts.scope === 'all') {
      rows.push('type,id,name,kind,status,duration_ms,timestamp');
      for (const t of this.filterTraces(opts)) {
        const dur = this.computeDurationMs(t);
        rows.push([
          'trace',
          t.trace_id,
          this.escapeCSV(t.name),
          t.kind,
          t.status,
          dur !== null ? String(dur) : '',
          t.timestamp.toISOString(),
        ].join(','));
      }
    }

    if (opts.scope === 'decisions' || opts.scope === 'all') {
      rows.push('type,id,title,outcome,description,timestamp,tags');
      for (const d of this.filterDecisions(opts)) {
        rows.push([
          'decision',
          d.id,
          this.escapeCSV(d.title),
          this.escapeCSV(d.outcome),
          this.escapeCSV(d.description.slice(0, 200)),
          d.timestamp.toISOString(),
          this.escapeCSV(d.tags.join(';')),
        ].join(','));
      }
    }

    if (opts.scope === 'signals' || opts.scope === 'all') {
      rows.push('type,id,signal_type,source,importance,acknowledged,timestamp');
      for (const s of this.filterSignals(opts)) {
        rows.push([
          'signal',
          s.id,
          s.type,
          this.escapeCSV(s.source),
          String(s.importance),
          String(s.acknowledged),
          new Date(s.timestamp).toISOString(),
        ].join(','));
      }
    }

    return rows.join('\n');
  }

  private exportMarkdown(opts: ExportOptions): string {
    const sections: string[] = ['# UCCP Export', `Generated: ${new Date().toISOString()}\n`];

    if (opts.scope === 'traces' || opts.scope === 'all') {
      const traces = this.filterTraces(opts);
      sections.push(`## Traces (${traces.length})`);
      sections.push('| ID | Name | Kind | Status | Timestamp |');
      sections.push('| --- | --- | --- | --- | --- |');
      for (const t of traces) {
        sections.push(`| ${t.trace_id.slice(0, 8)} | ${t.name} | ${t.kind} | ${t.status} | ${t.timestamp.toISOString()} |`);
      }
      sections.push('');
    }

    if (opts.scope === 'decisions' || opts.scope === 'all') {
      const decisions = this.filterDecisions(opts);
      sections.push(`## Decisions (${decisions.length})`);
      for (const d of decisions) {
        sections.push(`### ${d.title}`);
        sections.push(`**Outcome:** ${d.outcome}`);
        sections.push(`**Rationale:** ${d.rationale}`);
        if (d.alternatives.length > 0) {
          sections.push('**Alternatives:**');
          for (const alt of d.alternatives) {
            sections.push(`- **${alt.name}**: ${alt.description}`);
          }
        }
        sections.push(`*Tags: ${d.tags.join(', ')}*\n`);
      }
    }

    if (opts.scope === 'signals' || opts.scope === 'all') {
      const signals = this.filterSignals(opts);
      sections.push(`## Signals (${signals.length})`);
      sections.push('| ID | Type | Source | Importance | Acknowledged | Timestamp |');
      sections.push('| --- | --- | --- | --- | --- | --- |');
      for (const s of signals) {
        sections.push(`| ${s.id.slice(0, 8)} | ${s.type} | ${s.source} | ${s.importance} | ${s.acknowledged ? '✓' : '✗'} | ${new Date(s.timestamp).toISOString()} |`);
      }
    }

    return sections.join('\n');
  }

  private filterTraces(opts: ExportOptions): CognitiveTrace[] {
    const limit = opts.limit ?? 1000;
    const all = this.ledger.getRecent(limit);
    return opts.traceFilter ? all.filter(opts.traceFilter) : all;
  }

  private filterDecisions(opts: ExportOptions): DecisionEntry[] {
    const limit = opts.limit ?? 1000;
    const all = this.decisionLog.getAll(limit);
    return opts.decisionFilter ? all.filter(opts.decisionFilter) : all;
  }

  private filterSignals(opts: ExportOptions): CognitiveSignal[] {
    const limit = opts.limit ?? 1000;
    const all = this.signalStore.getRecent(limit);
    return opts.signalFilter ? all.filter(opts.signalFilter) : all;
  }

  private serializeTrace(t: CognitiveTrace): Record<string, unknown> {
    return {
      id: t.trace_id,
      spanId: t.span_id,
      parentSpanId: t.parent_span_id,
      name: t.name,
      kind: t.kind,
      status: t.status,
      timestamp: t.timestamp.toISOString(),
      endTimestamp: t.end_timestamp?.toISOString(),
      events: t.events.map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp.toISOString(),
        attributes: e.attributes,
      })),
      attributes: t.attributes,
    };
  }

  private serializeDecision(d: DecisionEntry): Record<string, unknown> {
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      rationale: d.rationale,
      outcome: d.outcome,
      alternatives: d.alternatives,
      tags: d.tags,
      timestamp: d.timestamp.toISOString(),
      metadata: d.metadata,
    };
  }

  private serializeSignal(s: CognitiveSignal): Record<string, unknown> {
    return {
      id: s.id,
      type: s.type,
      source: s.source,
      importance: s.importance,
      acknowledged: s.acknowledged,
      timestamp: new Date(s.timestamp).toISOString(),
      payload: s.payload,
      traceId: s.traceId,
    };
  }

  private escapeCSV(val: string): string {
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
}
