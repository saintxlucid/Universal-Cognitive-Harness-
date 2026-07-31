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

export class CognitiveWearableHarnessAdapter implements HarnessAdapter {
  readonly runtime: string;
  private readonly syncTarget: CognitiveStateSyncTarget;

  constructor(runtime: string, syncTarget: CognitiveStateSyncTarget) {
    this.runtime = runtime;
    this.syncTarget = syncTarget;
  }

  sync(state: UniversalCognitiveState) {
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
}
