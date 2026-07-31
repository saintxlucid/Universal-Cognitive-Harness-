import type { UniversalCognitiveState } from './cognitive-wearable.js';

export interface CognitiveLifecycleEvent {
  kind: 'wear' | 'sync' | 'learn' | 'sleep' | 'unwear';
  runtime: string;
  timestamp: string;
  summary: string;
  stateVersion: number;
}

export interface CognitiveContinuityLedger {
  organismId: string;
  genomeVersion: number;
  createdAt: string;
  updatedAt: string;
  activeRuntime: string | null;
  wearCount: number;
  currentState: UniversalCognitiveState;
  history: CognitiveLifecycleEvent[];
}

export interface CognitiveAugmentationOptions {
  focus?: string;
  includePolicies?: boolean;
}

export interface CognitiveAugmentationResult {
  request: string;
  injectedContext: string[];
  summary: string;
  state: UniversalCognitiveState;
}
