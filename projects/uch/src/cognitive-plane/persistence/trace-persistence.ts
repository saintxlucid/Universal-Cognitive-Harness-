import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CognitiveTrace } from '../trace-engine/cognitive-trace.js';
import { TraceLedger } from '../trace-engine/trace-ledger.js';
import { normalizeSpanId, normalizeTraceId } from '../trace-engine/cognitive-trace.js';

export class TracePersistence {
  private filePath: string;
  private writeStream: fs.WriteStream | null = null;
  private loaded = false;
  private lastWriteError: Error | null = null;
  private pendingBytes = 0;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /** Last write-stream failure, if any. The persistence layer degrades to
   * in-memory operation after a write error — it never crashes the process. */
  get writeError(): Error | null {
    return this.lastWriteError;
  }

  /** Bytes queued in the write-stream buffer since the last drain. */
  get bufferedBytes(): number {
    return this.pendingBytes;
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
    const stream = fs.createWriteStream(this.filePath, { flags: 'a' });
    stream.on('error', (err) => {
      // Record and degrade: subsequent appends become no-ops instead of
      // throwing (Node's default would crash the process on EACCES/EISDIR).
      this.lastWriteError = err;
      if (this.writeStream === stream) {
        this.writeStream = null;
      }
    });
    stream.on('drain', () => {
      this.pendingBytes = 0;
    });
    this.writeStream = stream;
  }

  append(trace: CognitiveTrace): void {
    if (!this.writeStream) return;
    const line = JSON.stringify(trace) + '\n';
    if (this.writeStream.write(line) === false) {
      this.pendingBytes += Buffer.byteLength(line);
    }
  }

  /** Flush and close the append stream. Resolves on error too — shutdown
   * must never hang or throw because of a failing trace sink. */
  async close(): Promise<void> {
    const stream = this.writeStream;
    this.writeStream = null;
    if (!stream) return;
    await new Promise<void>((resolve) => {
      stream.on('error', () => resolve());
      stream.end(() => resolve());
    });
  }

  get size(): number {
    if (!fs.existsSync(this.filePath)) return 0;
    return fs.statSync(this.filePath).size;
  }
}
