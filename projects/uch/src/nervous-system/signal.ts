import type { EventType } from '../event-bus/neural-event-bus.js';
import {
  type SignalID,
  type ComponentID,
  type EnergyUnit,
  type Timestamp,
  type InformationMetrics,
  signalID,
  componentID,
  energyUnit,
  entropy,
  novelty,
  timestamp,
} from '../shared/branded-types.js';

export type NervousSystemLayer = 'peripheral' | 'spinal' | 'brainstem' | 'thalamus' | 'cortex';

export type InterruptLevel = 0 | 1 | 2 | 3 | 4;

export type SignalPriority = 0 | 1 | 2 | 3 | 4;

export interface Signal {
  readonly id: SignalID;
  readonly type: EventType;
  readonly source: ComponentID;
  readonly target?: ComponentID | 'broadcast';
  readonly payload: Readonly<Record<string, unknown>>;
  readonly energy: EnergyUnit;
  readonly timestamp: Timestamp;
  readonly freshness: number;
  readonly priority: SignalPriority;
  readonly causalParent?: SignalID;
  readonly layer: NervousSystemLayer;
  readonly information: InformationMetrics;
  readonly interrupt: boolean;
  readonly interruptLevel?: InterruptLevel;
}

export interface EntropyReductionResult {
  signal: Readonly<Signal>;
  metrics: InformationMetrics;
  escalate: boolean;
  absorbedAt: NervousSystemLayer | null;
}

export type SignalHandler = (signal: Readonly<Signal>) => void | Promise<void>;

export type SignalFilter = (signal: Readonly<Signal>) => boolean;

export const signalPriorityForType = new Map<EventType, SignalPriority>([
  ['file:opened', 0 as SignalPriority],
  ['file:saved', 0 as SignalPriority],
  ['file:deleted', 0 as SignalPriority],
  ['file:created', 0 as SignalPriority],
  ['git:commit', 0 as SignalPriority],
  ['git:branch_changed', 0 as SignalPriority],
  ['git:push', 0 as SignalPriority],
  ['git:pull', 0 as SignalPriority],
  ['terminal:executed', 0 as SignalPriority],
  ['terminal:output', 0 as SignalPriority],
  ['test:passed', 1 as SignalPriority],
  ['test:failed', 1 as SignalPriority],
  ['test:started', 1 as SignalPriority],
  ['build:started', 1 as SignalPriority],
  ['build:finished', 1 as SignalPriority],
  ['build:failed', 1 as SignalPriority],
  ['ci:passed', 1 as SignalPriority],
  ['ci:failed', 1 as SignalPriority],
  ['ci:started', 1 as SignalPriority],
  ['prompt:sent', 2 as SignalPriority],
  ['prompt:responded', 2 as SignalPriority],
  ['tool:called', 2 as SignalPriority],
  ['tool:result', 2 as SignalPriority],
  ['error:occurred', 2 as SignalPriority],
  ['error:handled', 2 as SignalPriority],
  ['debug:started', 2 as SignalPriority],
  ['debug:stopped', 2 as SignalPriority],
  ['dependency:installed', 1 as SignalPriority],
  ['dependency:removed', 1 as SignalPriority],
  ['pr:created', 1 as SignalPriority],
  ['pr:merged', 1 as SignalPriority],
  ['pr:reviewed', 1 as SignalPriority],
  ['review:requested', 1 as SignalPriority],
  ['review:submitted', 1 as SignalPriority],
  ['workspace:switched', 1 as SignalPriority],
  ['workspace:opened', 1 as SignalPriority],
  ['workspace:closed', 1 as SignalPriority],
  ['agent:attached', 3 as SignalPriority],
  ['agent:detached', 3 as SignalPriority],
  ['agent:message_sent', 2 as SignalPriority],
  ['agent:message_received', 2 as SignalPriority],
  ['session:started', 3 as SignalPriority],
  ['session:ended', 3 as SignalPriority],
  ['sleep:cycle', 2 as SignalPriority],
  ['consolidation:completed', 1 as SignalPriority],
  ['skill:distilled', 1 as SignalPriority],
  ['prediction:made', 1 as SignalPriority],
  ['prediction:failed', 2 as SignalPriority],
  ['memory:ingest', 1 as SignalPriority],
  ['memory:recall', 1 as SignalPriority],
  ['memory:consolidate', 2 as SignalPriority],
  ['module:message', 2 as SignalPriority],
  ['module:handoff', 2 as SignalPriority],
  ['cognitive:state_changed', 2 as SignalPriority],
  ['aether:started', 3 as SignalPriority],
  ['aether:stopped', 3 as SignalPriority],
  ['aether:tick', 2 as SignalPriority],
  ['connectome:link', 1 as SignalPriority],
  ['framework:selected', 2 as SignalPriority],
  ['framework:completed', 1 as SignalPriority],
  ['framework:error', 2 as SignalPriority],
]);

export const layerForPriority: Record<number, NervousSystemLayer> = {
  0: 'peripheral',
  1: 'spinal',
  2: 'brainstem',
  3: 'thalamus',
  4: 'cortex',
};

export const priorityForLayer: Record<string, SignalPriority> = {
  peripheral: 0 as SignalPriority,
  spinal: 1 as SignalPriority,
  brainstem: 2 as SignalPriority,
  thalamus: 3 as SignalPriority,
  cortex: 4 as SignalPriority,
};

let signalCounter = 0;

export interface CreateSignalOptions {
  target?: string | 'broadcast';
  energy?: number;
  causalParent?: string;
  interrupt?: boolean;
  interruptLevel?: InterruptLevel;
  information?: Partial<InformationMetrics>;
}

export function createSignal(
  type: EventType,
  source: string,
  payload: Record<string, unknown>,
  options?: CreateSignalOptions,
): Signal {
  const priority = signalPriorityForType.get(type) ?? (1 as SignalPriority);
  return Object.freeze({
    id: signalID(`sig-${Date.now()}-${++signalCounter}`),
    type,
    source: componentID(source),
    target: (options?.target ?? 'broadcast') as ComponentID | 'broadcast',
    payload: Object.freeze({ ...payload }),
    energy: energyUnit(options?.energy ?? 1),
    timestamp: timestamp(Date.now()),
    freshness: 30000,
    priority,
    causalParent: options?.causalParent ? signalID(options.causalParent) : undefined,
    layer: layerForPriority[priority]!,
    information: {
      entropy: entropy(options?.information?.entropy ?? computeDefaultEntropy(type)),
      novelty: novelty(options?.information?.novelty ?? 0.5),
      informationGain: options?.information?.informationGain ?? 0.5,
      predictionError: options?.information?.predictionError ?? 0,
    },
    interrupt: options?.interrupt ?? (priority >= 3),
    interruptLevel: options?.interruptLevel ?? (priority >= 3 ? priority as InterruptLevel : undefined),
  });
}

function computeDefaultEntropy(type: EventType): number {
  if (type.startsWith('file:') || type.startsWith('git:')) return 0.3;
  if (type.startsWith('test:') || type.startsWith('build:') || type.startsWith('ci:')) return 0.5;
  if (type.startsWith('session:') || type.startsWith('agent:')) return 0.9;
  if (type.startsWith('error:')) return 0.95;
  if (type.startsWith('memory:')) return 0.4;
  return 0.6;
}
