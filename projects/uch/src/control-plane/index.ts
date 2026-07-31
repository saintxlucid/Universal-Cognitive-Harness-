export { Lifecycle } from './lifecycle.js';
export type { ServiceDefinition, ServiceStatus } from './lifecycle.js';
export { PolicyEngine } from './policies.js';
export type { PolicyRule, PolicyEffect } from './policies.js';
export { EventGovernance } from './event-governance.js';
export type {
  ProvenanceLink,
  GovernedEvent,
  GovernEventInput,
  GovernanceDecision,
  GovernanceRecord,
  EventGovernanceOptions,
} from './event-governance.js';
export { ProjectionEngine, projectScope, SCOPE_LEVELS } from './projections.js';
export type {
  WorkspaceState,
  WorkspaceProjection,
  ScopeProjection,
  CapabilityProjection,
  ScopeLevel,
  ProjectionEngineOptions,
} from './projections.js';
export { Auth } from './auth/auth.js';
export type { AuthConfig, AgentIdentity, AuthToken } from './auth/auth.js';
export { SecretsStore } from './secrets/secrets-store.js';
export type { SecretEntry } from './secrets/secrets-store.js';
export { BudgetTracker } from './budgets/budgets.js';
export type { BudgetConfig, BudgetState, BudgetCheckResult, UsageRecord } from './budgets/budgets.js';
export { OTLPExporter } from './telemetry/otlp-exporter.js';
export type { OTLPExporterConfig } from './telemetry/otlp-exporter.js';
export { MCPTransport } from '../cognitive-runtime/mcp-transport.js';
export { MCPSSETransport } from './transport/mcp-sse.js';
export { CapabilityRegistry } from '../cognitive-runtime/capability-registry.js';
export type {
  Capability,
  CapabilityScope,
  CapabilityCost,
  CapabilityRetention,
  CapabilityDependencyCheck,
  GrantOperation,
} from '../cognitive-runtime/capability-registry.js';
export { GrantEngine, GRANT_SCHEMA_VERSION } from '../cognitive-runtime/grants.js';
export type {
  GrantActor,
  ActorType,
  GrantConstraints,
  IssueGrantRequest,
  CapabilityGrant,
  AuthorizationDecision,
} from '../cognitive-runtime/grants.js';
export { ConfigLoader } from './config/config-loader.js';
export type { UCCPConfig } from './config/config-loader.js';
export { PluginLoader } from './plugins/plugin-loader.js';
export type { PluginManifest, PluginAPI, PluginHook } from './plugins/plugin-loader.js';
