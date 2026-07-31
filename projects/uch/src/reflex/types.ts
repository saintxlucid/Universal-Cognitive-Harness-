import type { Signal } from '../nervous-system/signal.js';
import type { NeuralEvent } from '../event-bus/neural-event-bus.js';

export type ReflexVerdict = 'allow' | 'block' | 'defer';

export interface WriteProposal {
  tool: string;
  target: string;
  content?: string;
  zone?: string;
}

export interface ReflexEvidence {
  check_id: string;
  rule: string;
  level: 'block' | 'defer';
  evidence: string[];
  threshold?: string;
  reason: string;
}

export interface ReflexCheckContext {
  zoneAffect(zone: string): number;
}

export interface ReflexCheck {
  id: string;
  rule: string;
  evaluate(proposal: WriteProposal, ctx: ReflexCheckContext): ReflexEvidence | null;
}

export interface ReflexResult {
  verdict: ReflexVerdict;
  checks_run: string[];
  evidence: ReflexEvidence[];
  override?: { name: string; recorded: boolean };
  duration_ms: number;
  target: string;
}

export type ZoneAffectProvider = (zone: string) => number;

export interface ReflexGateConfig {
  checks?: ReflexCheck[];
  zoneAffect?: ZoneAffectProvider;
  override?: { enabled?: boolean; names?: string[] };
  signalSink?: (signal: Signal) => void;
  eventSink?: (event: Omit<NeuralEvent, 'id' | 'timestamp'>) => void;
}

export interface ReflexGateLike {
  evaluate(proposal: WriteProposal): ReflexResult;
}
