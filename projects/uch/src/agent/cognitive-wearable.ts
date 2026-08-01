import type { CognitiveLifecycleEvent } from './cognitive-continuity.js';

export interface UniversalCognitiveState {
  runtime: string;
  objective: string;
  hypotheses: string[];
  evidence: string[];
  toolCalls: string[];
  decisions: string[];
  confidence: number;
  stateVersion: number;
  updatedAt: string;
}

export interface CognitiveStateSyncTarget {
  syncCognitiveState(
    runtime: string,
    update: Partial<UniversalCognitiveState>,
  ): UniversalCognitiveState;
  getCognitiveStateSnapshot(runtime: string): UniversalCognitiveState;
  wear(runtime: string, objective?: string): CognitiveLifecycleEvent;
  syncLifecycle(
    runtime: string,
    update: Partial<UniversalCognitiveState>,
  ): CognitiveLifecycleEvent;
  learnFromWearable(runtime: string, summary: string): CognitiveLifecycleEvent;
  sleepWearable(runtime: string): CognitiveLifecycleEvent;
}

export interface HarnessAdapter {
  readonly runtime: string;
  sync(state: UniversalCognitiveState): {
    event: {
      kind: 'state-sync';
      runtime: string;
      timestamp: string;
      summary: string;
    };
    state: UniversalCognitiveState;
  };
}

export interface WearableLifecycleResult {
  event: CognitiveLifecycleEvent;
  state: UniversalCognitiveState;
}

export class CognitiveWearableHarnessAdapter implements HarnessAdapter {
  readonly runtime: string;
  private readonly syncTarget: CognitiveStateSyncTarget;

  constructor(runtime: string, syncTarget: CognitiveStateSyncTarget) {
    this.runtime = runtime;
    this.syncTarget = syncTarget;
  }

  sync(state: UniversalCognitiveState): {
    event: {
      kind: 'state-sync';
      runtime: string;
      timestamp: string;
      summary: string;
    };
    state: UniversalCognitiveState;
  } {
    const syncedState = this.syncTarget.syncCognitiveState(this.runtime, state);
    return {
      event: {
        kind: 'state-sync',
        runtime: this.runtime,
        timestamp: new Date().toISOString(),
        summary: `Synced ${this.runtime} with objective: ${syncedState.objective}`,
      },
      state: syncedState,
    };
  }

  wear(objective?: string): WearableLifecycleResult {
    const event = this.syncTarget.wear(this.runtime, objective);
    return {
      event,
      state: this.syncTarget.getCognitiveStateSnapshot(this.runtime),
    };
  }

  syncLifecycle(update: Partial<UniversalCognitiveState>): WearableLifecycleResult {
    const event = this.syncTarget.syncLifecycle(this.runtime, update);
    return {
      event,
      state: this.syncTarget.getCognitiveStateSnapshot(this.runtime),
    };
  }

  learn(summary: string): WearableLifecycleResult {
    const event = this.syncTarget.learnFromWearable(this.runtime, summary);
    return {
      event,
      state: this.syncTarget.getCognitiveStateSnapshot(this.runtime),
    };
  }

  sleep(): WearableLifecycleResult {
    const event = this.syncTarget.sleepWearable(this.runtime);
    return {
      event,
      state: this.syncTarget.getCognitiveStateSnapshot(this.runtime),
    };
  }
}
