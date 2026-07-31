/**
 * Cognitive Accelerator Contract
 *
 * Accelerators are stateless internal firmware units (CA-01..CA-07).
 * They receive serializable input and return structured output.
 * They never touch the workspace: no filesystem, no tools, no git,
 * no terminal, no user interaction. See constitution law
 * 'Coprocessor Workspace Isolation'.
 */

export type AcceleratorKind =
  | 'semantic'
  | 'compression'
  | 'reasoning'
  | 'prediction'
  | 'memory'
  | 'ontology'
  | 'classification';

export interface AcceleratorRequest<I = Record<string, unknown>> {
  kind: AcceleratorKind;
  input: I;
  priority?: number;
  latencyTargetMs?: number;
  maxTokens?: number;
}

export interface AcceleratorResult<O = Record<string, unknown>> {
  kind: AcceleratorKind;
  output: O;
  confidence: number;
  provider: string;
  latencyMs: number;
  fallbackUsed: boolean;
  fired: boolean;
}

export type CapabilityTier = 'tiny' | 'standard' | 'deep';

/**
 * A model a provider can serve, tagged with its cognitive capability tier
 * (Level 4 — model virtualization). The kernel routes a request to the
 * cheapest healthy provider that can satisfy the required tier.
 */
export interface ProviderModel {
  tier: CapabilityTier;
  model: string;
  /** 0 = cheapest; used as the primary frugality sort key */
  costRank?: number;
}

export interface AcceleratorCompletionParams {
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** Per-call model override — the kernel's chosen virtual processor model */
  model?: string;
}

export interface InferenceProvider {
  id: string;
  label: string;
  isAvailable(): boolean;
  /** Optional model roster: tiers this provider can serve. Absent = standard tier only. */
  roster?: ProviderModel[];
  complete(params: AcceleratorCompletionParams): Promise<string>;
}

export type GatewayCompletion =
  | string
  | { text: string; providerId: string; latencyMs: number };

export interface ProviderGateway {
  isAvailable(): boolean;
  complete(params: AcceleratorCompletionParams): Promise<GatewayCompletion>;
}

export interface Accelerator<I = Record<string, unknown>, O = Record<string, unknown>> {
  kind: AcceleratorKind;
  execute(input: I, gateway: ProviderGateway, options?: {
    maxTokens?: number;
  }): Promise<O>;
  fallback(input: I): Promise<O>;
}
