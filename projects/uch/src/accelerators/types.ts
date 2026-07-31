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

export interface AcceleratorCompletionParams {
  system?: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
}

export interface InferenceProvider {
  id: string;
  label: string;
  isAvailable(): boolean;
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
