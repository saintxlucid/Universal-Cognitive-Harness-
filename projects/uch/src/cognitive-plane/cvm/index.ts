export { CognitiveExecutionGraph, CognitiveVM } from './cognitive-vm.js';
export type { CVMExecutionInput, CVMGraphSnapshot, CVMNode, CVMNodeState } from './cognitive-vm.js';
export {
  CVMDecodeError,
  COGNITIVE_OPS,
  DELEGATED_OPS,
  DETERMINISTIC_OPS,
  PAYLOAD_REQUIRED_OPS,
  PERCEPTUAL_OPS,
  VALID_VERIFY,
  classifyOp,
  decodeProgram,
  isDelegatedOp,
  isDeterministicOp,
} from './bytecode.js';
export type { CVMInstructionClass, DecodedInstruction, DecodedProgram } from './bytecode.js';
export { certificateLine, certifyDevice, hasCapability } from './device.js';
export type { DeviceCertification, DeviceTier, ModelDevice } from './device.js';
export { CvmMachine } from './machine.js';
export type {
  CvmExecuteOptions,
  CvmExecutionResult,
  CvmMachineOptions,
  CvmReplayReport,
  CvmTraceEntry,
} from './machine.js';
