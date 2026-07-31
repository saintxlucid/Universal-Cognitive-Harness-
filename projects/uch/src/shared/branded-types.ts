declare const BRAND_SIGNAL_ID: unique symbol;
declare const BRAND_COMPONENT_ID: unique symbol;
declare const BRAND_ENERGY_UNIT: unique symbol;
declare const BRAND_ENTROPY: unique symbol;
declare const BRAND_NOVELTY: unique symbol;
declare const BRAND_CONFIDENCE: unique symbol;
declare const BRAND_TIMESTAMP: unique symbol;
declare const BRAND_LAW_ID: unique symbol;
declare const BRAND_CAPABILITY_ID: unique symbol;
declare const BRAND_SESSION_ID: unique symbol;
declare const BRAND_PRIORITY: unique symbol;
declare const BRAND_INTERRUPT_LEVEL: unique symbol;

export type SignalID = string & { readonly __signal: typeof BRAND_SIGNAL_ID };
export type ComponentID = string & { readonly __component: typeof BRAND_COMPONENT_ID };
export type EnergyUnit = number & { readonly __energy: typeof BRAND_ENERGY_UNIT };
export type Entropy = number & { readonly __entropy: typeof BRAND_ENTROPY };
export type Novelty = number & { readonly __novelty: typeof BRAND_NOVELTY };
export type Confidence = number & { readonly __confidence: typeof BRAND_CONFIDENCE };
export type Timestamp = number & { readonly __timestamp: typeof BRAND_TIMESTAMP };
export type LawID = `law:${number}` & { readonly __law: typeof BRAND_LAW_ID };
export type CapabilityID = string & { readonly __capability: typeof BRAND_CAPABILITY_ID };
export type SessionID = string & { readonly __session: typeof BRAND_SESSION_ID };
export type SignalPriority = 0 | 1 | 2 | 3 | 4 & { readonly __priority: typeof BRAND_PRIORITY };
export type InterruptLevel = 0 | 1 | 2 | 3 | 4 & { readonly __interrupt: typeof BRAND_INTERRUPT_LEVEL };

export function signalID(id: string): SignalID { return id as SignalID; }
export function componentID(id: string): ComponentID { return id as ComponentID; }
export function energyUnit(n: number): EnergyUnit { return n as EnergyUnit; }
export function entropy(n: number): Entropy { return n as Entropy; }
export function novelty(n: number): Novelty { return n as Novelty; }
export function confidence(n: number): Confidence { return n as Confidence; }
export function timestamp(n: number): Timestamp { return n as Timestamp; }
export function lawID(id: string): LawID { return id as LawID; }
export function capabilityID(id: string): CapabilityID { return id as CapabilityID; }
export function sessionID(id: string): SessionID { return id as SessionID; }

export interface InformationMetrics {
  readonly entropy: Entropy;
  readonly novelty: Novelty;
  readonly informationGain: number;
  readonly predictionError: number;
}

export interface MetabolicCost {
  readonly cpu: EnergyUnit;
  readonly memory: EnergyUnit;
  readonly tokens: number;
  readonly latency: number;
  readonly storage: EnergyUnit;
  readonly network: EnergyUnit;
}

export interface EconomicProposal {
  readonly operation: string;
  readonly cost: MetabolicCost;
  readonly expectedBenefit: Confidence;
  readonly confidence: Confidence;
  readonly risk: Confidence;
  readonly opportunityCost: string[];
  readonly roi: number;
  readonly deadline?: Timestamp;
}
