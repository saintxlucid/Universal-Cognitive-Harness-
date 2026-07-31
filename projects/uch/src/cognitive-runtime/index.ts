export { UniversalCognitiveHarness } from '../harness-api/universal-harness.js';
export type { UCHConfig, UCHStatus } from '../harness-api/universal-harness.js';
export { BiologicalFunctions } from '../harness-api/biological-functions.js';
export { StateVirtualization } from '../state-virtualization/state-virtualization.js';
export { CapabilityRegistry } from './capability-registry.js';
export type {
  Capability,
  CapabilityScope,
  CapabilityCost,
  CapabilityRetention,
  CapabilityDependencyCheck,
  GrantOperation,
} from './capability-registry.js';
export { GrantEngine, GRANT_SCHEMA_VERSION } from './grants.js';
export type {
  GrantActor,
  ActorType,
  GrantConstraints,
  IssueGrantRequest,
  CapabilityGrant,
  AuthorizationDecision,
} from './grants.js';
export { MCPTransport } from './mcp-transport.js';
