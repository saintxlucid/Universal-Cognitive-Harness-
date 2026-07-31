export { EpistemicImmuneSystem } from './epistemic-immune.js';
export type {
  GateVerdict,
  InboundSignal,
  GateResult,
  QuarantineEntry,
  ImmuneGateConfig,
} from './epistemic-immune.js';

export { EpistemicElevationEngine } from './elevation-engine.js';
export type {
  MemoryTier,
  MemoryObject,
  ElevationConfig,
  PromotionAttempt,
} from './elevation-engine.js';

export {
  createInquiryContract,
  validateInquiryContract,
  isInquiryEligible,
} from './inquiry-contract.js';
export type {
  InquiryContract,
  InquiryDesign,
  InquiryContractValidation,
} from './inquiry-contract.js';
