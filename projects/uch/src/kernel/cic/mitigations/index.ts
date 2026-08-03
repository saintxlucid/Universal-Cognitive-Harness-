export { ThreatMitigationEngine } from './engine.js';
export { T01UnauthorizedMemoryAccessMitigation } from './t01.js';
export { T02CrossProjectContaminationMitigation } from './t02.js';
export { T03PrivilegeEscalationMitigation } from './t03.js';
export { T04ConsentBypassMitigation } from './t04.js';
export { T05DataExfiltrationMitigation } from './t05.js';
export { T06RunawayProcessMitigation } from './t06.js';
export { T07CascadingPolicyMitigation } from './t07.js';
export { T08ReplayAttackMitigation } from './t08.js';
export { T09ConsolidationPoisoningMitigation } from './t09.js';
export { T10RetentionPolicyMitigation } from './t10.js';
export { T11HardDeleteWithoutAuditMitigation } from './t11.js';
export { T12TimingSideChannelMitigation } from './t12.js';
export { T13TokenExhaustionMitigation } from './t13.js';
export { T14SessionHijackingMitigation } from './t14.js';
export type {
  MitigationResult,
  PolicyFailureRecord,
  ThreatID,
  ThreatMitigation,
  ThreatMitigationConfig,
  TokenExhaustionRecord,
} from './types.js';
