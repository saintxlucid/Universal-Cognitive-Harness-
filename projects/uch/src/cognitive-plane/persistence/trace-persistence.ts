import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CognitiveTrace } from '../trace-engine/cognitive-trace.js';
import { TraceLedger } from '../trace-engine/trace-ledger.js';
import { normalizeSpanId, normalizeTraceId } from '../trace-engine/cognitive-trace.js';

export class TracePersistence {
  private filePath: string;
  private writeStream: fs.WriteStream | null = null;
  private loaded = false;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async loadInto(ledger: TraceLedger): Promise<number> {
    if (this.loaded) return 0;
    this.loaded = true;

    if (!fs.existsSync(this.filePath)) return 0;

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);
    let count = 0;

    for (const line of lines) {
      try {
        const trace = JSON.parse(line) as CognitiveTrace;
        // Normalize legacy ids (pre-ADR-002 32-hex UUIDs) to W3C shape so
        // parent/child linkage survives across versions.
        trace.trace_id = normalizeTraceId(trace.trace_id);
        trace.span_id = normalizeSpanId(trace.span_id);
        if (trace.parent_span_id) trace.parent_span_id = normalizeSpanId(trace.parent_span_id);
        trace.timestamp = new Date(trace.timestamp);
        if (trace.end_timestamp) trace.end_timestamp = new Date(trace.end_timestamp);
        for (const evt of trace.events) {
          evt.timestamp = new Date(evt.timestamp);
        }
        ledger.append(trace);
        count++;
      } catch {
        continue;
      }
    }

    return count;
  }

  open(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.writeStream = fs.createWriteStream(this.filePath, { flags: 'a' });
  }

  append(trace: CognitiveTrace): void {
    if (!this.writeStream) return;
    const line = JSON.stringify(trace) + '\n';
    this.writeStream.write(line);
  }

  close(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  get size(): number {
    if (!fs.existsSync(this.filePath)) return 0;
    return fs.statSync(this.filePath).size;
  }
}
