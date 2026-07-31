import * as fs from 'node:fs';
import * as path from 'node:path';
import { TraceLedger } from '../trace-engine/trace-ledger.js';

export type SignalType =
  | 'agent:attached' | 'agent:detached'
  | 'session:started' | 'session:ended'
  | 'workspace:opened' | 'workspace:closed'
  | 'trace:completed' | 'error:occurred'
  | 'budget:exceeded' | 'policy:denied'
  | 'manual:trigger';

export interface CognitiveSignal {
  id: string;
  type: SignalType;
  timestamp: Date;
  source: string;
  payload: Record<string, unknown>;
  traceId?: string;
  importance: number;
  acknowledged: boolean;
}

export interface ReplayTrigger {
  signalId: string;
  traceId: string;
  reason: string;
  triggeredAt: Date;
}

export class SignalStore {
  private signals: CognitiveSignal[] = [];
  private triggers: ReplayTrigger[] = [];
  private ledger: TraceLedger;
  private filePath: string | null = null;
  private maxSignals: number;

  constructor(ledger: TraceLedger, maxSignals = 10000) {
    this.ledger = ledger;
    this.maxSignals = maxSignals;
  }

  record(type: SignalType, source: string, payload: Record<string, unknown>, importance = 0.5): CognitiveSignal {
    const signal: CognitiveSignal = {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date(),
      source,
      payload,
      traceId: (payload.traceId as string) ?? undefined,
      importance,
      acknowledged: false,
    };

    this.signals.push(signal);
    if (this.signals.length > this.maxSignals) this.signals.shift();

    if (importance >= 0.7) {
      this.autoTriggerReplay(signal);
    }

    return signal;
  }

  getRecent(count = 50): CognitiveSignal[] {
    return this.signals.slice(-count);
  }

  getByType(type: SignalType): CognitiveSignal[] {
    return this.signals.filter((s) => s.type === type);
  }

  getUnacknowledged(): CognitiveSignal[] {
    return this.signals.filter((s) => !s.acknowledged);
  }

  acknowledge(signalId: string): boolean {
    const signal = this.signals.find((s) => s.id === signalId);
    if (!signal) return false;
    signal.acknowledged = true;
    return true;
  }

  acknowledgeAll(): number {
    let count = 0;
    for (const signal of this.signals) {
      if (!signal.acknowledged) { signal.acknowledged = true; count++; }
    }
    return count;
  }

  getTriggers(limit = 20): ReplayTrigger[] {
    return this.triggers.slice(-limit);
  }

  count(): number {
    return this.signals.length;
  }

  getStats(): { total: number; unacknowledged: number; triggers: number; byType: Record<string, number> } {
    const byType: Record<string, number> = {};
    for (const s of this.signals) {
      byType[s.type] = (byType[s.type] ?? 0) + 1;
    }
    return {
      total: this.signals.length,
      unacknowledged: this.signals.filter((s) => !s.acknowledged).length,
      triggers: this.triggers.length,
      byType,
    };
  }

  async persist(filePath: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const data = { signals: this.signals, triggers: this.triggers };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    this.filePath = filePath;
  }

  async load(filePath: string): Promise<number> {
    if (!fs.existsSync(filePath)) return 0;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);

    let count = 0;
    if (data.signals) {
      for (const s of data.signals as CognitiveSignal[]) {
        s.timestamp = new Date(s.timestamp);
        this.signals.push(s);
        count++;
      }
    }
    if (data.triggers) {
      for (const t of data.triggers as ReplayTrigger[]) {
        t.triggeredAt = new Date(t.triggeredAt);
        this.triggers.push(t);
      }
    }

    this.filePath = filePath;
    return count;
  }

  private autoTriggerReplay(signal: CognitiveSignal): void {
    if (signal.traceId) {
      const trace = this.ledger.getByTraceId(signal.traceId);
      if (trace) {
        this.triggers.push({
          signalId: signal.id,
          traceId: signal.traceId,
          reason: `Auto-trigger from ${signal.type} (importance: ${signal.importance})`,
          triggeredAt: new Date(),
        });
      }
    }
  }
}
