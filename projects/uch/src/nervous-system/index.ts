export { NervousSystem } from './nervous-system.js';
export type { NervousSystemConfig, LayerConfig } from './nervous-system.js';
export {
  createSignal,
  signalPriorityForType,
  layerForPriority,
  priorityForLayer,
} from './signal.js';
export type {
  Signal,
  SignalHandler,
  SignalFilter,
  NervousSystemLayer,
  SignalPriority,
} from './signal.js';
